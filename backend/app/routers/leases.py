"""
Leases Router - Lease Generation and Management.
Provides endpoints for generating, downloading, and managing lease documents.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.property import Property
from app.models.application import Application
from app.models.visits_and_leases import Lease
from app.services.lease_generator import lease_generator

router = APIRouter(prefix="/leases", tags=["leases"])


class LeaseGenerateRequest(BaseModel):
    application_id: UUID
    lease_type: str = "meuble"  # meuble, colocation, code_civil, simple
    start_date: str  # YYYY-MM-DD
    duration_months: int = 12
    rent_override: Optional[float] = None
    charges_override: Optional[float] = None
    deposit_override: Optional[float] = None
    guarantor_name: Optional[str] = None


class LeaseResponse(BaseModel):
    id: UUID
    property_id: UUID
    tenant_id: UUID
    status: str
    start_date: Optional[str] = None
    monthly_rent: Optional[float] = None
    created_at: datetime
    property_location: Optional[dict] = None # {lat, lng}

    class Config:
        from_attributes = True

from sqlalchemy.orm import selectinload

@router.post("/generate", response_class=HTMLResponse)
async def generate_lease(
    request: LeaseGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a lease document for an approved application.
    Returns HTML that can be previewed or converted to PDF.
    """
    # Get application
    result = await db.execute(
        select(Application).where(Application.id == request.application_id)
    )
    application = result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if application.status != 'approved':
        raise HTTPException(
            status_code=400,
            detail="Can only generate lease for approved applications"
        )
    
    # Get property
    result = await db.execute(
        select(Property).where(Property.id == application.property_id)
    )
    property_obj = result.scalar_one_or_none()
    
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Verify current user is landlord
    if property_obj.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Identity verification required for legal documents
    if not current_user.identity_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Identity verification required to generate leases"
        )
    
    # Get tenant
    result = await db.execute(
        select(User).where(User.id == application.tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Generate HTML
    rent = request.rent_override or float(property_obj.monthly_rent or 0)
    charges = request.charges_override or float(property_obj.charges or 0)
    deposit = request.deposit_override
    
    html = lease_generator.generate_html(
        property=property_obj,
        landlord=current_user,
        tenant=tenant,
        start_date=request.start_date,
        rent=rent,
        lease_type=request.lease_type,
        deposit=deposit,
        charges=charges,
        duration_months=request.duration_months,
        guarantor_name=request.guarantor_name
    )
    
    return HTMLResponse(content=html)


@router.post("/create")
async def create_lease(
    request: LeaseGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a lease record in the database.
    """
    # Get application
    result = await db.execute(
        select(Application).where(Application.id == request.application_id)
    )
    application = result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Get property
    result = await db.execute(
        select(Property).where(Property.id == application.property_id)
    )
    property_obj = result.scalar_one_or_none()
    
    if not property_obj or property_obj.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Identity verification required for legal documents
    if not current_user.identity_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Identity verification required to create leases"
        )
    
    # Create lease record
    rent = request.rent_override or float(property_obj.monthly_rent or 0)
    
    lease = Lease(
        property_id=application.property_id,
        tenant_id=application.tenant_id,
        application_id=application.id,
        status='pending_signature',
        start_date=datetime.strptime(request.start_date, "%Y-%m-%d").date(),
        monthly_rent=rent,
        deposit=request.deposit_override or (rent * 2)
    )
    
    db.add(lease)
    
    # Update application status
    application.status = 'lease_created'
    
    await db.commit()
    await db.refresh(lease)
    
    return {
        "message": "Lease created successfully",
        "lease_id": str(lease.id),
        "status": lease.status
    }


@router.get("/{lease_id}/download")
async def download_lease_pdf(
    lease_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Download lease as PDF.
    """
    # Get lease
    result = await db.execute(
        select(Lease).where(Lease.id == lease_id)
    )
    lease = result.scalar_one_or_none()
    
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")
    
    # Get property
    result = await db.execute(
        select(Property).where(Property.id == lease.property_id)
    )
    property_obj = result.scalar_one_or_none()
    
    # Verify access
    if property_obj.landlord_id != current_user.id and lease.tenant_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get landlord
    landlord_result = await db.execute(select(User).where(User.id == property_obj.landlord_id))
    landlord = landlord_result.scalar_one()
    
    tenant_result = await db.execute(select(User).where(User.id == lease.tenant_id))
    tenant = tenant_result.scalar_one()
    
    # Generate HTML
    html = lease_generator.generate_html(
        property=property_obj,
        landlord=landlord,
        tenant=tenant,
        start_date=lease.start_date.strftime("%Y-%m-%d"),
        rent=float(lease.monthly_rent or 0),
        lease_type='meuble',  # Default; could be stored in lease
        deposit=float(lease.deposit or 0)
    )
    
    return HTMLResponse(content=html)

@router.get("/{lease_id}", response_model=LeaseResponse)
async def get_lease(
    lease_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get generic lease details.
    """
    result = await db.execute(
        select(Lease)
        .options(selectinload(Lease.property))
        .where(Lease.id == lease_id)
    )
    lease = result.scalar_one_or_none()
    
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")
        
    prop = lease.property
    
    # Verify access
    if prop.landlord_id != current_user.id and lease.tenant_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Construct response manually to inject location
    # (Or rely on Pydantic if we mapped it, but Lease model doesn't have prop_location)
    
    response = LeaseResponse.model_validate(lease)
    
    if prop and prop.latitude and prop.longitude:
        response.property_location = {
            "lat": float(prop.latitude),
            "lng": float(prop.longitude)
        }
        
    return response

@router.get("/", response_model=List[LeaseResponse])
async def list_leases(
    property_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List leases for current user (as landlord or tenant).
    """
    query = select(Lease).options(selectinload(Lease.property))
    
    if property_id:
        # Verify ownership
        result = await db.execute(
            select(Property).where(Property.id == property_id)
        )
        prop = result.scalar_one_or_none()
        if not prop or prop.landlord_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        query = query.where(Lease.property_id == property_id)
    else:
        # Get all leases where user is landlord or tenant
        from sqlalchemy import or_
        landlord_props = select(Property.id).where(Property.landlord_id == current_user.id)
        query = query.where(
            or_(
                Lease.tenant_id == current_user.id,
                Lease.property_id.in_(landlord_props)
            )
        )
    
    result = await db.execute(query.order_by(Lease.created_at.desc()))
    leases = result.scalars().all()
    
    # Quick fix for list response location injection (optional for now, mainly need single get)
    # Ensuring lazy load doesn't fail
    return leases
