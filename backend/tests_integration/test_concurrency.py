"""
Concurrency / race-condition integration tests against a real DB.

These fire two requests at once (asyncio.gather) so the DB-level guards
(row locks / unique constraints) are actually exercised.
"""

import asyncio

import pytest

from tests_integration.conftest import (
    make_user, make_property, make_slot, auth,
)


@pytest.mark.asyncio
async def test_visit_slot_cannot_be_double_booked(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, "landlord")
    t1 = await make_user(sm, "tenant")
    t2 = await make_user(sm, "tenant")
    prop = await make_property(sm, landlord)
    slot = await make_slot(sm, prop, landlord)

    r1, r2 = await asyncio.gather(
        client.post(f"/visits/book/{slot.id}", headers=auth(t1)),
        client.post(f"/visits/book/{slot.id}", headers=auth(t2)),
    )
    codes = sorted([r1.status_code, r2.status_code])
    # Exactly one booking succeeds; the other is rejected (row lock serializes).
    assert codes.count(200) == 1, f"expected exactly one 200, got {codes}"
    assert 400 in codes, f"expected a 400 for the loser, got {codes}"


@pytest.mark.asyncio
async def test_concurrent_duplicate_applications_are_prevented(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, "landlord")
    tenant = await make_user(sm, "tenant")
    prop = await make_property(sm, landlord)

    payload = {"property_id": str(prop.id), "cover_letter": "hi"}
    r1, r2 = await asyncio.gather(
        client.post("/applications", json=payload, headers=auth(tenant)),
        client.post("/applications", json=payload, headers=auth(tenant)),
    )
    codes = sorted([r1.status_code, r2.status_code])
    # Exactly one application is created; the duplicate is a 409 Conflict.
    assert codes.count(201) == 1, f"expected exactly one 201, got {codes}"
    assert 409 in codes, f"expected a 409 for the duplicate, got {codes}"
