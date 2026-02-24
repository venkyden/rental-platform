"""
Team permissions helper functions.
Used to check if a user has access to a property based on team membership.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.property import Property
from app.models.team import (InviteStatus, PermissionLevel, TeamMember,
                             TeamMemberProperty)
from app.models.user import User


async def get_effective_permission(
    db: AsyncSession, user_id: UUID, property_id: UUID
) -> Optional[PermissionLevel]:
    """
    Get the effective permission level a user has for a property.
    Returns None if no access.

    Checks:
    1. Is user the property owner? → FULL_ACCESS
    2. Is user a team member with access to this property? → Their permission level
    """
    # Check if user is property owner
    prop = (
        await db.execute(select(Property).where(Property.id == property_id))
    ).scalar_one_or_none()

    if prop and prop.landlord_id == user_id:
        return PermissionLevel.FULL_ACCESS

    # Check team membership
    team_member = (
        await db.execute(
            select(TeamMember).where(
                and_(
                    TeamMember.member_user_id == user_id,
                    TeamMember.status == InviteStatus.ACTIVE,
                )
            )
        )
    ).scalar_one_or_none()

    if not team_member:
        return None

    # Check if they have access to this specific property
    property_access = (
        await db.execute(
            select(TeamMemberProperty).where(
                and_(
                    TeamMemberProperty.team_member_id == team_member.id,
                    TeamMemberProperty.property_id == property_id,
                )
            )
        )
    ).scalar_one_or_none()

    if not property_access:
        return None

    # Return override if set, otherwise default permission
    return property_access.permission_override or team_member.permission_level


async def can_view_property(db: AsyncSession, user_id: UUID, property_id: UUID) -> bool:
    """Check if user can view a property (any permission level)."""
    permission = await get_effective_permission(db, user_id, property_id)
    return permission is not None


async def can_manage_visits(db: AsyncSession, user_id: UUID, property_id: UUID) -> bool:
    """Check if user can manage visits (manage_visits or full_access)."""
    permission = await get_effective_permission(db, user_id, property_id)
    return permission in [PermissionLevel.MANAGE_VISITS, PermissionLevel.FULL_ACCESS]


async def can_edit_property(db: AsyncSession, user_id: UUID, property_id: UUID) -> bool:
    """Check if user can edit property (full_access only)."""
    permission = await get_effective_permission(db, user_id, property_id)
    return permission == PermissionLevel.FULL_ACCESS


async def get_accessible_properties(
    db: AsyncSession, user_id: UUID, min_permission: Optional[PermissionLevel] = None
) -> List[UUID]:
    """
    Get all property IDs a user can access.

    Args:
        user_id: The user's ID
        min_permission: Minimum required permission level (optional filter)

    Returns:
        List of property UUIDs
    """
    property_ids = []

    # Get properties user owns
    owned = await db.execute(select(Property.id).where(Property.landlord_id == user_id))
    property_ids.extend([row[0] for row in owned.fetchall()])

    # Get properties through team membership
    team_member = (
        await db.execute(
            select(TeamMember).where(
                and_(
                    TeamMember.member_user_id == user_id,
                    TeamMember.status == InviteStatus.ACTIVE,
                )
            )
        )
    ).scalar_one_or_none()

    if team_member:
        access_query = select(TeamMemberProperty).where(
            TeamMemberProperty.team_member_id == team_member.id
        )

        accesses = (await db.execute(access_query)).scalars().all()

        for access in accesses:
            # Check permission level if filter specified
            if min_permission:
                effective = access.permission_override or team_member.permission_level
                if not _permission_meets_minimum(effective, min_permission):
                    continue

            property_ids.append(access.property_id)

    return list(set(property_ids))  # Deduplicate


def _permission_meets_minimum(
    permission: PermissionLevel, minimum: PermissionLevel
) -> bool:
    """Check if a permission level meets the minimum required."""
    levels = [
        PermissionLevel.VIEW_ONLY,
        PermissionLevel.MANAGE_VISITS,
        PermissionLevel.FULL_ACCESS,
    ]
    return levels.index(permission) >= levels.index(minimum)


async def get_team_landlord_id(db: AsyncSession, user_id: UUID) -> Optional[UUID]:
    """
    If user is a team member, get their landlord's ID.
    Returns None if user is not a team member.
    """
    team_member = (
        await db.execute(
            select(TeamMember).where(
                and_(
                    TeamMember.member_user_id == user_id,
                    TeamMember.status == InviteStatus.ACTIVE,
                )
            )
        )
    ).scalar_one_or_none()

    return team_member.landlord_id if team_member else None
