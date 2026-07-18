"""add users.first_name (dedicated given name for trust lines)

Revision ID: a9c1e2d3f4b5
Revises: b7d8032403f5
Create Date: 2026-07-18

No backfill: deriving a given name from full_name is exactly the surname-leak
heuristic removed in 830556e. Captured going forward via profile/onboarding.
"""

import sqlalchemy as sa

from alembic import op

revision = "a9c1e2d3f4b5"
down_revision = "b7d8032403f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "first_name")
