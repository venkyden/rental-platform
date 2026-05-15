import asyncio
import os
import sys
import uuid
from sqlalchemy import select

# Add parent directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(current_dir))

from app.core.database import AsyncSessionLocal
from app.models.document import DocumentExtraction
from app.models.user import User  # Required for relationship resolution
from app.services.employment import employment_service

async def test_persistent_cache():
    print("🧪 Testing Persistent OCR Cache...")

    # Generate random content to ensure fresh hash
    content = f"test_payslip_content_{uuid.uuid4()}".encode("utf-8")
    file_type = "text/plain"

    # 1. First Call: Should execute extraction (Gemini AI or Mock) and Save to DB
    print("1️⃣  First Call (Cache Miss)...")
    # Note: verify_payslip now manages its own session internally
    result1 = await employment_service.verify_payslip(
        file_content=content, file_type=file_type, expected_name="Test User"
    )
    print(f"   Result status: {result1['status']}")

    file_hash = employment_service._get_file_hash(content)
    
    async with AsyncSessionLocal() as db:
        # Verify DB Record exists
        stmt = select(DocumentExtraction).where(
            DocumentExtraction.file_hash == file_hash
        )
        db_res = await db.execute(stmt)
        record = db_res.scalar_one_or_none()

        if record:
            print("   ✅ DB Record Created.")
        else:
            print("   ❌ DB Record NOT Found! (AI extraction might have failed or not returned data)")
            return

        # 2. Second Call: Should fetch from DB
        print("2️⃣  Second Call (DB Cache Hit)...")
        # If cached, it shouldn't call AI (monitored via logs if running manually)
        result2 = await employment_service.verify_payslip(
            file_content=content, file_type=file_type, expected_name="Test User"
        )
        print(f"   Result status: {result2['status']}")

        # Simplified comparison of data (Decimal to float issues handled in service)
        if result2['status'] == result1['status'] and result2['data']['net_salary'] == result1['data']['net_salary']:
            print("   ✅ Results Match.")
        else:
            print("   ❌ Results Do Not Match.")

        # Cleanup
        await db.delete(record)
        await db.commit()
        print("🧹 Cleanup Done.")

if __name__ == "__main__":
    asyncio.run(test_persistent_cache())
