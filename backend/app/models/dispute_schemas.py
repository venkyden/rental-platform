from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.dispute import DisputeCategory, DisputeStatus, DisputeVerdict


class DisputeBase(BaseModel):
    category: DisputeCategory
    title: str
    description: str
    accused_id: Optional[UUID] = None
    amount_claimed: Optional[float] = None


class DisputeCreate(DisputeBase):
    lease_id: UUID
    inventory_id: Optional[UUID] = None  # Linked if related to move-out


class DisputeResponse(DisputeBase):
    id: UUID
    lease_id: UUID
    raised_by_id: UUID
    status: DisputeStatus
    verdict: DisputeVerdict
    created_at: datetime

    class Config:
        from_attributes = True


class DisputeVerdictUpdate(BaseModel):
    verdict: DisputeVerdict
    admin_notes: Optional[str] = None
    final_report_path: Optional[str] = None
    resolve: bool = False  # If true, set resolved_at
