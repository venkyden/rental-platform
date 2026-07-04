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
    # Nullable: credentials issued before key rotation carry no kid, verify
    # by key trial (see services/credential.py verify_signature). Index
    # supports bulk revocation by kid (compromise runbook).
    op.add_column("credentials", sa.Column("kid", sa.String(length=32), nullable=True))
    op.create_index("ix_credentials_kid", "credentials", ["kid"])


def downgrade() -> None:
    op.drop_index("ix_credentials_kid", table_name="credentials")
    op.drop_column("credentials", "kid")
