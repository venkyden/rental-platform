"""
Add VisitSlot and Lease models for Scheduler and Digital Contract features.

Revision ID: 003_visits_and_leases
Revises: 002_property_manager_role
Create Date: 2026-01-14 15:35:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = '003_visits_and_leases'
down_revision = '002b'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # --- Visit Slots Table ---
    op.create_table(
        'visit_slots',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('property_id', UUID(as_uuid=True), sa.ForeignKey('properties.id'), nullable=False),
        sa.Column('landlord_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_booked', sa.Boolean(), default=False),
        sa.Column('meeting_link', sa.String(), nullable=True),  # For virtual visits
        
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now())
    )
    op.create_index(op.f('ix_visit_slots_property_id'), 'visit_slots', ['property_id'], unique=False)
    op.create_index(op.f('ix_visit_slots_start_time'), 'visit_slots', ['start_time'], unique=False)

    # --- Lease Types Enum ---
    lease_type_enum = sa.Enum('meuble', 'vide', 'mobilite', 'etudiant', name='lease_type_enum')
    # try:
    #     lease_type_enum.create(op.get_bind())
    # except:
    #     pass  # Enum already exists

    # --- Leases Table ---
    op.create_table(
        'leases',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('property_id', UUID(as_uuid=True), sa.ForeignKey('properties.id'), nullable=False),
        sa.Column('landlord_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),  # Nullable for CDI (3 years auto-renew)
        
        sa.Column('rent_amount', sa.Float(), nullable=False),
        sa.Column('deposit_amount', sa.Float(), nullable=False),
        sa.Column('charges_amount', sa.Float(), nullable=False),
        
        sa.Column('lease_type', sa.Enum('meuble', 'vide', 'mobilite', 'etudiant', name='lease_type_enum'), nullable=False),
        sa.Column('status', sa.String(), default='draft'),  # draft, signed, active, terminated
        
        sa.Column('pdf_path', sa.String(), nullable=True),  # Path to generated PDF
        sa.Column('signature_data', JSONB, nullable=True), # Electronic signature metadata
        
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now())
    )
    op.create_index(op.f('ix_leases_property_id'), 'leases', ['property_id'], unique=False)
    op.create_index(op.f('ix_leases_tenant_id'), 'leases', ['tenant_id'], unique=False)


def downgrade() -> None:
    op.drop_table('leases')
    sa.Enum(name='lease_type_enum').drop(op.get_bind())
    op.drop_table('visit_slots')
