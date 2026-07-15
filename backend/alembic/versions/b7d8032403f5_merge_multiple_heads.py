"""merge multiple heads

Revision ID: b7d8032403f5
Revises: 20260715_fg_rent_freeze, add_deposit_binding_data
Create Date: 2026-07-15 17:20:24.143048

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7d8032403f5'
down_revision = ('20260715_fg_rent_freeze', 'add_deposit_binding_data')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
