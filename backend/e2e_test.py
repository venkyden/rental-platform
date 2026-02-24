#!/usr/bin/env python3
"""End-to-end validation script for Rental Platform features"""

import json

import requests

BASE = "http://localhost:8000"

print("=" * 60)
print("RENTAL PLATFORM - END-TO-END VALIDATION")
print("=" * 60)

results = []

# 1. Health check
print("\n1. HEALTH CHECK")
try:
    r = requests.get(f"{BASE}/health", timeout=5)
    print(f"   Status: {r.status_code}")
    print(f"   Result: {r.json()['status']}")
    results.append(("Health", True))
except Exception as e:
    print(f"   ❌ Failed: {e}")
    results.append(("Health", False))

# 2. Register/Login
print("\n2. USER AUTHENTICATION")
user_data = {
    "email": "e2e-landlord2@test.com",
    "password": "TestPass123!",
    "full_name": "E2E Test Landlord",
    "role": "landlord",
}
try:
    r = requests.post(f"{BASE}/auth/register", json=user_data)
    if r.status_code == 201:
        print("   ✅ User registered")
        token = r.json()["access_token"]
    elif "already registered" in r.text.lower():
        print("   User exists, logging in...")
        r = requests.post(
            f"{BASE}/auth/login",
            data={"username": user_data["email"], "password": user_data["password"]},
        )
        token = r.json()["access_token"]
    else:
        print(f"   Error: {r.text[:100]}")
        token = None

    if token:
        headers = {"Authorization": f"Bearer {token}"}
        print("   ✅ Token obtained")
        results.append(("Auth", True))
    else:
        results.append(("Auth", False))
        headers = {}
except Exception as e:
    print(f"   ❌ Failed: {e}")
    results.append(("Auth", False))
    headers = {}

if not headers:
    print("\n❌ Cannot continue without authentication")
    exit(1)

# 3. User Profile
print("\n3. USER PROFILE")
try:
    r = requests.get(f"{BASE}/auth/me", headers=headers)
    user = r.json()
    print(f"   Name: {user.get('full_name')}")
    print(f"   Role: {user.get('role')}")
    results.append(("Profile", True))
except Exception as e:
    print(f"   ❌ Failed: {e}")
    results.append(("Profile", False))

# 4. Properties
print("\n4. PROPERTIES")
try:
    r = requests.get(f"{BASE}/properties", headers=headers)
    props = r.json()
    print(f"   Count: {len(props)}")
    results.append(("Properties", True))
except Exception as e:
    print(f"   ❌ Failed: {e}")
    results.append(("Properties", False))

# 5. GLI Quote
print("\n5. GLI QUOTE")
gli_data = {
    "monthly_rent": 1500,
    "tenant_monthly_income": 5000,
    "tenant_employment_type": "cdi",
    "tenant_employment_verified": True,
    "tenant_identity_verified": True,
}
try:
    r = requests.post(f"{BASE}/verification/gli/quote", headers=headers, json=gli_data)
    if r.status_code == 200:
        quote = r.json()
        print(f"   Eligible: {quote.get('eligible')}")
        print(f"   Premium: {quote.get('monthly_premium')}€/month")
        print(f"   Coverage: {quote.get('coverage_amount')}€")
        results.append(("GLI", True))
    else:
        print(f"   ❌ Status: {r.status_code}")
        results.append(("GLI", False))
except Exception as e:
    print(f"   ❌ Failed: {e}")
    results.append(("GLI", False))

# 6. Bulk Export
print("\n6. BULK EXPORT")
try:
    r = requests.get(f"{BASE}/bulk/properties/export?format=csv", headers=headers)
    if r.status_code == 200:
        lines = r.text.strip().split("\n")
        print(f"   Lines: {len(lines)}")
        print(f"   Header: {lines[0][:50]}...")
        results.append(("Bulk Export", True))
    else:
        print(f"   ❌ Status: {r.status_code}")
        results.append(("Bulk Export", False))
except Exception as e:
    print(f"   ❌ Failed: {e}")
    results.append(("Bulk Export", False))

# 7. Webhooks
print("\n7. WEBHOOKS")
try:
    r = requests.get(f"{BASE}/webhooks/subscriptions/events")
    events = r.json()
    print(f"   Events: {len(events.get('events', []))}")
    results.append(("Webhooks", True))
except Exception as e:
    print(f"   ❌ Failed: {e}")
    results.append(("Webhooks", False))

# 8. Team
print("\n8. TEAM MANAGEMENT")
try:
    r = requests.get(f"{BASE}/team/members", headers=headers)
    if r.status_code == 200:
        print(f"   Members: {len(r.json())}")
        results.append(("Team", True))
    else:
        print(f"   ❌ Status: {r.status_code}")
        results.append(("Team", False))
except Exception as e:
    print(f"   ❌ Failed: {e}")
    results.append(("Team", False))

# 9. Inbox
print("\n9. UNIFIED INBOX")
try:
    r = requests.get(f"{BASE}/inbox", headers=headers)
    if r.status_code == 200:
        print(f"   Conversations: {len(r.json())}")
        results.append(("Inbox", True))
    else:
        print(f"   ❌ Status: {r.status_code}")
        results.append(("Inbox", False))
except Exception as e:
    print(f"   ❌ Failed: {e}")
    results.append(("Inbox", False))

# Summary
print("\n" + "=" * 60)
print("VALIDATION SUMMARY")
print("=" * 60)
passed = sum(1 for r in results if r[1])
total = len(results)
for name, status in results:
    icon = "✅" if status else "❌"
    print(f"   {icon} {name}")
print(f"\nResult: {passed}/{total} tests passed")
if passed == total:
    print("🎉 ALL FEATURES WORKING!")
else:
    print("⚠️ Some features need attention")
