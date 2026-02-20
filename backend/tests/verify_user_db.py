
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, '/Users/venkat/.gemini/antigravity/scratch/rental-platform/backend')

from app.core.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select, update

TEST_EMAIL = "verify_test_landlord@test.com"

async def verify_user():
    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.email == TEST_EMAIL)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if user:
            print(f"Found user {user.email}. Verified: {user.identity_verified}")
            if not user.identity_verified:
                print("Verifying user identity...")
                stmt = update(User).where(User.email == TEST_EMAIL).values(identity_verified=True)
                await db.execute(stmt)
                await db.commit()
                print("✅ User verified.")
            else:
                print("User already verified.")
        else:
            print("❌ User not found.")

if __name__ == "__main__":
    asyncio.run(verify_user())
