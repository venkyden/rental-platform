"""
Pydantic schemas for property endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID


class PropertyCreate(BaseModel):
    """Schema for creating a new property"""
    title: str = Field(..., min_length=10, max_length=200)
    description: Optional[str] = None
    property_type: str  # 'apartment', 'house', 'studio', 'room'
    
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    postal_code: str
    country: str = 'France'
    
    bedrooms: int = Field(..., ge=0)
    bathrooms: Optional[Decimal] = Field(None, ge=0)
    size_sqm: Optional[Decimal] = Field(None, gt=0)
    floor_number: Optional[int] = None
    furnished: bool = False
    
    monthly_rent: Decimal = Field(..., gt=0)
    deposit: Optional[Decimal] = Field(None, ge=0)
    charges: Optional[Decimal] = Field(None, ge=0)
    
    available_from: Optional[date] = None
    lease_duration_months: Optional[int] = Field(None, gt=0)
    
    
    amenities: Optional[List[str]] = []
    custom_amenities: Optional[List[str]] = []  # User-defined amenities
    public_transport: Optional[List[str]] = []  # e.g., ["Metro Line 1", "Bus 42"]
    nearby_landmarks: Optional[List[str]] = []  # e.g., ["School - 200m", "Supermarket Carrefour - 500m"]
    
    # Utilities & Eligibility
    utilities_included: Optional[List[str]] = []  # ['electricity', 'gas', 'water', 'internet']
    is_caf_eligible: bool = False


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
    
    monthly_rent: Optional[Decimal] = Field(None, gt=0)
    deposit: Optional[Decimal] = Field(None, ge=0)
    charges: Optional[Decimal] = Field(None, ge=0)
    
    available_from: Optional[date] = None
    lease_duration_months: Optional[int] = Field(None, gt=0)
    
    
    amenities: Optional[List[str]] = None
    custom_amenities: Optional[List[str]] = None
    public_transport: Optional[List[str]] = None
    nearby_landmarks: Optional[List[str]] = None
    
    utilities_included: Optional[List[str]] = None
    is_caf_eligible: Optional[bool] = None


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
    
    bedrooms: int
    bathrooms: Optional[Decimal]
    size_sqm: Optional[Decimal]
    floor_number: Optional[int]
    furnished: bool
    
    monthly_rent: Decimal
    deposit: Optional[Decimal]
    charges: Optional[Decimal]
    
    available_from: Optional[date]
    lease_duration_months: Optional[int]
    
    
    amenities: Optional[dict]
    custom_amenities: Optional[dict]
    public_transport: Optional[dict]
    nearby_landmarks: Optional[dict]
    
    utilities_included: Optional[dict]
    is_caf_eligible: bool
    
    photos: Optional[dict]
    
    status: str
    views_count: int
    
    created_at: datetime
    updated_at: Optional[datetime]
    published_at: Optional[datetime]
    
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
    
    class Config:
        from_attributes = True


class MediaUploadMetadata(BaseModel):
    """Metadata sent with media upload"""
    media_type: str  # 'photo' or 'video'
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    captured_at: datetime
    device_id: Optional[str] = None
    watermark_address: str
