"""
Pydantic schemas for property endpoints.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class PropertyCreate(BaseModel):
    """Schema for creating a new property"""

    title: str = Field(..., min_length=10, max_length=200)
    description: Optional[str] = None
    property_type: str  # 'apartment', 'house', 'studio', 'room'

    address_line1: str
    address_line2: Optional[str] = None
    city: str
    postal_code: str
    country: str = "France"

    bedrooms: int = Field(..., ge=0)
    bathrooms: Optional[Decimal] = Field(None, ge=0)
    size_sqm: Optional[Decimal] = Field(None, gt=0)
    floor_number: Optional[int] = None
    furnished: bool = False

    accommodation_capacity: Optional[int] = Field(None, gt=0)
    rooms_count: Optional[int] = Field(None, gt=0)
    living_room_type: Optional[str] = None
    kitchen_type: Optional[str] = None
    room_details: Optional[List[dict]] = []

    monthly_rent: Decimal = Field(..., gt=0)
    deposit: Optional[Decimal] = Field(None, ge=0)
    charges: Optional[Decimal] = Field(None, ge=0)
    charges_included: bool = False
    charges_description: Optional[str] = None

    available_from: Optional[date] = None
    lease_duration_months: Optional[int] = Field(None, gt=0)

    amenities: Optional[List[str]] = []
    custom_amenities: Optional[List[str]] = []  # User-defined amenities
    public_transport: Optional[List[str]] = []  # e.g., ["Metro Line 1", "Bus 42"]
    nearby_landmarks: Optional[List[str]] = (
        []
    )  # e.g., ["School - 200m", "Supermarket Carrefour - 500m"]

    # Utilities & Eligibility
    utilities_included: Optional[List[str]] = (
        []
    )  # ['electricity', 'gas', 'water', 'internet']
    caf_eligible: bool = False
    # Guarantor Preferences
    guarantor_required: bool = False
    accepted_guarantor_types: Optional[List[str]] = (
        []
    )  # physical, visale, garantme, organisation
    accepted_tenant_types: Optional[List[str]] = (
        []
    )  # employee, student, freelancer, retired, other

    # French Compliance (Loi ALUR / Loi ELAN)
    dpe_rating: Optional[str] = Field(None, pattern=r'^[A-G]$')  # Energy performance A-G
    dpe_value: Optional[int] = Field(None, ge=0)  # kWh/m²/year
    ges_rating: Optional[str] = Field(None, pattern=r'^[A-G]$')  # Greenhouse gas A-G
    ges_value: Optional[int] = Field(None, ge=0)  # kg CO2/m²/year
    surface_type: Optional[str] = None  # 'standard' or 'loi_carrez'
    construction_year: Optional[int] = Field(None, ge=1800, le=2100)
    # Rent control (encadrement des loyers) — mandatory in Paris, Lyon, Lille, etc.
    loyer_reference: Optional[Decimal] = Field(None, ge=0)  # Reference rent €/m²
    loyer_reference_majore: Optional[Decimal] = Field(None, ge=0)  # Max reference rent €/m²
    complement_de_loyer: Optional[Decimal] = Field(None, ge=0)  # Justified supplement
    complement_de_loyer_justification: Optional[str] = None  # Why supplement is charged
    # Natural risks
    natural_risks_compliant: bool = False  # ERP/ERNMT report provided

    @field_validator("title", "description", "charges_description", mode="before")
    @classmethod
    def sanitize_strings(cls, v):
        if v is None:
            return v
        if not isinstance(v, str):
            return v
        from app.core.sanitize import sanitize_html
        return sanitize_html(v)

    @field_validator("dpe_rating", "ges_rating", mode="before")
    @classmethod
    def empty_to_none(cls, v):
        if v == "":
            return None
        return v


class PropertyUpdate(BaseModel):
    """Schema for updating a property"""

    title: Optional[str] = Field(None, min_length=10, max_length=200)
    description: Optional[str] = None
    property_type: Optional[str] = None

    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None

    bedrooms: Optional[int] = Field(None, ge=0)
    bathrooms: Optional[Decimal] = Field(None, ge=0)
    size_sqm: Optional[Decimal] = Field(None, gt=0)
    floor_number: Optional[int] = None
    furnished: Optional[bool] = None

    accommodation_capacity: Optional[int] = Field(None, gt=0)
    rooms_count: Optional[int] = Field(None, gt=0)
    living_room_type: Optional[str] = None
    kitchen_type: Optional[str] = None
    room_details: Optional[List[dict]] = None

    monthly_rent: Optional[Decimal] = Field(None, gt=0)
    deposit: Optional[Decimal] = Field(None, ge=0)
    charges: Optional[Decimal] = Field(None, ge=0)
    charges_included: Optional[bool] = None
    charges_description: Optional[str] = None

    available_from: Optional[date] = None
    lease_duration_months: Optional[int] = Field(None, gt=0)

    amenities: Optional[List[str]] = None
    custom_amenities: Optional[List[str]] = None
    public_transport: Optional[List[str]] = None
    nearby_landmarks: Optional[List[str]] = None

    utilities_included: Optional[List[str]] = None
    caf_eligible: Optional[bool] = None
    guarantor_required: Optional[bool] = None
    accepted_guarantor_types: Optional[List[str]] = None
    accepted_tenant_types: Optional[List[str]] = None

    # French Compliance
    dpe_rating: Optional[str] = Field(None, pattern=r'^[A-G]$')
    dpe_value: Optional[int] = Field(None, ge=0)
    ges_rating: Optional[str] = Field(None, pattern=r'^[A-G]$')
    ges_value: Optional[int] = Field(None, ge=0)
    surface_type: Optional[str] = None
    construction_year: Optional[int] = Field(None, ge=1800, le=2100)
    loyer_reference: Optional[Decimal] = Field(None, ge=0)
    loyer_reference_majore: Optional[Decimal] = Field(None, ge=0)
    complement_de_loyer: Optional[Decimal] = Field(None, ge=0)
    complement_de_loyer_justification: Optional[str] = None
    natural_risks_compliant: Optional[bool] = None

    @field_validator("title", "description", "charges_description", mode="before")
    @classmethod
    def sanitize_strings(cls, v):
        if v is None:
            return v
        if not isinstance(v, str):
            return v
        from app.core.sanitize import sanitize_html
        return sanitize_html(v)

    @field_validator("dpe_rating", "ges_rating", mode="before")
    @classmethod
    def empty_to_none(cls, v):
        if v == "":
            return None
        return v


class PropertyResponse(BaseModel):
    """Schema for property response"""

    id: UUID
    landlord_id: UUID

    title: str
    description: Optional[str]
    property_type: str

    address_line1: str
    address_line2: Optional[str]
    city: str
    postal_code: str
    country: str
    latitude: Optional[Decimal]
    longitude: Optional[Decimal]

    bedrooms: int = 0
    bathrooms: Optional[Decimal] = None
    size_sqm: Optional[Decimal] = None
    floor_number: Optional[int] = None
    furnished: bool = False

    accommodation_capacity: Optional[int] = None
    rooms_count: Optional[int] = None
    living_room_type: Optional[str] = None
    kitchen_type: Optional[str] = None
    room_details: Optional[List[dict]] = []

    monthly_rent: Decimal = Decimal("0")
    deposit: Optional[Decimal] = None
    charges: Optional[Decimal] = None
    charges_included: bool = False
    charges_description: Optional[str] = None

    available_from: Optional[date] = None
    lease_duration_months: Optional[int] = None

    amenities: Optional[list] = []
    custom_amenities: Optional[list] = []
    public_transport: Optional[list] = []
    nearby_landmarks: Optional[list] = []

    utilities_included: Optional[list] = []
    caf_eligible: bool = False
    guarantor_required: bool = False
    accepted_guarantor_types: Optional[list] = []
    accepted_tenant_types: Optional[list] = []

    # French Compliance
    dpe_rating: Optional[str] = None
    dpe_value: Optional[int] = None
    ges_rating: Optional[str] = None
    ges_value: Optional[int] = None
    surface_type: Optional[str] = None
    construction_year: Optional[int] = None
    loyer_reference: Optional[Decimal] = None
    loyer_reference_majore: Optional[Decimal] = None
    complement_de_loyer: Optional[Decimal] = None
    complement_de_loyer_justification: Optional[str] = None
    natural_risks_compliant: bool = False

    photos: Optional[list] = []
    is_saved: bool = False
    ownership_verified: bool = False

    status: str = "draft"
    views_count: int = 0
    lease_duration_months: Optional[int] = None

    created_at: datetime
    updated_at: Optional[datetime]
    published_at: Optional[datetime]

    # Matching Details (Optional)
    match_score: Optional[int] = None
    match_breakdown: Optional[dict] = None

    class Config:
        from_attributes = True


class MediaSessionCreate(BaseModel):
    """Schema for creating a media capture session"""

    property_id: UUID


class MediaSessionResponse(BaseModel):
    """Schema for media session response"""

    id: UUID
    property_id: UUID
    verification_code: str
    capture_url: str
    expires_at: datetime
    target_address: str
    target_latitude: Optional[Decimal] = None
    target_longitude: Optional[Decimal] = None
    gps_radius_meters: int = 500
    location_verified: bool = False
    room_index: Optional[int] = None
    room_label: Optional[str] = None
    # Room info for capture page room selector
    rooms: Optional[list] = None

    class Config:
        from_attributes = True


class MediaUploadMetadata(BaseModel):
    """Metadata sent with media upload"""

    media_type: str  # 'photo' or 'video'
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    gps_accuracy: Optional[float] = None  # meters
    captured_at: datetime
    device_id: Optional[str] = None
    watermark_address: str = ""
    room_index: Optional[int] = None  # which room this media belongs to
    room_label: Optional[str] = None

class PropertyMatchResponse(PropertyResponse):
    """Schema for property response with match details"""
    match_score: int
    match_breakdown: dict
