"""
API endpoints for managing Rental Applications (Candidatures).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.application import Application, ApplicationStatus
from app.models.property import Property
from app.models.schemas import ApplicationCreate, ApplicationResponse

router = APIRouter(prefix="/applications", tags=["Applications"])

@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    application_in: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit a new application for a property"""
    
    # 1. Check if property exists
    result = await db.execute(select(Property).where(Property.id == application_in.property_id))
    property_obj = result.scalar_one_or_none()
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")
        
    # 2. Check if already applied
    result = await db.execute(
        select(Application)
        .where(Application.tenant_id == current_user.id)
        .where(Application.property_id == application_in.property_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="You have already applied to this property")

    # 3. Create Application
    new_app = Application(
        tenant_id=current_user.id,
        property_id=application_in.property_id,
        status=ApplicationStatus.PENDING,
        cover_letter=application_in.cover_letter
    )
    
    db.add(new_app)
    await db.commit()
    await db.refresh(new_app)
    
    return new_app


@router.get("/me", response_model=List[ApplicationResponse])
async def list_my_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List applications submitted by the current user"""
    result = await db.execute(
        select(Application)
        .where(Application.tenant_id == current_user.id)
        .order_by(Application.created_at.desc())
    )
    return result.scalars().all()


@router.get("/received", response_model=List[ApplicationResponse])
async def list_received_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List applications received for my properties (Landlord)"""
    # Join with Property to filter by landlord_id
    result = await db.execute(
        select(Application)
        .join(Application.property)
        .where(Property.landlord_id == current_user.id)
        .order_by(Application.created_at.desc())
    )
    return result.scalars().all()


class ApplicationUpdate(BaseModel):
    status: ApplicationStatus

@router.patch("/{application_id}", response_model=ApplicationResponse)
async def update_application_status(
    application_id: UUID,
    update_data: ApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update application status (Landlord only)"""
    # 1. Get Application + Property
    result = await db.execute(
        select(Application).options(selectinload(Application.property))
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
        
    # 2. Verify Ownership
    # Note: application.property might need lazy load handling if not joined above. 
    # Use explicit join or lazy loading. simpler to just join in query if needed, 
    # but let's assume relationship lazy loading works or we need to be explicit.
    # The 'selectinload' is safer for async.
    
    if application.property.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to manage this application")
        
    # 3. Update
    application.status = update_data.status
    application.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(application)
    
    return application
