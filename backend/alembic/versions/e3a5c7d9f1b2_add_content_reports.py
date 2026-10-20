"""add content_reports (DSA notice and action)

Revision ID: e3a5c7d9f1b2
Revises: d2f4b6c8e0a1
Create Date: 2026-10-20
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "e3a5c7d9f1b2"
down_revision = "d2f4b6c8e0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "content_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "property_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("properties.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reason", sa.String(30), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("notifier_name", sa.String(120), nullable=True),
        sa.Column("notifier_email", sa.String(255), nullable=True),
        sa.Column("good_faith", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="received"),
        sa.Column("ground", sa.String(20), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.Column(
            "decided_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_content_reports_property_id", "content_reports", ["property_id"])
    op.create_index("ix_content_reports_status", "content_reports", ["status"])


def downgrade() -> None:
    op.drop_index("ix_content_reports_status", table_name="content_reports")
    op.drop_index("ix_content_reports_property_id", table_name="content_reports")
    op.drop_table("content_reports")
