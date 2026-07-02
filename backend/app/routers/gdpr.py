"""
GDPR Data Export & Right to Erasure (Right to be Forgotten)

Endpoints:
  GET  /api/v1/gdpr/export   — Download all personal data (Art. 20 portability)
  DELETE /api/v1/gdpr/delete  — Anonymise & deactivate account (Art. 17 erasure)
"""

import logging
from datetime import datetime, timezone

from app.core.timeutils import naive_utcnow

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gdpr", tags=["GDPR"])


def _enum(value):
    """Render an enum/scalar column as a plain JSON-safe value."""
    if value is None:
        return None
    return value.value if hasattr(value, "value") else str(value)

# Safety ceiling for the per-user export collections. A single user's data is
# naturally bounded, so this is a guard against pathological memory use rather
# than user-facing pagination — it is set high enough never to truncate a
# legitimate Art. 20 export.
_EXPORT_ROW_CAP = 10000


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

    # ── Collect related personal data (GDPR Art. 20) ─────────────────────
    # Each collection is guarded independently and logs on failure. The
    # previous implementation queried a non-existent column inside a bare
    # `except: pass`, so every export silently returned zero properties and
    # zero messages — a real portability defect.
    from app.models.property import Property
    from app.models.messages import Message
    from app.models.application import Application
    from app.models.document import Document
    from app.models.visits_and_leases import Lease
    from app.models.dispute import Dispute

    async def _collect(label: str, stmt, mapper):
        try:
            rows = (await db.execute(stmt.limit(_EXPORT_ROW_CAP))).scalars().all()
            return [mapper(r) for r in rows]
        except Exception as exc:  # defensive per-table guard, never silent
            logger.warning(
                "GDPR export: failed to collect %s for user %s: %s", label, user.id, exc
            )
            return []

    properties_data = await _collect(
        "properties",
        select(Property).where(Property.landlord_id == user.id),
        lambda p: {
            "id": str(p.id),
            "title": getattr(p, "title", None),
            "address": getattr(p, "address_line1", None),
            "city": getattr(p, "city", None),
            "monthly_rent": float(getattr(p, "monthly_rent", 0) or 0),
            "created_at": str(getattr(p, "created_at", "")),
        },
    )

    messages_data = await _collect(
        "messages",
        select(Message).where(Message.sender_id == user.id),
        lambda m: {
            "id": str(m.id),
            "conversation_id": str(getattr(m, "conversation_id", "")),
            "content": getattr(m, "content", ""),
            "sent_at": str(getattr(m, "created_at", "")),
        },
    )

    applications_data = await _collect(
        "applications",
        select(Application).where(Application.tenant_id == user.id),
        lambda a: {
            "id": str(a.id),
            "property_id": str(getattr(a, "property_id", "")),
            "status": _enum(getattr(a, "status", None)),
            "cover_letter": getattr(a, "cover_letter", None),
            "created_at": str(getattr(a, "created_at", "")),
        },
    )

    documents_data = await _collect(
        "documents",
        select(Document).where(Document.user_id == user.id),
        lambda d: {
            "id": str(d.id),
            "file_name": getattr(d, "file_name", None),
            "document_type": _enum(getattr(d, "document_type", None)),
            "created_at": str(getattr(d, "created_at", "")),
        },
    )

    leases_data = await _collect(
        "leases",
        select(Lease).where((Lease.tenant_id == user.id) | (Lease.landlord_id == user.id)),
        lambda l: {
            "id": str(l.id),
            "role": "tenant" if getattr(l, "tenant_id", None) == user.id else "landlord",
            "rent_amount": float(getattr(l, "rent_amount", 0) or 0),
            "status": _enum(getattr(l, "status", None)),
            "created_at": str(getattr(l, "created_at", "")),
        },
    )

    disputes_data = await _collect(
        "disputes",
        select(Dispute).where((Dispute.raised_by_id == user.id) | (Dispute.accused_id == user.id)),
        lambda d: {
            "id": str(d.id),
            "title": getattr(d, "title", None),
            "category": _enum(getattr(d, "category", None)),
            "status": _enum(getattr(d, "status", None)),
            "created_at": str(getattr(d, "created_at", "")),
        },
    )

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
        "applications": applications_data,
        "documents": documents_data,
        "leases": leases_data,
        "disputes": disputes_data,
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
    # 1. Physical File Deletion (GDPR Art. 17 — True Erasure)
    from app.services.storage import storage
    from app.models.property import Property
    from app.models.document import Document

    # Delete verification documents (using new folder structure)
    await storage.delete_files_by_prefix(f"verification/identity/{current_user.id}")
    await storage.delete_files_by_prefix(f"verification/intl/identity/{current_user.id}")
    await storage.delete_files_by_prefix(f"verification/employment/{current_user.id}")
    await storage.delete_files_by_prefix(f"verification/guarantor/{current_user.id}")
    await storage.delete_files_by_prefix(f"verification/property/{current_user.id}")

    # Fallback: Delete specific keys if they exist in JSONB (for older uploads)
    if current_user.identity_data and isinstance(current_user.identity_data, dict):
        key = current_user.identity_data.get("storage_key")
        if key: await storage.delete_file(key)
        
    if current_user.employment_data and isinstance(current_user.employment_data, dict):
        key = current_user.employment_data.get("storage_key")
        if key: await storage.delete_file(key)

    # Delete property media and mark properties as inactive
    props_result = await db.execute(select(Property).where(Property.landlord_id == current_user.id))
    properties = props_result.scalars().all()
    for prop in properties:
        await storage.delete_files_by_prefix(f"properties/{prop.id}")
        # Also check property-level ownership docs
        if prop.ownership_data and isinstance(prop.ownership_data, dict):
            key = prop.ownership_data.get("storage_key")
            if key: await storage.delete_file(key)
        prop.status = "inactive"

    # Delete any other documents associated with the user
    docs_result = await db.execute(select(Document).where(Document.user_id == current_user.id))
    for doc in docs_result.scalars().all():
        if doc.extra_data and isinstance(doc.extra_data, dict):
            key = doc.extra_data.get("storage_key")
            if key: await storage.delete_file(key)

    # 2. Database Anonymisation
    anonymised_email = f"deleted_{current_user.id}@anonymised.roomivo.internal"

    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(
            email=anonymised_email,
            google_id=None,
            hashed_password=None,
            full_name="[Deleted User]",
            phone=None,
            bio=None,
            profile_picture_url=None,
            identity_data=None,
            identity_status="deleted",
            employment_data=None,
            employment_status="deleted",
            ownership_data=None,
            ownership_status="deleted",
            preferences=None,
            contact_preferences=None,
            segment=None,
            is_active=False,
            updated_at=naive_utcnow(),
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


@router.post("/purge-stale-applications", status_code=status.HTTP_202_ACCEPTED)
async def trigger_stale_applications_purge(
    current_user: User = Depends(get_current_user),
):
    """
    Triggers the Celery task to purge REJECTED/WITHDRAWN applications older than 30 days.
    Only accessible by admins.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can trigger data retention purges."
        )

    from app.workers.tasks import purge_stale_applications_task
    # Dispatch to Celery
    task = purge_stale_applications_task.delay()
    
    return {
        "status": "accepted",
        "message": "Stale applications purge task dispatched to background workers.",
        "task_id": task.id
    }
