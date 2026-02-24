import concurrent.futures
import json
import os
import time
from datetime import datetime

import requests

BASE = "http://localhost:8001"
TEST_EMAIL = "verify_test_landlord@test.com"
TEST_PASS = "TestPass123!"

# Setup dummy file
with open("test_upload.jpg", "wb") as f:
    f.write(b"fake image content for testing")


def print_header(title):
    print(f"\n{'='*60}\n{title}\n{'='*60}")


def run_smoke_test():
    print_header("1. SMOKE TEXT")
    try:
        r = requests.get(f"{BASE}/docs")
        if r.status_code == 200:
            print("✅ Backend is UP (Docs accessible)")
        else:
            print(f"❌ Backend returned {r.status_code}")
            return False
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
        return False
    return True


def get_auth_token():
    print_header("2. AUTHENTICATION (Functional)")
    # Register or Login
    try:
        r = requests.post(
            f"{BASE}/auth/register",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASS,
                "full_name": "Verify Tester",
                "role": "landlord",
            },
        )
        if r.status_code == 201:
            token = r.json().get("access_token")
            if not token:
                print(f"❌ Register success but no token in response: {r.text}")
                return None
            print("✅ User Registered")
            return token
        elif "already registered" in r.text or r.status_code == 400:
            print("   User exists, logging in...")
            # Note: OAuth2RequestForm expects 'username' and 'password' as form data
            r = requests.post(
                f"{BASE}/auth/login",
                data={"username": TEST_EMAIL, "password": TEST_PASS},
            )
            if r.status_code == 200:
                print("✅ User Logged In")
                token = r.json().get("access_token")
                if not token:
                    print(f"❌ Login success but no token: {r.text}")
                return token
            else:
                print(f"❌ Login Failed: {r.status_code} {r.text}")
        else:
            print(f"❌ Register Failed: {r.status_code} {r.text}")
    except Exception as e:
        print(f"❌ Auth Failed: {e}")
    print("❌ Failed to get token")
    return None


def test_verification_flow(token):
    print_header("3. VERIFICATION FLOW (Integration & Security)")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Property
    prop_data = {
        "title": "Test Property",
        "description": "Desc",
        "property_type": "apartment",
        "address_line1": "123 Test St",
        "city": "Paris",
        "postal_code": "75001",
        "country": "France",
        "bedrooms": 1,
        "bathrooms": 1,
        "size_sqm": 50,
        "monthly_rent": 1000,
        "furnished": True,
        "status": "draft",
        "amenities": [],
        "custom_amenities": [],
        "public_transport": [],
        "nearby_landmarks": [],
    }

    r = requests.post(f"{BASE}/properties", json=prop_data, headers=headers)
    if r.status_code not in [200, 201]:
        print(f"❌ Create Property Failed: {r.text}")
        return None

    prop_id = r.json()["id"]
    print(f"✅ Property Created: {prop_id}")

    # 2. Create Verification Session
    # Fix: URL is singular /media-session based on router code
    r = requests.post(
        f"{BASE}/properties/{prop_id}/media-session",
        headers=headers,
        params={"gps_radius": 500, "expires_in_hours": 24},
    )
    if r.status_code != 200:
        print(f"❌ Create Session Failed: {r.text}")
        return None

    session_data = r.json()
    verification_code = session_data["verification_code"]
    print(f"✅ Session Created. Code: {verification_code}")

    # 3. Public Context Check (Delegated Verification)
    r = requests.get(f"{BASE}/properties/media-sessions/{verification_code}")
    if r.status_code == 200:
        print("✅ Public Session Details Access Works")
    else:
        print(f"❌ Public Session Access Failed: {r.status_code}")

    return prop_id, verification_code


def test_tenant_perspective():
    print_header("6. TENANT PERSPECTIVE (Search)")
    # Anonymous Search
    r = requests.get(f"{BASE}/properties")
    if r.status_code == 200:
        props = r.json()
        print(f"✅ Anonymous Search Works. Found {len(props)} properties.")
        # Check if our draft property is hidden (if implementing logic correctly)
        # But for now just checking API availability
    else:
        print(f"❌ Anonymous Search Failed: {r.status_code}")


def stress_test_upload(verification_code, num_requests=20):
    print_header(f"4. LOAD/STRESS TEST ({num_requests} Concurrent Uploads)")

    url = f"{BASE}/properties/media/upload"

    def single_upload(i):
        metadata = json.dumps(
            {
                "captured_at": datetime.utcnow().isoformat(),
                "latitude": 48.8566,
                "longitude": 2.3522,
                "gps_accuracy": 10,
                "media_type": "photo",
                "device_id": "test_script",
                "watermark_address": "Test Address",
            }
        )

        files = {"file": ("test.jpg", open("test_upload.jpg", "rb"), "image/jpeg")}
        # Note: In stress test loop, we need to re-open file or seek 0?
        # But 'files' is consumed?
        # Better to open inside the try or use bytes.

        try:
            # Re-open file for each generic request simulated
            files_fresh = {
                "file": ("test.jpg", open("test_upload.jpg", "rb"), "image/jpeg")
            }
            r = requests.post(
                url,
                params={"verification_code": verification_code, "metadata": metadata},
                files=files_fresh,
            )
            return r.status_code
        except Exception as e:
            return str(e)

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(single_upload, i) for i in range(num_requests)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    success = results.count(200)
    print(f"Results: {results}")
    print(f"✅ Success Rate: {success}/{num_requests}")
    if success == num_requests:
        print("✅ STRESS TEST PASSED")
    else:
        print("⚠️ STRESS TEST PARTIAL/FAILED")


def test_security_access(prop_id, token):
    print_header("5. SECURITY TEST (Access Control)")
    # Try to access as anonymous
    r = requests.get(f"{BASE}/properties/{prop_id}")
    if r.status_code == 401:
        print("✅ Anonymous Access Blocked (401)")
    else:
        print(f"❌ Security Hole? Anonymous got {r.status_code}")

    # Try upload with invalid code
    files = {"file": ("test.jpg", open("test_upload.jpg", "rb"), "image/jpeg")}
    valid_meta = json.dumps(
        {
            "captured_at": datetime.utcnow().isoformat(),
            "latitude": 48.8566,
            "longitude": 2.3522,
            "media_type": "photo",
            "watermark_address": "Test",
        }
    )
    r = requests.post(
        f"{BASE}/properties/media/upload",
        params={"verification_code": "INVALID_CODE", "metadata": valid_meta},
        files=files,
    )
    if r.status_code in [
        400,
        403,
        404,
    ]:  # Assuming 400 'Session invalid' or 404 'Session not found'
        print(f"✅ Invalid Code Blocked ({r.status_code})")
    else:
        print(f"❌ Invalid Code Accepted? ({r.status_code})")


if __name__ == "__main__":
    if run_smoke_test():
        token = get_auth_token()
        if token:
            res = test_verification_flow(token)
            if res:
                prop_id, code = res
                test_security_access(prop_id, token)
                stress_test_upload(code)
                test_tenant_perspective()

    # Cleanup
    if os.path.exists("test_upload.jpg"):
        os.remove("test_upload.jpg")
