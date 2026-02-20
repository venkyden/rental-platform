"""
Application model for rental candidatures.
"""
from sqlalchemy import Column, String, ForeignKey, TIMESTAMP, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.core.database import Base

class ApplicationStatus(str, enum.Enum):
    PENDING = "pending"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"

class Application(Base):
    __tablename__ = "applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Links
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    
    # Data
    status = Column(String, default="pending", nullable=False)
    cover_letter = Column(Text, nullable=True)
    
    # Snapshot of profile/docs at time of application (optional, for immutability)
    snapshot_data = Column(JSONB, nullable=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    tenant = relationship("User", backref="applications")
    property = relationship("Property", backref="applications")
