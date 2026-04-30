"""merge_heads

Revision ID: 6c17267e50bc
Revises: a1b2c3d4e5f6, c1d2e3f4g5h6
Create Date: 2026-04-30 07:17:54.594732

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6c17267e50bc'
down_revision = ('a1b2c3d4e5f6', 'c1d2e3f4g5h6')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
