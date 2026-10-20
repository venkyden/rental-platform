"""
The furnished rule against real rows: a listing whose owner marked an item the
furnished-housing decree requires as absent or not working is not shown as
furnished, and no furnished lease is produced for it. Unanswered items only
inform; they never block.
"""

import secrets
import uuid
from datetime import timedelta

import pytest

from app.core.timeutils import naive_utcnow
from app.models.property import Property, PropertyMediaSession
from tests_integration.conftest import auth, make_application, make_property, make_user

ALL_PRESENT = {
    "kitchen": {"hob": "working", "oven": "working", "fridge_freezer": "working",
                "plates_glasses": "present", "pans_utensils": "present"},
    "bedroom:0": {"bed_bedding": "present", "curtains_shutters": "present"},
    "living": {"table_chairs": "present"},
    "home": {"lights": "present", "storage_shelves": "present", "cleaning_equipment": "present"},
}


async def _furnished_listing(sm, landlord, **fields) -> Property:
    prop = await make_property(sm, landlord, status="active")
    async with sm() as s:
        row = await s.get(Property, prop.id)
        row.property_type = "studio"
        row.furnished = True
        for key, value in fields.items():
            setattr(row, key, value)
        await s.commit()
    return prop


async def _code(sm, prop, landlord) -> str:
    code = secrets.token_urlsafe(24)
    async with sm() as s:
        s.add(PropertyMediaSession(id=uuid.uuid4(), property_id=prop.id, verification_code=code,
                                   generated_by=landlord.id, expires_at=naive_utcnow() + timedelta(days=7),
                                   is_active=True))
        await s.commit()
    return code


async def _answer(client, code, answers: dict) -> None:
    for space, items in answers.items():
        r = await client.put(f"/properties/media-sessions/{code}/answers", json={"space": space, "answers": items})
        assert r.status_code == 200, r.text


async def _furnished_search_ids(client) -> set[str]:
    r = await client.get("/properties?furnished=true")
    assert r.status_code == 200, r.text
    return {p["id"] for p in r.json()}


@pytest.mark.asyncio
async def test_an_item_marked_missing_removes_the_furnished_label_until_it_is_fixed(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await _furnished_listing(sm, landlord)
    code = await _code(sm, prop, landlord)
    await _answer(client, code, ALL_PRESENT)
    assert str(prop.id) in await _furnished_search_ids(client)

    await _answer(client, code, {"kitchen": {**ALL_PRESENT["kitchen"], "hob": "not_working"}})
    body = (await client.get(f"/properties/{prop.id}")).json()
    assert body["furnished_missing"] == ["plaques_cuisson"]
    assert str(prop.id) not in await _furnished_search_ids(client)
    # Still published and findable without the filter: never hidden.
    assert str(prop.id) in {p["id"] for p in (await client.get("/properties")).json()}

    await _answer(client, code, {"kitchen": ALL_PRESENT["kitchen"]})
    assert (await client.get(f"/properties/{prop.id}")).json()["furnished_missing"] == []
    assert str(prop.id) in await _furnished_search_ids(client)


@pytest.mark.asyncio
async def test_unanswered_items_inform_but_never_hide_a_furnished_listing(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await _furnished_listing(sm, landlord)

    body = (await client.get(f"/properties/{prop.id}")).json()
    assert body["furnished_missing"] == []
    assert len(body["furnished_unanswered"]) == 11
    assert str(prop.id) in await _furnished_search_ids(client)


@pytest.mark.asyncio
async def test_the_edit_page_path_keeps_the_label_in_step(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await _furnished_listing(sm, landlord)

    marked = {**ALL_PRESENT, "home": {**ALL_PRESENT["home"], "cleaning_equipment": "absent"}}
    r = await client.put(f"/properties/{prop.id}", json={"walkthrough_answers": marked}, headers=auth(landlord))
    assert r.status_code == 200, r.text
    assert r.json()["furnished_missing"] == ["materiel_entretien"]
    assert str(prop.id) not in await _furnished_search_ids(client)

    # Offered unfurnished instead: nothing is missing for an unfurnished home.
    r = await client.put(f"/properties/{prop.id}", json={"furnished": False, "deposit": 900}, headers=auth(landlord))
    assert r.status_code == 200, r.text
    assert r.json()["furnished_missing"] == []
    async with sm() as s:
        assert (await s.get(Property, prop.id)).furnished_incomplete is False

    # Offered furnished again: the stored answers count again.
    r = await client.put(f"/properties/{prop.id}", json={"furnished": True}, headers=auth(landlord))
    assert r.status_code == 200, r.text
    assert r.json()["furnished_missing"] == ["materiel_entretien"]


@pytest.mark.asyncio
async def test_a_second_bedroom_without_bedding_counts(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await _furnished_listing(sm, landlord, room_details=[{"surface": 10}, {"surface": 9}])
    code = await _code(sm, prop, landlord)
    await _answer(client, code, {**ALL_PRESENT, "bedroom:1": {"bed_bedding": "absent", "curtains_shutters": "present"}})
    assert (await client.get(f"/properties/{prop.id}")).json()["furnished_missing"] == ["literie"]


async def _lease_setup(sm, *, approved=True):
    landlord = await make_user(sm, "landlord")
    tenant = await make_user(sm, "tenant")
    async with sm() as s:
        from app.models.user import User as U
        (await s.get(U, landlord.id)).identity_verified = True
        await s.commit()
    prop = await _furnished_listing(sm, landlord)
    app_ = await make_application(sm, tenant, prop)
    if approved:
        async with sm() as s:
            from app.models.application import Application
            (await s.get(Application, app_.id)).status = "approved"
            await s.commit()
    return landlord, prop, app_


@pytest.mark.asyncio
@pytest.mark.parametrize("route", ["/leases/create", "/leases/generate"])
async def test_no_furnished_lease_for_a_home_with_an_item_marked_missing(client, route):
    sm = client._sessionmaker
    landlord, prop, app_ = await _lease_setup(sm)
    code = await _code(sm, prop, landlord)
    await _answer(client, code, {**ALL_PRESENT, "bedroom:0": {"bed_bedding": "absent", "curtains_shutters": "present"}})
    payload = {"application_id": str(app_.id), "start_date": "2026-11-01"}

    for lease_type in ("meuble", "etudiant", "mobilite"):
        r = await client.post(route, headers=auth(landlord), json={**payload, "lease_type": lease_type})
        assert r.status_code == 422, (lease_type, r.text)
        assert "Literie" in r.json()["detail"]
    r = await client.post(route, headers=auth(landlord), json={**payload, "lease_type": "vide"})
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_unanswered_items_do_not_block_a_furnished_lease(client):
    sm = client._sessionmaker
    landlord, _prop, app_ = await _lease_setup(sm)
    r = await client.post("/leases/create", headers=auth(landlord),
                          json={"application_id": str(app_.id), "start_date": "2026-11-01", "lease_type": "meuble"})
    assert r.status_code == 200, r.text
