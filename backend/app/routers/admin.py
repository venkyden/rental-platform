from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.feature_flag_service import feature_flag_service

router = APIRouter(prefix="/admin", tags=["Admin"])


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

