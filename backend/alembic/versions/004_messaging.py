"""Add conversations and messages tables for Unified Inbox

Revision ID: 004
Revises: 003_visits_and_leases
Create Date: 2026-01-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '004_messaging'
down_revision = '003_visits_and_leases'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create conversations table
    op.create_table(
        'conversations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('property_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('properties.id'), nullable=False),
        sa.Column('landlord_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('subject', sa.String(200)),
        sa.Column('status', sa.String(20), default='active'),
        sa.Column('last_message_at', sa.TIMESTAMP, server_default=sa.func.now()),
        sa.Column('unread_count_landlord', sa.Integer, default=0),
        sa.Column('unread_count_tenant', sa.Integer, default=0),
        sa.Column('created_at', sa.TIMESTAMP, server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP, server_default=sa.func.now()),
    )
    
    # Create messages table
    op.create_table(
        'messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('conversations.id'), nullable=False),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('message_type', sa.String(30), default='text'),
        sa.Column('extra_data', postgresql.JSONB, default={}),
        sa.Column('is_read', sa.Boolean, default=False),
        sa.Column('read_at', sa.TIMESTAMP),
        sa.Column('created_at', sa.TIMESTAMP, server_default=sa.func.now()),
    )
    
    # Create indexes for performance
    op.create_index('ix_conversations_landlord_id', 'conversations', ['landlord_id'])
    op.create_index('ix_conversations_tenant_id', 'conversations', ['tenant_id'])
    op.create_index('ix_conversations_property_id', 'conversations', ['property_id'])
    op.create_index('ix_conversations_last_message_at', 'conversations', ['last_message_at'])
    op.create_index('ix_messages_conversation_id', 'messages', ['conversation_id'])
    op.create_index('ix_messages_created_at', 'messages', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_messages_created_at', if_exists=True)
    op.drop_index('ix_messages_conversation_id', if_exists=True)
    op.drop_index('ix_conversations_last_message_at', if_exists=True)
    op.drop_index('ix_conversations_property_id', if_exists=True)
    op.drop_index('ix_conversations_tenant_id', if_exists=True)
    op.drop_index('ix_conversations_landlord_id', if_exists=True)
    op.execute(\"DROP TABLE IF EXISTS messages CASCADE\")
    op.execute(\"DROP TABLE IF EXISTS conversations CASCADE\")
