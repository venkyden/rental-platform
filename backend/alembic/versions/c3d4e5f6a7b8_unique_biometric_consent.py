"""unique (user_id, consent_version) on biometric_consents

Duplicate consent rows pollute the legal-evidence audit trail; DB constraint
closes the check-then-insert race in record_biometric_consent (CodeRabbit
review on PR #35).

Revision ID: c3d4e5f6a7b8
Revises: b1c2d3e4f5a6
Create Date: 2026-07-04

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "c3d4e5f6a7b8"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_biometric_consents_user_version",
        "biometric_consents",
        ["user_id", "consent_version"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_biometric_consents_user_version", "biometric_consents", type_="unique"
    )
