import base64
import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.feature_flag_service import feature_flag_service
from app.services.notification_service import NotificationService
from app.models.user import User, UserRole
from app.models.property import Property
from app.routers.auth import get_current_user
from app.routers.verification import _purge_identity_doc_pointer
from app.core.cache import cache
from app.services.storage import storage
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

logger = logging.getLogger(__name__)

# Redis TTL is 10 min; 15 min gives the user a grace window before operator escalation
_STALL_THRESHOLD_MINUTES = 15

router = APIRouter(prefix="/admin", tags=["Admin"])


async def _notify_best_effort(coro) -> None:
    """Run a notification coroutine without letting a delivery failure turn an
    already-committed admin action into a reported 500."""
    try:
        await coro
    except Exception:
        logger.warning("Admin action notification failed", exc_info=True)


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

class VerificationReview(BaseModel):
    id: str
    user_name: str
    type: str               # "identity_stalled" | "property"
    status: str              # "stalled_upload" | "pending_review" (property)
    upload_date: str         # ISO UTC from identity_data["upload_date"]
    minutes_stalled: int     # floor((now_utc - upload_date).total_seconds() / 60)
    checks: dict[str, bool] | None  # check name -> passed; PII-bearing "details" stripped


def _sanitize_checks(raw_checks: list | None) -> dict[str, bool] | None:
    """
    Reduce identity_data["checks"] (a list of validation-check dicts with
    PII-bearing "details" strings — e.g. extracted name, expiry date) to a
    {name: passed} boolean map safe for the admin API response.
    """
    if not raw_checks:
        return None
    return {
        c["name"]: c["passed"]
        for c in raw_checks
        if isinstance(c, dict) and "name" in c and "passed" in c
    } or None

class ReviewAction(BaseModel):
    approved: bool
    reason: str | None = None


class FeatureFlagResponse(BaseModel):
    name: str
    is_enabled: bool
    description: str | None


class ToggleRequest(BaseModel):
    is_enabled: bool


@router.post("/features/{name}/toggle", response_model=bool)
async def toggle_feature(
    name: str, request: ToggleRequest, db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Kill Switch: Enable/Disable a feature instantly.
    Invalidates cache immediately.
    """
    success = await feature_flag_service.toggle_flag(db, name, request.is_enabled)
    if not success:
        raise HTTPException(status_code=404, detail=f"Flag {name} not found")
    return success


@router.post("/features", response_model=FeatureFlagResponse)
async def create_feature(
    response: FeatureFlagResponse, db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Create a new feature flag"""
    flag = await feature_flag_service.create_flag(
        db,
        name=response.name,
        description=response.description,
        is_enabled=response.is_enabled,
    )
    return flag


@router.post("/cleanup-stale-photos")
async def cleanup_stale_photos(
    property_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Remove broken photo references that point to local /uploads/ paths
    (files lost on Render redeploy). Keeps cloud-hosted URLs intact.

    Pass ?property_id=<uuid> to target one property, or omit to clean all.
    """
    from uuid import UUID

    from sqlalchemy import select, delete as sql_delete
    from sqlalchemy.orm.attributes import flag_modified

    from app.models.property import Property, PropertyMedia

    # 1. Delete PropertyMedia rows with local paths
    media_query = select(PropertyMedia).where(
        PropertyMedia.file_url.like("/uploads/%")
    )
    if property_id:
        media_query = media_query.where(PropertyMedia.property_id == UUID(property_id))

    media_result = await db.execute(media_query)
    stale_media = media_result.scalars().all()
    media_deleted = len(stale_media)

    for m in stale_media:
        await db.delete(m)

    # 2. Clean the photos JSONB on affected properties
    prop_query = select(Property)
    if property_id:
        prop_query = prop_query.where(Property.id == UUID(property_id))
    else:
        # Only touch properties that have photos with local paths
        prop_query = prop_query.where(Property.photos.isnot(None))

    prop_result = await db.execute(prop_query)
    properties = prop_result.scalars().all()

    photos_cleaned = 0
    for prop in properties:
        if not prop.photos:
            continue
        original_len = len(prop.photos)
        # Keep only entries whose URL does NOT start with /uploads/
        cleaned = [
            p for p in prop.photos
            if not (isinstance(p, dict) and p.get("url", "").startswith("/uploads/"))
        ]
        if len(cleaned) < original_len:
            photos_cleaned += original_len - len(cleaned)
            prop.photos = cleaned if cleaned else None
            flag_modified(prop, "photos")

    await db.commit()

    return {
        "media_rows_deleted": media_deleted,
        "photo_entries_removed": photos_cleaned,
        "message": "Stale local-path photo references cleaned up.",
    }


@router.get("/storage-health")
async def storage_health(_: User = Depends(require_admin)):
    """
    Diagnostic endpoint: check cloud storage configuration and connectivity.
    Use this to verify R2 is working after deploy.
    """
    from app.services.storage import storage

    return storage.get_health()

@router.get("/verifications/pending", response_model=List[VerificationReview])
async def get_pending_verifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    List verifications that require operator attention.

    Identity: users whose upload stalled > 15 minutes ago (Redis TTL is 10 min —
    at 15 min the user cannot complete the flow without re-uploading). The
    skip/limit is applied at the DB level; the Python-side age filter may reduce
    the result count below `limit` — acceptable at MVP scale.

    Property: unverified properties with verification_data present.
    """
    pending = []

    # ── 1. Stalled identity uploads ───────────────────────────────────────────
    user_query = (
        select(User)
        .where(
            User.identity_status == "document_uploaded",
            User.identity_verified == False,
        )
        .offset(skip)
        .limit(limit)
    )
    user_result = await db.execute(user_query)
    users = user_result.scalars().all()

    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC matches stored dates
    stall_threshold = timedelta(minutes=_STALL_THRESHOLD_MINUTES)

    for user in users:
        if not user.identity_data:
            continue
        upload_date_str = user.identity_data.get("upload_date", "")
        if not upload_date_str:
            continue
        try:
            upload_dt = datetime.fromisoformat(upload_date_str)
        except (ValueError, TypeError):
            continue
        stalled_for = now_utc - upload_dt
        if stalled_for < stall_threshold:
            continue
        pending.append(VerificationReview(
            id=str(user.id),
            user_name=user.full_name or user.email,
            type="identity_stalled",
            status="stalled_upload",
            upload_date=upload_date_str,
            minutes_stalled=int(stalled_for.total_seconds() / 60),
            checks=_sanitize_checks(user.identity_data.get("checks")),
        ))

    # ── 2. Identity docs AI could not verify — queued for manual review ──────
    review_query = (
        select(User)
        .where(
            User.identity_status == "pending_manual_review",
            User.identity_verified == False,
        )
        .offset(skip)
        .limit(limit)
    )
    review_result = await db.execute(review_query)
    review_users = review_result.scalars().all()

    for user in review_users:
        if not user.identity_data:
            continue
        expires_str = user.identity_data.get("review_expires_at", "")
        if expires_str:
            try:
                if now_utc > datetime.fromisoformat(expires_str):
                    continue  # window lapsed — the underlying document is gone or about to be
            except (ValueError, TypeError):
                pass
        upload_date_str = user.identity_data.get("upload_date", "")
        stalled_for = timedelta(0)
        if upload_date_str:
            try:
                stalled_for = now_utc - datetime.fromisoformat(upload_date_str)
            except (ValueError, TypeError):
                pass
        pending.append(VerificationReview(
            id=str(user.id),
            user_name=user.full_name or user.email,
            type="identity_pending_review",
            status="pending_manual_review",
            upload_date=upload_date_str,
            minutes_stalled=int(stalled_for.total_seconds() / 60),
            checks=None,  # AI never ran — nothing to sanitize/show
        ))

    # ── 3. Unverified properties ──────────────────────────────────────────────
    prop_query = (
        select(Property)
        .where(Property.ownership_verified == False)
        .offset(skip)
        .limit(limit)
    )
    prop_result = await db.execute(prop_query)
    properties = prop_result.scalars().all()

    for prop in properties:
        if hasattr(prop, 'verification_data') and prop.verification_data:
            pending.append(VerificationReview(
                id=str(prop.id),
                user_name=f"Property: {prop.title}",
                type="property",
                status="pending_review",
                upload_date=prop.verification_data.get("upload_date", ""),
                minutes_stalled=0,
                checks=_sanitize_checks(prop.verification_data.get("checks")),
            ))

    return pending


@router.get("/verifications/{id}/identity-document")
async def get_identity_document_for_review(
    id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Fetch the raw identity-document image for manual review.

    Only ever available while status == pending_manual_review and the bounded
    retention window hasn't lapsed — this is the one case where a source ID
    document exists at rest at all. Access is logged (who viewed whose
    document, when): this is exactly the kind of PII access GDPR accountability
    expects an audit trail for.
    """
    uid = UUID(id)
    user = await db.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = user.identity_data or {}
    if data.get("status") != "pending_manual_review":
        raise HTTPException(status_code=404, detail="No document is pending manual review for this user")

    expires_str = data.get("review_expires_at", "")
    if expires_str:
        try:
            if datetime.now(timezone.utc).replace(tzinfo=None) > datetime.fromisoformat(expires_str):
                raise HTTPException(status_code=410, detail="The manual-review window has expired; use /reset")
        except (ValueError, TypeError):
            pass

    if data.get("redis_key"):
        doc = await cache.get(str(data["redis_key"]))
        if not doc:
            raise HTTPException(status_code=410, detail="Document expired or unavailable")
        content = base64.b64decode(doc["b64"])
        content_type = doc.get("content_type", "image/jpeg")
    elif data.get("storage_key"):
        content = await storage.download_file(str(data["storage_key"]))
        if content is None:
            raise HTTPException(status_code=410, detail="Document expired or unavailable")
        content_type = data.get("content_type", "application/octet-stream")
    else:
        raise HTTPException(status_code=404, detail="No document pointer on file")

    logger.info(
        "identity_document_reviewed: admin=%s subject=%s", admin_user.id, uid
    )
    return Response(content=content, media_type=content_type)


@router.post("/verifications/{id}/reset")
async def reset_verification(
    id: str,
    type: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Reset a stalled identity verification so the user can restart the upload flow.
    Clears identity_data and sets identity_status back to "unverified".
    Trust score is unchanged — no trust was awarded for an incomplete flow.

    Returns 409 if the user completed verification between queue load and this call.
    """
    uid = UUID(id)

    if type == "identity":
        user = await db.get(User, uid)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.identity_verified:
            raise HTTPException(
                status_code=409,
                detail="User has already completed identity verification — cannot reset.",
            )
        await _purge_identity_doc_pointer(user.identity_data)
        user.identity_status = "unverified"
        user.identity_data = None  # type: ignore
        await db.commit()
        return {"status": "reset", "user_id": id}

    raise HTTPException(status_code=400, detail=f"Reset not supported for type: {type}")


@router.post("/verifications/{id}/approve")
async def approve_verification(
    id: str,
    type: str,  # identity, employment, property
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Manually approve a verification"""
    uid = UUID(id)

    if type == "identity":
        user = await db.get(User, uid)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        data = user.identity_data or {}
        if data.get("status") != "pending_manual_review":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only a document queued for manual review can be approved this way "
                    "— no source document is retained otherwise. Use /reset to unblock "
                    "stalled users."
                ),
            )
        # Approve the DOCUMENT only — liveness still required. Same resting state
        # a normal AI-validated front upload reaches; the existing selfie flow
        # (unchanged) then completes identity_verified + assurance labelling.
        user.identity_status = "document_uploaded"
        user.identity_data = {
            **data,
            "status": "document_uploaded",
            "checks": [{
                "name": "manual_document_review",
                "description": "Document reviewed and approved by an admin",
                "passed": True,
                "critical": True,
            }],
            "reviewed_by": str(admin_user.id),
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.commit()
        await _notify_best_effort(NotificationService(db).create_notification(
            user_id=user.id,
            notification_type="identity",
            title="Identity document approved",
            message="Your identity document was manually reviewed and approved. Please complete the selfie step to finish verification.",
            action_url="/verification",
        ))
        return {"status": "approved", "user_id": id}

    if type == "employment":
        user = await db.get(User, uid)
        if user and user.employment_data:
            user.employment_verified = True
            user.employment_status = "verified"
            new_data = dict(user.employment_data)
            new_data["status"] = "verified"
            user.employment_data = new_data
            user.trust_score = min(100, user.trust_score + 30)

    elif type == "property":
        prop = await db.get(Property, uid)
        if prop:
            prop.ownership_verified = True
            prop.ownership_status = "verified"
    
    await db.commit()
    return {"status": "approved"}


class RejectRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/verifications/{id}/reject")
async def reject_verification(
    id: str,
    type: str,
    body: RejectRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Reject a document that was queued for manual review — the admin looked at
    it and it is not a valid/legible identity document. Purges the retained
    document and notifies the user with the reason, if given.
    """
    if type != "identity":
        raise HTTPException(status_code=400, detail=f"Reject not supported for type: {type}")

    uid = UUID(id)
    user = await db.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = user.identity_data or {}
    if data.get("status") != "pending_manual_review":
        raise HTTPException(
            status_code=400,
            detail="Only a document queued for manual review can be rejected this way.",
        )

    await _purge_identity_doc_pointer(data)
    user.identity_status = "rejected"
    user.identity_data = {
        "status": "rejected",
        "rejected_at": datetime.now(timezone.utc).isoformat(),
        "rejection_reason": body.reason,
    }
    await db.commit()

    message = "Your identity document was reviewed and could not be accepted."
    if body.reason:
        message += f" Reason: {body.reason}"
    await _notify_best_effort(NotificationService(db).create_notification(
        user_id=user.id,
        notification_type="identity",
        title="Identity document rejected",
        message=message + " Please upload a new document.",
        action_url="/verification",
    ))
    return {"status": "rejected", "user_id": id}
