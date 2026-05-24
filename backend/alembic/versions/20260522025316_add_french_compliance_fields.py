"""Add French compliance fields: accepted_tenant_types, rent control, natural risks

Revision ID: 20260522025316
Create Date: 2026-05-22T02:53:16.783459
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = '20260522025316'
down_revision = 'fix_user_schema_encryption'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    columns = sa.inspect(conn).get_columns("properties")
    existing_column_names = [c["name"] for c in columns]

    def add_if_missing(name, type_, **kwargs):
        if name not in existing_column_names:
            op.add_column('properties', sa.Column(name, type_, **kwargs))

    # Accepted tenant types for matching service
    add_if_missing('accepted_tenant_types', JSONB, nullable=True)

    # Rent control (Encadrement des Loyers) - Loi ELAN Art. 140
    add_if_missing('loyer_reference', sa.DECIMAL(10, 2), nullable=True)
    add_if_missing('loyer_reference_majore', sa.DECIMAL(10, 2), nullable=True)
    add_if_missing('complement_de_loyer', sa.DECIMAL(10, 2), nullable=True)
    add_if_missing('complement_de_loyer_justification', sa.Text(), nullable=True)

    # Natural Risks (ERP/ERNMT)
    add_if_missing('natural_risks_compliant', sa.Boolean(), server_default='false', nullable=True)


def downgrade():
    op.drop_column('properties', 'natural_risks_compliant')
    op.drop_column('properties', 'complement_de_loyer_justification')
    op.drop_column('properties', 'complement_de_loyer')
    op.drop_column('properties', 'loyer_reference_majore')
    op.drop_column('properties', 'loyer_reference')
    op.drop_column('properties', 'accepted_tenant_types')
