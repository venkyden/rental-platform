"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2026-01-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('role', sa.Enum('tenant', 'landlord', 'admin', name='userrole'), nullable=False),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('email_verified', sa.Boolean(), default=False),
        sa.Column('identity_verified', sa.Boolean(), default=False),
        sa.Column('employment_verified', sa.Boolean(), default=False),
        sa.Column('identity_data', postgresql.JSON(), nullable=True),
        sa.Column('employment_data', postgresql.JSON(), nullable=True),
        sa.Column('trust_score', sa.Integer(), default=0),
        sa.Column('risk_tier', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
    )
    
    op.create_index('ix_users_email', 'users', ['email'])
    
    # Create verification_records table
    op.create_table(
        'verification_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('verification_type', sa.String(), nullable=False),
        sa.Column('status', sa.Enum('pending', 'verified', 'failed', 'expired', name='verificationstatus'), nullable=False),
        sa.Column('confidence_score', sa.Integer(), nullable=True),
        sa.Column('verification_data', postgresql.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
    )
    
    op.create_index('ix_verification_records_user_id', 'verification_records', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_verification_records_user_id')
    op.drop_table('verification_records')
    op.execute('DROP TYPE verificationstatus')
    
    op.drop_index('ix_users_email')
    op.drop_table('users')
    op.execute('DROP TYPE userrole')
