"""
Property listing API endpoints.
"""

import os
import secrets
import logging
from datetime import timedelta
from app.core.timeutils import naive_utcnow
from decimal import Decimal
from typing import List, Optional, cast
from uuid import UUID

from fastapi import (APIRouter, Depends, File, HTTPException, Query, Request,
                     UploadFile, status)
from sqlalchemy import and_
from sqlalchemy import delete as sql_delete
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel

from app.core.database import get_db
from app.models.property import Property, PropertyMedia, PropertyMediaSession, SavedProperty
from app.models.property_schemas import (MediaSessionCreate,
                                         MediaSessionResponse,
                                         MediaUploadMetadata, PropertyCreate,
                                         PropertyResponse, PropertyUpdate,
                                         PropertyMatchResponse, DescriptionGenerationRequest)
from app.models.user import User
from app.routers.auth import get_current_user, get_current_user_optional

# Rate limiting
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)


class PublishRequest(BaseModel):
    acknowledge_dpe_warning: bool = False

router = APIRouter(prefix="/properties", tags=["Properties"])
logger = logging.getLogger(__name__)

# Upload directory
UPLOAD_DIR = os.environ.get("UPLOAD_DIR_PROPS", "uploads/properties")
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except PermissionError:
    pass


def calculate_distance(
    lat1: Decimal, lon1: Decimal, lat2: Decimal, lon2: Decimal
) -> float:
    """Calculate distance between two GPS coordinates in meters (Haversine formula)"""
    from math import asin, cos, radians, sin, sqrt

    flat1, flon1, flat2, flon2 = map(float, [lat1, lon1, lat2, lon2])

    # Convert to radians
    flat1, flon1, flat2, flon2 = map(radians, [flat1, flon1, flat2, flon2])

    # Haversine formula
    dlat = flat2 - flat1
    dlon = flon2 - flon1
    a = sin(dlat / 2) ** 2 + cos(flat1) * cos(flat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    r = 6371000  # Earth radius in meters

    return c * r


@router.post("", response_model=PropertyResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_property(
    request: Request,
    property_data: PropertyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new property listing"""

    # Only landlords and property managers can create properties
    if current_user.role not in ["landlord", "property_manager", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only landlords or managers can create properties",
        )

    # Create property
    new_property = Property(landlord_id=current_user.id, **property_data.model_dump())

    db.add(new_property)
    await db.commit()
    await db.refresh(new_property)

    return new_property


@router.post("/generate-description", response_model=dict)
@limiter.limit("5/minute")
async def generate_property_description(
    request: Request,
    payload: DescriptionGenerationRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a property description using Gemini based on property parameters.

    Falls back to a template-based description if Gemini is not configured or
    if the API call fails (quota exceeded, network error, etc.).
    """
    from app.core.config import settings

    def _build_fallback_description() -> str:
        """Template-based description when Gemini is unavailable."""
        is_fr = payload.language == "fr"
        city = payload.city or ("la ville" if is_fr else "the city")
        prop_type = payload.property_type or ("bien" if is_fr else "property")
        sqm = payload.size_sqm or ""
        beds = payload.bedrooms or 0

        if is_fr:
            desc = f"Magnifique {prop_type} situé au coeur de {city}. "
            desc += f"Cette propriété spacieuse de {sqm}m² " if sqm else "Cette superbe propriété "
            desc += f"comprend {beds} chambre(s) et des équipements modernes. "
            if payload.monthly_rent:
                desc += f"Disponible pour un loyer mensuel de {payload.monthly_rent} EUR. "
            if payload.address:
                desc += f"Idéalement situé à {payload.address}. "
            if payload.amenities:
                desc += f"Équipements inclus: {', '.join(payload.amenities)}. "
            desc += "Idéal pour ceux qui recherchent le confort et la commodité."
        else:
            desc = f"Magnificent {prop_type} located in the heart of {city}. "
            desc += f"This spacious {sqm}m² property " if sqm else "This beautiful property "
            desc += f"features {beds} bedroom(s) and modern amenities. "
            if payload.monthly_rent:
                desc += f"Available for a monthly rent of {payload.monthly_rent} EUR. "
            if payload.address:
                desc += f"Ideally located at {payload.address}. "
            if payload.amenities:
                desc += f"Included amenities: {', '.join(payload.amenities)}. "
            desc += "Ideal for those seeking comfort and convenience."
        return desc

    if not settings.GEMINI_API_KEY:
        return {"description": _build_fallback_description()}

    try:
        from google import genai

        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        lang_name = "French" if payload.language == "fr" else "English"

        prompt = (
            f"Write a beautiful, engaging, professional real estate rental listing description in {lang_name} "
            f"for a {payload.property_type}. "
        )
        if payload.address or payload.city:
            prompt += f"Location: {payload.address or ''}, {payload.city or ''}"
            if payload.postal_code:
                prompt += f" ({payload.postal_code})"
            if payload.country:
                prompt += f", {payload.country}"
            prompt += ". "
        if payload.size_sqm:
            prompt += f"Size: {payload.size_sqm} m². "
        if payload.bedrooms:
            prompt += f"Bedrooms: {payload.bedrooms}. "
        if payload.rooms_count:
            prompt += f"Total Rooms: {payload.rooms_count}. "
        if payload.bathrooms:
            prompt += f"Bathrooms: {payload.bathrooms}. "
        if payload.furnished is not None:
            prompt += f"Furnished: {'Yes' if payload.furnished else 'No'}. "
        if payload.monthly_rent:
            prompt += f"Monthly rent: {payload.monthly_rent} EUR. "
        if payload.amenities:
            prompt += f"Amenities: {', '.join(payload.amenities)}. "
        if payload.custom_amenities:
            prompt += f"Custom Amenities: {', '.join(payload.custom_amenities)}. "
        if payload.public_transport:
            prompt += f"Nearby Public Transport: {', '.join(payload.public_transport)}. "
        if payload.nearby_landmarks:
            prompt += f"Nearby Landmarks: {', '.join(payload.nearby_landmarks)}. "

        prompt += (
            f"\nMake the description appealing to potential tenants, highlight convenience, and structure it with brief paragraphs or bullet points. "
            f"Write the entire description ONLY in {lang_name}. Do not include any translation or notes. "
            f"Return ONLY the description text, do not include any other markdown formatting wrapper (e.g. do not wrap in backticks or markdown code block) or conversational intro/outro."
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt],  # type: ignore
        )

        return {"description": (response.text or "").strip()}

    except Exception as e:
        # Log the real error for debugging but degrade gracefully — never 500 the user
        logger.error(f"Gemini generate-description failed, using fallback: {e}", exc_info=True)
        return {"description": _build_fallback_description()}




def _landlord_trust_fields(landlord) -> dict:
    """First name + identity flag for the listing trust line. Never exposes full name.

    full_name is free text: a single token may be a bare surname, and casing can't
    disambiguate "DUPONT Marc" (NOM Prénom) from "MARC Dupont" (caps given name) —
    same shape, opposite meaning. Any all-caps token therefore makes the name
    ambiguous: degrade to None rather than guess and leak a surname. Only the plain
    "Prénom Nom" shape emits its first token. The dedicated first_name column is
    authoritative when set; the heuristic is the fallback for legacy profiles.
    """
    if landlord is None:
        return {"landlord_first_name": None, "landlord_identity_verified": False}
    first = (getattr(landlord, "first_name", None) or "").strip() or None
    if first is None:
        tokens = (landlord.full_name or "").split()
        if len(tokens) >= 2 and not any(t.isupper() and len(t) > 1 for t in tokens):
            first = tokens[0]
    return {
        "landlord_first_name": first or None,
        "landlord_identity_verified": bool(landlord.identity_verified),
    }


def _apply_property_filters(
    query,
    params: dict,
    amenities: List[str],
    default_sort_col,
    current_user: Optional[User] = None,
):
    city = params.get("city")
    min_rent = params.get("min_rent")
    max_rent = params.get("max_rent")
    bedrooms = params.get("bedrooms")
    rooms_count = params.get("rooms_count")
    rooms_count_min = params.get("rooms_count_min")
    property_type = params.get("property_type")
    furnished = params.get("furnished")
    caf_eligible = params.get("caf_eligible")
    caf_eligible = params.get("caf_eligible")
    landlord_id = params.get("landlord_id")
    sort_by = params.get("sort_by", "created_at")
    order_direction = params.get("order_direction", "desc")
    verified_only = params.get("verified_only")
    
    # Secure Status Filtering
    requested_status = params.get("status", "active")
    if not current_user or current_user.role not in ["landlord", "property_manager", "admin"]:
        query = query.where(Property.status == "active")
    else:
        # Landlords/PMs can only view non-active properties if they are explicitly querying their own
        if landlord_id and str(current_user.id) == str(landlord_id):
            if requested_status != "all":
                query = query.where(Property.status == requested_status)
            else:
                # If "all", exclude deleted
                query = query.where(Property.status != "deleted")
        else:
            query = query.where(Property.status == "active")

    if city:
        query = query.where(Property.city.ilike(f"%{city}%"))
    
    # Parse numeric/bool params
    try:
        min_rent_val = float(min_rent) if min_rent and min_rent != "" else None
        max_rent_val = float(max_rent) if max_rent and max_rent != "" else None
    except (ValueError, TypeError):
        min_rent_val = max_rent_val = None

    if min_rent_val is not None or max_rent_val is not None:
        from decimal import Decimal
        from sqlalchemy import case, func

        min_rent_dec = Decimal(str(min_rent_val)) if min_rent_val is not None else None
        max_rent_dec = Decimal(str(max_rent_val)) if max_rent_val is not None else None

        total_rent = Property.monthly_rent + case(
            (Property.charges_included == True, Decimal("0")),
            else_=func.coalesce(Property.charges, Decimal("0")),
        )
        if min_rent_dec is not None:
            query = query.where(total_rent >= min_rent_dec)
        if max_rent_dec is not None:
            query = query.where(total_rent <= max_rent_dec)

    if bedrooms and bedrooms != "":
        try:
            query = query.where(Property.bedrooms >= int(bedrooms))
        except (ValueError, TypeError):
            pass

    if rooms_count and rooms_count != "":
        try:
            query = query.where(Property.rooms_count == int(rooms_count))
        except (ValueError, TypeError):
            pass

    if rooms_count_min and rooms_count_min != "":
        try:
            query = query.where(Property.rooms_count >= int(rooms_count_min))
        except (ValueError, TypeError):
            pass

    if property_type:
        query = query.where(Property.property_type == property_type)

    if furnished and furnished != "":
        val = furnished.lower() == "true" if isinstance(furnished, str) else bool(furnished)
        query = query.where(Property.furnished == val)

    if caf_eligible and caf_eligible != "":
        val = caf_eligible.lower() == "true" if isinstance(caf_eligible, str) else bool(caf_eligible)
        query = query.where(Property.caf_eligible == val)

    if amenities:
        for amenity in amenities:
            query = query.where(Property.amenities.contains([amenity]))

    if verified_only:
        query = query.where(Property.ownership_verified == True)

    if landlord_id:
        try:
            query = query.where(Property.landlord_id == UUID(landlord_id))
        except (ValueError, TypeError):
            pass

    # Sorting — SECURITY: allowlist to prevent column enumeration
    ALLOWED_SORT_FIELDS = ['created_at', 'monthly_rent', 'size_sqm', 'views_count', 'published_at', 'bedrooms']
    if sort_by and sort_by in ALLOWED_SORT_FIELDS and hasattr(Property, sort_by):
        col = getattr(Property, sort_by)
        if order_direction == "desc":
            query = query.order_by(col.desc())
        else:
            query = query.order_by(col.asc())
    else:
        query = query.order_by(default_sort_col)

    return query


@router.get("/wishlist", response_model=List[PropertyResponse])
async def list_saved_properties(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List all properties saved by the current user"""
    logger.info(f"Wishlist request received for user: {current_user.id if current_user else 'None'}")
    if not current_user:
        return []
    
    # Extract params from request
    params = dict(request.query_params)
    amenities = request.query_params.getlist("amenities")
    skip = params.get("skip", "0")
    limit = params.get("limit", "20")

    query = (
        select(Property)
        .join(SavedProperty, SavedProperty.property_id == Property.id)
        .where(SavedProperty.user_id == current_user.id)
    )

    query = _apply_property_filters(
        query=query,
        params=params,
        amenities=amenities,
        default_sort_col=SavedProperty.created_at.desc(),
        current_user=current_user,
    )

    # Pagination
    try:
        skip_val = int(skip) if skip else 0
        limit_val = int(limit) if limit else 20
    except (ValueError, TypeError):
        skip_val = 0
        limit_val = 20

    query = query.offset(skip_val).limit(limit_val)
    result = await db.execute(query)
    properties = result.scalars().all()
    
    response = []
    for prop in properties:
        prop_dict = PropertyResponse.model_validate(prop).model_dump()
        prop_dict["is_saved"] = True
        response.append(prop_dict)
        
    return response


@router.get("/recommendations", response_model=List[PropertyMatchResponse], deprecated=True)
async def get_recommendations(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Deprecated — always returns empty list.

    Personalized counterparty recommendation is entremise under Loi Hoguet;
    Roomivo operates without carte professionnelle and must never perform it.
    Stub retained so existing clients don't break.
    """
    return []


@router.get("", response_model=List[PropertyResponse])
@limiter.limit("60/minute")
async def list_properties(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List properties with filters and sorting using direct request parameter access"""
    # Extract params from request
    params = dict(request.query_params)
    amenities = request.query_params.getlist("amenities")
    skip = params.get("skip", "0")
    limit = params.get("limit", "20")

    from sqlalchemy.orm import selectinload
    query = select(Property).options(selectinload(Property.landlord))
    query = _apply_property_filters(
        query=query,
        params=params,
        amenities=amenities,
        default_sort_col=Property.created_at.desc(),
        current_user=current_user,
    )

    # Pagination — enforce a hard server-side maximum to prevent abuse
    try:
        skip_val = int(skip) if skip else 0
        limit_val = min(int(limit) if limit else 20, 200)
    except (ValueError, TypeError):
        skip_val = 0
        limit_val = 20

    query = query.offset(skip_val).limit(limit_val)
    result = await db.execute(query)
    properties = result.scalars().all()
    
    response = []

    # Batch-fetch saved property IDs for the current user
    saved_property_ids = set()
    if current_user:
        saved_result = await db.execute(
            select(SavedProperty.property_id).where(
                SavedProperty.user_id == current_user.id
            )
        )
        saved_property_ids = {row[0] for row in saved_result.all()}

    for prop in properties:
        prop_dict = PropertyResponse.model_validate(prop).model_dump()
        prop_dict["is_saved"] = prop.id in saved_property_ids
        prop_dict.update(_landlord_trust_fields(prop.landlord))
        response.append(prop_dict)
        
    return response


@router.post("/{property_id}/save", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def save_property(
    request: Request,
    property_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a property to wishlist"""
    # Check if exists
    result = await db.execute(select(Property).where(Property.id == property_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Property not found")

    # Check if already saved
    existing = await db.execute(
        select(SavedProperty).where(
            and_(
                SavedProperty.user_id == current_user.id,
                SavedProperty.property_id == property_id
            )
        )
    )
    if existing.scalar_one_or_none():
        return {"message": "Property already saved"}

    saved = SavedProperty(user_id=current_user.id, property_id=property_id)
    db.add(saved)
    await db.commit()
    return {"message": "Property saved to wishlist"}


@router.delete("/{property_id}/save", status_code=status.HTTP_204_NO_CONTENT)
async def unsave_property(
    property_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a property from wishlist"""
    await db.execute(
        sql_delete(SavedProperty).where(
            and_(
                SavedProperty.user_id == current_user.id,
                SavedProperty.property_id == property_id
            )
        )
    )
    await db.commit()
    return


@router.get("/{property_id}", response_model=PropertyResponse)
async def get_property(
    property_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Get property details"""
    # Defensive check against route priority issues
    if property_id == "saved":
        raise HTTPException(status_code=400, detail="Ambiguous route. Please use /properties/saved directly.")

    try:
        prop_uuid = UUID(property_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid property ID format")

    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Property)
        .options(selectinload(Property.landlord))
        .where(Property.id == prop_uuid)
    )
    property_obj = result.scalar_one_or_none()

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Property not found"
        )

    # Secure visibility check for non-active properties
    if property_obj.status != "active":
        if not current_user:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this property")
        
        has_permission = property_obj.landlord_id == current_user.id
        if not has_permission and current_user.role != "admin":
            # Check team access
            from app.models.team import TeamMember, TeamMemberProperty
            team_access = (await db.execute(
                select(TeamMemberProperty).join(
                    TeamMember, TeamMember.id == TeamMemberProperty.team_member_id
                ).where(
                    and_(
                        TeamMember.member_user_id == current_user.id,
                        TeamMemberProperty.property_id == prop_uuid,
                        TeamMember.status == "active"
                    )
                )
            )).scalar_one_or_none()
            
            if not team_access:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this property")

    # SECURE CHECK: Ensure photos JSONB is in sync with PropertyMedia table
    # This is necessary because the JSONB field might be out of sync if uploads happened concurrently
    media_query = select(PropertyMedia).where(PropertyMedia.property_id == prop_uuid)
    media_result = await db.execute(media_query)
    all_media = media_result.scalars().all()

    if all_media:
        # Re-build photos array if it's out of sync (JSONB might be null or have fewer items)
        photos = cast(Optional[list], property_obj.photos)
        if not photos or len(photos) < len(all_media):
            new_photos = []
            for i, m in enumerate(all_media):
                new_photos.append({
                    "url": m.file_url,
                    "order": i,
                    "room_index": m.room_index,
                    "room_label": m.room_label,
                    "media_type": m.media_type,
                })
            property_obj.photos = new_photos  # type: ignore
            flag_modified(property_obj, "photos")

    # Increment view count (exclude property owner to prevent inflation)
    # Use a raw UPDATE to avoid flushing the photo sync unintentionally
    is_owner = current_user and current_user.id == property_obj.landlord_id
    if not is_owner:
        await db.execute(
            update(Property)
            .where(Property.id == prop_uuid)
            .values(views_count=Property.views_count + 1)
        )
        await db.commit()
        property_obj.views_count += 1  # type: ignore
    else:
        # If we modified photos, we need to commit
        await db.commit()

    prop_dict = PropertyResponse.model_validate(property_obj).model_dump()
    prop_dict.update(_landlord_trust_fields(property_obj.landlord))
    if property_obj.landlord:
        prop_dict["landlord_bio"] = property_obj.landlord.bio
        prop_dict["landlord_member_since"] = property_obj.landlord.created_at

    # Calculate is_saved
    is_saved = False
    if current_user is not None:
        saved_result = await db.execute(
            select(SavedProperty).where(
                and_(
                    SavedProperty.user_id == current_user.id,
                    SavedProperty.property_id == prop_uuid
                )
            )
        )
        if saved_result.scalar_one_or_none():
            is_saved = True
    prop_dict["is_saved"] = is_saved
    return prop_dict


@router.put("/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: str,
    property_data: PropertyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update property"""

    try:
        prop_uuid = UUID(property_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid property ID format")

    result = await db.execute(select(Property).where(Property.id == prop_uuid))
    property_obj = result.scalar_one_or_none()

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Property not found"
        )

    # Check ownership or team permissions
    has_permission = property_obj.landlord_id == current_user.id
    
    if not has_permission:
        # Check team access with FULL_ACCESS permission
        from app.models.team import TeamMember, TeamMemberProperty, PermissionLevel
        
        team_access = (await db.execute(
            select(TeamMemberProperty).join(
                TeamMember, TeamMember.id == TeamMemberProperty.team_member_id
            ).where(
                and_(
                    TeamMember.member_user_id == current_user.id,
                    TeamMemberProperty.property_id == prop_uuid,
                    TeamMember.status == "active"
                )
            )
        )).scalar_one_or_none()
        
        if team_access:
            # Use override if exists, otherwise default member level
            perm = team_access.permission_override or team_access.team_member.permission_level
            if perm == PermissionLevel.FULL_ACCESS:
                has_permission = True

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit this property",
        )

    # Update fields
    update_data = property_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(property_obj, field, value)

    # If the property is active, it must remain compliant with French law.
    if property_obj.status == "active":
        from app.services.french_compliance import validate_property_compliance
        compliance_errors = validate_property_compliance(property_obj)
        if compliance_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=" ".join(compliance_errors),
            )

    property_obj.updated_at = naive_utcnow()  # type: ignore

    await db.commit()
    await db.refresh(property_obj)

    return property_obj


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(
    property_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete property"""

    try:
        prop_uuid = UUID(property_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid property ID format")

    result = await db.execute(select(Property).where(Property.id == prop_uuid))
    property_obj = result.scalar_one_or_none()

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Property not found"
        )

    # Check ownership
    if property_obj.landlord_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own properties",
        )

    # Use soft delete to preserve historical data (leases, applications) without cascading FK errors
    property_obj.status = "deleted"
    await db.commit()

    return

@router.put("/{property_id}/archive", response_model=PropertyResponse)
async def archive_property(
    property_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archive property"""
    try:
        prop_uuid = UUID(property_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid property ID format")

    result = await db.execute(select(Property).where(Property.id == prop_uuid))
    property_obj = result.scalar_one_or_none()

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Property not found"
        )

    if property_obj.landlord_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only archive your own properties",
        )

    property_obj.status = "archived"
    await db.commit()
    await db.refresh(property_obj)
    
    return property_obj

@router.put("/{property_id}/unarchive", response_model=PropertyResponse)
async def unarchive_property(
    property_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unarchive property (returns to draft)"""
    try:
        prop_uuid = UUID(property_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid property ID format")

    result = await db.execute(select(Property).where(Property.id == prop_uuid))
    property_obj = result.scalar_one_or_none()

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Property not found"
        )

    if property_obj.landlord_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only unarchive your own properties",
        )

    property_obj.status = "draft"
    await db.commit()
    await db.refresh(property_obj)
    
    return property_obj


@router.post("/{property_id}/publish", response_model=PropertyResponse)
@limiter.limit("10/minute")
async def publish_property(
    request: Request,
    property_id: UUID,
    payload: Optional[PublishRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Publish a draft property"""

    # Get property
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Property)
        .options(selectinload(Property.landlord))
        .where(Property.id == property_id)
    )
    property_obj = result.scalar_one_or_none()

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Property not found"
        )

    # Check ownership or team permissions
    has_permission = property_obj.landlord_id == current_user.id
    
    if not has_permission:
        # Check team access with FULL_ACCESS permission
        from app.models.team import TeamMember, TeamMemberProperty, PermissionLevel
        
        team_access = (await db.execute(
            select(TeamMemberProperty).join(
                TeamMember, TeamMember.id == TeamMemberProperty.team_member_id
            ).where(
                and_(
                    TeamMember.member_user_id == current_user.id,
                    TeamMemberProperty.property_id == property_id,
                    TeamMember.status == "active"
                )
            )
        )).scalar_one_or_none()
        
        if team_access:
            perm = team_access.permission_override or team_access.team_member.permission_level
            if perm == PermissionLevel.FULL_ACCESS:
                has_permission = True

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to publish this property",
        )

    # WP3 gate: a listing without a landlord bio ships an anonymous counterparty —
    # the owner (not the publishing team member) must have completed their bio.
    if not ((property_obj.landlord.bio if property_obj.landlord else "") or "").strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="landlord_bio_required",
        )

    # Check per-room media coverage
    room_details = cast(list, property_obj.room_details) if property_obj.room_details else []
    if len(room_details) > 0:
        # Query all media for this property
        from app.models.property import PropertyMedia

        media_result = await db.execute(
            select(PropertyMedia).where(PropertyMedia.property_id == property_id)
        )
        all_media = media_result.scalars().all()

        # Build set of room indices that have media
        rooms_with_media = set()
        has_common_media = False
        for m in all_media:
            if m.room_index is not None:
                rooms_with_media.add(m.room_index)
            else:
                has_common_media = True

        # Check each room has at least 1 photo or video
        missing_rooms = []
        for i, room in enumerate(room_details):
            if i not in rooms_with_media:
                label = room.get("label", f"Room {i + 1}")
                missing_rooms.append(label)

        if missing_rooms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing media for: {', '.join(missing_rooms)}. Upload at least 1 photo or video per room.",
            )
    else:
        # No room_details — fall back to property-level check
        photos = cast(Optional[list], property_obj.photos)
        if not photos or len(photos) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Property must have at least 1 photo or video to publish",
            )

    # ── French Compliance Validations ──────────────────────────────────────

    # DPE class: décence énergétique (warn + acknowledge, not block) and
    # L126-33 (the class must appear in the ad, and be accurate).
    from datetime import date
    from app.services.dpe_compliance import assess_dpe

    od = cast(dict, property_obj.ownership_data or {})
    assessment = assess_dpe(
        self_typed_class=cast(Optional[str], property_obj.dpe_rating),
        ademe_class=od.get("dpe_class"),
        assurance=od.get("dpe_assurance"),
        expired=od.get("dpe_expired"),
        today=date.today(),
    )

    # L126-33: a rental ad must state the DPE class.
    if assessment.authoritative_class is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A DPE (Diagnostic de Performance Énergétique) class is required to "
                "publish a rental listing (Art. L126-33 CCH). — Une classe DPE est "
                "obligatoire pour publier une annonce de location (art. L126-33 CCH)."
            ),
        )

    if property_obj.dpe_rating != assessment.authoritative_class:
        property_obj.dpe_rating = assessment.authoritative_class  # type: ignore

    acknowledged = payload.acknowledge_dpe_warning if payload else False
    if assessment.requires_acknowledgment and not acknowledged:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "dpe_acknowledgment_required",
                "warnings": [
                    {"code": w.code, "severity": w.severity, "en": w.en, "fr": w.fr}
                    for w in assessment.warnings
                ],
            },
        )
    if assessment.requires_acknowledgment and acknowledged:
        property_obj.ownership_data = {
            **od,
            "dpe_decence_acknowledged_at": naive_utcnow().isoformat(),
            "dpe_decence_acknowledged_class": assessment.authoritative_class,
        }  # type: ignore

    # Remaining French compliance (deposit cap, surface, rent control) — consolidated.
    from app.services.french_compliance import validate_property_compliance
    compliance_errors = validate_property_compliance(property_obj)
    if compliance_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=" ".join(compliance_errors),
        )

    # ── End French Compliance ────────────────────────────────────────────

    # PR-7: Zone tendue advisory — non-blocking, stored for audit + surfaced via
    # is_zone_tendue on PropertyResponse. Advisory fires when in zone tendue and
    # loyer_reference_majore absent; cleared on re-publish if landlord supplies
    # it (prevents stale advisory).
    from app.services.zone_tendue import is_zone_tendue
    _od = property_obj.ownership_data or {}
    if is_zone_tendue(property_obj.postal_code) and not property_obj.loyer_reference_majore:
        property_obj.ownership_data = {
            **_od,
            "zone_tendue_advisory": True,
            "zone_tendue_note": (
                "This property is in a zone tendue. Encadrement des loyers (Loi ALUR/"
                "ELAN Art. 140) may apply — set loyer_reference_majore to validate "
                "rent compliance. / Ce bien est en zone tendue. L'encadrement des "
                "loyers peut s'appliquer — renseignez le loyer de référence majoré "
                "pour valider la conformité."
            ),
        }
    elif _od.get("zone_tendue_advisory"):
        # Landlord has since supplied loyer_reference_majore — clear stale advisory.
        property_obj.ownership_data = {
            k: v for k, v in _od.items()
            if k not in ("zone_tendue_advisory", "zone_tendue_note")
        }

    # Publish
    property_obj.status = "active"  # type: ignore
    property_obj.published_at = naive_utcnow()  # type: ignore

    await db.commit()
    await db.refresh(property_obj)

    return property_obj


@router.post("/{property_id}/media-session", response_model=MediaSessionResponse)
@limiter.limit("10/minute")
async def create_media_session(
    request: Request,
    property_id: UUID,
    room_index: Optional[int] = Query(None, description="Room index (0-based)"),
    room_label: Optional[str] = Query(None, description="Room label e.g. 'Bedroom 1'"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a shareable link/QR code for media capture, optionally scoped to a room"""

    # Get property
    result = await db.execute(select(Property).where(Property.id == property_id))
    property_obj = result.scalar_one_or_none()

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Property not found"
        )

    # Check ownership
    if property_obj.landlord_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create media sessions for your own properties",
        )

    # Generate unique code
    verification_code = secrets.token_urlsafe(32)

    # Create session
    session = PropertyMediaSession(
        property_id=property_id,
        verification_code=verification_code,
        generated_by=current_user.id,
        expires_at=naive_utcnow() + timedelta(days=7),
        target_address=f"{property_obj.address_line1}, {property_obj.city} {property_obj.postal_code}",
        target_latitude=property_obj.latitude,
        target_longitude=property_obj.longitude,
        gps_radius_meters=500,
        room_index=room_index,
        room_label=room_label,
    )

    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Generate URL
    from app.core.config import settings

    capture_url = f"{settings.FRONTEND_URL}/capture/{verification_code}"

    # Fetch room details for the capture page room selector
    rooms_list = None
    room_details = cast(Optional[list], property_obj.room_details)
    if room_details and len(room_details) > 0:
        rooms_list = [
            {"index": i, "label": f"Bedroom {i + 1}"}
            for i in range(len(room_details))
        ]

    return {
        "id": session.id,
        "property_id": property_id,
        "verification_code": verification_code,
        "capture_url": capture_url,
        "expires_at": session.expires_at,
        "target_address": session.target_address,
        "target_latitude": session.target_latitude,
        "target_longitude": session.target_longitude,
        "gps_radius_meters": session.gps_radius_meters,
        "location_verified": session.location_verified,
        "room_index": session.room_index,
        "room_label": session.room_label,
        "rooms": rooms_list,
    }


@router.get("/media-sessions/{code}")
async def get_media_session(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Get media session details by verification code (no auth — used by mobile capture page)"""

    result = await db.execute(
        select(PropertyMediaSession).where(
            PropertyMediaSession.verification_code == code
        )
    )
    session = result.scalar_one_or_none()

    if not session or not session.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired session",
        )

    if session.expires_at < naive_utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has expired",
        )

    # Get property for room details
    prop_result = await db.execute(
        select(Property).where(Property.id == session.property_id)
    )
    property_obj = prop_result.scalar_one_or_none()

    rooms_list = None
    if property_obj:
        room_details = cast(Optional[list], property_obj.room_details)
        if room_details and len(room_details) > 0:
            rooms_list = [
                {"index": i, "label": f"Bedroom {i + 1}"}
                for i in range(len(room_details))
            ]

    return {
        "target_address": session.target_address,
        "target_latitude": float(cast(Decimal, session.target_latitude)) if session.target_latitude else None,
        "target_longitude": float(cast(Decimal, session.target_longitude)) if session.target_longitude else None,
        "gps_radius_meters": session.gps_radius_meters,
        "location_verified": session.location_verified or False,
        "expires_at": session.expires_at,
        "rooms": rooms_list,
    }


@router.post("/media/upload")
@limiter.limit("20/minute")
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    metadata: str = Query(...),  # JSON string
    verification_code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload property media with GPS verification"""
    # File type validation
    ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
    ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".avi", ".m4v"}
    ALLOWED_IMAGE_MIMETYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
    ALLOWED_VIDEO_MIMETYPES = {"video/mp4", "video/quicktime", "video/webm", "video/x-msvideo", "video/x-m4v"}
    ALLOWED_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS
    ALLOWED_MIMETYPES = ALLOWED_IMAGE_MIMETYPES | ALLOWED_VIDEO_MIMETYPES

    MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10MB for images
    MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB for videos
    
    file_ext = os.path.splitext(file.filename.lower())[1] if file.filename else ""
    content_type = (file.content_type or "").lower()

    if file_ext not in ALLOWED_EXTENSIONS and content_type not in ALLOWED_MIMETYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file_ext}'. Allowed: images ({', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}), videos ({', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))})."
        )

    is_video = file_ext in ALLOWED_VIDEO_EXTENSIONS or content_type in ALLOWED_VIDEO_MIMETYPES
    max_file_size = MAX_VIDEO_SIZE if is_video else MAX_IMAGE_SIZE

    # File size validation
    try:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
    except Exception:
        file_size = 0

    if file_size > max_file_size:
        limit_mb = max_file_size // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds the {limit_mb}MB limit for {'videos' if is_video else 'images'}."
        )

    import json
    from pydantic import ValidationError

    # Parse metadata
    try:
        meta = json.loads(metadata)
        meta_obj = MediaUploadMetadata(**meta)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid metadata JSON: {e}",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.errors(),
        )

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
            detail="Invalid or expired verification code",
        )

    # Check expiry
    if session.expires_at < naive_utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired",
        )

    # GPS verification (if coordinates provided)
    distance = None
    gps_verified = False
    verification_status = "pending_review"

    # Check accuracy — if too inaccurate (>200m), treat as unverified
    accuracy_ok = True
    if meta_obj.gps_accuracy and meta_obj.gps_accuracy > 200:
        accuracy_ok = False

    if meta_obj.latitude and meta_obj.longitude and accuracy_ok:
        if session.target_latitude and session.target_longitude:
            distance = calculate_distance(
                cast(Decimal, session.target_latitude),
                cast(Decimal, session.target_longitude),
                meta_obj.latitude,
                meta_obj.longitude,
            )

            # Check if within radius
            if distance <= session.gps_radius_meters:
                gps_verified = True
                verification_status = "verified"

                # Persist session-level verification (verify-once)
                if not session.location_verified:
                    session.location_verified = True  # type: ignore
                    session.location_verified_at = naive_utcnow()  # type: ignore

    # Determine room info — prefer metadata over session
    upload_room_index = meta_obj.room_index if meta_obj.room_index is not None else session.room_index
    upload_room_label = meta_obj.room_label or session.room_label

    # Save file via cloud storage service (R2 / local fallback)
    from io import BytesIO
    from app.services.storage import storage

    content = await file.read()
    file_extension = os.path.splitext(file.filename)[1] if file.filename else ""
    if not file_extension:
        # Infer extension from MIME type (common for mobile camera captures)
        _mime_to_ext = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/heic": ".heic",
            "image/heif": ".heif",
            "video/mp4": ".mp4",
            "video/quicktime": ".mov",
            "video/webm": ".webm",
        }
        file_extension = _mime_to_ext.get((file.content_type or "").lower(), ".jpg")
    safe_filename = f"{secrets.token_urlsafe(16)}{file_extension}"

    try:
        upload_result = await storage.upload_file(
            file_data=BytesIO(content),
            filename=safe_filename,
            content_type=file.content_type or "application/octet-stream",
            folder=f"properties/{session.property_id}",
        )
        file_url = upload_result["url"]
    except RuntimeError as e:
        logger.error(f"Storage runtime error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage service unavailable: {e}",
        )
    except Exception as e:
        logger.exception("Unexpected error during media upload")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during upload",
        )

    # Create media record
    media = PropertyMedia(
        property_id=session.property_id,
        session_id=session.id,
        media_type=meta_obj.media_type,
        file_url=file_url,
        file_size=len(content),
        room_index=upload_room_index,
        room_label=upload_room_label,
        captured_latitude=meta_obj.latitude,
        captured_longitude=meta_obj.longitude,
        gps_accuracy=Decimal(str(meta_obj.gps_accuracy)) if meta_obj.gps_accuracy else None,
        distance_from_target=Decimal(str(distance)) if distance else None,
        captured_at=meta_obj.captured_at.replace(tzinfo=None) if meta_obj.captured_at else None,
        device_id=meta_obj.device_id,
        watermark_address=meta_obj.watermark_address,
        verification_status=verification_status,
        verified_at=naive_utcnow() if verification_status == "verified" else None,
    )

    db.add(media)

    # Update property photos array
    result = await db.execute(
        select(Property).where(Property.id == session.property_id)
    )
    property_obj = result.scalar_one_or_none()

    if property_obj:
        # Crucial: Initialize photos as a NEW list if it's currently None or empty
        # If we use += or append to an object pulled from SQLAlchemy without flag_modified, it might not track correctly.
        photos = cast(Optional[list], property_obj.photos)
        current_photos = list(photos) if photos else []
        
        current_photos.append({
            "url": media.file_url,
            "order": len(current_photos),
            "room_index": upload_room_index,
            "room_label": upload_room_label,
            "media_type": meta_obj.media_type,
        })
        
        property_obj.photos = current_photos  # type: ignore
        flag_modified(property_obj, "photos")

    await db.commit()
    await db.refresh(media)

    return {
        "message": "Media uploaded successfully",
        "media_id": str(media.id),
        "room_index": media.room_index,
        "room_label": media.room_label,
        "media_type": meta_obj.media_type,
        "gps_verified": gps_verified,
        "distance_meters": int(distance) if distance else None,
        "verification_status": verification_status,
    }
