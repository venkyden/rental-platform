from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.feature_flag_service import feature_flag_service
from app.models.user import User, UserRole
from app.models.property import Property
from app.routers.auth import get_current_user
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

# Redis TTL is 10 min; 15 min gives the user a grace window before operator escalation
_STALL_THRESHOLD_MINUTES = 15

router = APIRouter(prefix="/admin", tags=["Admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

class VerificationReview(BaseModel):
    id: str
    user_name: str
    type: str            # "identity_stalled" | "property"
    status: str          # "stalled_upload" | "pending_review" (property)
    upload_date: str     # ISO UTC from identity_data["upload_date"]
    minutes_stalled: int # floor((now_utc - upload_date).total_seconds() / 60)
    checks: dict | None  # identity_data.get("checks") — partial OCR results if any

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
            checks=user.identity_data.get("checks"),
        ))

    # ── 2. Unverified properties ──────────────────────────────────────────────
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
                checks=prop.verification_data.get("checks"),
            ))

    return pending


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
    _: User = Depends(require_admin),
):
    """Manually approve a verification"""
    uid = UUID(id)

    if type == "identity":
        user = await db.get(User, uid)
        if user and user.identity_data:
            user.identity_verified = True
            user.identity_status = "verified"
            # We must be careful: modifying a dict inside a TypeDecorator-managed field
            # might not trigger the 'dirty' flag if it's already a dict in memory.
            # But here it's an EncryptedJSON, so any reassignment triggers it.
            new_data = dict(user.identity_data)
            new_data["status"] = "verified"
            user.identity_data = new_data
            user.trust_score = min(100, user.trust_score + 30)
    
    elif type == "employment":
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
