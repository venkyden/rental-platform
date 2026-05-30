"""Convert money columns from float to Numeric(10, 2)

Stores currency as exact DECIMAL to prevent floating-point rounding drift in
leases (rent/deposit/charges) and dispute claims. Matches the existing
properties money columns which already use DECIMAL(10, 2).

Idempotent: each column is only altered if it is still a float/double type.

Revision ID: d1a2b3c4e5f7
Revises: 8fd63e2cac16
Create Date: 2026-05-30
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d1a2b3c4e5f7"
down_revision = "8fd63e2cac16"
branch_labels = None
depends_on = None


# (table, column, nullable) for every money column being converted.
_MONEY_COLUMNS = [
    ("leases", "rent_amount", False),
    ("leases", "deposit_amount", False),
    ("leases", "charges_amount", False),
    ("disputes", "amount_claimed", True),
]


def _column_type(conn, table, column):
    """Return the reflected SQLAlchemy type for a column, or None if absent."""
    for col in sa.inspect(conn).get_columns(table):
        if col["name"] == column:
            return col["type"]
    return None


def upgrade() -> None:
    conn = op.get_bind()
    for table, column, nullable in _MONEY_COLUMNS:
        current = _column_type(conn, table, column)
        # sa.Float covers POSTGRES double precision; sa.NUMERIC does not subclass it.
        if current is not None and isinstance(current, sa.Float):
            op.alter_column(
                table,
                column,
                type_=sa.Numeric(10, 2),
                existing_nullable=nullable,
                postgresql_using=f"{column}::numeric(10,2)",
            )


def downgrade() -> None:
    conn = op.get_bind()
    for table, column, nullable in _MONEY_COLUMNS:
        current = _column_type(conn, table, column)
        if current is not None and not isinstance(current, sa.Float):
            op.alter_column(
                table,
                column,
                type_=sa.Float(),
                existing_nullable=nullable,
                postgresql_using=f"{column}::double precision",
            )
