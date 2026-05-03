"""add_refresh_token_version

Revision ID: b3a4d5e6f7g8
Revises: f3b4c5d6e7f8
Create Date: 2026-05-03 11:25:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b3a4d5e6f7g8'
down_revision = 'f3b4c5d6e7f8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('refresh_token_version', sa.Integer(), server_default='1', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'refresh_token_version')
