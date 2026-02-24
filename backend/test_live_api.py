import requests
import json
import uuid

BASE_URL = "https://roomivo-backend-0jyi.onrender.com"
TEST_EMAIL = f"test_landlord_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "TestPassword123!"

print(f"Testing against: {BASE_URL}")

# 1. Health check
print("\n--- 1. Testing Health Endpoint ---")
r = requests.get(f"{BASE_URL}/health")
print(f"Status: {r.status_code}")
print(r.json())

# 2. Register
print("\n--- 2. Registering Test Landlord ---")
reg_payload = {
    "email": TEST_EMAIL,
    "password": TEST_PASSWORD,
    "full_name": "Test Landlord API",
    "role": "landlord",
    "marketing_consent": False
}
r = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
print(f"Status: {r.status_code}")
print(r.json())
assert r.status_code == 201

# 3. Login
print("\n--- 3. Logging In ---")
login_data = {"username": TEST_EMAIL, "password": TEST_PASSWORD}
r = requests.post(f"{BASE_URL}/auth/login", data=login_data)
print(f"Status: {r.status_code}")
print(r.json())
assert r.status_code == 200
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 4. Create Property
print("\n--- 4. Creating a Property ---")
prop_payload = {
    "title": "API Test Property Paris",
    "description": "A beautiful test apartment in Paris.",
    "property_type": "apartment",
    "address_line1": "10 Rue de la Paix",
    "city": "Paris",
    "postal_code": "75002",
    "country": "France",
    "latitude": 48.868,
    "longitude": 2.331,
    "monthly_rent": 1500,
    "charges": 100,
    "charges_included": False,
    "security_deposit": 1500,
    "bedrooms": 2,
    "bathrooms": 1,
    "area_sqm": 65.5,
    "furnished": True,
    "amenities": ["wifi", "kitchen", "elevator"],
    "status": "draft"
}
r = requests.post(f"{BASE_URL}/properties", json=prop_payload, headers=headers)
print(f"Status: {r.status_code}")
print(r.json())
assert r.status_code == 201
property_id = r.json()["id"]

# 5. List Properties (Drafts)
print("\n--- 5. Listing My Draft Properties ---")
r = requests.get(f"{BASE_URL}/properties?status=draft", headers=headers)
print(f"Status: {r.status_code}")
print(f"Count: {len(r.json())}")
assert len(r.json()) > 0
assert r.json()[0]["id"] == property_id

print("\n✅ ALL TESTS PASSED! Production API is fully functional.")
