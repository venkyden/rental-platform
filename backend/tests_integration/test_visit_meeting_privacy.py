"""
Visit meeting-link privacy (domain audit #4, 2026-07-05).

The by-room slot listing is unauthenticated and returns booked slots; it must
never expose the private video-call link, and the link must not be derivable
from the public slot id. Retrieval is authorized to the booking tenant and the
property landlord only.
"""
import pytest

from tests_integration.conftest import make_user, make_property, make_slot, auth


async def _book(client, sm):
    landlord = await make_user(sm, "landlord")
    tenant = await make_user(sm, "tenant")
    prop = await make_property(sm, landlord)
    slot = await make_slot(sm, prop, landlord)
    r = await client.post(f"/visits/book/{slot.id}", headers=auth(tenant))
    assert r.status_code == 200, r.text
    return landlord, tenant, prop, slot, r.json()["meeting_link"]


@pytest.mark.asyncio
async def test_meeting_link_not_derivable_from_slot_id(client):
    """The room must use a secret token, not rental-{slot.id} (slot id is public)."""
    _, _, _, slot, link = await _book(client, client._sessionmaker)
    assert str(slot.id) not in link, "meeting room name must not embed the public slot id"


@pytest.mark.asyncio
async def test_by_room_listing_never_exposes_meeting_link(client):
    """Unauthenticated by-room listing returns booked slots WITHOUT the link."""
    _, _, prop, _, link = await _book(client, client._sessionmaker)
    r = await client.get(f"/visits/slots/{prop.id}/by-room")
    assert r.status_code == 200
    body = r.text
    assert "meeting_link" not in body
    assert link not in body


@pytest.mark.asyncio
async def test_meeting_link_readable_by_tenant_and_landlord_only(client):
    sm = client._sessionmaker
    landlord, tenant, _, slot, link = await _book(client, sm)
    stranger = await make_user(sm, "tenant")

    # Booking tenant can retrieve it
    rt = await client.get(f"/visits/slots/{slot.id}/meeting", headers=auth(tenant))
    assert rt.status_code == 200 and rt.json()["meeting_link"] == link

    # Property landlord can retrieve it
    rl = await client.get(f"/visits/slots/{slot.id}/meeting", headers=auth(landlord))
    assert rl.status_code == 200 and rl.json()["meeting_link"] == link

    # An unrelated user cannot
    rs = await client.get(f"/visits/slots/{slot.id}/meeting", headers=auth(stranger))
    assert rs.status_code == 403


@pytest.mark.asyncio
async def test_meeting_link_404_for_unbooked_slot(client):
    sm = client._sessionmaker
    landlord = await make_user(sm, "landlord")
    prop = await make_property(sm, landlord)
    slot = await make_slot(sm, prop, landlord)  # never booked
    r = await client.get(f"/visits/slots/{slot.id}/meeting", headers=auth(landlord))
    assert r.status_code == 404
