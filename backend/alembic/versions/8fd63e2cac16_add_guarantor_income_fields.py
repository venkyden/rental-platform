"""add_guarantor_income_fields

Revision ID: 8fd63e2cac16
Revises: 20260522025316
Create Date: 2026-05-23 15:11:37.170628

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8fd63e2cac16'
down_revision = '20260522025316'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to users table
    op.add_column('users', sa.Column('income_verified', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('users', sa.Column('income_status', sa.String(), server_default='unverified', nullable=True))
    op.add_column('users', sa.Column('income_data', sa.String(), nullable=True))
    op.add_column('users', sa.Column('guarantor_type', sa.String(), nullable=True))
    op.add_column('users', sa.Column('guarantor_status', sa.String(), server_default='unverified', nullable=True))
    op.add_column('users', sa.Column('guarantor_data', sa.String(), nullable=True))
    op.add_column('users', sa.Column('visale_id', sa.String(), nullable=True))
    op.add_column('users', sa.Column('garantme_ref', sa.String(), nullable=True))

    # Data migration: Copy employment fields to income fields
    op.execute("UPDATE users SET income_verified = employment_verified, income_status = employment_status, income_data = employment_data")


def downgrade() -> None:
    op.drop_column('users', 'garantme_ref')
    op.drop_column('users', 'visale_id')
    op.drop_column('users', 'guarantor_data')
    op.drop_column('users', 'guarantor_status')
    op.drop_column('users', 'guarantor_type')
    op.drop_column('users', 'income_data')
    op.drop_column('users', 'income_status')
    op.drop_column('users', 'income_verified')

