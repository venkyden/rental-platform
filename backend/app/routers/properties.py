"""
Property listing API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete as sql_delete, func, and_
from typing import List, Optional
from decimal import Decimal
import secrets
import os
from datetime import datetime, timedelta
from uuid import UUID

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.property import Property, PropertyMediaSession, PropertyMedia
from app.models.property_schemas import (
    PropertyCreate,
    PropertyUpdate,
    PropertyResponse,
    MediaSessionCreate,
    MediaSessionResponse,
    MediaUploadMetadata
)

router = APIRouter(prefix="/properties", tags=["Properties"])

# Upload directory
UPLOAD_DIR = "uploads/properties"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def calculate_distance(lat1: Decimal, lon1: Decimal, lat2: Decimal, lon2: Decimal) -> float:
    """Calculate distance between two GPS coordinates in meters (Haversine formula)"""
    from math import radians, cos, sin, asin, sqrt
    
    lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
    
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371000  # Earth radius in meters
    
    return c * r


@router.post("", response_model=PropertyResponse, status_code=status.HTTP_201_CREATED)
async def create_property(
    property_data: PropertyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new property listing"""
    
    # Only landlords and property managers can create properties
    if current_user.role not in ['landlord', 'property_manager']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only landlords can create properties"
        )
    
    # Create property
    new_property = Property(
        landlord_id=current_user.id,
        **property_data.model_dump()
    )
    
    db.add(new_property)
    await db.commit()
    await db.refresh(new_property)
    
    return new_property


@router.get("", response_model=List[PropertyResponse])
async def list_properties(
    city: Optional[str] = None,
    min_rent: Optional[Decimal] = None,
    max_rent: Optional[Decimal] = None,
    bedrooms: Optional[int] = None,
    property_type: Optional[str] = None,
    furnished: Optional[bool] = None,
    amenities: Optional[List[str]] = Query(None),
    landlord_id: Optional[UUID] = None,
    status: Optional[str] = 'active',
    skip: int = 0,
    limit: int = 20,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List properties with filters"""
    
    query = select(Property)
    
    # Apply filters
    filters = []
    
    if city:
        filters.append(Property.city.ilike(f"%{city}%"))
    
    if min_rent:
        filters.append(Property.monthly_rent >= min_rent)
    
    if max_rent:
        filters.append(Property.monthly_rent <= max_rent)
    
    if bedrooms is not None:
        filters.append(Property.bedrooms >= bedrooms)
    
    if property_type:
        filters.append(Property.property_type == property_type)

    if furnished is not None:
        filters.append(Property.furnished == furnished)
        
    if amenities:
        # Check if property amenities (JSONB) contains ALL requested amenities
        # Using the @> operator for JSONB containment
        from sqlalchemy.dialects.postgresql import JSONB
        # Cast mainly for type safety if needed, but usually works directly on JSONB column
        for amenity in amenities:
             # Basic implementation: check if the JSON array contains the string
             # Note: This depends on how amenities are stored (list of strings)
             filters.append(Property.amenities.contains([amenity]))
    
    if landlord_id:
        filters.append(Property.landlord_id == landlord_id)
    
    # Status filtering: users can only see their own drafts
    if current_user and status == 'draft':
        filters.append(and_(
            Property.status == 'draft',
            Property.landlord_id == current_user.id
        ))
    elif status:
        filters.append(Property.status == status)
    else:
        # Default: only show active properties to public
        filters.append(Property.status == 'active')
    
    if filters:
        query = query.where(and_(*filters))
    
    # Pagination
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    properties = result.scalars().all()
    
    return properties


@router.get("/{property_id}", response_model=PropertyResponse)
async def get_property(
    property_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get property details"""
    
    result = await db.execute(
        select(Property).where(Property.id == property_id)
    )
    property_obj = result.scalar_one_or_none()
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    # Increment view count
    await db.execute(
        update(Property)
        .where(Property.id == property_id)
        .values(views_count=Property.views_count + 1)
    )
    await db.commit()
    
    return property_obj


@router.put("/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: UUID,
    property_data: PropertyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update property"""
    
    # Get property
    result = await db.execute(
        select(Property).where(Property.id == property_id)
    )
    property_obj = result.scalar_one_or_none()
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    # Check ownership
    if property_obj.landlord_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own properties"
        )
    
    # Update fields
    update_data = property_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(property_obj, field, value)
    
    property_obj.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(property_obj)
    
    return property_obj


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(
    property_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete property"""
    
    # Get property
    result = await db.execute(
        select(Property).where(Property.id == property_id)
    )
    property_obj = result.scalar_one_or_none()
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    # Check ownership
    if property_obj.landlord_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own properties"
        )
    
    await db.execute(sql_delete(Property).where(Property.id == property_id))
    await db.commit()
    
    return


@router.post("/{property_id}/publish", response_model=PropertyResponse)
async def publish_property(
    property_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Publish a draft property"""
    
    # Get property
    result = await db.execute(
        select(Property).where(Property.id == property_id)
    )
    property_obj = result.scalar_one_or_none()
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    # Check ownership
    if property_obj.landlord_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only publish your own properties"
        )
    
    # Check if has photos
    if not property_obj.photos or len(property_obj.photos) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Property must have at least 1 photo to publish"
        )
    
    # Publish
    property_obj.status = 'active'
    property_obj.published_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(property_obj)
    
    return property_obj


@router.post("/{property_id}/media-session", response_model=MediaSessionResponse)
async def create_media_session(
    property_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate a shareable link/QR code for media capture"""
    
    # Get property
    result = await db.execute(
        select(Property).where(Property.id == property_id)
    )
    property_obj = result.scalar_one_or_none()
    
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    
    # Check ownership
    if property_obj.landlord_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create media sessions for your own properties"
        )
    
    # Generate unique code
    verification_code = secrets.token_urlsafe(32)
    
    # Create session
    session = PropertyMediaSession(
        property_id=property_id,
        verification_code=verification_code,
        generated_by=current_user.id,
        expires_at=datetime.utcnow() + timedelta(days=7),
        target_address=f"{property_obj.address_line1}, {property_obj.city} {property_obj.postal_code}",
        target_latitude=property_obj.latitude,
        target_longitude=property_obj.longitude,
        gps_radius_meters=500
    )
    
    db.add(session)
    await db.commit()
    await db.refresh(session)
    
    # Generate URL
    from app.core.config import settings
    capture_url = f"{settings.FRONTEND_URL}/capture/{verification_code}"
    
    return {
        "id": session.id,
        "property_id": property_id,
        "verification_code": verification_code,
        "capture_url": capture_url,
        "expires_at": session.expires_at,
        "target_address": session.target_address
    }


@router.post("/media/upload")
async def upload_media(
    file: UploadFile = File(...),
    metadata: str = Query(...),  # JSON string
    verification_code: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload property media with GPS verification"""
    import json
    
    # Parse metadata
    meta = json.loads(metadata)
    meta_obj = MediaUploadMetadata(**meta)
    
    # Get session
    result = await db.execute(
        select(PropertyMediaSession).where(
            PropertyMediaSession.verification_code == verification_code
        )
    )
    session = result.scalar_one_or_none()
    
    if not session or not session.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired verification code"
        )
    
    # Check expiry
    if session.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired"
        )
    
    # GPS verification (if coordinates provided)
    distance = None
    if meta_obj.latitude and meta_obj.longitude:
        if session.target_latitude and session.target_longitude:
            distance = calculate_distance(
                session.target_latitude,
                session.target_longitude,
                meta_obj.latitude,
                meta_obj.longitude
            )
            
            # Check if within radius
            if distance > session.gps_radius_meters:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Too far from property ({int(distance)}m away, max {session.gps_radius_meters}m)"
                )
    
    # Save file
    property_dir = os.path.join(UPLOAD_DIR, str(session.property_id))
    os.makedirs(property_dir, exist_ok=True)
    
    file_extension = os.path.splitext(file.filename)[1]
    filename = f"{secrets.token_urlsafe(16)}{file_extension}"
    file_path = os.path.join(property_dir, filename)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Create media record
    media = PropertyMedia(
        property_id=session.property_id,
        session_id=session.id,
        media_type=meta_obj.media_type,
        file_url=f"/uploads/properties/{session.property_id}/{filename}",
        file_size=len(content),
        captured_latitude=meta_obj.latitude,
        captured_longitude=meta_obj.longitude,
        distance_from_target=Decimal(str(distance)) if distance else None,
        captured_at=meta_obj.captured_at,
        device_id=meta_obj.device_id,
        watermark_address=meta_obj.watermark_address,
        verification_status='verified',
        verified_at=datetime.utcnow()
    )
    
    db.add(media)
    
    # Update property photos array
    result = await db.execute(
        select(Property).where(Property.id == session.property_id)
    )
    property_obj = result.scalar_one_or_none()
    
    if property_obj:
        photos = property_obj.photos or []
        photos.append({
            'url': media.file_url,
            'order': len(photos)
        })
        property_obj.photos = photos
    
    await db.commit()
    await db.refresh(media)
    
    return {
        "message": "Media uploaded successfully",
        "media_id": str(media.id),
        "distance_verified": distance is not None,
        "distance_meters": int(distance) if distance else None
    }
