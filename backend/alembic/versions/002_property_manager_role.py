"""Add property manager role and access table

Revision ID: 002
Revises: 001
Create Date: 2026-01-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update UserRole enum to include property_manager
    op.execute("ALTER TYPE userrole ADD VALUE 'property_manager'")
    
    # Create property_manager_access table
    op.create_table(
        'property_manager_access',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('property_manager_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('landlord_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('management_fee_percentage', sa.String(), nullable=True),
        sa.Column('granted_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
    )
    
    op.create_index('ix_pm_access_property_manager_id', 'property_manager_access', ['property_manager_id'])
    op.create_index('ix_pm_access_landlord_id', 'property_manager_access', ['landlord_id'])


def downgrade() -> None:
    op.drop_index('ix_pm_access_landlord_id', if_exists=True)
    op.drop_index('ix_pm_access_property_manager_id', if_exists=True)
    op.execute("DROP TABLE IF EXISTS property_manager_access CASCADE")
    
    # Note: Cannot remove enum value in PostgreSQL easily, would need to recreate the type
