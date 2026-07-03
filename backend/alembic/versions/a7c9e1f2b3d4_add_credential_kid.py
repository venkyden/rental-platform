"""add credential kid column (key rotation support)

Revision ID: a7c9e1f2b3d4
Revises: d184160e73e2
Create Date: 2026-07-04

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a7c9e1f2b3d4"
down_revision = "d184160e73e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable: credentials issued before key rotation existed carry no kid
    # and verify by key trial (see services/credential.py verify_signature).
    op.add_column("credentials", sa.Column("kid", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("credentials", "kid")
