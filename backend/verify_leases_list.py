import json
import requests

BASE_URL = "http://localhost:8000"

def test_list_leases():
    # Login
    print("Logging in...")
    resp = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": "landlord-test@example.com", "password": "password123"},
    )
    if resp.status_code != 200:
        print("Login failed:", resp.text)
        return

    token = resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    # List Leases
    print("Fetching leases...")
    resp = requests.get(f"{BASE_URL}/leases/", headers=headers)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        leases = resp.json()
        print(f"Success! Found {len(leases)} leases.")
        if leases:
            print("First lease sample:")
            print(json.dumps(leases[0], indent=2))
    else:
        print(f"Failed! Response: {resp.text}")

if __name__ == "__main__":
    test_list_leases()
