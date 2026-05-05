from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.feature_flag_service import feature_flag_service
from app.models.user import User, UserRole
from app.models.property import Property
from sqlalchemy import select, or_

router = APIRouter(prefix="/admin", tags=["Admin"])

class VerificationReview(BaseModel):
    id: str
    user_name: str
    type: str  # identity, employment, property
    status: str
    upload_date: str
    file_url: str
    extracted_data: dict | None

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
    name: str, request: ToggleRequest, db: AsyncSession = Depends(get_db)
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
    response: FeatureFlagResponse, db: AsyncSession = Depends(get_db)
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
async def storage_health():
    """
    Diagnostic endpoint: check cloud storage configuration and connectivity.
    Use this to verify R2 is working after deploy.
    """
    from app.services.storage import storage

    return storage.get_health()

@router.get("/verifications/pending", response_model=List[VerificationReview])
async def get_pending_verifications(db: AsyncSession = Depends(get_db)):
    """
    List all verifications that require manual review.
    Checks users (identity/employment) and properties (ownership).
    """
    pending = []

    # 1. Check Users (Identity & Employment)
    user_query = select(User).where(
        or_(
            User.identity_data["status"].astext == "pending_review",
            User.employment_data["status"].astext == "pending_review"
        )
    )
    user_result = await db.execute(user_query)
    users = user_result.scalars().all()

    for user in users:
        if user.identity_data and user.identity_data.get("status") == "pending_review":
            pending.append(VerificationReview(
                id=str(user.id),
                user_name=user.full_name or user.email,
                type="identity",
                status="pending_review",
                upload_date=user.identity_data.get("upload_date", ""),
                file_url=user.identity_data.get("file_url", ""),
                extracted_data=user.identity_data.get("extracted_data")
            ))
        
        if user.employment_data and user.employment_data.get("status") == "pending_review":
            pending.append(VerificationReview(
                id=str(user.id),
                user_name=user.full_name or user.email,
                type="employment",
                status="pending_review",
                upload_date=user.employment_data.get("upload_date", ""),
                file_url=user.employment_data.get("file_url", ""),
                extracted_data=user.employment_data.get("extracted_data")
            ))

    # 2. Check Properties
    prop_query = select(Property).where(Property.ownership_verified == False) # Simplified for MVP
    # In a real app, we'd have a specific status field for property verification
    prop_result = await db.execute(prop_query)
    properties = prop_result.scalars().all()

    for prop in properties:
        # Only include if there is verification data present
        if hasattr(prop, 'verification_data') and prop.verification_data:
            pending.append(VerificationReview(
                id=str(prop.id),
                user_name=f"Property: {prop.title}",
                type="property",
                status="pending_review",
                upload_date=prop.verification_data.get("upload_date", ""),
                file_url=prop.verification_data.get("file_url", ""),
                extracted_data=prop.verification_data.get("extracted_data")
            ))

    return pending

@router.post("/verifications/{id}/approve")
async def approve_verification(
    id: str, 
    type: str, # identity, employment, property
    db: AsyncSession = Depends(get_db)
):
    """Manually approve a verification"""
    from uuid import UUID
    uid = UUID(id)

    if type == "identity":
        user = await db.get(User, uid)
        if user and user.identity_data:
            user.identity_verified = True
            user.identity_data["status"] = "verified"
            user.trust_score = min(100, user.trust_score + 30)
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(user, "identity_data")
    
    elif type == "employment":
        user = await db.get(User, uid)
        if user and user.employment_data:
            user.employment_verified = True
            user.employment_data["status"] = "verified"
            user.trust_score = min(100, user.trust_score + 30)
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(user, "employment_data")

    elif type == "property":
        prop = await db.get(Property, uid)
        if prop:
            prop.ownership_verified = True
    
    await db.commit()
    return {"status": "approved"}
