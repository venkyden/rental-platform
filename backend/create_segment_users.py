import asyncio
import os
import sys

# Add parent directory to path so we can import app modules
sys.path.append(os.getcwd())

from sqlalchemy import select

from app.core.database import AsyncSessionLocal as async_session_factory
from app.core.security import get_password_hash
from app.models.user import User, UserRole, VerificationStatus

SEGMENT_USERS = [
    # Demand Side (Tenants)
    {
        "email": "d1_tenant@example.com",
        "password": "Password123!",
        "full_name": "Alice Newrenter (D1)",
        "role": UserRole.TENANT,
        "segment": "D1",
        "description": "First-time renter",
        "identity_verified": False,
        "onboarding_completed": False,
    },
    {
        "email": "d2_tenant@example.com",
        "password": "Password123!",
        "full_name": "Bob Experienced (D2)",
        "role": UserRole.TENANT,
        "segment": "D2",
        "description": "Experienced renter",
        "identity_verified": True,
        "onboarding_completed": True,
    },
    {
        "email": "d3_tenant@example.com",
        "password": "Password123!",
        "full_name": "Charlie Pro (D3)",
        "role": UserRole.TENANT,
        "segment": "D3",
        "description": "Relocating Professional",
        "identity_verified": True,
        "onboarding_completed": True,
    },
    # Supply Side (Landlords)
    {
        "email": "s1_landlord@example.com",
        "password": "Password123!",
        "full_name": "David Owner (S1)",
        "role": UserRole.LANDLORD,
        "segment": "S1",  # Updated to uppercase S1 as per previous config
        "description": "First-time Landlord",
        "identity_verified": False,
        "onboarding_completed": False,
    },
    {
        "email": "s2_landlord@example.com",
        "password": "Password123!",
        "full_name": "Eve Investor (S2)",
        "role": UserRole.LANDLORD,
        "segment": "S2",
        "description": "Professional Investor",
        "identity_verified": True,
        "onboarding_completed": True,
    },
    {
        "email": "s3_agency@example.com",
        "password": "Password123!",
        "full_name": "Frank Agency (S3)",
        "role": UserRole.PROPERTY_MANAGER,
        "segment": "S3",
        "description": "Real Estate Agency",
        "identity_verified": True,
        "onboarding_completed": True,
    },
]


async def seed_users():
    async with async_session_factory() as db:
        print("🌱 Seeding segment users...")
        for user_data in SEGMENT_USERS:
            # Check if user exists
            result = await db.execute(
                select(User).where(User.email == user_data["email"])
            )
            existing_user = result.scalar_one_or_none()

            if existing_user:
                print(f"User {user_data['email']} already exists, updating segment...")
                existing_user.segment = user_data["segment"]
                existing_user.role = user_data["role"]
                existing_user.identity_verified = user_data["identity_verified"]
                existing_user.onboarding_completed = user_data["onboarding_completed"]
            else:
                print(f"Creating user {user_data['email']} ({user_data['segment']})...")
                new_user = User(
                    email=user_data["email"],
                    hashed_password=get_password_hash(user_data["password"]),
                    full_name=user_data["full_name"],
                    role=user_data["role"],
                    segment=user_data["segment"],
                    identity_verified=user_data["identity_verified"],
                    onboarding_completed=user_data["onboarding_completed"],
                    email_verified=True,
                    is_active=True,
                )
                db.add(new_user)

        await db.commit()
        print("✅ Seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed_users())
