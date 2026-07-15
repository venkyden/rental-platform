"""Add DPE F/G rent freeze fields: previous_tenant_rent, is_overseas_dom

Revision ID: 20260715_fg_rent_freeze
Revises: f3f9c0359a2a
Create Date: 2026-07-15T00:00:00

Legal basis:
  Loi Climat (loi n°2021-1104, art. 160) + décret 2021-19 + décret 2022-1052:
  For dwellings classified F or G at DPE, the rent of a new or renewed lease
  may not exceed the rent paid by the previous tenant.
    - Mainland France + Corsica: leases signed since 24 August 2022.
    - Overseas DOM: leases signed since 1 July 2024.
"""
from alembic import op
import sqlalchemy as sa

revision = '20260715_fg_rent_freeze'
down_revision = 'f3f9c0359a2a'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    columns = sa.inspect(conn).get_columns("properties")
    existing = {c["name"] for c in columns}

    def add_if_missing(name, type_, **kwargs):
        if name not in existing:
            op.add_column('properties', sa.Column(name, type_, **kwargs))

    # Previous tenant rent (HC) — used to enforce the DPE F/G rent cap.
    # NULL = first tenant on record, or landlord has not declared it.
    add_if_missing('previous_tenant_rent', sa.DECIMAL(10, 2), nullable=True)

    # True for overseas DOM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte)
    # where the F/G freeze took effect from 1 July 2024 instead of 24 August 2022.
    add_if_missing('is_overseas_dom', sa.Boolean(), server_default='false', nullable=True)


def downgrade():
    op.drop_column('properties', 'is_overseas_dom')
    op.drop_column('properties', 'previous_tenant_rent')
