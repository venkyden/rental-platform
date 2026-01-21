from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User, UserRole
from app.models.property_manager import PropertyManagerAccess
from app.core.permissions import check_permission

router = APIRouter(prefix="/property-manager", tags=["Property Manager"])


class GrantAccessRequest(BaseModel):
    landlord_id: str
    management_fee_percentage: Optional[str] = "10.0"
    notes: Optional[str] = None


class PropertyManagerAccessResponse(BaseModel):
    id: str
    property_manager_id: str
    landlord_id: str
    landlord_name: str
    is_active: bool
    management_fee_percentage: Optional[str]
    granted_at: datetime
    revoked_at: Optional[datetime]
    notes: Optional[str]
    
    class Config:
        from_attributes = True


@router.post("/request-access")
async def request_access_to_landlord(
    request: GrantAccessRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Property Manager requests access to manage a landlord's properties.
    In production, this would notify the landlord for approval.
    For now, we auto-approve.
    """
    # Only property managers can request access
    if current_user.role != UserRole.PROPERTY_MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only property managers can request access"
        )
    
    # Verify landlord exists
    result = await db.execute(
        select(User).where(User.id == request.landlord_id)
    )
    landlord = result.scalar_one_or_none()
    
    if not landlord or landlord.role != UserRole.LANDLORD:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Landlord not found"
        )
    
    # Check if access already exists
    result = await db.execute(
        select(PropertyManagerAccess).where(
            PropertyManagerAccess.property_manager_id == current_user.id,
            PropertyManagerAccess.landlord_id == request.landlord_id
        )
    )
    existing_access = result.scalar_one_or_none()
    
    if existing_access and existing_access.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access already granted"
        )
    
    # Create access record
    access = PropertyManagerAccess(
        property_manager_id=current_user.id,
        landlord_id=request.landlord_id,
        management_fee_percentage=request.management_fee_percentage,
        notes=request.notes,
        is_active=True
    )
    
    db.add(access)
    await db.commit()
    await db.refresh(access)
    
    return {
        "message": "Access granted successfully",
        "access_id": str(access.id)
    }


@router.get("/my-landlords", response_model=List[PropertyManagerAccessResponse])
async def get_my_landlords(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all landlords that this property manager has access to"""
    if current_user.role != UserRole.PROPERTY_MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only property managers can access this"
        )
    
    result = await db.execute(
        select(PropertyManagerAccess).where(
            PropertyManagerAccess.property_manager_id == current_user.id,
            PropertyManagerAccess.is_active == True
        )
    )
    accesses = result.scalars().all()
    
    # Fetch landlord details
    response = []
    for access in accesses:
        landlord_result = await db.execute(
            select(User).where(User.id == access.landlord_id)
        )
        landlord = landlord_result.scalar_one_or_none()
        
        if landlord:
            response.append({
                "id": str(access.id),
                "property_manager_id": str(access.property_manager_id),
                "landlord_id": str(access.landlord_id),
                "landlord_name": landlord.full_name,
                "is_active": access.is_active,
                "management_fee_percentage": access.management_fee_percentage,
                "granted_at": access.granted_at,
                "revoked_at": access.revoked_at,
                "notes": access.notes
            })
    
    return response


@router.post("/revoke-access/{access_id}")
async def revoke_access(
    access_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Landlord or Property Manager can revoke access.
    Landlord revokes a property manager's access to their properties.
    Property Manager can revoke their own access.
    """
    result = await db.execute(
        select(PropertyManagerAccess).where(PropertyManagerAccess.id == access_id)
    )
    access = result.scalar_one_or_none()
    
    if not access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access record not found"
        )
    
    # Check permissions: either landlord or property manager can revoke
    if current_user.role == UserRole.LANDLORD:
        if str(current_user.id) != str(access.landlord_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only revoke access to your own properties"
            )
    elif current_user.role == UserRole.PROPERTY_MANAGER:
        if str(current_user.id) != str(access.property_manager_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only revoke your own access"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only landlords or property managers can revoke access"
        )
    
    # Revoke access
    access.is_active = False
    access.revoked_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Access revoked successfully"}


@router.get("/my-property-managers", response_model=List[PropertyManagerAccessResponse])
async def get_my_property_managers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Landlord: Get all property managers who have access to my properties"""
    if current_user.role != UserRole.LANDLORD:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only landlords can access this"
        )
    
    result = await db.execute(
        select(PropertyManagerAccess).where(
            PropertyManagerAccess.landlord_id == current_user.id,
            PropertyManagerAccess.is_active == True
        )
    )
    accesses = result.scalars().all()
    
    # Fetch property manager details
    response = []
    for access in accesses:
        pm_result = await db.execute(
            select(User).where(User.id == access.property_manager_id)
        )
        pm_user = pm_result.scalar_one_or_none()
        
        if pm_user:
            response.append({
                "id": str(access.id),
                "property_manager_id": str(access.property_manager_id),
                "landlord_id": str(access.landlord_id),
                "landlord_name": pm_user.full_name,  # Actually PM name in this context
                "is_active": access.is_active,
                "management_fee_percentage": access.management_fee_percentage,
                "granted_at": access.granted_at,
                "revoked_at": access.revoked_at,
                "notes": access.notes
            })
    
    return response
