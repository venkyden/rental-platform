"""Add MRH insurance verification fields to users

Revision ID: add_mrh_insurance_fields
Revises: fix_user_schema_encryption
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "add_mrh_insurance_fields"
down_revision = "fix_user_schema_encryption"
branch_labels = None
depends_on = None


def upgrade() -> None:
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


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("insurance_data")
        batch_op.drop_column("insurance_status")
        batch_op.drop_column("insurance_verified")
