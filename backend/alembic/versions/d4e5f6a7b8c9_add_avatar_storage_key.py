"""add users.avatar_storage_key

Avatar objects live under shared avatars/ folder with randomized names — not
per-user prefixable, so purge-on-replace and erasure need the stored key
(WS-1b follow-up from the gdpr-purge-parity audit).

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-04

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_storage_key", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_storage_key")
