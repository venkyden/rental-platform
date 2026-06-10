"""merge heads

Revision ID: f3f9c0359a2a
Revises: add_mrh_insurance_fields, c1d2e3f4a5b6
Create Date: 2026-06-10 23:48:56.030613

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f3f9c0359a2a'
down_revision = ('add_mrh_insurance_fields', 'c1d2e3f4a5b6')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
