import sys

import requests

BASE_URL = "http://localhost:8000"


def get_token(username, password):
    response = requests.post(
        f"{BASE_URL}/auth/login", data={"username": username, "password": password}
    )
    if response.status_code != 200:
        print(f"Login failed for {username}: {response.text}")
        return None
    return response.json()["access_token"]


def check_config(segment, username, password, expected_flow):
    print(f"\n🔍 Checking {segment} ({username})...")
    token = get_token(username, password)
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/auth/me/segment-config", headers=headers)

    if response.status_code != 200:
        print(f"❌ Failed to get config: {response.text}")
        return

    config = response.json()
    settings = config.get("settings", {})
    flow = settings.get("verification_flow")

    print(f"   Verification Flow: {flow}")

    if flow == expected_flow:
        print(f"✅ SUCCESS: {segment} has correct flow '{expected_flow}'")
    else:
        print(f"❌ FAILURE: Expected '{expected_flow}', got '{flow}'")


def main():
    # D1 Tenant (Student) -> Guarantor
    check_config("D1", "d1_tenant@example.com", "Password123!", "guarantor")

    # D3 Tenant (Flex) -> Identity
    check_config("D3", "d3_tenant@example.com", "Password123!", "identity")

    # S3 Agency -> Enterprise Mode (check analytics/white_label)
    print(f"\n🔍 Checking S3 (s3_agency@example.com)...")
    token = get_token("s3_agency@example.com", "Password123!")
    if token:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/auth/me/segment-config", headers=headers)
        config = resp.json()
        settings = config.get("settings", {})
        feats = config.get("all_features", [])

        if settings.get("enterprise_mode") is True:
            print("✅ S3 Enterprise Mode: ON")
        else:
            print("❌ S3 Enterprise Mode: OFF")

        if "white_label" in feats:
            print("✅ S3 has White Label feature")
        else:
            print("❌ S3 MISSING White Label feature")


if __name__ == "__main__":
    main()
