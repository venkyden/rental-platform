"""add_caf_eligible_to_property

Revision ID: 6bf5a0864033
Revises: b3a4d5e6f7g8
Create Date: 2026-05-03 17:12:00.959159

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6bf5a0864033'
down_revision = 'b3a4d5e6f7g8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('properties', sa.Column('caf_eligible', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('properties', 'caf_eligible')
