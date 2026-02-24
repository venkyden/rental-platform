"""
Team member models for Multi-User Access.
Allows landlords to invite team members with property-level permissions.
"""

import enum
import secrets
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class PermissionLevel(str, enum.Enum):
    VIEW_ONLY = "view_only"  # View property details, messages
    MANAGE_VISITS = "manage_visits"  # + Manage visit slots, respond to inquiries
    FULL_ACCESS = "full_access"  # + Edit property, generate leases


class InviteStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"


class TeamMember(Base):
    """
    Team member invited by landlord to manage properties.
    Supports pending invites (member_user_id NULL until accepted).
    """

    __tablename__ = "team_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Who invited this team member (must be landlord)
    landlord_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # The user account of the team member (NULL until invite accepted)
    member_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )

    # Invite details
    email = Column(String(255), nullable=False)  # Invite sent to this email
    name = Column(String(200))  # Display name set by landlord

    # Default permission level (can be overridden per-property)
    permission_level = Column(
        SQLEnum(PermissionLevel, name="permission_level_enum", native_enum=True),
        default=PermissionLevel.VIEW_ONLY,
    )

    # Invite status
    status = Column(
        SQLEnum(InviteStatus, name="invite_status_enum", native_enum=True),
        default=InviteStatus.PENDING,
    )

    # Token for invite link (secure random)
    invite_token = Column(
        String(64),
        unique=True,
        nullable=False,
        default=lambda: secrets.token_urlsafe(32),
    )
    invite_expires_at = Column(DateTime, nullable=True)  # Optional expiry

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)

    # Relationships
    landlord = relationship(
        "User", foreign_keys=[landlord_id], backref="team_members_owned"
    )
    member = relationship(
        "User", foreign_keys=[member_user_id], backref="team_memberships"
    )
    property_access = relationship(
        "TeamMemberProperty", back_populates="team_member", cascade="all, delete-orphan"
    )


class TeamMemberProperty(Base):
    """
    Which properties a team member can access.
    Allows property-specific permission overrides.
    """

    __tablename__ = "team_member_properties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    team_member_id = Column(
        UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False, index=True
    )
    property_id = Column(
        UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False, index=True
    )

    # Optional: override permission level for this specific property
    # If NULL, uses the team member's default permission level
    permission_override = Column(
        SQLEnum(
            PermissionLevel,
            name="permission_level_enum",
            native_enum=True,
            create_type=False,
        ),
        nullable=True,
    )

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    team_member = relationship("TeamMember", back_populates="property_access")
    property = relationship("Property", backref="team_access")
