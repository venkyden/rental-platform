"""Fix user schema for encryption and status fields

Revision ID: fix_user_schema_encryption
Revises: 0f55a1a92c1f
Create Date: 2026-05-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'fix_user_schema_encryption'
down_revision = '0f55a1a92c1f'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Add missing status columns
    # We use batch_alter_table for compatibility and cleaner syntax
    with op.batch_alter_table('users') as batch_op:
        # Add status columns if they don't exist
        # Note: server_default='unverified' ensures existing rows have a valid status
        batch_op.add_column(sa.Column('identity_status', sa.String(), server_default='unverified', nullable=True))
        batch_op.add_column(sa.Column('employment_status', sa.String(), server_default='unverified', nullable=True))
        batch_op.add_column(sa.Column('ownership_status', sa.String(), server_default='unverified', nullable=True))
        
        # 2. Change JSON columns to String to support encrypted payloads
        # We use postgresql_using to explicitly cast existing JSON data to text
        batch_op.alter_column('identity_data', 
                            type_=sa.String(), 
                            postgresql_using='identity_data::text')
        batch_op.alter_column('employment_data', 
                            type_=sa.String(), 
                            postgresql_using='employment_data::text')
        batch_op.alter_column('ownership_data', 
                            type_=sa.String(), 
                            postgresql_using='ownership_data::text')

def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('ownership_status')
        batch_op.drop_column('employment_status')
        batch_op.drop_column('identity_status')
        
        # Revert types back to JSON
        batch_op.alter_column('identity_data', 
                            type_=sa.JSON(), 
                            postgresql_using='identity_data::json')
        batch_op.alter_column('employment_data', 
                            type_=sa.JSON(), 
                            postgresql_using='employment_data::json')
        batch_op.alter_column('ownership_data', 
                            type_=sa.JSON(), 
                            postgresql_using='ownership_data::json')
