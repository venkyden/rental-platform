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


def downgrade() -> None:
    op.drop_column('property_media', 'gps_accuracy')
