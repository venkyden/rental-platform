from sqlalchemy import Column, String, Float, ForeignKey, DateTime, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid
import enum
from datetime import datetime

class DisputeCategory(str, enum.Enum):
    DAMAGE = "damage" # Tenant Fault
    APPLIANCE_FAILURE = "appliance_failure" # Landlord Fault
    SHARED_LIABILITY = "shared_liability" # Common Area / Unreported
    CLEANING = "cleaning"
    OTHER = "other"

class DisputeStatus(str, enum.Enum):
    OPEN = "open"
    EVIDENCE_NEEDED = "evidence_needed" # Waiting for Landlord/Tenant
    UNDER_REVIEW = "under_review" # Admin looking
    RESOLVED = "resolved"
    DISMISSED = "dismissed"

class DisputeVerdict(str, enum.Enum):
    TENANT_WINS = "tenant_wins"
    LANDLORD_WINS = "landlord_wins"
    SPLIT = "split" # 50/50 etc
    NONE = "none"

class Dispute(Base):
    __tablename__ = "disputes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Context
    lease_id = Column(UUID(as_uuid=True), ForeignKey("leases.id"), nullable=False, index=True)
    inventory_id = Column(UUID(as_uuid=True), ForeignKey("inventories.id"), nullable=True) # Linked to Move-Out Inventory
    
    raised_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False) # Who complained?
    accused_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True) # Optional (e.g. "General" issue)
    
    category = Column(SQLEnum(DisputeCategory, name='dispute_category_enum'), nullable=False)
    status = Column(SQLEnum(DisputeStatus, name='dispute_status_enum'), default=DisputeStatus.OPEN, nullable=False)
    
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    
    # Financial context (Offline tracking only)
    amount_claimed = Column(Float, nullable=True)
    
    # Resolution
    verdict = Column(SQLEnum(DisputeVerdict, name='dispute_verdict_enum'), default=DisputeVerdict.NONE)
    admin_notes = Column(Text, nullable=True)
    final_report_path = Column(String, nullable=True) # Path to PDF Verdict
    
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    
    # Relationships
    lease = relationship("Lease", back_populates="disputes")
    inventory = relationship("Inventory")
    raised_by = relationship("User", foreign_keys=[raised_by_id])
    accused = relationship("User", foreign_keys=[accused_id])
