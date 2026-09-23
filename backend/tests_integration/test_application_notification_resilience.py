"""
Regression: a notification-delivery failure must never turn an
already-committed application change into a reported 500. Applications
router didn't wrap its post-commit NotificationService calls in a
best-effort guard (unlike esign.py's _notify helper) — an exception raised
while notifying (e.g. a DB hiccup inside create_notification) would
propagate past the point where the actual application row was already
committed, so the client sees a failure for an action that actually
succeeded.
"""
import pytest
from tests_integration.conftest import make_user, make_property, auth


def _break_notifications(monkeypatch):
    from app.services.notification_service import NotificationService

    async def _boom(self, *args, **kwargs):
        raise RuntimeError("simulated notification delivery failure")

    monkeypatch.setattr(NotificationService, "notify_application_received", _boom)
    monkeypatch.setattr(NotificationService, "notify_application_status_changed", _boom)
    monkeypatch.setattr(NotificationService, "create_notification", _boom)


@pytest.mark.asyncio
async def test_create_application_succeeds_despite_notification_failure(client, monkeypatch):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord", email="landlord_notif1@test.com")
    tenant = await make_user(sm, role="tenant", email="tenant_notif1@test.com")
    prop = await make_property(sm, landlord)
    _break_notifications(monkeypatch)

    r = await client.post(
        "/applications",
        headers=auth(tenant),
        json={"property_id": str(prop.id), "cover_letter": "Bonjour"},
    )
    assert r.status_code == 201, r.text

    from app.models.application import Application
    from sqlalchemy import select
    async with sm() as s:
        app_row = (
            await s.execute(select(Application).where(Application.tenant_id == tenant.id))
        ).scalar_one()
        assert app_row.property_id == prop.id


@pytest.mark.asyncio
async def test_update_application_status_succeeds_despite_notification_failure(client, monkeypatch):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord", email="landlord_notif2@test.com")
    tenant = await make_user(sm, role="tenant", email="tenant_notif2@test.com")
    prop = await make_property(sm, landlord)

    r0 = await client.post(
        "/applications",
        headers=auth(tenant),
        json={"property_id": str(prop.id), "cover_letter": "Bonjour"},
    )
    assert r0.status_code == 201, r0.text
    app_id = r0.json()["id"]

    _break_notifications(monkeypatch)

    r = await client.patch(
        f"/applications/{app_id}",
        headers=auth(landlord),
        json={"status": "approved"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_withdraw_application_succeeds_despite_notification_failure(client, monkeypatch):
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord", email="landlord_notif3@test.com")
    tenant = await make_user(sm, role="tenant", email="tenant_notif3@test.com")
    prop = await make_property(sm, landlord)

    r0 = await client.post(
        "/applications",
        headers=auth(tenant),
        json={"property_id": str(prop.id), "cover_letter": "Bonjour"},
    )
    assert r0.status_code == 201, r0.text
    app_id = r0.json()["id"]

    _break_notifications(monkeypatch)

    r = await client.delete(f"/applications/{app_id}", headers=auth(tenant))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "withdrawn"
