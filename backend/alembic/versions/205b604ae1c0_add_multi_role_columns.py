"""add_multi_role_columns

Revision ID: 205b604ae1c0
Revises: 6d1f57373f33
Create Date: 2026-04-30 13:09:58.834746

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '205b604ae1c0'
down_revision = '6d1f57373f33'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('available_roles', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('onboarding_status', sa.JSON(), nullable=True))

    # Backfill existing data using the user's active role
    op.execute("""
        UPDATE users 
        SET available_roles = json_build_array(role::text),
            onboarding_status = json_build_object(role::text, onboarding_completed)
    """)


def downgrade() -> None:
    op.drop_column('users', 'onboarding_status')
    op.drop_column('users', 'available_roles')
