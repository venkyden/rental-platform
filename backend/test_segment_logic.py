import os
import sys

# Add parent directory to path
sys.path.append(os.getcwd())

from app.routers.onboarding import detect_segment


def test_logic():
    scenarios = [
        # Tenants
        ({"user_type": "tenant", "situation": "student_budget"}, "D1"),
        ({"user_type": "tenant", "situation": "family_stability"}, "D2"),
        ({"user_type": "tenant", "situation": "flexibility_relocation"}, "D3"),
        # Legacy/Fallback Tenants
        ({"user_type": "tenant", "situation": "i am a student"}, "D1"),
        (
            {"user_type": "tenant", "situation": "looking for stability for my family"},
            "D2",
        ),
        ({"user_type": "tenant", "situation": "digital nomad remote work"}, "D3"),
        # Landlords
        ({"user_type": "landlord", "property_count": "1-4"}, "S1"),
        ({"user_type": "landlord", "property_count": "5-100"}, "S2"),
        ({"user_type": "landlord", "property_count": "100+"}, "S3"),
        ({"user_type": "landlord", "property_count": 2}, "S1"),
        ({"user_type": "landlord", "property_count": 50}, "S2"),
        ({"user_type": "landlord", "property_count": 150}, "S3"),
    ]

    print("🧪 Testing Segment Detection Logic...")
    failed = 0
    for inputs, expected in scenarios:
        result = detect_segment(inputs)
        if result == expected:
            print(f"✅ Pass: {inputs} -> {result}")
        else:
            print(f"❌ Fail: {inputs} -> Got {result}, Expected {expected}")
            failed += 1

    if failed == 0:
        print("\n🎉 All tests passed!")
    else:
        print(f"\n⚠️ {failed} tests failed.")


if __name__ == "__main__":
    test_logic()
