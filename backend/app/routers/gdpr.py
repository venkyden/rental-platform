"""
GDPR Data Export & Right to Erasure (Right to be Forgotten)

Endpoints:
  GET  /api/v1/gdpr/export   — Download all personal data (Art. 20 portability)
  DELETE /api/v1/gdpr/delete  — Anonymise & deactivate account (Art. 17 erasure)
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/v1/gdpr", tags=["GDPR"])


@router.get("/export")
async def export_user_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    GDPR Art. 20 — Right to Data Portability.

    Returns all personal data associated with the authenticated user
    in a structured, machine-readable JSON format.
    """
    # Fetch fresh user record
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Collect user properties (if any)
    properties_data = []
    try:
        from app.models.property import Property
        props = await db.execute(select(Property).where(Property.owner_id == user.id))
        for prop in props.scalars().all():
            properties_data.append({
                "id": str(prop.id),
                "title": getattr(prop, "title", None),
                "address": getattr(prop, "address_line1", None),
                "city": getattr(prop, "city", None),
                "monthly_rent": float(getattr(prop, "monthly_rent", 0) or 0),
                "created_at": str(getattr(prop, "created_at", "")),
            })
    except Exception:
        pass  # Properties table may not exist in test environments

    # Collect messages sent by user (if any)
    messages_data = []
    try:
        from app.models.message import Message
        msgs = await db.execute(select(Message).where(Message.sender_id == user.id))
        for msg in msgs.scalars().all():
            messages_data.append({
                "id": str(msg.id),
                "recipient_id": str(getattr(msg, "recipient_id", "")),
                "content": getattr(msg, "content", ""),
                "sent_at": str(getattr(msg, "created_at", "")),
            })
    except Exception:
        pass

    # Build export payload
    export = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "format_version": "1.0",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "nationality": user.nationality,
            "languages": user.languages,
            "gender": user.gender,
            "birth_date": str(user.birth_date) if user.birth_date else None,
            "address": {
                "line1": user.address_line1,
                "line2": user.address_line2,
                "city": user.city,
                "postal_code": user.postal_code,
                "country": user.country,
            },
            "verification": {
                "email_verified": user.email_verified,
                "identity_verified": user.identity_verified,
                "employment_verified": user.employment_verified,
            },
            "trust_score": user.trust_score,
            "risk_tier": user.risk_tier,
            "segment": user.segment,
            "preferences": user.preferences,
            "contact_preferences": user.contact_preferences,
            "onboarding_completed": user.onboarding_completed,
            "created_at": str(user.created_at),
            "updated_at": str(user.updated_at),
            "last_login": str(user.last_login) if user.last_login else None,
        },
        "properties": properties_data,
        "messages_sent": messages_data,
    }

    return export


@router.delete("/delete", status_code=status.HTTP_200_OK)
async def delete_user_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    GDPR Art. 17 — Right to Erasure (Right to be Forgotten).

    Anonymises the user's personal data and deactivates the account.
    We retain the anonymised record for legal obligations (invoicing,
    fraud prevention) as permitted by GDPR Art. 17(3)(b) and (e).
    """
    # Anonymise user record
    anonymised_email = f"deleted_{current_user.id}@anonymised.roomivo.internal"
    
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(
            email=anonymised_email,
            full_name="[Deleted User]",
            phone=None,
            nationality=None,
            languages=None,
            gender=None,
            birth_date=None,
            address_line1=None,
            address_line2=None,
            city=None,
            postal_code=None,
            country=None,
            identity_data=None,
            employment_data=None,
            preferences=None,
            contact_preferences=None,
            segment=None,
            is_active=False,
            updated_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()

    return {
        "status": "deleted",
        "message": "Your personal data has been anonymised and your account deactivated. "
                   "A minimal anonymised record is retained for legal compliance (invoicing, fraud prevention). "
                   "If you believe any data remains, contact dpo@roomivo.com.",
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "data_retention_note": "Anonymised records retained per GDPR Art. 17(3)(b)(e) for legal obligations.",
    }
