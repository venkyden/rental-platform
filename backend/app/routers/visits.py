from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.visits_and_leases import VisitSlot, Lease
from app.models.property import Property
from pydantic import BaseModel
from datetime import datetime
import os
from sqlalchemy import select, and_
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

# --- Visit Endpoints ---

@router.post("/visits/slots", response_model=List[VisitSlotResponse])
async def create_visit_slots(
    slots: List[VisitSlotCreate],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
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
        
        if property.owner_id != current_user.id:
             raise HTTPException(status_code=403, detail="Not authorized to manage visits for this property")

        visit_slot = VisitSlot(
            property_id=slot_data.property_id,
            landlord_id=current_user.id,
            start_time=slot_data.start_time,
            end_time=slot_data.end_time,
            is_booked=False
        )
        db.add(visit_slot)
        created_slots.append(visit_slot)
    
    await db.commit()
    for slot in created_slots:
        await db.refresh(slot)
        
    return created_slots

@router.get("/visits/slots/{property_id}", response_model=List[VisitSlotResponse])
async def get_property_visit_slots(
    property_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get available visit slots for a property"""
    query = select(VisitSlot).where(
        and_(
            VisitSlot.property_id == property_id,
            VisitSlot.is_booked == False,
            VisitSlot.start_time > datetime.utcnow()
        )
    ).order_by(VisitSlot.start_time)
    
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/visits/book/{slot_id}")
async def book_visit(
    slot_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
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
    slot.meeting_link = f"https://meet.jit.si/rental-{slot.id}" # Generate instant meeting link
    
    await db.commit()
    await db.refresh(slot)
    
    return {"message": "Visit booked successfully", "meeting_link": slot.meeting_link}


