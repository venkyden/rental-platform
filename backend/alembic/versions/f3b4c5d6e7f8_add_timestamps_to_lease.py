"""add_timestamps_to_lease

Revision ID: f3b4c5d6e7f8
Revises: 205b604ae1c0
Create Date: 2026-05-02 04:56:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f3b4c5d6e7f8"
down_revision = "205b604ae1c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leases", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))
    op.add_column("leases", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))
    
    # Update existing rows to have a value for created_at and updated_at
    # (server_default will handle it for new rows, but existing rows might need it)
    # Actually, with server_default it should be fine if we make it nullable=True first, then fill, then nullable=False if desired.
    # For now, keeping it nullable=True is safer.


def downgrade() -> None:
    op.drop_column("leases", "updated_at")
    op.drop_column("leases", "created_at")
