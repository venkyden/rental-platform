"""
POST /visits/leases/generate — integration tests.

Regression: this "direct from property" lease-creation path (wired to the
live LeaseManager.tsx component on the property detail page) used to create
a real Lease row with NO identity-verification check and a hardcoded
`deposit = rent * 2` default — illegal for a bail vide (1 month max) and a
bail mobilité (must be 0), and bypassing every check the compliant
POST /leases/create path enforces (test_lease_create_deposit_cap.py).
"""
import pytest
from tests_integration.conftest import make_user, make_property, auth


@pytest.mark.asyncio
async def test_direct_generate_requires_landlord_identity_verified(client):
    """A landlord with no identity verification cannot generate a lease this way either."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")
    tenant = await make_user(sm, role="tenant", email="tenant_dlg1@test.com")
    prop = await make_property(sm, landlord)

    r = await client.post(
        f"/visits/leases/generate?property_id={prop.id}",
        headers=auth(landlord),
        json={
            "tenant_email": tenant.email,
            "rent_amount": 1000,
            "start_date": "2026-09-01",
            "lease_type": "vide",
        },
    )
    assert r.status_code == 403
    assert "identity" in r.json()["detail"].lower()


async def _verified_landlord(sm, email="landlord_dlg@test.com"):
    from app.models.user import User
    landlord = await make_user(sm, role="landlord", email=email)
    async with sm() as s:
        u = await s.get(User, landlord.id)
        u.identity_verified = True
        await s.commit()
        await s.refresh(u)
        return u


@pytest.mark.asyncio
async def test_direct_generate_vide_rejects_over_cap_deposit(client):
    """Bail vide: deposit capped at 1 month hors charges — an explicit override above
    that must be rejected, not silently accepted."""
    sm = client._sessionmaker
    landlord = await _verified_landlord(sm)
    tenant = await make_user(sm, role="tenant", email="tenant_dlg2@test.com")
    prop = await make_property(sm, landlord)

    r = await client.post(
        f"/visits/leases/generate?property_id={prop.id}",
        headers=auth(landlord),
        json={
            "tenant_email": tenant.email,
            "rent_amount": 1000,
            "start_date": "2026-09-01",
            "lease_type": "vide",
            "deposit_amount": 2000,  # 2 months — illegal for vide (max 1 month)
        },
    )
    assert r.status_code == 400
    assert "dépôt" in r.json()["detail"].lower() or "deposit" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_direct_generate_vide_defaults_to_one_month_not_two(client):
    """No explicit deposit given: must default to the legal cap for the type
    (1 month for vide), never the old unconditional rent*2."""
    sm = client._sessionmaker
    landlord = await _verified_landlord(sm, email="landlord_dlg3@test.com")
    tenant = await make_user(sm, role="tenant", email="tenant_dlg3@test.com")
    prop = await make_property(sm, landlord)

    r = await client.post(
        f"/visits/leases/generate?property_id={prop.id}",
        headers=auth(landlord),
        json={
            "tenant_email": tenant.email,
            "rent_amount": 1000,
            "start_date": "2026-09-01",
            "lease_type": "vide",
        },
    )
    assert r.status_code == 200, r.text

    from app.models.visits_and_leases import Lease
    from sqlalchemy import select
    async with sm() as s:
        lease = (await s.execute(select(Lease).where(Lease.property_id == prop.id))).scalar_one()
        assert float(lease.deposit_amount) == 1000.0


@pytest.mark.asyncio
async def test_direct_generate_mobilite_rejects_any_deposit(client):
    """Bail mobilité forbids any deposit at all (loi ELAN art. 25-12)."""
    sm = client._sessionmaker
    landlord = await _verified_landlord(sm, email="landlord_dlg4@test.com")
    tenant = await make_user(sm, role="tenant", email="tenant_dlg4@test.com")
    prop = await make_property(sm, landlord)

    r = await client.post(
        f"/visits/leases/generate?property_id={prop.id}",
        headers=auth(landlord),
        json={
            "tenant_email": tenant.email,
            "rent_amount": 1000,
            "start_date": "2026-09-01",
            "lease_type": "mobilite",
            "deposit_amount": 1,
        },
    )
    assert r.status_code == 400

    r2 = await client.post(
        f"/visits/leases/generate?property_id={prop.id}",
        headers=auth(landlord),
        json={
            "tenant_email": tenant.email,
            "rent_amount": 1000,
            "start_date": "2026-09-01",
            "lease_type": "mobilite",
        },
    )
    assert r2.status_code == 200, r2.text
    from app.models.visits_and_leases import Lease
    from sqlalchemy import select
    async with sm() as s:
        lease = (await s.execute(select(Lease).where(Lease.property_id == prop.id))).scalar_one()
        assert float(lease.deposit_amount) == 0.0
