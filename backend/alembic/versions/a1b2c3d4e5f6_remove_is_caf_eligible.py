"""remove is_caf_eligible

Revision ID: a1b2c3d4e5f6
Revises: f1380d161d84
Create Date: 2026-03-21 21:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f1380d161d84'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('properties', 'is_caf_eligible')


def downgrade() -> None:
    op.add_column('properties', sa.Column('is_caf_eligible', sa.Boolean(), nullable=True))
