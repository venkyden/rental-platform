"""Add missing user columns

Revision ID: 002c
Revises: 002b
Create Date: 2026-01-10

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "002c"
down_revision = "002b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Missing users columns
    op.add_column("users", sa.Column("segment", sa.String(), nullable=True))
    op.add_column("users", sa.Column("preferences", sa.JSON(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "onboarding_completed", sa.Boolean(), server_default="false", nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "onboarding_completed")
    op.drop_column("users", "preferences")
    op.drop_column("users", "segment")
