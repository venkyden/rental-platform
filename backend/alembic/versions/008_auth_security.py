"""Add security fields for auth

Revision ID: 008_auth_security
Revises: 007_user_address_fields
Create Date: 2026-01-27

Adds:
- failed_login_attempts and locked_until to users table
- used_reset_tokens table for single-use password reset tokens
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '008_auth_security'
down_revision = '44ebd345175e'  # Current actual head
branch_labels = None
depends_on = None


def upgrade():
    # Add account security fields to users
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(), nullable=True))
    
    # Create used_reset_tokens table
    op.create_table(
        'used_reset_tokens',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('token_hash', sa.String(), nullable=False, unique=True, index=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
    )
    

def downgrade():
    op.execute(\"DROP TABLE IF EXISTS used_reset_tokens CASCADE\")
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_attempts')
