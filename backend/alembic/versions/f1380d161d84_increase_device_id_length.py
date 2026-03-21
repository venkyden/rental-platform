"""increase_device_id_length

Revision ID: f1380d161d84
Revises: 7541346c694b
Create Date: 2026-03-21 21:08:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1380d161d84'
down_revision = '7541346c694b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Increase device_id column length in property_media table
    op.alter_column('property_media', 'device_id',
               existing_type=sa.VARCHAR(length=100),
               type_=sa.String(length=512),
               existing_nullable=True)


def downgrade() -> None:
    # Revert device_id column length to 100
    op.alter_column('property_media', 'device_id',
               existing_type=sa.String(length=512),
               type_=sa.VARCHAR(length=100),
               existing_nullable=True)
