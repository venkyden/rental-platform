"""Add unique constraint on applications(tenant_id, property_id)

Prevents a tenant from applying to the same property more than once, closing
the TOCTOU race that the app-level pre-check alone cannot.

Revision ID: a1f2e3d4c5b6
Revises: 8b85d2793a6b
Create Date: 2026-05-31
"""
from alembic import op

revision = "a1f2e3d4c5b6"
down_revision = "8b85d2793a6b"
branch_labels = None
depends_on = None

CONSTRAINT = "uq_application_tenant_property"


def upgrade() -> None:
    # De-duplicate any pre-existing rows (keep the earliest per tenant/property)
    # so the unique constraint can be created on legacy data.
    op.execute(
        """
        DELETE FROM applications a
        USING applications b
        WHERE a.tenant_id = b.tenant_id
          AND a.property_id = b.property_id
          AND (a.created_at > b.created_at
               OR (a.created_at = b.created_at AND a.id > b.id))
        """
    )
    op.create_unique_constraint(
        CONSTRAINT, "applications", ["tenant_id", "property_id"]
    )


def downgrade() -> None:
    op.drop_constraint(CONSTRAINT, "applications", type_="unique")
