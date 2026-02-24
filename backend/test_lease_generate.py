import json
import sys

import requests

# Login
resp = requests.post(
    "http://localhost:8000/auth/login",
    data={"username": "landlord-test@example.com", "password": "password123"},
)
if resp.status_code != 200:
    print("Login failed:", resp.text)
    sys.exit(1)
token = resp.json().get("access_token")

# Get applications
headers = {"Authorization": f"Bearer {token}"}
resp = requests.get("http://localhost:8000/applications/received", headers=headers)
apps = resp.json()
if not apps:
    print("No applications found")
    sys.exit(1)
app_id = apps[0]["id"]

# Generate Lease
payload = {
    "application_id": app_id,
    "start_date": "2026-03-01",
    "rent_override": 1000.0,
    "charges_override": 50.0,
    "deposit_override": 1000.0,
    "lease_type": "meuble",
    "duration_months": 12,
    "landlord_signature": "data:image/png;base64,iVBORw0K",
}
resp = requests.post(
    "http://localhost:8000/leases/generate", headers=headers, json=payload
)
print(resp.status_code)
print(json.dumps(resp.json(), indent=2))
