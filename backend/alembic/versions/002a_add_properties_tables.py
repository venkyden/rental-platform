"""Add properties tables

Revision ID: 002a
Revises: 002
Create Date: 2026-01-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002a'
down_revision = '002'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Properties
    op.create_table(
        'properties',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('landlord_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('property_type', sa.String(length=50), nullable=True),
        sa.Column('address_line1', sa.String(length=200), nullable=False),
        sa.Column('address_line2', sa.String(length=200), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('postal_code', sa.String(length=20), nullable=False),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('latitude', sa.DECIMAL(precision=10, scale=8), nullable=True),
        sa.Column('longitude', sa.DECIMAL(precision=11, scale=8), nullable=True),
        sa.Column('bedrooms', sa.Integer(), nullable=False),
        sa.Column('bathrooms', sa.DECIMAL(precision=3, scale=1), nullable=True),
        sa.Column('size_sqm', sa.DECIMAL(precision=8, scale=2), nullable=True),
        sa.Column('floor_number', sa.Integer(), nullable=True),
        sa.Column('furnished', sa.Boolean(), nullable=True),
        sa.Column('monthly_rent', sa.DECIMAL(precision=10, scale=2), nullable=False),
        sa.Column('deposit', sa.DECIMAL(precision=10, scale=2), nullable=True),
        sa.Column('charges', sa.DECIMAL(precision=10, scale=2), nullable=True),
        sa.Column('charges_included', sa.Boolean(), nullable=True),
        sa.Column('charges_description', sa.Text(), nullable=True),
        sa.Column('guarantor_required', sa.Boolean(), nullable=True),
        sa.Column('accepted_guarantor_types', postgresql.JSONB(), nullable=True),
        sa.Column('available_from', sa.Date(), nullable=True),
        sa.Column('lease_duration_months', sa.Integer(), nullable=True),
        sa.Column('amenities', postgresql.JSONB(), nullable=True),
        sa.Column('custom_amenities', postgresql.JSONB(), nullable=True),
        sa.Column('public_transport', postgresql.JSONB(), nullable=True),
        sa.Column('nearby_landmarks', postgresql.JSONB(), nullable=True),
        sa.Column('photos', postgresql.JSONB(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.Column('published_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('views_count', sa.Integer(), nullable=True),
    )
    op.create_index('idx_properties_city', 'properties', ['city'], unique=False)
    op.create_index('idx_properties_landlord', 'properties', ['landlord_id'], unique=False)
    op.create_index('idx_properties_rent', 'properties', ['monthly_rent'], unique=False)
    op.create_index('idx_properties_status', 'properties', ['status'], unique=False)

    # 2. Property Media Sessions
    op.create_table(
        'property_media_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('property_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('properties.id', ondelete='CASCADE'), nullable=False),
        sa.Column('verification_code', sa.String(length=50), nullable=False),
        sa.Column('generated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('target_address', sa.Text(), nullable=True),
        sa.Column('target_latitude', sa.DECIMAL(precision=10, scale=8), nullable=True),
        sa.Column('target_longitude', sa.DECIMAL(precision=11, scale=8), nullable=True),
        sa.Column('gps_radius_meters', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
        sa.UniqueConstraint('verification_code')
    )
    op.create_index('idx_media_sessions_code', 'property_media_sessions', ['verification_code'], unique=False)
    op.create_index('idx_media_sessions_property', 'property_media_sessions', ['property_id'], unique=False)

    # 3. Property Media
    op.create_table(
        'property_media',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('property_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('properties.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('property_media_sessions.id'), nullable=True),
        sa.Column('media_type', sa.String(length=20), nullable=True),
        sa.Column('file_url', sa.Text(), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=True),
        sa.Column('is_cover', sa.Boolean(), nullable=True),
        sa.Column('captured_latitude', sa.DECIMAL(precision=10, scale=8), nullable=True),
        sa.Column('captured_longitude', sa.DECIMAL(precision=11, scale=8), nullable=True),
        sa.Column('distance_from_target', sa.DECIMAL(precision=8, scale=2), nullable=True),
        sa.Column('captured_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('device_id', sa.String(length=100), nullable=True),
        sa.Column('watermark_address', sa.Text(), nullable=True),
        sa.Column('verification_status', sa.String(length=20), nullable=True),
        sa.Column('verified_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=True),
    )
    op.create_index('idx_property_media_property', 'property_media', ['property_id'], unique=False)
    op.create_index('idx_property_media_session', 'property_media', ['session_id'], unique=False)


def downgrade() -> None:
    op.drop_table('property_media')
    op.drop_table('property_media_sessions')
    op.drop_table('properties')
