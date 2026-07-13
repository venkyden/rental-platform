"""Add deposit_binding_data column to users (items 15/16)

Revision ID: add_deposit_binding_data
Revises: d4e5f6a7b8c9
Create Date: 2026-07-05
"""
from alembic import op
import sqlalchemy as sa

revision = "add_deposit_binding_data"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    existing = {c["name"] for c in sa.inspect(conn).get_columns("users")}

    with op.batch_alter_table("users") as batch_op:
        if "deposit_binding_data" not in existing:
            # EncryptedJSON stores as opaque text (Fernet ciphertext), same as the
            # other *_data columns.
            batch_op.add_column(
                sa.Column("deposit_binding_data", sa.Text(), nullable=True)
            )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("deposit_binding_data")
