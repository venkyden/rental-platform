"""add ownership verification to user

Revision ID: 0f55a1a92c1f
Revises: 6bf5a0864033
Create Date: 2026-05-06 12:00:00

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0f55a1a92c1f'
down_revision = '6bf5a0864033'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Safely add columns to users table
    op.add_column('users', sa.Column('ownership_verified', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('users', sa.Column('ownership_data', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'ownership_data')
    op.drop_column('users', 'ownership_verified')
