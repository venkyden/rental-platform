from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.core.database import Base


class PropertyManagerAccess(Base):
    """
    Tracks which Property Managers have access to which Landlords' properties.
    Landlord can grant/revoke access. Property Manager can manage all granted properties.
    """
    __tablename__ = "property_manager_access"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Who is managing (must be property_manager role)
    property_manager_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Whose properties they're managing (must be landlord role)
    landlord_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Access control
    is_active = Column(Boolean, default=True)
    
    # Management fee (percentage of monthly rent, e.g., 10.0 = 10%)
    management_fee_percentage = Column(String, nullable=True)  # Stored as string for flexibility
    
    # Timestamps
    granted_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)
    
    # Metadata
    notes = Column(String, nullable=True)  # Why was access granted/what agreement
