"""store user emails in lowercase, and refuse anything else

Revision ID: a7c9e1b3d5f7
Revises: f4b6d8e0a2c3
Create Date: 2026-10-27

"Jean@x.com" and "jean@x.com" could be two accounts, so a case variant of a
real address could be registered beside it. Every address is lowercased and a
check constraint keeps it that way. Two existing accounts that differ only by
case cannot be merged automatically (which one is genuine is a person's call):
they are left as they are, listed in the migration output, and the constraint
then applies to new and changed rows only until they are resolved.
"""

from alembic import op
import sqlalchemy as sa

revision = "a7c9e1b3d5f7"
down_revision = "f4b6d8e0a2c3"
branch_labels = None
depends_on = None

CONSTRAINT = "ck_users_email_lowercase"


def upgrade() -> None:
    conn = op.get_bind()
    collisions = conn.execute(sa.text(
        "SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1"
    )).scalars().all()
    if collisions:
        print(
            f"[a7c9e1b3d5f7] {len(collisions)} address(es) used by accounts that differ only by case; "
            "left unchanged for a person to resolve (user ids below):"
        )
        for address in collisions:
            ids = conn.execute(sa.text("SELECT id FROM users WHERE lower(email) = :a"), {"a": address}).scalars().all()
            print(f"  {', '.join(str(i) for i in ids)}")

    conn.execute(sa.text(
        "UPDATE users SET email = lower(email) WHERE email <> lower(email) "
        "AND lower(email) NOT IN (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1)"
    ))
    # NOT VALID: enforced for new and changed rows at once; existing rows are checked
    # only once nothing is left to resolve.
    op.execute(f"ALTER TABLE users ADD CONSTRAINT {CONSTRAINT} CHECK (email = lower(email)) NOT VALID")
    if not collisions:
        op.execute(f"ALTER TABLE users VALIDATE CONSTRAINT {CONSTRAINT}")


def downgrade() -> None:
    op.execute(f"ALTER TABLE users DROP CONSTRAINT IF EXISTS {CONSTRAINT}")
