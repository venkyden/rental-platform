"""add properties.walkthrough_answers and properties.flatmates

Revision ID: c7e1a9d4b2f6
Revises: cddfc29ae95d
Create Date: 2026-10-13

The landlord's answers from the walk-through tap list and the household card
for a shared home. Both nullable: existing listings have no answers, and the
listing page shows no panel for them.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "c7e1a9d4b2f6"
down_revision = "cddfc29ae95d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("properties", sa.Column("walkthrough_answers", postgresql.JSONB(), nullable=True))
    op.add_column("properties", sa.Column("flatmates", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("properties", "flatmates")
    op.drop_column("properties", "walkthrough_answers")
