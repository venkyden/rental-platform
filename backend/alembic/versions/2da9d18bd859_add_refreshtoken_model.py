"""Add RefreshToken model

Revision ID: 2da9d18bd859
Revises: 004_add_detailed_room
Create Date: 2026-03-02 16:56:52.868224

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2da9d18bd859'
down_revision = '004_add_detailed_room'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create refresh_tokens table (safe: only if it doesn't already exist)
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'refresh_tokens')"
    ))
    table_exists = result.scalar()

    if not table_exists:
        op.create_table('refresh_tokens',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('user_id', sa.UUID(), nullable=False),
            sa.Column('token', sa.String(), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('revoked', sa.Boolean(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_refresh_tokens_token'), 'refresh_tokens', ['token'], unique=True)

    # Make hashed_password nullable (Google-only accounts have no password)
    op.alter_column('users', 'hashed_password',
               existing_type=sa.VARCHAR(),
               nullable=True)


def downgrade() -> None:
    op.alter_column('users', 'hashed_password',
               existing_type=sa.VARCHAR(),
               nullable=False)
    op.drop_index(op.f('ix_refresh_tokens_token'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
