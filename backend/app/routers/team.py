"""
Team Management API router.
Allows landlords to invite team members, manage permissions, and assign properties.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime, timedelta
from uuid import UUID
from pydantic import BaseModel, EmailStr
import secrets

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.services.email import email_service
from app.models.user import User, UserRole
from app.models.property import Property
from app.models.team import TeamMember, TeamMemberProperty, PermissionLevel, InviteStatus

router = APIRouter(prefix="/team", tags=["Team Management"])


# --- Schemas ---

class InviteTeamMemberRequest(BaseModel):
    email: EmailStr
    name: str
    permission_level: str = "view_only"  # view_only, manage_visits, full_access
    property_ids: List[str] = []  # If empty, no properties assigned yet


class UpdateTeamMemberRequest(BaseModel):
    name: Optional[str] = None
    permission_level: Optional[str] = None


class UpdatePropertyAccessRequest(BaseModel):
    property_ids: List[str]  # Complete list of property IDs to assign


class TeamMemberResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    permission_level: str
    status: str
    property_count: int
    created_at: datetime
    accepted_at: Optional[datetime]

    class Config:
        from_attributes = True


class TeamMemberDetailResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    permission_level: str
    status: str
    properties: List[dict]  # [{id, title, permission_override}]
    created_at: datetime
    accepted_at: Optional[datetime]
    invite_link: Optional[str]  # Only for pending invites

    class Config:
        from_attributes = True


class AcceptInviteRequest(BaseModel):
    # If user already exists, they just need to be logged in
    # If new user, they'll create account first
    pass


# --- Endpoints ---

@router.get("/members", response_model=List[TeamMemberResponse])
async def get_team_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all team members for the current landlord."""
    if current_user.role != UserRole.LANDLORD:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only landlords can manage team members"
        )
    
    result = await db.execute(
        select(TeamMember).where(
            and_(
                TeamMember.landlord_id == current_user.id,
                TeamMember.status != InviteStatus.REVOKED
            )
        ).order_by(TeamMember.created_at.desc())
    )
    members = result.scalars().all()
    
    response = []
    for member in members:
        # Count assigned properties
        prop_count = (await db.execute(
            select(TeamMemberProperty).where(
                TeamMemberProperty.team_member_id == member.id
            )
        )).scalars().all()
        
        response.append(TeamMemberResponse(
            id=str(member.id),
            email=member.email,
            name=member.name,
            permission_level=member.permission_level.value,
            status=member.status.value,
            property_count=len(prop_count),
            created_at=member.created_at,
            accepted_at=member.accepted_at
        ))
    
    return response


@router.post("/members", response_model=TeamMemberDetailResponse)
async def invite_team_member(
    data: InviteTeamMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Invite a new team member by email."""
    if current_user.role != UserRole.LANDLORD:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only landlords can invite team members"
        )
    
    # Map permission string to enum
    try:
        permission = PermissionLevel(data.permission_level)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid permission level. Use: view_only, manage_visits, full_access"
        )
    
    # Check if already invited
    existing = (await db.execute(
        select(TeamMember).where(
            and_(
                TeamMember.landlord_id == current_user.id,
                TeamMember.email == data.email,
                TeamMember.status != InviteStatus.REVOKED
            )
        )
    )).scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email has already been invited"
        )
    
    # Check if user exists (to auto-link if they accept)
    existing_user = (await db.execute(
        select(User).where(User.email == data.email)
    )).scalar_one_or_none()
    
    # Create team member
    member = TeamMember(
        landlord_id=current_user.id,
        member_user_id=None,  # Will be set when invite accepted
        email=data.email,
        name=data.name,
        permission_level=permission,
        status=InviteStatus.PENDING,
        invite_token=secrets.token_urlsafe(32),
        invite_expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(member)
    await db.flush()  # Get member.id
    
    # Assign properties
    properties_assigned = []
    for prop_id in data.property_ids:
        # Verify property belongs to landlord
        prop = (await db.execute(
            select(Property).where(Property.id == prop_id)
        )).scalar_one_or_none()
        
        if prop and prop.landlord_id == current_user.id:
            access = TeamMemberProperty(
                team_member_id=member.id,
                property_id=prop.id
            )
            db.add(access)
            properties_assigned.append({
                "id": str(prop.id),
                "title": prop.title,
                "permission_override": None
            })
    
    await db.commit()
    await db.refresh(member)
    
    # Send invite email
    await email_service.send_team_invite_email(
        to_email=member.email,
        name=member.name or member.email,
        landlord_name=current_user.full_name or current_user.email,
        invite_token=member.invite_token,
        permission_level=member.permission_level.value
    )
    invite_link = f"/invite/{member.invite_token}"
    
    return TeamMemberDetailResponse(
        id=str(member.id),
        email=member.email,
        name=member.name,
        permission_level=member.permission_level.value,
        status=member.status.value,
        properties=properties_assigned,
        created_at=member.created_at,
        accepted_at=member.accepted_at,
        invite_link=invite_link
    )


@router.get("/members/{member_id}", response_model=TeamMemberDetailResponse)
async def get_team_member(
    member_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get details of a specific team member."""
    member = (await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )).scalar_one_or_none()
    
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    if member.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get assigned properties
    accesses = (await db.execute(
        select(TeamMemberProperty).where(
            TeamMemberProperty.team_member_id == member.id
        )
    )).scalars().all()
    
    properties = []
    for access in accesses:
        prop = (await db.execute(
            select(Property).where(Property.id == access.property_id)
        )).scalar_one_or_none()
        if prop:
            properties.append({
                "id": str(prop.id),
                "title": prop.title,
                "permission_override": access.permission_override.value if access.permission_override else None
            })
    
    invite_link = f"/invite/{member.invite_token}" if member.status == InviteStatus.PENDING else None
    
    return TeamMemberDetailResponse(
        id=str(member.id),
        email=member.email,
        name=member.name,
        permission_level=member.permission_level.value,
        status=member.status.value,
        properties=properties,
        created_at=member.created_at,
        accepted_at=member.accepted_at,
        invite_link=invite_link
    )


@router.patch("/members/{member_id}", response_model=TeamMemberResponse)
async def update_team_member(
    member_id: UUID,
    data: UpdateTeamMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update team member's name or permission level."""
    member = (await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )).scalar_one_or_none()
    
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    if member.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if data.name is not None:
        member.name = data.name
    
    if data.permission_level is not None:
        try:
            member.permission_level = PermissionLevel(data.permission_level)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid permission level"
            )
    
    await db.commit()
    await db.refresh(member)
    
    # Get property count
    prop_count = len((await db.execute(
        select(TeamMemberProperty).where(
            TeamMemberProperty.team_member_id == member.id
        )
    )).scalars().all())
    
    return TeamMemberResponse(
        id=str(member.id),
        email=member.email,
        name=member.name,
        permission_level=member.permission_level.value,
        status=member.status.value,
        property_count=prop_count,
        created_at=member.created_at,
        accepted_at=member.accepted_at
    )


@router.delete("/members/{member_id}")
async def revoke_team_member(
    member_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke a team member's access."""
    member = (await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )).scalar_one_or_none()
    
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    if member.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    member.status = InviteStatus.REVOKED
    member.revoked_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Access revoked successfully"}


@router.put("/members/{member_id}/properties")
async def update_property_access(
    member_id: UUID,
    data: UpdatePropertyAccessRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update which properties a team member can access."""
    member = (await db.execute(
        select(TeamMember).where(TeamMember.id == member_id)
    )).scalar_one_or_none()
    
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    if member.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Remove all existing property access
    await db.execute(
        TeamMemberProperty.__table__.delete().where(
            TeamMemberProperty.team_member_id == member_id
        )
    )
    
    # Add new property access
    for prop_id in data.property_ids:
        # Verify property belongs to landlord
        prop = (await db.execute(
            select(Property).where(Property.id == prop_id)
        )).scalar_one_or_none()
        
        if prop and prop.landlord_id == current_user.id:
            access = TeamMemberProperty(
                team_member_id=member_id,
                property_id=prop.id
            )
            db.add(access)
    
    await db.commit()
    
    return {"message": "Property access updated", "property_count": len(data.property_ids)}


@router.post("/invite/accept/{token}")
async def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept a team invite. User must be logged in."""
    member = (await db.execute(
        select(TeamMember).where(TeamMember.invite_token == token)
    )).scalar_one_or_none()
    
    if not member:
        raise HTTPException(status_code=404, detail="Invalid invite link")
    
    if member.status != InviteStatus.PENDING:
        raise HTTPException(status_code=400, detail="Invite already used or revoked")
    
    # Check expiry
    if member.invite_expires_at and datetime.utcnow() > member.invite_expires_at:
        member.status = InviteStatus.EXPIRED
        await db.commit()
        raise HTTPException(status_code=400, detail="Invite has expired")
    
    # Verify email matches
    if current_user.email.lower() != member.email.lower():
        raise HTTPException(
            status_code=400,
            detail=f"This invite was sent to {member.email}. Please log in with that email."
        )
    
    # Accept invite
    member.member_user_id = current_user.id
    member.status = InviteStatus.ACTIVE
    member.accepted_at = datetime.utcnow()
    
    await db.commit()
    
    # Get landlord name
    landlord = (await db.execute(
        select(User).where(User.id == member.landlord_id)
    )).scalar_one_or_none()
    
    return {
        "message": "Invite accepted successfully",
        "landlord_name": landlord.full_name if landlord else "Unknown",
        "permission_level": member.permission_level.value
    }


@router.get("/invite/{token}")
async def get_invite_info(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Get info about an invite (public endpoint for invite page)."""
    member = (await db.execute(
        select(TeamMember).where(TeamMember.invite_token == token)
    )).scalar_one_or_none()
    
    if not member:
        raise HTTPException(status_code=404, detail="Invalid invite link")
    
    # Get landlord info
    landlord = (await db.execute(
        select(User).where(User.id == member.landlord_id)
    )).scalar_one_or_none()
    
    # Get property count
    prop_count = len((await db.execute(
        select(TeamMemberProperty).where(
            TeamMemberProperty.team_member_id == member.id
        )
    )).scalars().all())
    
    return {
        "email": member.email,
        "name": member.name,
        "status": member.status.value,
        "landlord_name": landlord.full_name if landlord else "Unknown",
        "permission_level": member.permission_level.value,
        "property_count": prop_count,
        "expired": member.invite_expires_at and datetime.utcnow() > member.invite_expires_at
    }
