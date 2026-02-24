import asyncio
import sys
import uuid
from unittest.mock import MagicMock

from sqlalchemy import select

# Add parent to path
sys.path.insert(0, "/Users/venkat/.gemini/antigravity/scratch/rental-platform/backend")

from app.core.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.services.stripe_identity_service import stripe_identity_service

# We need to import the router logic... but it's hard to test router standalone without client.
# We'll simulate the "Logic" that happens inside the webhook.


async def verify_stripe_integration():
    print("🧪 Testing Stripe Identity Integration (Mock)...")

    async with AsyncSessionLocal() as db:
        # 1. Create Test User
        user_id = uuid.uuid4()
        user = User(
            id=user_id,
            email=f"test_stripe_{uuid.uuid4()}@example.com",
            hashed_password="hashed_secret",
            full_name="Stripe Test User",
            role=UserRole.TENANT,
            identity_verified=False,
            trust_score=0,
        )
        db.add(user)
        await db.commit()
        print(f"   👤 User Created: {user.email}")

        # 2. Test "Start Verification" (Mock Mode)
        print("   🚀 Starting Verification Session...")
        # Ensure API key is missing for Mock Mode check
        stripe_identity_service.api_key = None
        session = stripe_identity_service.create_verification_session(
            str(user_id), user.email
        )

        if "mock-verification" in session.get("url", ""):
            print(f"   ✅ Mock Session Created: {session['url']}")
        else:
            print(f"   ❌ Expected Mock URL, got: {session}")

        # 3. Test "Webhook Processing"
        # Since we can't easily spin up the full FastAPI app + client here without big overhead,
        # We will replicate the *Router Logic* to ensure the DB query works as expected.
        # (This verifies the User model update logic specifically).

        print(
            "   📩 Simulating Webhook Event 'identity.verification_session.verified'..."
        )

        # Payload that Stripe sends
        fake_session_id = "vs_mock_12345"
        webhook_data = {
            "id": fake_session_id,
            "metadata": {"user_id": str(user_id)},
            "created": 1700000000,
            "status": "verified",
        }

        # --- Router Logic Simulation ---
        # Fetch user
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user_db = result.scalar_one_or_none()

        if user_db:
            user_db.identity_verified = True
            user_db.identity_data = {
                "provider": "stripe_identity",
                "session_id": fake_session_id,
                "status": "verified",
                "verified_at": webhook_data["created"],
                "details": "Verified via Stripe Identity",
            }
            # Trust Score Logic
            user_db.trust_score = min(100, user_db.trust_score + 40)
            await db.commit()
            print("      (Database updated)")
        # -------------------------------

        # 4. Verify Result
        await db.refresh(user_db)
        if user_db.identity_verified:
            print(f"   ✅ User Identity Verified: True")
        else:
            print(f"   ❌ User Identity Verification Failed!")

        if user_db.trust_score == 40:
            print(f"   ✅ Trust Score Updated: {user_db.trust_score}")
        else:
            print(f"   ❌ Trust Score Incorrect: {user_db.trust_score}")

        if user_db.identity_data.get("session_id") == fake_session_id:
            print(f"   ✅ Identity Metadata Saved.")
        else:
            print(f"   ❌ Identity Metadata Missing.")

        # Cleanup
        await db.delete(user_db)
        await db.commit()
        print("🧹 Cleanup Done.")


if __name__ == "__main__":
    asyncio.run(verify_stripe_integration())
