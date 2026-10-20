"""add properties.furnished_incomplete

Revision ID: d2f4b6c8e0a1
Revises: c7e1a9d4b2f6
Create Date: 2026-10-20

True while the owner has marked an item required by Décret 2015-981 as absent
or not working; such a listing is left out of the furnished search filter and
not shown as furnished. False for every existing row: nothing has been marked
missing before this column exists.
"""

import sqlalchemy as sa

from alembic import op

revision = "d2f4b6c8e0a1"
down_revision = "c7e1a9d4b2f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("furnished_incomplete", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("properties", "furnished_incomplete")
