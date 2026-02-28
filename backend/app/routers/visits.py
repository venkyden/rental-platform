import os
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.property import Property
from app.models.user import User
from app.models.visits_and_leases import Lease, VisitSlot
from app.routers.auth import get_current_user

router = APIRouter(tags=["Visits & Leases"])

# --- Schemas ---


class VisitSlotCreate(BaseModel):
    property_id: UUID
    start_time: datetime
    end_time: datetime


class VisitSlotResponse(BaseModel):
    id: UUID
    property_id: UUID
    start_time: datetime
    end_time: datetime
    is_booked: bool
    meeting_link: Optional[str] = None


class DirectLeaseGenerateRequest(BaseModel):
    tenant_email: str
    rent_amount: float
    start_date: str
    lease_type: str = "meuble"
    deposit_amount: Optional[float] = None
    charges_amount: Optional[float] = None
    duration_months: Optional[int] = None


# --- Visit Endpoints ---


@router.post("/visits/leases/generate")
async def generate_lease_directly(
    property_id: UUID,
    request: DirectLeaseGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a lease directly from the property VisitScheduler UI"""
    # Check property ownership
    result = await db.execute(select(Property).where(Property.id == property_id))
    property_obj = result.scalar_one_or_none()

    if not property_obj or property_obj.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get or create tenant (simplified for UI)
    result = await db.execute(select(User).where(User.email == request.tenant_email))
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=404, detail=f"No user found with email {request.tenant_email}"
        )

    # Create dummy lease entry just to satisfy the download endpoint
    lease = Lease(
        property_id=property_id,
        landlord_id=current_user.id,
        tenant_id=tenant.id,
        start_date=datetime.strptime(request.start_date, "%Y-%m-%d").date(),
        rent_amount=request.rent_amount,
        deposit_amount=request.deposit_amount or (request.rent_amount * 2),
        charges_amount=request.charges_amount or 0,
        lease_type=request.lease_type,
        status="generated",
    )
    db.add(lease)
    await db.commit()
    await db.refresh(lease)

    return {
        "download_url": f"http://localhost:8000/leases/{lease.id}/download",
        "lease_type": request.lease_type,
    }




@router.post("/visits/slots", response_model=List[VisitSlotResponse])
async def create_visit_slots(
    slots: List[VisitSlotCreate],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create availability slots for property visits"""
    created_slots = []

    # Verify ownership of property
    # In a real app, optimize this to check once per property_id
    for slot_data in slots:
        # Check property
        query = select(Property).where(Property.id == slot_data.property_id)
        result = await db.execute(query)
        property = result.scalar_one_or_none()

        if not property:
            raise HTTPException(status_code=404, detail="Property not found")

        if property.landlord_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to manage visits for this property",
            )

        visit_slot = VisitSlot(
            property_id=slot_data.property_id,
            landlord_id=current_user.id,
            start_time=slot_data.start_time,
            end_time=slot_data.end_time,
            is_booked=False,
        )
        db.add(visit_slot)
        created_slots.append(visit_slot)

    await db.commit()
    for slot in created_slots:
        await db.refresh(slot)

    return created_slots


@router.get("/visits/slots/{property_id}", response_model=List[VisitSlotResponse])
async def get_property_visit_slots(
    property_id: UUID, db: AsyncSession = Depends(get_db)
):
    """Get available visit slots for a property"""
    query = (
        select(VisitSlot)
        .where(
            and_(
                VisitSlot.property_id == property_id,
                VisitSlot.is_booked == False,
                VisitSlot.start_time > datetime.utcnow(),
            )
        )
        .order_by(VisitSlot.start_time)
    )

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/visits/book/{slot_id}")
async def book_visit(
    slot_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Book a visit slot"""
    query = select(VisitSlot).where(VisitSlot.id == slot_id)
    result = await db.execute(query)
    slot = result.scalar_one_or_none()

    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Slot already booked")

    slot.is_booked = True
    slot.tenant_id = current_user.id
    slot.meeting_link = (
        f"https://meet.jit.si/rental-{slot.id}"  # Generate instant meeting link
    )

    await db.commit()
    await db.refresh(slot)

    return {"message": "Visit booked successfully", "meeting_link": slot.meeting_link}
