import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class InventoryType(str, enum.Enum):
    MOVE_IN = "move_in"
    MOVE_OUT = "move_out"
    INTERIM = "interim"


class InventoryStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_TENANT_SIGNATURE = "pending_tenant_sign"
    PENDING_LANDLORD_SIGNATURE = "pending_landlord_sign"
    COMPLETED = "completed"
    CONTESTED = "contested"


class ItemCondition(str, enum.Enum):
    NEW = "new"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    DAMAGED = "damaged"
    MISSING = "missing"


class Inventory(Base):
    __tablename__ = "inventories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lease_id = Column(
        UUID(as_uuid=True), ForeignKey("leases.id"), nullable=False, index=True
    )

    type = Column(SQLEnum(InventoryType, name="inventory_type_enum"), nullable=False)
    status = Column(
        SQLEnum(InventoryStatus, name="inventory_status_enum"),
        default=InventoryStatus.DRAFT,
        nullable=False,
    )
    date = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Signatures (Coords + Timestamp + IP)
    signature_tenant = Column(JSONB, nullable=True)
    signature_landlord = Column(JSONB, nullable=True)

    general_notes = Column(Text, nullable=True)

    # Relationships
    lease = relationship("Lease", back_populates="inventories")
    items = relationship(
        "InventoryItem", back_populates="inventory", cascade="all, delete-orphan"
    )


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_id = Column(
        UUID(as_uuid=True), ForeignKey("inventories.id"), nullable=False, index=True
    )

    name = Column(String, nullable=False)  # e.g. "Kitchen Walls", "Sofa"
    category = Column(String, nullable=True)  # e.g. "Living Room", "Kitchen"

    condition = Column(
        SQLEnum(ItemCondition, name="item_condition_enum"), nullable=False
    )
    photos = Column(JSONB, default=list)  # List of S3/R2 URLs
    notes = Column(Text, nullable=True)

    # Relationships
    inventory = relationship("Inventory", back_populates="items")
