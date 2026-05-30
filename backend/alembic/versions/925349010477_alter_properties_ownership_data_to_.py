"""alter_properties_ownership_data_to_string

Revision ID: 925349010477
Revises: e2b3c4d5f6a8
Create Date: 2026-05-30 21:57:11.030680

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '925349010477'
down_revision = 'e2b3c4d5f6a8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('properties') as batch_op:
        batch_op.alter_column('ownership_data',
                            type_=sa.String(),
                            postgresql_using='ownership_data::text')


def downgrade() -> None:
    with op.batch_alter_table('properties') as batch_op:
        batch_op.alter_column('ownership_data',
                            type_=sa.JSON(),
                            postgresql_using='ownership_data::json')
