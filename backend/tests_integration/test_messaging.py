"""
Messaging endpoint tests (domain audit #5): content validation + scam advisories.
"""
import pytest

from tests_integration.conftest import make_user, make_property, auth


async def _conversation(client, sm):
    """Landlord opens a conversation with a tenant; returns (landlord, tenant, conv_id)."""
    landlord = await make_user(sm, "landlord")
    tenant = await make_user(sm, "tenant")
    prop = await make_property(sm, landlord)
    r = await client.post(
        "/conversations",
        headers=auth(landlord),
        json={
            "property_id": str(prop.id),
            "tenant_email": tenant.email,
            "initial_message": "Hi, the flat is available — happy to arrange a viewing.",
        },
    )
    assert r.status_code == 200, r.text
    return landlord, tenant, r.json()["id"]


@pytest.mark.asyncio
async def test_empty_message_rejected(client):
    landlord, tenant, conv_id = await _conversation(client, client._sessionmaker)
    r = await client.post(
        f"/conversations/{conv_id}/messages",
        headers=auth(tenant),
        json={"content": ""},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_oversized_message_rejected(client):
    landlord, tenant, conv_id = await _conversation(client, client._sessionmaker)
    r = await client.post(
        f"/conversations/{conv_id}/messages",
        headers=auth(tenant),
        json={"content": "x" * 5001},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_scam_message_gets_advisory_in_thread(client):
    landlord, tenant, conv_id = await _conversation(client, client._sessionmaker)
    # Fraudster-style message from the landlord side.
    r = await client.post(
        f"/conversations/{conv_id}/messages",
        headers=auth(landlord),
        json={"content": "Send the deposit by Western Union before the visit to reserve it."},
    )
    assert r.status_code == 200
    assert "off_platform_payment" in r.json()["safety_advisories"]
    assert "pay_before_visit" in r.json()["safety_advisories"]

    # The reader (tenant) also sees the advisory when loading the thread.
    thread = await client.get(f"/conversations/{conv_id}", headers=auth(tenant))
    assert thread.status_code == 200
    scam_msgs = [m for m in thread.json()["messages"] if m["safety_advisories"]]
    assert scam_msgs and "pay_before_visit" in scam_msgs[0]["safety_advisories"]


@pytest.mark.asyncio
async def test_normal_message_has_no_advisory(client):
    landlord, tenant, conv_id = await _conversation(client, client._sessionmaker)
    r = await client.post(
        f"/conversations/{conv_id}/messages",
        headers=auth(tenant),
        json={"content": "Great, is Saturday morning available for a visit?"},
    )
    assert r.status_code == 200
    assert r.json()["safety_advisories"] == []
