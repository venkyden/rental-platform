"""
Walk-through answers against real rows: the capture-session endpoint, the
landlord's edit path and what the public listing shows.
"""

import secrets
import uuid
from datetime import timedelta

import pytest

from app.core.timeutils import naive_utcnow
from app.models.property import Property, PropertyMediaSession
from tests_integration.conftest import auth, make_property, make_user


async def _session(sm, prop, landlord, *, expired=False, active=True) -> str:
    code = secrets.token_urlsafe(24)
    async with sm() as s:
        s.add(PropertyMediaSession(
            id=uuid.uuid4(),
            property_id=prop.id,
            verification_code=code,
            generated_by=landlord.id,
            expires_at=naive_utcnow() + (timedelta(days=-1) if expired else timedelta(days=7)),
            is_active=active,
        ))
        await s.commit()
    return code


async def _listing(sm, landlord, **fields) -> Property:
    """A listing the public endpoint can serialise (the shared fixture leaves the type unset)."""
    prop = await make_property(sm, landlord, status=fields.pop("status", None))
    await _set(sm, prop, property_type="apartment", **fields)
    return prop


async def _stored(sm, prop) -> Property:
    async with sm() as s:
        return await s.get(Property, prop.id)


async def _set(sm, prop, **fields) -> None:
    async with sm() as s:
        row = await s.get(Property, prop.id)
        for key, value in fields.items():
            setattr(row, key, value)
        await s.commit()


@pytest.mark.asyncio
async def test_capture_session_returns_the_current_answers(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    code = await _session(sm, prop, landlord)

    resp = await client.get(f"/properties/media-sessions/{code}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["walkthrough"] == {"bedrooms": 1, "is_colocation": False, "answers": {}, "flatmates": None}


@pytest.mark.asyncio
async def test_saving_a_space_stores_dated_answers_and_shows_them_publicly(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await _listing(sm, landlord, status="active")
    code = await _session(sm, prop, landlord)

    resp = await client.put(
        f"/properties/media-sessions/{code}/answers",
        json={"space": "kitchen", "answers": {"hob": "working", "dishwasher": "absent"}},
    )
    assert resp.status_code == 200, resp.text
    kitchen = resp.json()["answers"]["kitchen"]
    assert kitchen["hob"]["state"] == "working"
    assert kitchen["dishwasher"]["state"] == "absent"
    assert kitchen["hob"]["answered_at"].endswith("Z")

    public = await client.get(f"/properties/{prop.id}")
    assert public.status_code == 200, public.text
    assert public.json()["walkthrough_answers"]["kitchen"]["dishwasher"]["state"] == "absent"


@pytest.mark.asyncio
async def test_spaces_are_saved_independently_and_resaving_keeps_unchanged_dates(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    code = await _session(sm, prop, landlord)
    url = f"/properties/media-sessions/{code}/answers"

    first = (await client.put(url, json={"space": "kitchen", "answers": {"hob": "working", "oven": "working"}})).json()
    await client.put(url, json={"space": "home", "answers": {"internet": "present"}})
    # Rewind the stored date so "kept" and "re-dated" are distinguishable within one second.
    stored = (await _stored(sm, prop)).walkthrough_answers
    stored["kitchen"]["hob"]["answered_at"] = stored["kitchen"]["oven"]["answered_at"] = "2020-01-01T00:00:00Z"
    await _set(sm, prop, walkthrough_answers=stored)

    again = (await client.put(url, json={"space": "kitchen", "answers": {"hob": "working", "oven": "not_working"}})).json()
    assert again["answers"]["kitchen"]["hob"]["answered_at"] == "2020-01-01T00:00:00Z"
    assert again["answers"]["kitchen"]["oven"]["answered_at"] != "2020-01-01T00:00:00Z"
    assert again["answers"]["home"]["internet"]["state"] == "present"
    assert first["answers"]["kitchen"]["hob"]["state"] == "working"


@pytest.mark.asyncio
async def test_a_code_only_writes_to_its_own_listing(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    other = await make_user(sm, role="landlord")
    mine = await make_property(sm, landlord)
    theirs = await make_property(sm, other)
    code = await _session(sm, mine, landlord)

    resp = await client.put(
        f"/properties/media-sessions/{code}/answers",
        json={"space": "kitchen", "answers": {"hob": "working"}, "property_id": str(theirs.id)},
    )
    assert resp.status_code == 200, resp.text
    assert (await _stored(sm, mine)).walkthrough_answers["kitchen"]["hob"]["state"] == "working"
    assert (await _stored(sm, theirs)).walkthrough_answers is None


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["unknown", "expired", "inactive", "nul"])
async def test_an_unusable_code_writes_nothing(client, kind):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    code = {
        "unknown": "no-such-code",
        "expired": await _session(sm, prop, landlord, expired=True),
        "inactive": await _session(sm, prop, landlord, active=False),
        "nul": "abc%00def",
    }[kind]

    resp = await client.put(
        f"/properties/media-sessions/{code}/answers", json={"space": "kitchen", "answers": {"hob": "working"}}
    )
    assert resp.status_code in (400, 404), resp.text
    assert (await _stored(sm, prop)).walkthrough_answers is None


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [
    {"space": "garage", "answers": {}},
    {"space": "bedroom:5", "answers": {"desk": "present"}},
    {"space": "kitchen", "answers": {"sofa": "present"}},
    {"space": "kitchen", "answers": {"hob": "present"}},
    {"space": "kitchen", "answers": {"hob": "<script>alert(1)</script>"}},
    {"space": "kitchen", "answers": ["hob"]},
    {"space": "kitchen\u0000", "answers": {}},
])
async def test_answers_outside_the_catalogue_are_refused_and_nothing_is_stored(client, payload):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    code = await _session(sm, prop, landlord)

    resp = await client.put(f"/properties/media-sessions/{code}/answers", json=payload)
    assert resp.status_code == 422, resp.text
    assert "<script>alert(1)</script>" not in resp.text or len(resp.text) < 200
    assert (await _stored(sm, prop)).walkthrough_answers is None


@pytest.mark.asyncio
async def test_bedrooms_follow_the_room_list(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)
    await _set(sm, prop, room_details=[{"surface": 10}, {"surface": 12}])
    code = await _session(sm, prop, landlord)
    url = f"/properties/media-sessions/{code}/answers"

    assert (await client.get(f"/properties/media-sessions/{code}")).json()["walkthrough"]["bedrooms"] == 2
    assert (await client.put(url, json={"space": "bedroom:1", "answers": {"desk": "present"}})).status_code == 200
    assert (await client.put(url, json={"space": "bedroom:2", "answers": {"desk": "present"}})).status_code == 422


@pytest.mark.asyncio
async def test_flatmates_are_kept_for_a_shared_home_only(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    solo = await make_property(sm, landlord)
    shared = await _listing(sm, landlord, status="active", is_colocation=True)
    card = {"count": 3, "occupation": "students", "smoking": False, "pets": True}

    solo_code = await _session(sm, solo, landlord)
    resp = await client.put(f"/properties/media-sessions/{solo_code}/answers", json={"flatmates": card})
    assert resp.status_code == 200, resp.text
    assert resp.json()["flatmates"] is None
    assert (await _stored(sm, solo)).flatmates is None

    shared_code = await _session(sm, shared, landlord)
    resp = await client.put(f"/properties/media-sessions/{shared_code}/answers", json={"flatmates": card})
    assert resp.status_code == 200, resp.text
    assert {k: v for k, v in resp.json()["flatmates"].items() if k != "answered_at"} == card
    assert (await client.get(f"/properties/{shared.id}")).json()["flatmates"]["count"] == 3


@pytest.mark.asyncio
@pytest.mark.parametrize("extra", ["name", "gender", "age", "nationality"])
async def test_the_flatmates_card_refuses_anything_about_a_person(client, extra):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    shared = await make_property(sm, landlord)
    await _set(sm, shared, is_colocation=True)
    code = await _session(sm, shared, landlord)

    resp = await client.put(
        f"/properties/media-sessions/{code}/answers", json={"flatmates": {"count": 2, extra: "x"}}
    )
    assert resp.status_code == 422, resp.text
    assert (await _stored(sm, shared)).flatmates is None


@pytest.mark.asyncio
async def test_the_landlord_can_edit_answers_from_the_listing(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await _listing(sm, landlord)

    resp = await client.put(
        f"/properties/{prop.id}",
        json={"walkthrough_answers": {"kitchen": {"hob": "working"}, "home": {"internet": "absent"}}},
        headers=auth(landlord),
    )
    assert resp.status_code == 200, resp.text
    answers = resp.json()["walkthrough_answers"]
    assert answers["kitchen"]["hob"]["state"] == "working"
    assert answers["home"]["internet"]["answered_at"].endswith("Z")

    # A later edit of one space leaves the other alone; an unrelated edit leaves both.
    await client.put(f"/properties/{prop.id}", json={"walkthrough_answers": {"kitchen": {}}}, headers=auth(landlord))
    await client.put(f"/properties/{prop.id}", json={"description": "A quiet flat near the tram."}, headers=auth(landlord))
    assert (await _stored(sm, prop)).walkthrough_answers == {"home": answers["home"]}


@pytest.mark.asyncio
async def test_the_edit_path_cannot_store_a_raw_or_forged_value(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    prop = await make_property(sm, landlord)

    forged = {"kitchen": {"hob": {"state": "working", "answered_at": "1999-01-01T00:00:00Z"}}}
    resp = await client.put(f"/properties/{prop.id}", json={"walkthrough_answers": forged}, headers=auth(landlord))
    assert resp.status_code == 422, resp.text
    resp = await client.put(f"/properties/{prop.id}", json={"walkthrough_answers": {"garage": {}}}, headers=auth(landlord))
    assert resp.status_code == 422, resp.text
    assert (await _stored(sm, prop)).walkthrough_answers is None


@pytest.mark.asyncio
async def test_only_the_landlord_can_edit_answers_from_the_listing(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    stranger = await make_user(sm, role="landlord")
    tenant = await make_user(sm, role="tenant")
    prop = await make_property(sm, landlord)
    payload = {"walkthrough_answers": {"kitchen": {"hob": "working"}}}

    assert (await client.put(f"/properties/{prop.id}", json=payload)).status_code == 401
    assert (await client.put(f"/properties/{prop.id}", json=payload, headers=auth(stranger))).status_code == 403
    assert (await client.put(f"/properties/{prop.id}", json=payload, headers=auth(tenant))).status_code == 403
    assert (await _stored(sm, prop)).walkthrough_answers is None
