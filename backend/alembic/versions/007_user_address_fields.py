"""Add user address fields for real lease generation

Revision ID: 007
Revises: 006
Create Date: 2026-01-21

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers
revision = "007_user_address_fields"
down_revision = "006_webhooks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add address fields to users table
    op.add_column("users", sa.Column("address_line1", sa.String(), nullable=True))
    op.add_column("users", sa.Column("address_line2", sa.String(), nullable=True))
    op.add_column("users", sa.Column("city", sa.String(), nullable=True))
    op.add_column("users", sa.Column("postal_code", sa.String(10), nullable=True))
    op.add_column(
        "users",
        sa.Column("country", sa.String(), server_default="France", nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "country")
    op.drop_column("users", "postal_code")
    op.drop_column("users", "city")
    op.drop_column("users", "address_line2")
    op.drop_column("users", "address_line1")
