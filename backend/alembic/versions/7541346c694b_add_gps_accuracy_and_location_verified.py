"""add_gps_accuracy_and_location_verified

Revision ID: 7541346c694b
Revises: 7a1f4b76a25d
Create Date: 2026-03-05 02:36:38.914456

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '7541346c694b'
down_revision = '7a1f4b76a25d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add gps_accuracy to property_media
    op.add_column('property_media', sa.Column('gps_accuracy', sa.NUMERIC(precision=8, scale=2), nullable=True))

    # Add location_verified fields to property_media_sessions (if not already present)
    # These columns may already exist from migration d827573aade4
    try:
        op.add_column('property_media_sessions', sa.Column('location_verified', sa.Boolean(), nullable=True, server_default=sa.text('false')))
    except Exception:
        pass  # Column may already exist

    try:
        op.add_column('property_media_sessions', sa.Column('location_verified_at', sa.TIMESTAMP(), nullable=True))
    except Exception:
        pass  # Column may already exist


def downgrade() -> None:
    op.drop_column('property_media', 'gps_accuracy')
    # Don't drop location_verified columns as they may have been created by another migration
