"""merge guarantor_income_multiple and remove-MRH-insurance heads

Revision ID: cddfc29ae95d
Revises: c7f139a2d5b6, e6f7a8b9c0d1
Create Date: 2026-08-25 22:55:05.742972

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cddfc29ae95d'
down_revision = ('c7f139a2d5b6', 'e6f7a8b9c0d1')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
