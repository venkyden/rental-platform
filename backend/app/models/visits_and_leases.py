from sqlalchemy import Column, String, Boolean, DateTime, Date, Float, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
import enum

class LeaseType(str, enum.Enum):
    MEUBLE = "meuble"
    VIDE = "vide"
    MOBILITE = "mobilite"
    ETUDIANT = "etudiant"

class LeaseStatus(str, enum.Enum):
    DRAFT = "draft"
    SIGNED = "signed"
    ACTIVE = "active"
    TERMINATED = "terminated"

class VisitSlot(Base):
    __tablename__ = "visit_slots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False, index=True)
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False)
    is_booked = Column(Boolean, default=False)
    meeting_link = Column(String, nullable=True)

    # Relationships
    property = relationship("Property", back_populates="visit_slots")
    landlord = relationship("User", foreign_keys=[landlord_id])
    tenant = relationship("User", foreign_keys=[tenant_id])


class Lease(Base):
    __tablename__ = "leases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False, index=True)
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)

    # Contract details
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True) # Null for CDI 3-year renewable
    rent_amount = Column(Float, nullable=False)
    deposit_amount = Column(Float, nullable=False)
    charges_amount = Column(Float, nullable=False)
    lease_type = Column(SQLEnum(LeaseType, name='lease_type_enum'), nullable=False)
    status = Column(String, default="draft")

    # Document management
    pdf_path = Column(String, nullable=True)
    signature_data = Column(JSONB, nullable=True)

    # Relationships
    property = relationship("Property", back_populates="leases")
    landlord = relationship("User", foreign_keys=[landlord_id])
    tenant = relationship("User", foreign_keys=[tenant_id])
