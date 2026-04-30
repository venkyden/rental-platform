from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.dispute import DisputeCategory, DisputeStatus


class DisputeCreate(BaseModel):
    lease_id: UUID
    category: DisputeCategory
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10, max_length=5000)
    evidence_urls: List[str] = Field(default_factory=list, max_length=5)
    inventory_id: Optional[UUID] = None
    accused_id: Optional[UUID] = None
    amount_claimed: Optional[float] = Field(None, ge=0, le=100000)
    location_verified: Optional[str] = None
    report_distance_meters: Optional[float] = None


class DisputeResponse(BaseModel):
    id: UUID
    lease_id: UUID
    raised_by_id: UUID
    accused_id: Optional[UUID] = None
    category: DisputeCategory
    status: DisputeStatus
    title: str
    description: str
    evidence_urls: List[str] = []
    response_description: Optional[str] = None
    response_evidence_urls: List[str] = []
    responded_at: Optional[datetime] = None
    amount_claimed: Optional[float] = None
    admin_observations: Optional[str] = None
    mediation_redirect_url: Optional[str] = None
    mediation_redirected_at: Optional[datetime] = None
    location_verified: Optional[str] = None
    report_distance_meters: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DisputeAddEvidence(BaseModel):
    """Append additional evidence photos to an existing dispute."""
    evidence_urls: List[str] = Field(..., min_length=1, max_length=5)


class DisputeRespond(BaseModel):
    """Accused party submits their side of the story."""
    response_description: str = Field(..., min_length=10, max_length=5000)
    response_evidence_urls: List[str] = Field(default_factory=list, max_length=5)


class DisputeAdminUpdate(BaseModel):
    """Admin facilitation — observations and status changes only. No verdicts."""
    admin_observations: Optional[str] = None
    status: Optional[DisputeStatus] = None
    mediation_redirect_url: Optional[str] = None
    close: bool = False  # If true, set closed_at and status to CLOSED
