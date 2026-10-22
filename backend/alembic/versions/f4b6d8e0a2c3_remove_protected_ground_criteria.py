"""remove nationality, gender and family criteria from stored listings and preferences

Revision ID: f4b6d8e0a2c3
Revises: e3a5c7d9f1b2
Create Date: 2026-10-22

Nationality, sex and family situation are protected grounds (Code pénal
225-1, loi 89-462 art. 1). Landlords could store a nationality preference and
list "family" among accepted tenant types, and tenants were asked their own
nationality and gender, which nothing used. The API now refuses all of them,
and this removes what was already stored. Not reversible: the removed values
must not come back.
"""

import json

import sqlalchemy as sa
from alembic import op

revision = "f4b6d8e0a2c3"
down_revision = "e3a5c7d9f1b2"
branch_labels = None
depends_on = None


PROTECTED_KEYS = ("nationality_preference", "nationality", "gender")


def clean_preferences(prefs):
    """Drop the protected criteria from one user's preferences, flat or per role."""
    if not isinstance(prefs, dict):
        return prefs

    def _clean(block):
        if not isinstance(block, dict):
            return block
        block = {k: v for k, v in block.items() if k not in PROTECTED_KEYS}
        types = block.get("accepted_tenant_types")
        if isinstance(types, list):
            block["accepted_tenant_types"] = [t for t in types if t != "family"]
        return block

    cleaned = _clean(prefs)
    return {k: _clean(v) if isinstance(v, dict) else v for k, v in cleaned.items()}


def upgrade() -> None:
    op.execute(
        """
        UPDATE properties
        SET accepted_tenant_types = COALESCE(
            (SELECT jsonb_agg(t) FROM jsonb_array_elements(accepted_tenant_types) AS t WHERE t <> '"family"'::jsonb),
            '[]'::jsonb)
        WHERE jsonb_typeof(accepted_tenant_types) = 'array' AND accepted_tenant_types @> '["family"]'::jsonb
        """
    )

    conn = op.get_bind()
    rows = conn.execute(sa.text(
        "SELECT id, preferences FROM users WHERE preferences::text LIKE '%nationality%' "
        "OR preferences::text LIKE '%\"gender\"%' OR preferences::text LIKE '%\"family\"%'"
    )).fetchall()
    for user_id, prefs in rows:
        if isinstance(prefs, str):
            prefs = json.loads(prefs)
        cleaned = clean_preferences(prefs)
        if cleaned != prefs:
            conn.execute(
                sa.text("UPDATE users SET preferences = CAST(:prefs AS json) WHERE id = :id"),
                {"prefs": json.dumps(cleaned), "id": user_id},
            )


def downgrade() -> None:
    pass
