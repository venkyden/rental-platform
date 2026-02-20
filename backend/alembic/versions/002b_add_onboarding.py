"""Add onboarding table

Revision ID: 002b
Revises: 002a
Create Date: 2026-01-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002b'
down_revision = '002a'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Onboarding Responses
    op.create_table(
        'onboarding_responses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('responses', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('detected_segment', sa.String(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True)
    )
    op.create_index('idx_onboarding_user_id', 'onboarding_responses', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_onboarding_user_id', table_name='onboarding_responses', if_exists=True)
    op.execute(\"DROP TABLE IF EXISTS onboarding_responses CASCADE\")
