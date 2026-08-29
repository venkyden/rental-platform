"""
Regression: a notification-delivery failure must never turn an
already-committed dispute change into a reported 500 (same class of bug as
test_application_notification_resilience.py).
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


def _break_notifications(monkeypatch):
    from app.services.notification_service import NotificationService

    async def _boom(self, *args, **kwargs):
        raise RuntimeError("simulated notification delivery failure")

    monkeypatch.setattr(NotificationService, "notify_dispute_created", _boom)
    monkeypatch.setattr(NotificationService, "notify_dispute_responded", _boom)


@pytest.mark.asyncio
async def test_create_dispute_succeeds_despite_notification_failure(client, monkeypatch):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord", email="landlord_dnr1@test.com")
    tenant = await make_user(sm, role="tenant", email="tenant_dnr1@test.com")
    prop = await make_property(sm, landlord)
    lease = await _make_lease(sm, landlord, tenant, prop)
    _break_notifications(monkeypatch)

    r = await client.post(
        "/disputes/",
        headers=auth(tenant),
        json={
            "lease_id": str(lease.id),
            "category": "damage",
            "title": "Broken window",
            "description": "The living room window was broken before move-in.",
            "accused_id": str(landlord.id),
        },
    )
    assert r.status_code == 200, r.text

    from app.models.dispute import Dispute
    from sqlalchemy import select
    async with sm() as s:
        d = (await s.execute(select(Dispute).where(Dispute.lease_id == lease.id))).scalar_one()
        assert d.title == "Broken window"


@pytest.mark.asyncio
async def test_respond_to_dispute_succeeds_despite_notification_failure(client, monkeypatch):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord", email="landlord_dnr2@test.com")
    tenant = await make_user(sm, role="tenant", email="tenant_dnr2@test.com")
    prop = await make_property(sm, landlord)
    lease = await _make_lease(sm, landlord, tenant, prop)

    r0 = await client.post(
        "/disputes/",
        headers=auth(tenant),
        json={
            "lease_id": str(lease.id),
            "category": "damage",
            "title": "Broken window",
            "description": "The living room window was broken before move-in.",
            "accused_id": str(landlord.id),
        },
    )
    assert r0.status_code == 200, r0.text
    dispute_id = r0.json()["id"]

    _break_notifications(monkeypatch)

    r = await client.post(
        f"/disputes/{dispute_id}/respond",
        headers=auth(landlord),
        json={"response_description": "The window was already like that at handover."},
    )
    assert r.status_code == 200, r.text
    assert r.json()["response_description"] == "The window was already like that at handover."
