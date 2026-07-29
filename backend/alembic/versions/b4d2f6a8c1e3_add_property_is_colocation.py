"""add properties.is_colocation (authoritative colocation signal)

Revision ID: b4d2f6a8c1e3
Revises: 2ea469daa90b
Create Date: 2026-07-28

Decoupled from property_type='room', which is ambiguous. Legacy rows keep
matching search via the existing property_type/amenities OR-fallback — no
backfill needed here.
"""

import sqlalchemy as sa

from alembic import op

revision = "b4d2f6a8c1e3"
down_revision = "2ea469daa90b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("is_colocation", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("properties", "is_colocation")
