"""Add user identity fields for smart matching

Revision ID: 009
Revises: 008_auth_security
Create Date: 2026-01-28
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers
revision = "009_user_identity_fields"
down_revision = "008_auth_security"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add identity fields for Smart Matching
    op.add_column("users", sa.Column("nationality", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("languages", postgresql.JSON(), nullable=True))
    op.add_column("users", sa.Column("gender", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "birth_date")
    op.drop_column("users", "gender")
    op.drop_column("users", "languages")
    op.drop_column("users", "nationality")
