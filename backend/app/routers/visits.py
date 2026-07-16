import os
from datetime import datetime
from app.core.timeutils import utcnow
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
    room_index: Optional[int] = None  # null = property-level visit
    room_label: Optional[str] = None  # e.g. 'Bedroom 1'


class VisitSlotResponse(BaseModel):
    id: UUID
    property_id: UUID
    start_time: datetime
    end_time: datetime
    is_booked: bool
    meeting_link: Optional[str] = None
    room_index: Optional[int] = None
    room_label: Optional[str] = None


class PublicVisitSlotResponse(BaseModel):
    """Slot shape for the UNAUTHENTICATED listing.

    Structurally cannot carry meeting_link, so the private booking URL can never
    leak from a public endpoint — the guarantee no longer depends on a
    (distant) is_booked filter staying correct. Defence in depth after the
    by-room leak (audit #4).
    """
    id: UUID
    property_id: UUID
    start_time: datetime
    end_time: datetime
    is_booked: bool
    room_index: Optional[int] = None
    room_label: Optional[str] = None


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
        "download_url": f"/leases/{lease.id}/download",
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
            room_index=slot_data.room_index,
            room_label=slot_data.room_label,
        )
        db.add(visit_slot)
        created_slots.append(visit_slot)

    await db.commit()
    for slot in created_slots:
        await db.refresh(slot)

    return created_slots


@router.get("/visits/slots/{property_id}", response_model=List[PublicVisitSlotResponse])
async def get_property_visit_slots(
    property_id: UUID,
    room_index: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get available visit slots for a property, optionally filtered by room"""
    conditions = [
        VisitSlot.property_id == property_id,
        VisitSlot.is_booked == False,
        VisitSlot.start_time > utcnow(),
    ]

    if room_index is not None:
        conditions.append(VisitSlot.room_index == room_index)

    query = (
        select(VisitSlot)
        .where(and_(*conditions))
        .order_by(VisitSlot.start_time)
    )

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/visits/slots/{property_id}/by-room")
async def get_slots_by_room(
    property_id: UUID, db: AsyncSession = Depends(get_db)
):
    """Get visit slots grouped by room"""
    query = (
        select(VisitSlot)
        .where(
            and_(
                VisitSlot.property_id == property_id,
                VisitSlot.start_time > utcnow(),
            )
        )
        .order_by(VisitSlot.room_index, VisitSlot.start_time)
    )

    result = await db.execute(query)
    slots = result.scalars().all()

    # Group by room
    grouped = {}
    for slot in slots:
        key = slot.room_label or (f"Room {slot.room_index + 1}" if slot.room_index is not None else "Property")
        if key not in grouped:
            grouped[key] = {"room_index": slot.room_index, "room_label": key, "slots": []}
        grouped[key]["slots"].append({
            "id": str(slot.id),
            "start_time": slot.start_time.isoformat(),
            "end_time": slot.end_time.isoformat(),
            "is_booked": slot.is_booked,
            # meeting_link intentionally omitted: this endpoint is unauthenticated
            # and returns booked slots too — the private video-call URL must never
            # leak. The booking tenant receives it in the POST /visits/book response.
        })

    return list(grouped.values())


@router.post("/visits/book/{slot_id}")
async def book_visit(
    slot_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Book a visit slot"""
    # Lock the row FOR UPDATE so two concurrent bookings serialize: the second
    # transaction blocks until the first commits, then sees is_booked=True.
    # Without this lock both requests read is_booked=False and double-book.
    query = select(VisitSlot).where(VisitSlot.id == slot_id).with_for_update()
    result = await db.execute(query)
    slot = result.scalar_one_or_none()

    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Slot already booked")

    slot.is_booked = True
    slot.tenant_id = current_user.id
    # Derive the room from an unguessable secret, NOT slot.id: the slot id is
    # exposed in public slot listings, so a rental-{slot.id} room could be joined
    # by anyone who saw the listing. A random token keeps the visit private.
    import secrets
    slot.meeting_link = f"https://meet.jit.si/rental-{secrets.token_urlsafe(12)}"

    await db.commit()
    await db.refresh(slot)

    return {"message": "Visit booked successfully", "meeting_link": slot.meeting_link}


@router.get("/visits/slots/{slot_id}/meeting")
async def get_visit_meeting_link(
    slot_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the private meeting link for a booked visit.

    Authorized to the booking tenant or the property landlord only — the link is
    NOT derivable from public data (see book_visit) and is never exposed by the
    unauthenticated slot listings. This is how the landlord (and the tenant, on
    return) retrieves the room to join.
    """
    slot = (
        await db.execute(select(VisitSlot).where(VisitSlot.id == slot_id))
    ).scalar_one_or_none()
    if not slot or not slot.is_booked:
        raise HTTPException(status_code=404, detail="Booked visit not found")
    if current_user.id not in (slot.tenant_id, slot.landlord_id):
        raise HTTPException(status_code=403, detail="Not authorized to access this visit")
    return {
        "meeting_link": slot.meeting_link,
        "start_time": slot.start_time.isoformat(),
        "end_time": slot.end_time.isoformat(),
    }
