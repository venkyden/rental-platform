"""add_agency_verification_fields

Revision ID: 6d1f57373f33
Revises: 5c1f57373f32
Create Date: 2026-04-30 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6d1f57373f33'
down_revision = '5c1f57373f32'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns
    op.add_column('users', sa.Column('kbis_verified', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('users', sa.Column('carte_g_verified', sa.Boolean(), server_default='false', nullable=True))

def downgrade() -> None:
    op.drop_column('users', 'carte_g_verified')
    op.drop_column('users', 'kbis_verified')
