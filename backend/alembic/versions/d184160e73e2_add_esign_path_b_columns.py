"""add e-sign Path B columns to lease

Adds the in-house Ed25519 e-sign columns (DOSSIER §5.7): document_hash (SG-3 tamper
anchor), document_source provenance, and esign_manifest (the signed manifest emitted
when both parties have signed).

Revision ID: d184160e73e2
Revises: f3f9c0359a2a
Create Date: 2026-06-24 00:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "d184160e73e2"
down_revision = "f3f9c0359a2a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("leases", schema=None) as batch_op:
        batch_op.add_column(sa.Column("document_hash", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("document_source", sa.String(), nullable=True))
        batch_op.add_column(
            sa.Column("esign_manifest", postgresql.JSONB(astext_type=sa.Text()), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("leases", schema=None) as batch_op:
        batch_op.drop_column("esign_manifest")
        batch_op.drop_column("document_source")
        batch_op.drop_column("document_hash")
