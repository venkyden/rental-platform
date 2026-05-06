import sys
import os
import asyncio
from decimal import Decimal

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.utils.watermark import apply_watermark
from app.services.identity import identity_service
from app.services.employment import employment_service

async def test_watermark():
    print("Testing watermark...")
    # Create a dummy image content
    dummy_content = b"fake image content"
    # apply_watermark should catch the error and return original content if PIL fails on fake data
    result = apply_watermark(dummy_content)
    assert result == dummy_content
    print("✅ Watermark fallback works for invalid image data.")

async def test_identity_critical_match():
    print("Testing identity critical name match...")
    from app.services.identity import IdentityData
    
    # Mock data
    data = IdentityData(
        is_identity_document=True,
        full_name="John Doe",
        document_number="ABC123",
        expiry_date="2030-01-01",
        document_type="passport",
        has_face_photo=True,
        confidence_score=0.9
    )
    
    # Test mismatch
    checks = identity_service._validate_identity_data(data, "Jane Smith", "passport")
    name_check = next(c for c in checks if c["name"] == "name_match")
    print(f"Name match passed: {name_check['passed']}, Critical: {name_check['critical']}")
    assert name_check["passed"] == False
    assert name_check["critical"] == True
    print("✅ Identity critical name match verified.")

async def main():
    await test_watermark()
    await test_identity_critical_match()

if __name__ == "__main__":
    asyncio.run(main())
