"""overhaul_dispute_for_facilitation

Revision ID: 5c1f57373f32
Revises: 6c17267e50bc
Create Date: 2026-04-30 08:39:28.297273

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5c1f57373f32'
down_revision = '6c17267e50bc'
branch_labels = None
depends_on = None


from sqlalchemy.dialects import postgresql

def upgrade() -> None:
    # Add new columns
    op.add_column('disputes', sa.Column('evidence_urls', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False))
    op.add_column('disputes', sa.Column('response_description', sa.Text(), nullable=True))
    op.add_column('disputes', sa.Column('response_evidence_urls', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False))
    op.add_column('disputes', sa.Column('responded_at', sa.DateTime(), nullable=True))
    op.add_column('disputes', sa.Column('admin_observations', sa.Text(), nullable=True))
    op.add_column('disputes', sa.Column('mediation_redirect_url', sa.String(), nullable=True))
    op.add_column('disputes', sa.Column('mediation_redirected_at', sa.DateTime(), nullable=True))
    op.add_column('disputes', sa.Column('location_verified', sa.String(), nullable=True))
    op.add_column('disputes', sa.Column('report_distance_meters', sa.Float(), nullable=True))
    op.add_column('disputes', sa.Column('updated_at', sa.DateTime(), nullable=True))
    op.add_column('disputes', sa.Column('closed_at', sa.DateTime(), nullable=True))

    # Drop old columns
    op.drop_column('disputes', 'verdict')
    op.drop_column('disputes', 'admin_notes')
    op.drop_column('disputes', 'final_report_path')
    op.drop_column('disputes', 'resolved_at')

    # Note: Enums are left as-is for now to avoid migration complexity in restricted environments.
    # The application will handle the mapping to lowercase/new statuses.

def downgrade() -> None:
    op.drop_column('disputes', 'closed_at')
    op.drop_column('disputes', 'updated_at')
    op.drop_column('disputes', 'report_distance_meters')
    op.drop_column('disputes', 'location_verified')
    op.drop_column('disputes', 'mediation_redirected_at')
    op.drop_column('disputes', 'mediation_redirect_url')
    op.drop_column('disputes', 'admin_observations')
    op.drop_column('disputes', 'responded_at')
    op.drop_column('disputes', 'response_evidence_urls')
    op.drop_column('disputes', 'response_description')
    op.drop_column('disputes', 'evidence_urls')

    op.add_column('disputes', sa.Column('resolved_at', sa.DateTime(), nullable=True))
    op.add_column('disputes', sa.Column('final_report_path', sa.String(), nullable=True))
    op.add_column('disputes', sa.Column('admin_notes', sa.Text(), nullable=True))
    op.add_column('disputes', sa.Column('verdict', sa.Enum('TENANT_WINS', 'LANDLORD_WINS', 'SPLIT', 'NONE', name='dispute_verdict_enum'), nullable=True))
