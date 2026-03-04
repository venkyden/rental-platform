"""add_detailed_room_config

Revision ID: 004_add_detailed_room
Revises: 01efdd595222
Create Date: 2026-03-02 16:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '004_add_detailed_room'
down_revision: Union[str, None] = '01efdd595222'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('properties', sa.Column('accommodation_capacity', sa.Integer(), nullable=True))
    op.add_column('properties', sa.Column('rooms_count', sa.Integer(), nullable=True))
    op.add_column('properties', sa.Column('living_room_type', sa.String(length=50), nullable=True))
    op.add_column('properties', sa.Column('kitchen_type', sa.String(length=50), nullable=True))
    op.add_column('properties', sa.Column('room_details', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('properties', 'room_details')
    op.drop_column('properties', 'kitchen_type')
    op.drop_column('properties', 'living_room_type')
    op.drop_column('properties', 'rooms_count')
    op.drop_column('properties', 'accommodation_capacity')
