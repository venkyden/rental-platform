"""add_room_index_to_media_and_visits

Revision ID: 7a1f4b76a25d
Revises: 8831b118955d
Create Date: 2026-03-05 02:14:06.983565

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '7a1f4b76a25d'
down_revision = '8831b118955d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add room_index and room_label to visit_slots
    op.add_column('visit_slots', sa.Column('room_index', sa.Integer(), nullable=True))
    op.add_column('visit_slots', sa.Column('room_label', sa.String(length=100), nullable=True))

    # Add room_index and room_label to property_media_sessions
    op.add_column('property_media_sessions', sa.Column('room_index', sa.Integer(), nullable=True))
    op.add_column('property_media_sessions', sa.Column('room_label', sa.String(length=100), nullable=True))

    # Add room_index and room_label to property_media
    op.add_column('property_media', sa.Column('room_index', sa.Integer(), nullable=True))
    op.add_column('property_media', sa.Column('room_label', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('property_media', 'room_label')
    op.drop_column('property_media', 'room_index')
    op.drop_column('property_media_sessions', 'room_label')
    op.drop_column('property_media_sessions', 'room_index')
    op.drop_column('visit_slots', 'room_label')
    op.drop_column('visit_slots', 'room_index')
