from pydantic import BaseModel, Field, SerializeAsAny
from typing import List, Optional, Any, Dict
from datetime import datetime
from uuid import UUID
from enum import Enum
from app.models.inventory import InventoryType, InventoryStatus, ItemCondition

# --- Item Schemas ---

class InventoryItemBase(BaseModel):
    name: str = Field(..., example="Living Room Walls")
    category: Optional[str] = Field(None, example="Living Room")
    condition: ItemCondition = Field(..., example="good")
    photos: List[str] = Field(default_factory=list, example=["https://bucket.r2.dev/img1.jpg"])
    notes: Optional[str] = Field(None, example="Scuff mark on left side")

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemResponse(InventoryItemBase):
    id: UUID
    inventory_id: UUID

    class Config:
        from_attributes = True

# --- Inventory Schemas ---

class InventoryBase(BaseModel):
    lease_id: UUID
    type: InventoryType
    general_notes: Optional[str] = None

class InventoryCreate(InventoryBase):
    # Initial items can be passed optionally
    items: List[InventoryItemCreate] = []

class InventoryUpdate(BaseModel):
    general_notes: Optional[str] = None
    items: Optional[List[InventoryItemCreate]] = None

class InventorySignRequest(BaseModel):
    signature_tenant: Optional[Dict[str, Any]] = None
    signature_landlord: Optional[Dict[str, Any]] = None
    # Optional: IP/Timestamp metadata can be embedded in the Dicts or added here

class InventoryResponse(InventoryBase):
    id: UUID
    status: InventoryStatus
    date: datetime
    signature_tenant: Optional[Dict[str, Any]]
    signature_landlord: Optional[Dict[str, Any]]
    items: List[InventoryItemResponse]
    property_location: Optional[Dict[str, float]] = None # {lat, lng} for geofencing

    class Config:
        from_attributes = True
