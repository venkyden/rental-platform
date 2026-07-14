"""
Deposit legality at lease creation (domain audit #6, 2026-07-06).

POST /leases/create previously defaulted deposit to rent*2 for EVERY lease type
— illegal for a bail vide (1 month max, loi 89 art. 22) and a bail mobilité
(deposit must be 0, loi ELAN art. 25-12) — and accepted any deposit_override
uncapped. These lock the legal caps at the creation boundary.
"""
import pytest

from tests_integration.conftest import make_user, make_property, make_application, auth


async def _setup(client, sm):
    landlord = await make_user(sm, "landlord")
    tenant = await make_user(sm, "tenant")
    async with sm() as s:
        from app.models.user import User as U
        ll = await s.get(U, landlord.id)
        ll.identity_verified = True  # /create requires a verified landlord
        await s.commit()
    prop = await make_property(sm, landlord)  # monthly_rent = 900
    app_ = await make_application(sm, tenant, prop)
    return landlord, app_


def _payload(app_id, lease_type, **kw):
    body = {
        "application_id": str(app_id),
        "lease_type": lease_type,
        "start_date": "2026-09-01",
    }
    body.update(kw)
    return body


@pytest.mark.asyncio
async def test_vide_defaults_to_one_month_not_two(client):
    """Bail vide caps at 1 month — the old rent*2 default was double the cap."""
    landlord, app_ = await _setup(client, client._sessionmaker)
    r = await client.post("/leases/create", headers=auth(landlord),
                          json=_payload(app_.id, "vide"))
    assert r.status_code == 200, r.text
    lease_id = r.json()["lease_id"]
    async with client._sessionmaker() as s:
        from app.models.visits_and_leases import Lease
        import uuid as _u
        lease = await s.get(Lease, _u.UUID(lease_id))
        assert float(lease.deposit_amount) == 900.0  # 1 month, not 1800


@pytest.mark.asyncio
async def test_mobilite_defaults_to_zero_deposit(client):
    """Bail mobilité forbids any deposit (loi ELAN art. 25-12)."""
    landlord, app_ = await _setup(client, client._sessionmaker)
    r = await client.post("/leases/create", headers=auth(landlord),
                          json=_payload(app_.id, "mobilite"))
    assert r.status_code == 200, r.text
    async with client._sessionmaker() as s:
        from app.models.visits_and_leases import Lease
        import uuid as _u
        lease = await s.get(Lease, _u.UUID(r.json()["lease_id"]))
        assert float(lease.deposit_amount) == 0.0


@pytest.mark.asyncio
async def test_mobilite_rejects_any_deposit_override(client):
    landlord, app_ = await _setup(client, client._sessionmaker)
    r = await client.post("/leases/create", headers=auth(landlord),
                          json=_payload(app_.id, "mobilite", deposit_override=500))
    assert r.status_code == 400
    assert "mobilité" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_vide_rejects_over_cap_override(client):
    landlord, app_ = await _setup(client, client._sessionmaker)
    r = await client.post("/leases/create", headers=auth(landlord),
                          json=_payload(app_.id, "vide", deposit_override=1800))
    assert r.status_code == 400
    assert "dépôt de garantie" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_meuble_two_months_still_allowed(client):
    """Regression: the legal 2-month meublé cap must still pass."""
    landlord, app_ = await _setup(client, client._sessionmaker)
    r = await client.post("/leases/create", headers=auth(landlord),
                          json=_payload(app_.id, "meuble", deposit_override=1800))
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_unmapped_type_requires_explicit_deposit(client):
    """No legal cap defined (e.g. colocation) -> no default can be justified."""
    landlord, app_ = await _setup(client, client._sessionmaker)
    r = await client.post("/leases/create", headers=auth(landlord),
                          json=_payload(app_.id, "colocation"))
    assert r.status_code == 400
