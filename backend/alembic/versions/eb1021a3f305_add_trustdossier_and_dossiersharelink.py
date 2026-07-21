"""Add TrustDossier and DossierShareLink

Revision ID: eb1021a3f305
Revises: a9c1e2d3f4b5
Create Date: 2026-07-19 14:44:33.076638

Scope note (2026-07-20): `alembic revision --autogenerate` also emitted a
`DROP TABLE refresh_tokens`, plus NOT NULL relaxations on users.* and
properties.caf_eligible, because those objects are no longer described by the
ORM metadata. Dropping a table and weakening constraints is irreversible
against production data and has nothing to do with this feature, so those
operations were removed. This migration creates the two dossier tables and
nothing else. Retiring `refresh_tokens` (if wanted) belongs in its own
reviewed migration.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'eb1021a3f305'
down_revision = 'a9c1e2d3f4b5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'trustdossiers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('credential_id', sa.String(length=64), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('pdf_s3_key', sa.String(length=1024), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['credential_id'], ['credentials.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_trustdossiers_credential_id'), 'trustdossiers', ['credential_id'], unique=False)
    op.create_index(op.f('ix_trustdossiers_user_id'), 'trustdossiers', ['user_id'], unique=False)

    op.create_table(
        'dossier_share_links',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('dossier_id', sa.UUID(), nullable=False),
        sa.Column('target_user_id', sa.UUID(), nullable=True),
        sa.Column('token', sa.String(length=128), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('view_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['dossier_id'], ['trustdossiers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['target_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_dossier_share_links_dossier_id'), 'dossier_share_links', ['dossier_id'], unique=False)
    op.create_index(op.f('ix_dossier_share_links_target_user_id'), 'dossier_share_links', ['target_user_id'], unique=False)
    op.create_index(op.f('ix_dossier_share_links_token'), 'dossier_share_links', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_dossier_share_links_token'), table_name='dossier_share_links')
    op.drop_index(op.f('ix_dossier_share_links_target_user_id'), table_name='dossier_share_links')
    op.drop_index(op.f('ix_dossier_share_links_dossier_id'), table_name='dossier_share_links')
    op.drop_table('dossier_share_links')
    op.drop_index(op.f('ix_trustdossiers_user_id'), table_name='trustdossiers')
    op.drop_index(op.f('ix_trustdossiers_credential_id'), table_name='trustdossiers')
    op.drop_table('trustdossiers')
