"""
Verifies the ON DELETE CASCADE foreign keys: deleting a parent removes its
owned children (rather than erroring or orphaning rows).
"""

import uuid

import pytest
from sqlalchemy import delete, select

from app.models.property import SavedProperty, Property
from tests_integration.conftest import make_user, make_property


@pytest.mark.asyncio
async def test_deleting_property_cascades_saved_properties(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, "landlord")
    tenant = await make_user(sm, "tenant")
    prop = await make_property(sm, landlord)

    async with sm() as s:
        s.add(SavedProperty(id=uuid.uuid4(), user_id=tenant.id, property_id=prop.id))
        await s.commit()

    # Sanity: the saved row exists
    async with sm() as s:
        rows = (await s.execute(select(SavedProperty).where(SavedProperty.property_id == prop.id))).scalars().all()
        assert len(rows) == 1

    # Delete the parent property
    async with sm() as s:
        await s.execute(delete(Property).where(Property.id == prop.id))
        await s.commit()

    # The saved_properties row must have cascaded away
    async with sm() as s:
        rows = (await s.execute(select(SavedProperty).where(SavedProperty.property_id == prop.id))).scalars().all()
        assert rows == [], "saved_properties should cascade-delete with its property"
