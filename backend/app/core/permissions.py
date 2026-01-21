from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models.user import User, UserRole
from app.models.property_manager import PropertyManagerAccess


async def check_permission(
    user: User,
    action: str,
    resource_owner_id: Optional[str] = None,
    db: Optional[AsyncSession] = None
) -> bool:
    """
    Check if user has permission to perform action.
    
    Args:
        user: Current user
        action: Action to perform (e.g., 'create_property', 'approve_application')
        resource_owner_id: ID of the landlord who owns the resource (for property manager checks)
        db: Database session (required for property manager access checks)
    
    Returns:
        True if user has permission, raises HTTPException otherwise
    """
    
    # Admin can do anything
    if user.role == UserRole.ADMIN:
        return True
    
    # Landlord permissions
    landlord_actions = [
        'create_property', 'edit_property', 'delete_property',
        'view_applications', 'approve_application', 'reject_application',
        'generate_lease', 'sign_lease_landlord', 'collect_rent',
        'view_analytics', 'view_comps', 'view_churn'
    ]
    
    # Tenant permissions
    tenant_actions = [
        'search_properties', 'apply_to_property', 'sign_lease_tenant',
        'pay_rent', 'view_own_applications', 'view_own_lease'
    ]
    
    # Property Manager has ALL landlord permissions
    property_manager_actions = landlord_actions + ['manage_multiple_landlords']
    
    # Check role-based permissions
    if user.role == UserRole.LANDLORD:
        if action not in landlord_actions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Landlords cannot perform action: {action}"
            )
        return True
    
    elif user.role == UserRole.TENANT:
        if action not in tenant_actions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Tenants cannot perform action: {action}"
            )
        return True
    
    elif user.role == UserRole.PROPERTY_MANAGER:
        if action not in property_manager_actions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Property Managers cannot perform action: {action}"
            )
        
        # For property manager, check if they have access to this landlord's properties
        if action in landlord_actions and resource_owner_id and db:
            access = await check_property_manager_access(
                property_manager_id=str(user.id),
                landlord_id=resource_owner_id,
                db=db
            )
            if not access:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to manage this landlord's properties"
                )
        
        return True
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions"
    )


async def check_property_manager_access(
    property_manager_id: str,
    landlord_id: str,
    db: AsyncSession
) -> bool:
    """
    Check if property manager has active access to landlord's properties.
    """
    result = await db.execute(
        select(PropertyManagerAccess).where(
            PropertyManagerAccess.property_manager_id == property_manager_id,
            PropertyManagerAccess.landlord_id == landlord_id,
            PropertyManagerAccess.is_active == True
        )
    )
    access = result.scalar_one_or_none()
    return access is not None


async def can_manage_property(
    user: User,
    property_owner_id: str,
    db: AsyncSession
) -> bool:
    """
    Check if user can manage a specific property.
    
    Returns True if:
    - User is the landlord who owns the property, OR
    - User is a property manager with access to that landlord's properties
    """
    # User is the owner
    if str(user.id) == property_owner_id:
        return True
    
    # User is property manager with access
    if user.role == UserRole.PROPERTY_MANAGER:
        return await check_property_manager_access(
            property_manager_id=str(user.id),
            landlord_id=property_owner_id,
            db=db
        )
    
    return False
