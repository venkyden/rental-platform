"""
Identity Service - Stripe Identity Integration.
Handles ID verification (document + selfie) via Stripe Identity API.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User, VerificationRecord, VerificationStatus


class IdentityService:
    """Service for Stripe Identity verification."""

    def __init__(self):
        stripe.api_key = settings.STRIPE_SECRET_KEY

    async def create_verification_session(
        self, user_id: UUID, return_url: str, db: AsyncSession
    ) -> dict:
        """
        Create a Stripe Identity VerificationSession.
        Returns client_secret for frontend modal.
        """
        # Get user
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found")

        # Create Stripe VerificationSession
        session = stripe.identity.VerificationSession.create(
            type="document",
            metadata={"user_id": str(user_id), "email": user.email},
            options={
                "document": {
                    "allowed_types": ["driving_license", "passport", "id_card"],
                    "require_live_capture": True,
                    "require_matching_selfie": True,
                }
            },
            return_url=return_url,
        )

        # Create verification record
        record = VerificationRecord(
            user_id=user_id,
            verification_type="stripe_identity",
            status=VerificationStatus.PENDING,
            verification_data={
                "stripe_session_id": session.id,
                "created_at": datetime.utcnow().isoformat(),
            },
        )
        db.add(record)
        await db.commit()

        return {
            "session_id": session.id,
            "client_secret": session.client_secret,
            "url": session.url,  # Fallback redirect URL
            "record_id": str(record.id),
        }

    async def handle_webhook(
        self, event_type: str, event_data: dict, db: AsyncSession
    ) -> Optional[dict]:
        """
        Handle Stripe Identity webhook events.
        Updates user verification status based on results.
        """
        session_id = event_data.get("object", {}).get("id")
        metadata = event_data.get("object", {}).get("metadata", {})
        user_id = metadata.get("user_id")

        if not user_id:
            return {"error": "No user_id in metadata"}

        # Find user
        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()

        if not user:
            return {"error": "User not found"}

        if event_type == "identity.verification_session.verified":
            # SUCCESS: User is verified
            user.identity_verified = True
            user.identity_data = {
                "stripe_session_id": session_id,
                "verified_at": datetime.utcnow().isoformat(),
                "verification_type": "stripe_identity",
            }

            # Update trust score
            user.trust_score = min(100, (user.trust_score or 0) + 30)

            # Update verification record
            await self._update_record(
                db,
                session_id,
                VerificationStatus.VERIFIED,
                {"verified_at": datetime.utcnow().isoformat()},
            )

            await db.commit()
            return {"status": "verified", "user_id": user_id}

        elif event_type == "identity.verification_session.requires_input":
            # User needs to provide more info
            await self._update_record(
                db, session_id, VerificationStatus.PENDING, {"requires_input": True}
            )
            return {"status": "requires_input", "user_id": user_id}

        elif event_type == "identity.verification_session.canceled":
            # Canceled
            await self._update_record(
                db, session_id, VerificationStatus.FAILED, {"canceled": True}
            )
            return {"status": "canceled", "user_id": user_id}

        return {"status": "unhandled", "event_type": event_type}

    async def _update_record(
        self,
        db: AsyncSession,
        session_id: str,
        status: VerificationStatus,
        extra_data: dict,
    ):
        """Update verification record by Stripe session ID."""
        from sqlalchemy import update
        from sqlalchemy.dialects.postgresql import JSONB

        # Find record with this session_id in verification_data
        result = await db.execute(
            select(VerificationRecord).where(
                VerificationRecord.verification_data["stripe_session_id"].astext
                == session_id
            )
        )
        record = result.scalar_one_or_none()

        if record:
            record.status = status
            record.verification_data = {
                **(record.verification_data or {}),
                **extra_data,
            }
            if status == VerificationStatus.VERIFIED:
                record.completed_at = datetime.utcnow()


identity_service = IdentityService()
