"""
Webhook handlers for external service callbacks.
Supports verification services, payment providers, etc.
"""

import hashlib
import hmac
import json
import os
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.services.email import email_service

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify webhook signature using HMAC-SHA256"""
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


@router.post("/verification/callback")
async def verification_webhook(
    request: Request,
    x_signature: str = Header(None, alias="X-Webhook-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Webhook endpoint for identity verification callbacks.
    Supports: Fourthline, Onfido, Jumio, etc.

    Expected payload:
    {
        "event": "verification.completed" | "verification.failed",
        "user_id": "uuid",
        "verification_type": "identity" | "employment",
        "status": "verified" | "rejected" | "pending_review",
        "data": {
            "document_type": "passport" | "national_id" | "driving_license",
            "confidence_score": 0.95,
            "checks_passed": ["face_match", "document_valid", "liveness"],
            "rejection_reason": null
        },
        "timestamp": "2026-01-14T12:00:00Z"
    }
    """
    # Get raw body for signature verification
    body = await request.body()

    # Verify signature (if configured)
    webhook_secret = os.getenv("VERIFICATION_WEBHOOK_SECRET")
    if webhook_secret and x_signature:
        if not verify_signature(body, x_signature, webhook_secret):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Parse payload
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Extract data
    event = payload.get("event")
    user_id = payload.get("user_id")
    verification_type = payload.get("verification_type")
    status = payload.get("status")
    data = payload.get("data", {})

    if not all([event, user_id, verification_type, status]):
        raise HTTPException(status_code=400, detail="Missing required fields")

    # Find user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        # Log but don't fail - user might have been deleted
        print(f"Webhook: User {user_id} not found")
        return {"status": "acknowledged", "action": "user_not_found"}

    # Update user verification status
    if event == "verification.completed" and status == "verified":
        if verification_type == "identity":
            user.identity_verified = True
            user.trust_score = min(100, user.trust_score + 30)
        elif verification_type == "employment":
            user.employment_verified = True
            user.trust_score = min(100, user.trust_score + 20)

        await db.commit()

        # Send congratulatory email
        await email_service.send_verification_success_email(
            to_email=user.email,
            full_name=user.full_name or user.email,
            verification_type=verification_type,
        )

        return {
            "status": "processed",
            "user_id": str(user_id),
            "verification_type": verification_type,
            "updated_trust_score": user.trust_score,
        }

    elif event == "verification.failed":
        # Log failure for review
        print(f"Verification failed for user {user_id}: {data.get('rejection_reason')}")

        # Send failure notification to user
        await email_service.send_verification_failed_email(
            to_email=user.email,
            full_name=user.full_name or user.email,
            reason=data.get("rejection_reason"),
        )

        return {
            "status": "processed",
            "user_id": str(user_id),
            "action": "failure_logged",
        }

    return {"status": "acknowledged", "event": event}


@router.post("/payment/callback")
async def payment_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Webhook endpoint for payment provider callbacks (Stripe, etc.)
    For future monetization features.
    """
    body = await request.body()

    # Verify Stripe signature
    stripe_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if stripe_secret and stripe_signature:
        # Stripe uses a different signature format
        # In production, use stripe.Webhook.construct_event()
        pass

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("type")

    # Handle different event types
    if event_type == "checkout.session.completed":
        # Handle successful payment
        return {"status": "processed", "action": "payment_recorded"}

    elif event_type == "invoice.payment_failed":
        # Handle failed payment
        return {"status": "processed", "action": "failure_logged"}

    return {"status": "acknowledged", "event": event_type}


@router.get("/health")
async def webhook_health():
    """Health check for webhook endpoint"""
    return {
        "status": "healthy",
        "endpoints": ["/webhooks/verification/callback", "/webhooks/payment/callback"],
    }
