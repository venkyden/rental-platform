"""add ownership verification to user

Revision ID: 0f55a1a92c1f
Revises: 6bf5a0864033
Create Date: 2026-05-06 16:21:44.123456

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0f55a1a92c1f'
down_revision = '6bf5a0864033'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Use a batch-like approach to add columns if they don't exist
    conn = op.get_bind()
    columns = sa.inspect(conn).get_columns("users")
    existing_column_names = [c["name"] for c in columns]

    # Helper to add column if missing
    def add_if_missing(name, type_, **kwargs):
        if name not in existing_column_names:
            op.add_column('users', sa.Column(name, type_, **kwargs))
            print(f"Added column {name}")

    # Comprehensive list of columns that might be missing
    add_if_missing('google_id', sa.String(), unique=True)
    add_if_missing('bio', sa.String())
    add_if_missing('profile_picture_url', sa.String())
    add_if_missing('ownership_verified', sa.Boolean(), server_default='false')
    add_if_missing('kbis_verified', sa.Boolean(), server_default='false')
    add_if_missing('carte_g_verified', sa.Boolean(), server_default='false')
    add_if_missing('ownership_data', sa.JSON())
    add_if_missing('segment', sa.String())
    add_if_missing('preferences', sa.JSON())
    add_if_missing('available_roles', sa.JSON(), server_default='["tenant"]')
    add_if_missing('onboarding_status', sa.JSON(), server_default='{}')
    add_if_missing('onboarding_completed', sa.Boolean(), server_default='false')
    add_if_missing('marketing_consent', sa.Boolean(), server_default='false')
    add_if_missing('marketing_consent_at', sa.DateTime())
    add_if_missing('contact_preferences', sa.JSON())
    add_if_missing('refresh_token_version', sa.Integer(), server_default='1')

def downgrade() -> None:
    # Downgrade is optional for this fix-up migration
    pass
