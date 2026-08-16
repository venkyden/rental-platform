"""
Property location enrichment + directions endpoints.
"""

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.utils.location import enrich_property_location

router = APIRouter(prefix="/location", tags=["Location"])
limiter = Limiter(key_func=get_remote_address)


class AddressEnrichRequest(BaseModel):
    address: str
    city: str
    postal_code: str
    country: str = "France"


@router.post("/enrich")
async def enrich_address(request: AddressEnrichRequest):
    """
    Geocode address and get nearby public transport and landmarks.
    Returns GPS coordinates, transit options, and nearby POIs.
    """
    result = await enrich_property_location(
        request.address, request.city, request.postal_code, request.country
    )

    return result


class DirectionsRequest(BaseModel):
    origin_lat: float = Field(..., ge=-90, le=90)
    origin_lng: float = Field(..., ge=-180, le=180)
    dest_lat: float = Field(..., ge=-90, le=90)
    dest_lng: float = Field(..., ge=-180, le=180)
    mode: str  # "walking" | "cycling" | "driving"


@router.post("/directions")
@limiter.limit("20/minute")
async def get_directions_route(request: Request, body: DirectionsRequest):
    """
    Walk/bike/car route + distance/duration between an origin (already
    geocoded client-side via AddressAutocomplete/Photon) and a destination
    (a property's stored coordinates). No server-side geocoding here.
    """
    from app.core.config import settings
    from app.services import ors_directions

    if not settings.ORS_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Directions service not configured",
        )

    try:
        result = await ors_directions.get_directions(
            body.origin_lat, body.origin_lng, body.dest_lat, body.dest_lng, body.mode,
            api_key=settings.ORS_API_KEY,
        )
    except ors_directions.InvalidMode:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid mode")
    except ors_directions.DirectionsUnavailable:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Directions temporarily unavailable",
        )

    return {
        "distance_m": result.distance_m,
        "duration_s": result.duration_s,
        "geometry": result.geometry,
    }
