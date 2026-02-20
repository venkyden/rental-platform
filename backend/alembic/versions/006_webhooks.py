"""Add webhook_subscriptions and webhook_deliveries tables for ERP Webhooks

Revision ID: 006
Revises: 005_team_members
Create Date: 2026-01-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '006_webhooks'
down_revision = '005_team_members'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create webhook_subscriptions table
    op.create_table(
        'webhook_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('landlord_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('url', sa.Text, nullable=False),
        sa.Column('secret', sa.String(64), nullable=False),
        sa.Column('events', postgresql.ARRAY(sa.String), nullable=False, default=[]),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('last_triggered_at', sa.DateTime, nullable=True),
        sa.Column('failure_count', sa.String, default='0'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    
    # Create webhook_deliveries table
    op.create_table(
        'webhook_deliveries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('subscription_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('webhook_subscriptions.id'), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('payload', sa.Text),
        sa.Column('success', sa.Boolean, default=False),
        sa.Column('status_code', sa.String, nullable=True),
        sa.Column('response_body', sa.Text, nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('delivered_at', sa.DateTime, nullable=True),
        sa.Column('duration_ms', sa.String, nullable=True),
    )
    
    # Create indexes
    op.create_index('ix_webhook_subscriptions_landlord_id', 'webhook_subscriptions', ['landlord_id'])
    op.create_index('ix_webhook_deliveries_subscription_id', 'webhook_deliveries', ['subscription_id'])
    op.create_index('ix_webhook_deliveries_created_at', 'webhook_deliveries', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_webhook_deliveries_created_at', if_exists=True)
    op.drop_index('ix_webhook_deliveries_subscription_id', if_exists=True)
    op.drop_index('ix_webhook_subscriptions_landlord_id', if_exists=True)
    op.drop_table('webhook_deliveries')
    op.drop_table('webhook_subscriptions')
