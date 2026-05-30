"""Add missing foreign-key / filter indexes (concurrently)

Adds indexes for high-traffic foreign keys and filter columns that were
previously unindexed: applications(tenant_id, property_id, status) and
documents(user_id). Created CONCURRENTLY so the operation does not take an
ACCESS EXCLUSIVE lock on a live table.

Idempotent (if_not_exists) and reversible (if_exists).

Revision ID: e2b3c4d5f6a8
Revises: d1a2b3c4e5f7
Create Date: 2026-05-30
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "e2b3c4d5f6a8"
down_revision = "d1a2b3c4e5f7"
branch_labels = None
depends_on = None


# (index_name, table, column)
_INDEXES = [
    ("ix_applications_tenant_id", "applications", "tenant_id"),
    ("ix_applications_property_id", "applications", "property_id"),
    ("ix_applications_status", "applications", "status"),
    ("ix_documents_user_id", "documents", "user_id"),
]


def upgrade() -> None:
    # CONCURRENTLY cannot run inside a transaction block.
    with op.get_context().autocommit_block():
        for name, table, column in _INDEXES:
            op.create_index(
                name,
                table,
                [column],
                unique=False,
                postgresql_concurrently=True,
                if_not_exists=True,
            )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, table, _column in _INDEXES:
            op.drop_index(
                name,
                table_name=table,
                postgresql_concurrently=True,
                if_exists=True,
            )
