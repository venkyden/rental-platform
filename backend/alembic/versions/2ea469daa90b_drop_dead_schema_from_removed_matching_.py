"""drop dead schema from removed matching and legacy address features

Revision ID: 2ea469daa90b
Revises: 2b90c15aa172
Create Date: 2026-07-26 02:45:37.956808

Every column dropped here was confirmed, via full git history of
app/models/user.py and app/models/property.py, to have NEVER been declared
as a model field — meaning the ORM has never been able to write to it and no
raw SQL/seed path exists that does either. Each traces to a migration for a
feature that no longer exists:

  users.address_line1/address_line2/city/postal_code/country
      007_user_address_fields — "Add user address fields for real lease
      generation"; superseded before the model ever adopted the fields.
  users.failed_login_attempts/locked_until
      008_auth_security — scaffolded account-lockout, never implemented.
      Brute-force defense today is the IP-based slowapi limiter only.
  users.nationality/languages/gender/birth_date
      009_user_identity_fields — "Add user identity fields for Smart
      Matching"; matching_service.py is disabled per the 2026-07-04 freeze
      (PR #29) and no router may import it.
  properties.accepted_guarantees
      41ea184ba52d_add_matching_fields — same matching freeze.
  properties.is_location_verified/location_verified_at
      44ebd345175e_add_location_verification_fields — a same-named,
      never-adopted sibling of PropertyMediaSession.location_verified_at
      (a distinct, live column on a different table).

Safety: upgrade() aborts before dropping anything if any row has a non-null
value in any of these columns — the git-history read is strong evidence, not
a substitute for checking the actual database this runs against.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '2ea469daa90b'
down_revision = '2b90c15aa172'
branch_labels = None
depends_on = None

_DROP_COLUMNS = {
    "users": [
        "address_line1",
        "address_line2",
        "city",
        "postal_code",
        "country",
        "failed_login_attempts",
        "locked_until",
        "nationality",
        "languages",
        "gender",
        "birth_date",
    ],
    "properties": [
        "accepted_guarantees",
        "is_location_verified",
        "location_verified_at",
    ],
}


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    existing_tables = set(insp.get_table_names())

    # Resolve, per table, only the columns that both (a) are in scope for this
    # migration and (b) actually exist here — fresh test DBs built from a
    # subset of migrations may be missing a table or column entirely.
    plan = {}
    for table, columns in _DROP_COLUMNS.items():
        if table not in existing_tables:
            continue
        existing_cols = {c["name"] for c in insp.get_columns(table)}
        cols_here = [c for c in columns if c in existing_cols]
        if cols_here:
            plan[table] = cols_here

    # users.country and users.failed_login_attempts carry a server_default
    # ("France" / 0) from the migrations that created them, so every row ever
    # inserted since 2026-01 has a non-null value there regardless of whether
    # the column was ever meaningfully used. Treat exactly the default value
    # as still-empty for these two; every other column has no server_default,
    # so any non-null value there is real and must block the drop.
    KNOWN_DEFAULTS = {"country": "France", "failed_login_attempts": "0"}

    for table, columns in plan.items():
        conditions = []
        for c in columns:
            default = KNOWN_DEFAULTS.get(c)
            if default is not None:
                conditions.append(f'("{c}" IS NOT NULL AND "{c}" != \'{default}\')')
            else:
                conditions.append(f'"{c}" IS NOT NULL')
        count = conn.execute(
            sa.text(f'SELECT COUNT(*) FROM "{table}" WHERE {" OR ".join(conditions)}')
        ).scalar()
        if count:
            raise RuntimeError(
                f"Refusing to drop columns on '{table}': {count} row(s) have "
                f"non-default data in one of {columns}. This migration assumed "
                f"these columns were always unreachable dead schema (never a "
                f"model field in git history) — that assumption is wrong for "
                f"this database. Investigate before proceeding; do not force "
                f"this migration through."
            )

    for table, columns in plan.items():
        for col in columns:
            op.drop_column(table, col)


def downgrade() -> None:
    op.add_column("users", sa.Column("address_line1", sa.String(), nullable=True))
    op.add_column("users", sa.Column("address_line2", sa.String(), nullable=True))
    op.add_column("users", sa.Column("city", sa.String(), nullable=True))
    op.add_column("users", sa.Column("postal_code", sa.String(10), nullable=True))
    op.add_column(
        "users", sa.Column("country", sa.String(), server_default="France", nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("failed_login_attempts", sa.Integer(), nullable=True, server_default="0"),
    )
    op.add_column("users", sa.Column("locked_until", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("nationality", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("languages", sa.JSON(), nullable=True))
    op.add_column("users", sa.Column("gender", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))

    op.add_column(
        "properties", sa.Column("accepted_guarantees", sa.JSON(), nullable=True)
    )
    op.add_column(
        "properties", sa.Column("is_location_verified", sa.Boolean(), nullable=True)
    )
    op.add_column(
        "properties", sa.Column("location_verified_at", sa.TIMESTAMP(), nullable=True)
    )
