"""add_saved_properties_table

Revision ID: 8b85d2793a6b
Revises: 925349010477
Create Date: 2026-05-30 21:57:35.422497

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8b85d2793a6b'
down_revision = '925349010477'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create saved_properties table
    op.create_table('saved_properties',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('property_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['property_id'], ['properties.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('saved_properties')
