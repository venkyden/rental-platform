"""add_biometric_consents

Revision ID: a9b1c2d3e4f5
Revises: d184160e73e2
Create Date: 2026-07-04 00:00:00.000000

GDPR Art. 9 explicit-consent record for the selfie face-match.
Contains no biometric data — consent proof only (master plan WS-2).
"""

import sqlalchemy as sa
from alembic import op

revision = "a9b1c2d3e4f5"
down_revision = "d184160e73e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "biometric_consents",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("consent_version", sa.String(20), nullable=False),
        sa.Column("consented_at", sa.DateTime(), nullable=False),
        sa.Column("user_agent", sa.String(400), nullable=True),
    )
    op.create_index(
        "ix_biometric_consents_user_id", "biometric_consents", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_biometric_consents_user_id", table_name="biometric_consents")
    op.drop_table("biometric_consents")
