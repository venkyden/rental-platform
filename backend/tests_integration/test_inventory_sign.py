"""
POST /inventory/{id}/sign — integration tests.

Regression: once both parties had signed (status COMPLETED), either party
could call /sign again and silently overwrite their own signature with no
409 — unlike the lease e-sign flow (esign.py), which rejects a party who
already signed and locks the document once fully signed. An état des lieux
is dispute evidence; it must be just as immutable once complete.
"""
import uuid
import pytest
from tests_integration.conftest import make_user, make_property, auth


async def _make_lease(sm, landlord, tenant, prop):
    from datetime import date
    from app.models.visits_and_leases import Lease

    async with sm() as s:
        lease = Lease(
            id=uuid.uuid4(),
            property_id=prop.id,
            landlord_id=landlord.id,
            tenant_id=tenant.id,
            start_date=date(2026, 9, 1),
            rent_amount=1000,
            deposit_amount=1000,
            charges_amount=0,
            lease_type="vide",
            status="signed",
        )
        s.add(lease)
        await s.commit()
        await s.refresh(lease)
        return lease


async def _make_inventory(client, landlord, prop_id, lease_id):
    r = await client.post(
        "/inventory/",
        headers=auth(landlord),
        json={"lease_id": str(lease_id), "type": "move_in", "items": []},
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.mark.asyncio
async def test_cannot_resign_after_both_parties_signed(client):
    """Once COMPLETED, neither party can call /sign again to overwrite a signature."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord", email="landlord_inv1@test.com")
    tenant = await make_user(sm, role="tenant", email="tenant_inv1@test.com")
    prop = await make_property(sm, landlord)
    lease = await _make_lease(sm, landlord, tenant, prop)
    inv_id = await _make_inventory(client, landlord, prop.id, lease.id)

    r1 = await client.post(
        f"/inventory/{inv_id}/sign",
        headers=auth(tenant),
        json={"signature_tenant": {"image": "sig1"}},
    )
    assert r1.status_code == 200, r1.text

    r2 = await client.post(
        f"/inventory/{inv_id}/sign",
        headers=auth(landlord),
        json={"signature_landlord": {"image": "sig2"}},
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["status"] == "completed"

    # Both attempts to re-sign after completion must be rejected.
    r3 = await client.post(
        f"/inventory/{inv_id}/sign",
        headers=auth(tenant),
        json={"signature_tenant": {"image": "sig1-tampered"}},
    )
    assert r3.status_code == 409

    r4 = await client.post(
        f"/inventory/{inv_id}/sign",
        headers=auth(landlord),
        json={"signature_landlord": {"image": "sig2-tampered"}},
    )
    assert r4.status_code == 409


@pytest.mark.asyncio
async def test_cannot_resign_own_signature_before_completion(client):
    """A party who already signed cannot overwrite their own signature even
    before the other party has signed."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord", email="landlord_inv2@test.com")
    tenant = await make_user(sm, role="tenant", email="tenant_inv2@test.com")
    prop = await make_property(sm, landlord)
    lease = await _make_lease(sm, landlord, tenant, prop)
    inv_id = await _make_inventory(client, landlord, prop.id, lease.id)

    r1 = await client.post(
        f"/inventory/{inv_id}/sign",
        headers=auth(tenant),
        json={"signature_tenant": {"image": "sig1"}},
    )
    assert r1.status_code == 200, r1.text
    assert r1.json()["status"] == "pending_landlord_sign"

    r2 = await client.post(
        f"/inventory/{inv_id}/sign",
        headers=auth(tenant),
        json={"signature_tenant": {"image": "sig1-different"}},
    )
    assert r2.status_code == 409
