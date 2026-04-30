import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class DisputeCategory(str, enum.Enum):
    DAMAGE = "damage"  # Accidental damage
    APPLIANCE_FAILURE = "appliance_failure"  # Broken appliance / infrastructure
    SHARED_LIABILITY = "shared_liability"  # Common area issues
    CLEANING = "cleaning"
    OTHER = "other"


class DisputeStatus(str, enum.Enum):
    OPEN = "open"  # Just filed
    AWAITING_RESPONSE = "awaiting_response"  # Accused party has been notified
    UNDER_REVIEW = "under_review"  # Admin reviewing both sides
    CLOSED = "closed"  # Admin closed — redirect to mediation if unresolved


class Dispute(Base):
    __tablename__ = "disputes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Context
    lease_id = Column(
        UUID(as_uuid=True), ForeignKey("leases.id"), nullable=False, index=True
    )
    inventory_id = Column(
        UUID(as_uuid=True), ForeignKey("inventories.id"), nullable=True
    )  # Linked to Move-Out Inventory

    raised_by_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )  # Who reported?
    accused_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )  # Optional (e.g. "General" issue)

    category = Column(
        SQLEnum(DisputeCategory, name="dispute_category_enum"), nullable=False
    )
    status = Column(
        SQLEnum(DisputeStatus, name="dispute_status_enum"),
        default=DisputeStatus.OPEN,
        nullable=False,
    )

    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)

    # Evidence — immutable once uploaded (reporter side)
    evidence_urls = Column(JSONB, default=list, nullable=False, server_default="[]")

    # Counter-evidence — accused party's response
    response_description = Column(Text, nullable=True)
    response_evidence_urls = Column(JSONB, default=list, nullable=False, server_default="[]")
    responded_at = Column(DateTime, nullable=True)

    # Financial context
    amount_claimed = Column(Float, nullable=True)

    # Facilitation (Roomivo is NOT a mediator — observations only)
    admin_observations = Column(Text, nullable=True)
    mediation_redirect_url = Column(String, nullable=True)
    mediation_redirected_at = Column(DateTime, nullable=True)

    # Geo-verification metadata
    location_verified = Column(String, nullable=True)  # "verified", "unverified", "denied"
    report_distance_meters = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)

    # Relationships
    lease = relationship("Lease", back_populates="disputes")
    inventory = relationship("Inventory")
    raised_by = relationship("User", foreign_keys=[raised_by_id])
    accused = relationship("User", foreign_keys=[accused_id])
