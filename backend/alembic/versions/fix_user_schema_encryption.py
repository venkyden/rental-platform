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
    conn = op.get_bind()
    columns = sa.inspect(conn).get_columns("users")
    existing_column_names = [c["name"] for c in columns]

    def get_column_type(name):
        for c in columns:
            if c["name"] == name:
                return c["type"]
        return None

    # We use batch_alter_table for compatibility and cleaner syntax
    with op.batch_alter_table('users') as batch_op:
        # 1. Add missing status columns
        if 'identity_status' not in existing_column_names:
            batch_op.add_column(sa.Column('identity_status', sa.String(), server_default='unverified', nullable=True))
        if 'employment_status' not in existing_column_names:
            batch_op.add_column(sa.Column('employment_status', sa.String(), server_default='unverified', nullable=True))
        if 'ownership_status' not in existing_column_names:
            batch_op.add_column(sa.Column('ownership_status', sa.String(), server_default='unverified', nullable=True))
        
        # 2. Change JSON columns to String to support encrypted payloads
        identity_type = get_column_type('identity_data')
        if identity_type is not None and not isinstance(identity_type, sa.String):
            batch_op.alter_column('identity_data', 
                                type_=sa.String(), 
                                postgresql_using='identity_data::text')
                                
        employment_type = get_column_type('employment_data')
        if employment_type is not None and not isinstance(employment_type, sa.String):
            batch_op.alter_column('employment_data', 
                                type_=sa.String(), 
                                postgresql_using='employment_data::text')
                                
        ownership_type = get_column_type('ownership_data')
        if ownership_type is not None and not isinstance(ownership_type, sa.String):
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
