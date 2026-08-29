"""
Manual-review fallback for identity verification — integration tests.

When AI document-OCR extraction fails (outage, misconfiguration, low
confidence), the front-document upload is queued for a human admin to review
instead of either silently accepting it (the fixed forgery bug — see
test_verification_kyc.py's test_front_upload_ai_unavailable_fails_closed) or
hard-blocking with no recourse. Covers the queue, document view, approve,
reject, and access-control paths.

Storage note: `storage` (app/services/storage.py) is a module-level
singleton imported via `from app.services.storage import storage` in both
app.routers.verification and app.routers.admin. Patching the *module
attribute* (`patch("app.services.storage.storage", ...)`) does not reach
those already-bound names — mutate the singleton's own methods instead
(via monkeypatch), which every importer shares by reference.
"""
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from tests_integration.conftest import make_user, auth


def _fake_storage(monkeypatch, *, upload_key="test/key", download_bytes=b"fake-id-photo-bytes"):
    from app.services.storage import storage as real_storage

    monkeypatch.setattr(
        real_storage, "upload_file",
        AsyncMock(return_value={"url": "https://r2.test/file.jpg", "key": upload_key}),
    )
    monkeypatch.setattr(real_storage, "download_file", AsyncMock(return_value=download_bytes))
    monkeypatch.setattr(real_storage, "delete_file", AsyncMock(return_value=None))
    return real_storage


def _fake_identity_service(monkeypatch, **overrides):
    from app.services.identity import identity_service as real_service

    defaults = {
        "verify_document": AsyncMock(return_value={
            "verified": False, "status": "error",
            "data": None, "validation_checks": [], "rejection_reason": "verification_service_unavailable",
        }),
    }
    defaults.update(overrides)
    for name, mock in defaults.items():
        monkeypatch.setattr(real_service, name, mock)
    return real_service


async def _queue_for_review(client, user, monkeypatch):
    _fake_identity_service(monkeypatch)
    _fake_storage(monkeypatch)
    r = await client.post(
        "/verification/identity/upload?document_type=passport",
        files={"file": ("id.jpg", b"\xff\xd8\xff photo", "image/jpeg")},
        data={"side": "front"},
        headers=auth(user),
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending_manual_review"
    return r


@pytest.mark.asyncio
async def test_queued_document_appears_in_admin_pending_list(client, sessionmaker_, monkeypatch):
    user = await make_user(sessionmaker_, role="tenant")
    admin = await make_user(sessionmaker_, role="admin")
    await _queue_for_review(client, user, monkeypatch)

    r = await client.get("/admin/verifications/pending", headers=auth(admin))
    assert r.status_code == 200, r.text
    entries = [e for e in r.json() if e["id"] == str(user.id)]
    assert len(entries) == 1
    assert entries[0]["type"] == "identity_pending_review"
    assert entries[0]["status"] == "pending_manual_review"


@pytest.mark.asyncio
async def test_every_admin_is_notified_when_a_document_is_queued(client, sessionmaker_, monkeypatch):
    """The queue is pull-only otherwise — on a small team with no dedicated
    reviewer, an unnoticed queue entry just sits there for its whole retention
    window. Every admin account must get an in-app alert."""
    user = await make_user(sessionmaker_, role="tenant", email="tenant_notify@test.com")
    admin1 = await make_user(sessionmaker_, role="admin", email="admin1@test.com")
    admin2 = await make_user(sessionmaker_, role="admin", email="admin2@test.com")
    await _queue_for_review(client, user, monkeypatch)

    async with sessionmaker_() as s:
        from sqlalchemy import select
        from app.models.notification import Notification
        notifs = (await s.execute(select(Notification))).scalars().all()
        recipients = {n.user_id for n in notifs if n.type == "verification"}
        assert admin1.id in recipients
        assert admin2.id in recipients
        assert user.id not in recipients


@pytest.mark.asyncio
async def test_admin_can_view_the_queued_document(client, sessionmaker_, monkeypatch):
    user = await make_user(sessionmaker_, role="tenant")
    admin = await make_user(sessionmaker_, role="admin")
    await _queue_for_review(client, user, monkeypatch)

    r = await client.get(
        f"/admin/verifications/{user.id}/identity-document", headers=auth(admin)
    )
    assert r.status_code == 200, r.text
    assert r.content == b"fake-id-photo-bytes"
    # Regression: the storage-backed path used to hardcode application/octet-stream,
    # which browsers generally won't render as an <img> even for real image bytes.
    assert r.headers["content-type"] == "image/jpeg"


@pytest.mark.asyncio
async def test_non_admin_cannot_view_the_queued_document(client, sessionmaker_, monkeypatch):
    user = await make_user(sessionmaker_, role="tenant")
    other_tenant = await make_user(sessionmaker_, role="tenant")
    await _queue_for_review(client, user, monkeypatch)

    r = await client.get(
        f"/admin/verifications/{user.id}/identity-document", headers=auth(other_tenant)
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_approve_unlocks_selfie_step_and_completes_verification(client, sessionmaker_, monkeypatch):
    user = await make_user(sessionmaker_, role="tenant")
    admin = await make_user(sessionmaker_, role="admin")
    await _queue_for_review(client, user, monkeypatch)

    r = await client.post(
        f"/admin/verifications/{user.id}/approve?type=identity", headers=auth(admin)
    )
    assert r.status_code == 200, r.text

    async with sessionmaker_() as s:
        from app.models.user import User as U
        refreshed = await s.get(U, user.id)
        assert refreshed.identity_status == "document_uploaded"
        assert refreshed.identity_verified is False
        assert refreshed.identity_data["checks"][0]["name"] == "manual_document_review"
        assert refreshed.identity_data["reviewed_by"] == str(admin.id)

    # The user can now complete the selfie step exactly as if AI had validated it.
    # The selfie endpoint fetches the stored document by URL via httpx when
    # there's no redis_key (no test Redis here) — fake that HTTP round trip too.
    fake_response = MagicMock()
    fake_response.raise_for_status = MagicMock()
    fake_response.content = b"\xff\xd8\xff photo"
    fake_response.headers = {"content-type": "image/jpeg"}
    monkeypatch.setattr(httpx.AsyncClient, "get", AsyncMock(return_value=fake_response))

    _fake_identity_service(monkeypatch, compare_faces=AsyncMock(return_value={
        "match": True, "confidence": 0.9, "reason": "match",
    }))
    r2 = await client.post(
        "/verification/identity/upload-selfie",
        files={"file": ("selfie.jpg", b"\xff\xd8\xff selfie", "image/jpeg")},
        headers=auth(user),
    )
    assert r2.status_code == 200, r2.text

    async with sessionmaker_() as s:
        from app.models.user import User as U
        refreshed = await s.get(U, user.id)
        assert refreshed.identity_verified is True


@pytest.mark.asyncio
async def test_admin_reject_purges_document_and_notifies(client, sessionmaker_, monkeypatch):
    user = await make_user(sessionmaker_, role="tenant")
    admin = await make_user(sessionmaker_, role="admin")
    await _queue_for_review(client, user, monkeypatch)

    r = await client.post(
        f"/admin/verifications/{user.id}/reject?type=identity",
        headers=auth(admin),
        json={"reason": "Not a legible government ID"},
    )
    assert r.status_code == 200, r.text

    async with sessionmaker_() as s:
        from app.models.user import User as U
        refreshed = await s.get(U, user.id)
        assert refreshed.identity_status == "rejected"
        assert refreshed.identity_data["rejection_reason"] == "Not a legible government ID"
        assert "storage_key" not in refreshed.identity_data

    # Notified in-app.
    async with sessionmaker_() as s:
        from sqlalchemy import select
        from app.models.notification import Notification
        notif = (
            await s.execute(select(Notification).where(Notification.user_id == user.id))
        ).scalars().all()
        assert any("rejected" in n.title.lower() for n in notif)


@pytest.mark.asyncio
async def test_reset_purges_the_retained_document(client, sessionmaker_, monkeypatch):
    """A stress-test-adjacent regression: reset used to wipe identity_data
    without deleting the underlying stored document, orphaning it — now a
    24h-retained manual-review document, not just a 10-minute one."""
    user = await make_user(sessionmaker_, role="tenant")
    admin = await make_user(sessionmaker_, role="admin")
    await _queue_for_review(client, user, monkeypatch)
    real_storage = _fake_storage(monkeypatch)

    r = await client.post(
        f"/admin/verifications/{user.id}/reset?type=identity", headers=auth(admin)
    )
    assert r.status_code == 200, r.text
    real_storage.delete_file.assert_awaited_once_with("test/key")


@pytest.mark.asyncio
async def test_approve_refuses_when_nothing_is_pending_review(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    admin = await make_user(sessionmaker_, role="admin")

    r = await client.post(
        f"/admin/verifications/{user.id}/approve?type=identity", headers=auth(admin)
    )
    assert r.status_code == 400
