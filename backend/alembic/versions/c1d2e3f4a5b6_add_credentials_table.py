"""add_credentials_table

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-06-05 00:00:00.000000

Thin banded credential store — no source documents, no raw PII.
See DOSSIER §2 + §0.8 for design rationale.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "c1d2e3f4a5b6"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "credentials",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("subject_role", sa.String(20), nullable=False),
        sa.Column("rail", sa.String(10), nullable=False),
        sa.Column(
            "subject_user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("subject_display_name", sa.String(256), nullable=True),
        sa.Column("issued_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("claims", JSONB, nullable=False),
        sa.Column("disclaimer", sa.String(512), nullable=False),
        sa.Column("signature", sa.String(128), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_credentials_subject_user_id", "credentials", ["subject_user_id"])


def downgrade() -> None:
    op.drop_index("ix_credentials_subject_user_id", table_name="credentials")
    op.drop_table("credentials")
