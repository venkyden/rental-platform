"""Add google_id and marketing consent to users

Revision ID: e28eaa60ce07
Revises: a3da0984d64a
Create Date: 2026-02-23 02:24:17.805979

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e28eaa60ce07'
down_revision = 'a3da0984d64a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Adding google_id and marketing consent columns to users table
    op.add_column('users', sa.Column('google_id', sa.String(), nullable=True))
    op.add_column('users', sa.Column('marketing_consent', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('users', sa.Column('marketing_consent_at', sa.DateTime(), nullable=True))
    
    # Create the index for google_id
    op.create_index(op.f('ix_users_google_id'), 'users', ['google_id'], unique=False)


def downgrade() -> None:
    # Drop the index for google_id
    op.drop_index(op.f('ix_users_google_id'), table_name='users')
    
    # Drop the columns
    op.drop_column('users', 'marketing_consent_at')
    op.drop_column('users', 'marketing_consent')
    op.drop_column('users', 'google_id')
