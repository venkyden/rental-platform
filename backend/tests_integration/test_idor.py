"""
IDOR / authorization integration tests against a real DB.

Verifies that users cannot read or mutate resources they don't own.
"""

import pytest

from tests_integration.conftest import (
    make_user, make_property, make_application, auth,
)


@pytest.mark.asyncio
async def test_application_read_is_scoped_to_tenant_and_landlord(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    other_landlord = await make_user(sm, role="landlord")
    tenant = await make_user(sm, role="tenant")
    intruder = await make_user(sm, role="tenant")

    prop = await make_property(sm, landlord)
    app = await make_application(sm, tenant, prop)
    url = f"/applications/{app.id}"

    # Owner tenant -> 200
    assert (await client.get(url, headers=auth(tenant))).status_code == 200
    # Property's landlord -> 200
    assert (await client.get(url, headers=auth(landlord))).status_code == 200
    # Unrelated tenant -> 403 (IDOR blocked)
    assert (await client.get(url, headers=auth(intruder))).status_code == 403
    # A different landlord -> 403
    assert (await client.get(url, headers=auth(other_landlord))).status_code == 403


@pytest.mark.asyncio
async def test_tenant_only_lists_own_applications(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    tenant_a = await make_user(sm, role="tenant")
    tenant_b = await make_user(sm, role="tenant")
    prop = await make_property(sm, landlord)
    await make_application(sm, tenant_a, prop)

    r = await client.get("/applications/me", headers=auth(tenant_b))
    assert r.status_code == 200
    assert r.json() == []  # B sees none of A's applications


@pytest.mark.asyncio
async def test_non_owner_cannot_update_property(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    intruder = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)

    r = await client.put(
        f"/properties/{prop.id}",
        json={"title": "Hacked Title"},
        headers=auth(intruder),
    )
    assert r.status_code == 403
