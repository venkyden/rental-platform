"""merge credential-kid and biometric-consent heads

Both a7c9e1f2b3d4 (credentials.kid, PR #30) and a9b1c2d3e4f5 (biometric
consents, PR #35) branch from d184160e73e2 — merged here so `alembic upgrade
head` resolves to a single head.

Revision ID: b1c2d3e4f5a6
Revises: a7c9e1f2b3d4, a9b1c2d3e4f5
Create Date: 2026-07-04

"""

# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = ("a7c9e1f2b3d4", "a9b1c2d3e4f5")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
