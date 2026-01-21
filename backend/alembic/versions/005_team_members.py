"""Add team_members and team_member_properties tables for Multi-User Access

Revision ID: 005
Revises: 004_messaging
Create Date: 2026-01-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '005_team_members'
down_revision = '004_messaging'
branch_labels = None
depends_on = None

# Create enums
permission_level_enum = postgresql.ENUM('view_only', 'manage_visits', 'full_access', name='permission_level_enum', create_type=False)
invite_status_enum = postgresql.ENUM('pending', 'active', 'revoked', 'expired', name='invite_status_enum', create_type=False)


def upgrade() -> None:
    # Create enums first
    permission_level_enum.create(op.get_bind(), checkfirst=True)
    invite_status_enum.create(op.get_bind(), checkfirst=True)
    
    # Create team_members table
    op.create_table(
        'team_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('landlord_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('member_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('name', sa.String(200)),
        sa.Column('permission_level', permission_level_enum, default='view_only'),
        sa.Column('status', invite_status_enum, default='pending'),
        sa.Column('invite_token', sa.String(64), unique=True, nullable=False),
        sa.Column('invite_expires_at', sa.DateTime, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('accepted_at', sa.DateTime, nullable=True),
        sa.Column('revoked_at', sa.DateTime, nullable=True),
    )
    
    # Create team_member_properties table
    op.create_table(
        'team_member_properties',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('team_member_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('team_members.id'), nullable=False),
        sa.Column('property_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('properties.id'), nullable=False),
        sa.Column('permission_override', permission_level_enum, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    
    # Create indexes
    op.create_index('ix_team_members_landlord_id', 'team_members', ['landlord_id'])
    op.create_index('ix_team_members_member_user_id', 'team_members', ['member_user_id'])
    op.create_index('ix_team_members_email', 'team_members', ['email'])
    op.create_index('ix_team_members_invite_token', 'team_members', ['invite_token'])
    op.create_index('ix_team_member_properties_team_member_id', 'team_member_properties', ['team_member_id'])
    op.create_index('ix_team_member_properties_property_id', 'team_member_properties', ['property_id'])


def downgrade() -> None:
    op.drop_index('ix_team_member_properties_property_id')
    op.drop_index('ix_team_member_properties_team_member_id')
    op.drop_index('ix_team_members_invite_token')
    op.drop_index('ix_team_members_email')
    op.drop_index('ix_team_members_member_user_id')
    op.drop_index('ix_team_members_landlord_id')
    op.drop_table('team_member_properties')
    op.drop_table('team_members')
    invite_status_enum.drop(op.get_bind(), checkfirst=True)
    permission_level_enum.drop(op.get_bind(), checkfirst=True)
