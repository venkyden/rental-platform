import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.stripe_identity_service import stripe_identity_service

router = APIRouter(prefix="/identity", tags=["Identity"])


@router.post("/start")
async def start_identity_verification(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """
    Start a Stripe Identity Verification Session.
    Returns the URL to redirect the user to.
    """
    from app.services.feature_flag_service import feature_flag_service

    if not await feature_flag_service.get_flag_state(
        db, "identity_verification", default=True
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Identity verification is currently disabled.",
        )

    try:
        session = stripe_identity_service.create_verification_session(
            user_id=str(current_user.id), email=current_user.email
        )

        return {
            "url": session.get("url"),
            "client_secret": session.get("client_secret"),
            "id": session.get("id"),
            "status": session.get("status"),
        }
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to start verification: {str(e)}"
        )


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Handle Stripe Webhooks (e.g. verification completed)
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe_identity_service.construct_event(payload, sig_header)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook Error: {str(e)}")

    # Handle the event
    if event["type"] == "identity.verification_session.verified":
        session = event["data"]["object"]
        user_id = session["metadata"].get("user_id")

        if user_id:
            # Update User Verification Status
            stmt = select(User).where(User.id == user_id)
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()

            if user:
                user.identity_verified = True
                # Store provider data
                user.identity_data = {
                    "provider": "stripe_identity",
                    "session_id": session.get("id"),
                    "status": "verified",
                    "verified_at": session.get("created"),
                    "details": "Verified via Stripe Identity",
                }
                # Increase Trust Score
                user.trust_score = min(
                    100, user.trust_score + 40
                )  # +40 for ID Verification

                await db.commit()
                print(f"✅ User {user_id} verified via Stripe Webhook")
            else:
                print(f"⚠️ Webhook received for unknown user {user_id}")

    return {"status": "success"}
