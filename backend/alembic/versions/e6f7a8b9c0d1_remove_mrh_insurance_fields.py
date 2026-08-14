"""remove MRH insurance verification fields from users

Revision ID: e6f7a8b9c0d1
Revises: b4d2f6a8c1e3
Create Date: 2026-08-14
"""
from alembic import op
import sqlalchemy as sa

revision = "e6f7a8b9c0d1"
down_revision = "b4d2f6a8c1e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    existing = {c["name"] for c in sa.inspect(conn).get_columns("users")}

    with op.batch_alter_table("users") as batch_op:
        if "insurance_data" in existing:
            batch_op.drop_column("insurance_data")
        if "insurance_status" in existing:
            batch_op.drop_column("insurance_status")
        if "insurance_verified" in existing:
            batch_op.drop_column("insurance_verified")


def downgrade() -> None:
    conn = op.get_bind()
    existing = {c["name"] for c in sa.inspect(conn).get_columns("users")}

    with op.batch_alter_table("users") as batch_op:
        if "insurance_verified" not in existing:
            batch_op.add_column(
                sa.Column("insurance_verified", sa.Boolean(), nullable=False, server_default="false")
            )
        if "insurance_status" not in existing:
            batch_op.add_column(
                sa.Column("insurance_status", sa.String(), nullable=False, server_default="unverified")
            )
        if "insurance_data" not in existing:
            batch_op.add_column(
                sa.Column("insurance_data", sa.Text(), nullable=True)
            )
