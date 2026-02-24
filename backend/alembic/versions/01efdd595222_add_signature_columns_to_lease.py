"""Add signature columns to lease

Revision ID: 01efdd595222
Revises: e28eaa60ce07
Create Date: 2026-02-23 02:42:35.063496

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '01efdd595222'
down_revision = 'e28eaa60ce07'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Safely add columns if they don't exist
    with op.batch_alter_table('leases', schema=None) as batch_op:
        batch_op.add_column(sa.Column('landlord_signature', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('tenant_signature', sa.String(), nullable=True))

def downgrade() -> None:
    # Remove columns on downgrade
    with op.batch_alter_table('leases', schema=None) as batch_op:
        batch_op.drop_column('tenant_signature')
        batch_op.drop_column('landlord_signature')
