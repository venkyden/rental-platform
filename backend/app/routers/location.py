"""
Property location enrichment endpoint.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.utils.location import enrich_property_location

router = APIRouter(prefix="/location", tags=["Location"])


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
        request.address,
        request.city,
        request.postal_code,
        request.country
    )
    
    return result
