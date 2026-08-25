"""add properties.guarantor_income_multiple

Revision ID: c7f139a2d5b6
Revises: b4d2f6a8c1e3
Create Date: 2026-07-30

Landlord criteria panel (2026-07-30 design): a transparent, uniformly-applied
income-to-rent ratio, e.g. 3.0 = tenant income must be >= 3x rent. Not a
protected-characteristic filter — see the design doc's Légifrance section for
why age/guarantor-residency fields were explicitly excluded from this feature.
"""

import sqlalchemy as sa

from alembic import op

revision = "c7f139a2d5b6"
down_revision = "b4d2f6a8c1e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("guarantor_income_multiple", sa.DECIMAL(3, 1), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("properties", "guarantor_income_multiple")
