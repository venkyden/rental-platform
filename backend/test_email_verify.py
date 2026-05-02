import asyncio
from app.core.security import create_access_token
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from datetime import timedelta
import uuid

async def test():
    async with SessionLocal() as db:
        user = User(
            email="test_verify@example.com",
            hashed_password="fake",
            role=UserRole.TENANT,
            full_name="Test Verify"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        token = create_access_token(
            data={"sub": user.email, "type": "email_verification"},
            expires_delta=timedelta(hours=24)
        )
        print("TOKEN:", token)

asyncio.run(test())
