"""Add ON DELETE CASCADE to owned-child / junction foreign keys

Scope is intentionally limited to rows that are meaningless without their parent
and carry no independent legal/financial value. Judgment-call FKs (leases,
disputes, applications, documents, properties.landlord_id, team_members→users)
are deliberately left as NO ACTION pending a product decision on retention.

Revision ID: b2c3d4e5f6a7
Revises: a1f2e3d4c5b6
Create Date: 2026-05-31
"""
from alembic import op

revision = "b2c3d4e5f6a7"
down_revision = "a1f2e3d4c5b6"
branch_labels = None
depends_on = None

# (source_table, constraint_name, local_cols, referent_table)
FKS = [
    ("inventory_items", "inventory_items_inventory_id_fkey", ["inventory_id"], "inventories"),
    ("messages", "messages_conversation_id_fkey", ["conversation_id"], "conversations"),
    ("notifications", "notifications_user_id_fkey", ["user_id"], "users"),
    ("property_media_sessions", "property_media_sessions_property_id_fkey", ["property_id"], "properties"),
    ("property_media", "property_media_property_id_fkey", ["property_id"], "properties"),
    ("saved_properties", "saved_properties_property_id_fkey", ["property_id"], "properties"),
    ("saved_properties", "saved_properties_user_id_fkey", ["user_id"], "users"),
    ("team_member_properties", "team_member_properties_property_id_fkey", ["property_id"], "properties"),
    ("team_member_properties", "team_member_properties_team_member_id_fkey", ["team_member_id"], "team_members"),
    ("webhook_deliveries", "webhook_deliveries_subscription_id_fkey", ["subscription_id"], "webhook_subscriptions"),
]


def upgrade() -> None:
    for table, name, local, referent in FKS:
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(name, table, referent, local, ["id"], ondelete="CASCADE")


def downgrade() -> None:
    for table, name, local, referent in FKS:
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(name, table, referent, local, ["id"])
