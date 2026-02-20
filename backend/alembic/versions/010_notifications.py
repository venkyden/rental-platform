"""Add notifications table and contact_preferences

Revision ID: 010_notifications
Revises: 009_user_identity_fields
Create Date: 2026-01-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


# revision identifiers
revision = '010_notifications'
down_revision = '009_user_identity_fields'
branch_labels = None
depends_on = None


def upgrade():
    # Add contact_preferences column to users table
    op.add_column('users', sa.Column(
        'contact_preferences', 
        JSON, 
        nullable=True,
        server_default='{"email_notifications": true, "sms_notifications": false, "push_notifications": true, "email_frequency": "instant", "preferred_contact": "email"}'
    ))
    
    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('action_url', sa.String(), nullable=True),
        sa.Column('extra_data', sa.String(), nullable=True),
        sa.Column('read', sa.Boolean(), default=False),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    
    # Create indexes for efficient querying
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_read', 'notifications', ['read'])
    op.create_index('ix_notifications_user_read', 'notifications', ['user_id', 'read'])


def downgrade():
    op.drop_index('ix_notifications_user_read', if_exists=True)
    op.drop_index('ix_notifications_read', if_exists=True)
    op.drop_index('ix_notifications_user_id', if_exists=True)
    op.execute(\"DROP TABLE IF EXISTS notifications CASCADE\")
    op.drop_column('users', 'contact_preferences')
