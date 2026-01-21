"""
Property models for rental platform.
"""
from sqlalchemy import Column, String, Integer, Boolean, DECIMAL, Date, Text, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class Property(Base):
    """Property listing model"""
    __tablename__ = "properties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Basic Info
    title = Column(String(200), nullable=False)
    description = Column(Text)
    property_type = Column(String(50))  # 'apartment', 'house', 'studio', 'room'
    
    # Location
    address_line1 = Column(String(200), nullable=False)
    address_line2 = Column(String(200))
    city = Column(String(100), nullable=False)
    postal_code = Column(String(20), nullable=False)
    country = Column(String(100), default='France')
    latitude = Column(DECIMAL(10, 8))
    longitude = Column(DECIMAL(11, 8))
    
    # Details
    bedrooms = Column(Integer, nullable=False)
    bathrooms = Column(DECIMAL(3, 1))
    size_sqm = Column(DECIMAL(8, 2))
    floor_number = Column(Integer)
    furnished = Column(Boolean, default=False)
    
    # Pricing
    monthly_rent = Column(DECIMAL(10, 2), nullable=False)
    deposit = Column(DECIMAL(10, 2))
    charges = Column(DECIMAL(10, 2))
    
    # Availability
    available_from = Column(Date)
    lease_duration_months = Column(Integer)  # NULL = flexible
    
    # French Compliance (Loi ALUR)
    dpe_rating = Column(String(1))  # A-G energy performance rating (required in France)
    ges_rating = Column(String(1))  # A-G greenhouse gas emissions rating
    dpe_value = Column(Integer)  # kWh/m²/year
    ges_value = Column(Integer)  # kg CO2/m²/year
    surface_type = Column(String(20), default='standard')  # 'loi_carrez' for apartments (required)
    construction_year = Column(Integer)  # For DPE context
    
    # Features & Amenities
    amenities = Column(JSONB)  # ['parking', 'elevator', 'balcony', etc.]
    custom_amenities = Column(JSONB)  # User-defined amenities
    public_transport = Column(JSONB)  # ['Metro Line 1', 'Bus 42']
    nearby_landmarks = Column(JSONB)  # ['School - 200m', 'Supermarket - 500m']
    
    # Utilities & CAF
    utilities_included = Column(JSONB)  # ['electricity', 'gas', 'water', 'internet']
    is_caf_eligible = Column(Boolean, default=False)
    
    # Photos (will be managed by PropertyMedia table, but keep this for quick access)
    photos = Column(JSONB)  # [{'url': '...', 'order': 1}, ...]
    
    # Status
    status = Column(String(20), default='draft')  # 'draft', 'active', 'rented', 'inactive'
    
    # Metadata
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    published_at = Column(TIMESTAMP)
    views_count = Column(Integer, default=0)
    
    # Relationships
    landlord = relationship("User", backref="properties", foreign_keys=[landlord_id])
    media_sessions = relationship("PropertyMediaSession", back_populates="property", cascade="all, delete-orphan")
    media = relationship("PropertyMedia", back_populates="property", cascade="all, delete-orphan")
    visit_slots = relationship("VisitSlot", back_populates="property", cascade="all, delete-orphan")
    leases = relationship("Lease", back_populates="property", cascade="all, delete-orphan")


class PropertyMediaSession(Base):
    """Media capture session for location-verified uploads"""
    __tablename__ = "property_media_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    
    # Shareable link details
    verification_code = Column(String(50), unique=True, nullable=False)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    expires_at = Column(TIMESTAMP, nullable=False)
    is_active = Column(Boolean, default=True)
    
    # Location verification
    target_address = Column(Text)
    target_latitude = Column(DECIMAL(10, 8))
    target_longitude = Column(DECIMAL(11, 8))
    gps_radius_meters = Column(Integer, default=500)
    
    # Audit trail
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relationships
    property = relationship("Property", back_populates="media_sessions")
    media = relationship("PropertyMedia", back_populates="session")


class PropertyMedia(Base):
    """Property photos and videos"""
    __tablename__ = "property_media"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("property_media_sessions.id"))
    
    # Media details
    media_type = Column(String(20))  # 'photo' or 'video'
    file_url = Column(Text, nullable=False)
    file_size = Column(Integer)  # bytes
    order_index = Column(Integer, default=0)
    is_cover = Column(Boolean, default=False)
    
    # Verification metadata
    captured_latitude = Column(DECIMAL(10, 8))
    captured_longitude = Column(DECIMAL(11, 8))
    distance_from_target = Column(DECIMAL(8, 2))  # meters
    captured_at = Column(TIMESTAMP)
    device_id = Column(String(100))
    
    # Watermark data
    watermark_address = Column(Text)
    
    # Review status
    verification_status = Column(String(20), default='verified')  # 'verified', 'pending_review', 'rejected'
    verified_at = Column(TIMESTAMP)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relationships
    property = relationship("Property", back_populates="media")
    session = relationship("PropertyMediaSession", back_populates="media")
