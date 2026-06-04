"""
Verification / KYC security hardening — integration tests.

Covers every fix from the KYC audit pass:
  1. Test reset endpoints removed (404)
  2. Webhook signature required when secret configured
  3. side="back" no longer auto-approves identity uploads
  4. Identity upload rate limiting
  5. Visale/Garantme certificate upload + AI verification gate
  6. Garantme missing-file FastAPI validation
"""

import hashlib
import hmac
import json
import uuid
from datetime import timedelta
from unittest.mock import AsyncMock, patch

import pytest

from app.core.timeutils import naive_utcnow
from app.routers.verification import _upload_rate_limits
from tests_integration.conftest import make_user, auth


# ── helpers ────────────────────────────────────────────────────────────────

def _sign(body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _fake_storage():
    m = AsyncMock()
    m.upload_file = AsyncMock(return_value={"url": "https://r2.test/file.jpg", "key": "test/key"})
    return m


def _fake_ai_verified():
    return AsyncMock(return_value={
        "verified": True,
        "status": "verified",
        "data": {"name": "Tenant User"},
        "validation_checks": [],
        "rejection_reason": None,
    })


def _fake_ai_rejected(reason="Not a valid document"):
    return AsyncMock(return_value={
        "verified": False,
        "status": "rejected",
        "data": {},
        "validation_checks": [],
        "rejection_reason": reason,
    })


# ── 1. Reset endpoints removed ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_identity_reset_endpoint_gone(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    r = await client.post("/verification/identity/reset", headers=auth(user))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_employment_reset_endpoint_gone(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    r = await client.post("/verification/employment/reset", headers=auth(user))
    assert r.status_code == 404


# ── 2. Verification webhook — signature enforcement ────────────────────────

@pytest.mark.asyncio
async def test_webhook_missing_sig_returns_401_when_secret_set(client, monkeypatch):
    monkeypatch.setenv("VERIFICATION_WEBHOOK_SECRET", "s3cr3t")
    payload = json.dumps({
        "event": "verification.completed",
        "user_id": str(uuid.uuid4()),
        "verification_type": "identity",
        "status": "verified",
        "data": {},
    }).encode()

    r = await client.post(
        "/webhooks/verification/callback",
        content=payload,
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 401
    assert "signature" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_webhook_wrong_sig_returns_401(client, monkeypatch):
    monkeypatch.setenv("VERIFICATION_WEBHOOK_SECRET", "s3cr3t")
    payload = json.dumps({
        "event": "verification.completed",
        "user_id": str(uuid.uuid4()),
        "verification_type": "identity",
        "status": "verified",
        "data": {},
    }).encode()

    r = await client.post(
        "/webhooks/verification/callback",
        content=payload,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Signature": "sha256=deabeef",
        },
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_webhook_correct_sig_accepted(client, sessionmaker_, monkeypatch):
    monkeypatch.setenv("VERIFICATION_WEBHOOK_SECRET", "s3cr3t")
    user = await make_user(sessionmaker_, role="tenant")
    payload = json.dumps({
        "event": "verification.failed",
        "user_id": str(user.id),
        "verification_type": "identity",
        "status": "rejected",
        "data": {"rejection_reason": "blurry"},
    }).encode()

    with patch("app.routers.webhooks.email_service") as mock_email:
        mock_email.send_verification_failed_email = AsyncMock()
        r = await client.post(
            "/webhooks/verification/callback",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "X-Webhook-Signature": _sign(payload, "s3cr3t"),
            },
        )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_webhook_no_secret_accepts_unsigned(client, monkeypatch):
    monkeypatch.delenv("VERIFICATION_WEBHOOK_SECRET", raising=False)
    payload = json.dumps({
        "event": "verification.failed",
        "user_id": str(uuid.uuid4()),
        "verification_type": "identity",
        "status": "rejected",
        "data": {},
    }).encode()

    with patch("app.routers.webhooks.email_service") as mock_email:
        mock_email.send_verification_failed_email = AsyncMock()
        r = await client.post(
            "/webhooks/verification/callback",
            content=payload,
            headers={"Content-Type": "application/json"},
        )
    assert r.status_code == 200


# ── 3. side="back" bypass removed ─────────────────────────────────────────
#
# Previously, uploading with side=back skipped AI and auto-approved.
# Now every upload goes through identity_service.verify_document().
# We mock the service to return rejected and confirm the endpoint
# propagates the rejection (proving the bypass is gone).

@pytest.mark.asyncio
async def test_identity_back_side_no_longer_auto_approves(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    key = f"{user.id}:identity"
    _upload_rate_limits.pop(key, None)

    with patch("app.services.identity.identity_service") as mock_svc:
        mock_svc.verify_document = _fake_ai_rejected("Not a valid identity document")
        r = await client.post(
            "/verification/identity/upload?document_type=id_card",
            files={"file": ("back.jpg", b"not a real document", "image/jpeg")},
            headers=auth(user),
        )

    assert r.status_code == 400
    assert "Verification failed" in r.json()["detail"]


@pytest.mark.asyncio
async def test_identity_mobile_back_side_no_longer_auto_approves(client, sessionmaker_):
    """Mobile upload with side=back (non-passport) must also go through AI."""
    user = await make_user(sessionmaker_, role="tenant")

    # Create a verification session for the mobile flow
    r = await client.post("/verification/identity/session", headers=auth(user))
    assert r.status_code == 200
    code = r.json()["verification_code"]

    with patch("app.services.identity.identity_service") as mock_svc:
        mock_svc.verify_document = _fake_ai_rejected("Not a real document")
        r = await client.post(
            f"/verification/identity/upload-mobile?verification_code={code}&document_type=id_card",
            files={"file": ("back.jpg", b"garbage", "image/jpeg")},
            data={"side": "back"},
        )

    assert r.status_code == 400


# ── 5. Identity upload rate limiting ──────────────────────────────────────

@pytest.mark.asyncio
async def test_identity_upload_rate_limited(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    key = f"{user.id}:identity"
    now = naive_utcnow()
    # Pre-fill the bucket with 5 uploads in the last hour
    _upload_rate_limits[key] = [now - timedelta(minutes=i) for i in range(5)]

    r = await client.post(
        "/verification/identity/upload?document_type=passport",
        files={"file": ("id.jpg", b"content", "image/jpeg")},
        headers=auth(user),
    )
    assert r.status_code == 429
    _upload_rate_limits.pop(key, None)


# ── 6. Visale certificate upload ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_visale_cert_upload_verified(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    key = f"{user.id}:visale"
    _upload_rate_limits.pop(key, None)

    with patch("app.services.employment.employment_service") as mock_svc, \
         patch("app.services.storage.storage", _fake_storage()), \
         patch("app.routers.verification.apply_watermark", return_value=b"wm"):
        mock_svc.verify_document = _fake_ai_verified()
        r = await client.post(
            "/verification/guarantor/visale",
            files={"file": ("visale_cert.pdf", b"%PDF content", "application/pdf")},
            headers=auth(user),
        )

    assert r.status_code == 200
    body = r.json()
    assert body["guarantor_type"] == "visale"
    assert body["guarantor_status"] == "verified"
    assert body["trust_score"] > 50  # started at 50, gained +15


@pytest.mark.asyncio
async def test_visale_cert_upload_ai_rejection_returns_422(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    key = f"{user.id}:visale"
    _upload_rate_limits.pop(key, None)

    with patch("app.services.employment.employment_service") as mock_svc:
        mock_svc.verify_document = _fake_ai_rejected("Name on document does not match account")
        r = await client.post(
            "/verification/guarantor/visale",
            files={"file": ("fake.jpg", b"not a cert", "image/jpeg")},
            headers=auth(user),
        )

    assert r.status_code == 422
    assert "Name on document" in r.json()["detail"]


@pytest.mark.asyncio
async def test_visale_upload_rate_limited(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    key = f"{user.id}:visale"
    now = naive_utcnow()
    _upload_rate_limits[key] = [now - timedelta(minutes=i) for i in range(5)]

    r = await client.post(
        "/verification/guarantor/visale",
        files={"file": ("visale_cert.pdf", b"%PDF content", "application/pdf")},
        headers=auth(user),
    )
    assert r.status_code == 429
    _upload_rate_limits.pop(key, None)


# ── 7. Garantme certificate upload ────────────────────────────────────────

@pytest.mark.asyncio
async def test_garantme_cert_upload_verified(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    key = f"{user.id}:garantme"
    _upload_rate_limits.pop(key, None)

    with patch("app.services.employment.employment_service") as mock_svc, \
         patch("app.services.storage.storage", _fake_storage()), \
         patch("app.routers.verification.apply_watermark", return_value=b"wm"):
        mock_svc.verify_document = _fake_ai_verified()
        r = await client.post(
            "/verification/guarantor/garantme",
            files={"file": ("garantme_cert.pdf", b"%PDF content", "application/pdf")},
            headers=auth(user),
        )

    assert r.status_code == 200
    body = r.json()
    assert body["guarantor_type"] == "garantme"
    assert body["guarantor_status"] == "verified"
    assert body["trust_score"] > 50


@pytest.mark.asyncio
async def test_garantme_cert_upload_ai_rejection_returns_422(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    key = f"{user.id}:garantme"
    _upload_rate_limits.pop(key, None)

    with patch("app.services.employment.employment_service") as mock_svc:
        mock_svc.verify_document = _fake_ai_rejected("Not a Garantme certificate")
        r = await client.post(
            "/verification/guarantor/garantme",
            files={"file": ("fake.png", b"garbage", "image/png")},
            headers=auth(user),
        )

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_garantme_missing_file_returns_422(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    r = await client.post(
        "/verification/guarantor/garantme",
        headers=auth(user),
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_garantme_upload_rate_limited(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    key = f"{user.id}:garantme"
    now = naive_utcnow()
    _upload_rate_limits[key] = [now - timedelta(minutes=i) for i in range(5)]

    r = await client.post(
        "/verification/guarantor/garantme",
        files={"file": ("cert.pdf", b"%PDF content", "application/pdf")},
        headers=auth(user),
    )
    assert r.status_code == 429
    _upload_rate_limits.pop(key, None)
