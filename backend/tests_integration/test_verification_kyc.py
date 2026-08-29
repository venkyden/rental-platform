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
from unittest.mock import AsyncMock, patch

import pytest

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
async def test_webhook_no_secret_returns_503(client, monkeypatch):
    """When VERIFICATION_WEBHOOK_SECRET is not configured the endpoint is closed."""
    monkeypatch.delenv("VERIFICATION_WEBHOOK_SECRET", raising=False)
    payload = json.dumps({
        "event": "verification.failed",
        "user_id": str(uuid.uuid4()),
        "verification_type": "identity",
        "status": "rejected",
        "data": {},
    }).encode()

    r = await client.post(
        "/webhooks/verification/callback",
        content=payload,
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 503


# ── 3. side="back" bypass removed ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_identity_back_side_no_longer_auto_approves(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")

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

    from fastapi import HTTPException as _HTTPException
    with patch(
        "app.routers.verification._check_upload_rate_limit",
        side_effect=_HTTPException(status_code=429, detail="Rate limit exceeded."),
    ):
        r = await client.post(
            "/verification/identity/upload?document_type=passport",
            files={"file": ("id.jpg", b"content", "image/jpeg")},
            headers=auth(user),
        )
    assert r.status_code == 429


# ── 6. Visale certificate upload ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_visale_cert_upload_verified(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    from app.services.guarantor_compliance import GuarantorCertData
    from datetime import date

    with patch("app.services.employment.employment_service") as mock_svc, \
         patch("app.services.storage.storage", _fake_storage()), \
         patch("app.routers.verification.apply_watermark", return_value=b"wm"):
        mock_svc.extract_guarantor_cert = AsyncMock(return_value=GuarantorCertData(
            cert_id="VS-2026-123",
            guaranteed_amount=1200.0,
            validity_date=date(2027, 1, 1),
            tenant_name="Tenant User",
            institution="Visale",
        ))
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
    from app.services.guarantor_compliance import GuarantorCertData
    from datetime import date

    with patch("app.services.employment.employment_service") as mock_svc:
        mock_svc.extract_guarantor_cert = AsyncMock(return_value=GuarantorCertData(
            cert_id="VS-2026-123",
            guaranteed_amount=1200.0,
            validity_date=date(2027, 1, 1),
            tenant_name="Mismatched Name",
            institution="Visale",
        ))
        r = await client.post(
            "/verification/guarantor/visale",
            files={"file": ("fake.jpg", b"not a cert", "image/jpeg")},
            headers=auth(user),
        )

    assert r.status_code == 422
    assert "name" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_visale_upload_rate_limited(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")

    from fastapi import HTTPException as _HTTPException
    with patch(
        "app.routers.verification._check_upload_rate_limit",
        side_effect=_HTTPException(status_code=429, detail="Rate limit exceeded."),
    ):
        r = await client.post(
            "/verification/guarantor/visale",
            files={"file": ("visale_cert.pdf", b"%PDF content", "application/pdf")},
            headers=auth(user),
        )
    assert r.status_code == 429


# ── 7. Garantme certificate upload ────────────────────────────────────────

@pytest.mark.asyncio
async def test_garantme_cert_upload_verified(client, sessionmaker_):
    user = await make_user(sessionmaker_, role="tenant")
    from app.services.guarantor_compliance import GuarantorCertData
    from datetime import date

    with patch("app.services.employment.employment_service") as mock_svc, \
         patch("app.services.storage.storage", _fake_storage()), \
         patch("app.routers.verification.apply_watermark", return_value=b"wm"):
        mock_svc.extract_guarantor_cert = AsyncMock(return_value=GuarantorCertData(
            cert_id="GM-2026-456",
            guaranteed_amount=1000.0,
            validity_date=date(2027, 1, 1),
            tenant_name="Tenant User",
            institution="Garantme",
        ))
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

    with patch("app.services.employment.employment_service") as mock_svc:
        mock_svc.extract_guarantor_cert = AsyncMock(return_value=None)
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

    from fastapi import HTTPException as _HTTPException
    with patch(
        "app.routers.verification._check_upload_rate_limit",
        side_effect=_HTTPException(status_code=429, detail="Rate limit exceeded."),
    ):
        r = await client.post(
            "/verification/guarantor/garantme",
            files={"file": ("cert.pdf", b"%PDF content", "application/pdf")},
            headers=auth(user),
        )
    assert r.status_code == 429


# ── 8. selfie_with_id — authenticated upload endpoint ─────────────────────

@pytest.mark.asyncio
async def test_selfie_with_id_auth_success(client, sessionmaker_):
    """Happy path: AI passes → identity_verified=True in one shot."""
    user = await make_user(sessionmaker_, role="tenant")

    with patch("app.services.identity.identity_service") as mock_svc, \
         patch("app.services.storage.storage", _fake_storage()), \
         patch("app.routers.verification.apply_watermark", return_value=b"wm"):
        mock_svc.verify_selfie_with_id = AsyncMock(return_value={
            "verified": True, "status": "verified",
            "data": {"full_name": "Tenant User", "document_number": "AB123456",
                     "document_type": "passport", "confidence_score": 0.92,
                     "is_same_person": True, "verification_method": "selfie_with_id"},
            "validation_checks": [], "rejection_reason": None,
        })
        r = await client.post(
            "/verification/identity/upload?document_type=passport",
            files={"file": ("selfie_id.jpg", b"\xff\xd8\xff photo", "image/jpeg")},
            data={"side": "selfie_with_id"},
            headers=auth(user),
        )

    assert r.status_code == 200
    body = r.json()
    assert body["verified"] is True
    assert body["status"] == "verified"
    assert body["trust_score"] >= 80   # started at 50, gained +30


@pytest.mark.asyncio
async def test_selfie_with_id_auth_ai_rejected(client, sessionmaker_):
    """AI rejects (face mismatch) → 400, user not verified."""
    user = await make_user(sessionmaker_, role="tenant")

    with patch("app.services.identity.identity_service") as mock_svc:
        mock_svc.verify_selfie_with_id = AsyncMock(return_value={
            "verified": False, "status": "rejected",
            "data": None, "validation_checks": [],
            "rejection_reason": "Live face does not match face on ID",
        })
        r = await client.post(
            "/verification/identity/upload?document_type=id_card",
            files={"file": ("bad.jpg", b"garbage", "image/jpeg")},
            data={"side": "selfie_with_id"},
            headers=auth(user),
        )

    assert r.status_code == 400
    assert "Live face does not match" in r.json()["detail"]


@pytest.mark.asyncio
async def test_selfie_with_id_auth_ai_unavailable_fails_closed(client, sessionmaker_):
    """AI down → status='error' → 503, user NOT marked verified.

    A trust product must never fabricate a verified fact when its verifier is
    down (fail closed; audit 2026-07-05). The old contract returned verified=True
    on failure, which could mint a MEDIUM identity credential with no face-match.
    """
    user = await make_user(sessionmaker_, role="tenant")

    with patch("app.services.identity.identity_service") as mock_svc, \
         patch("app.services.storage.storage", _fake_storage()), \
         patch("app.routers.verification.apply_watermark", return_value=b"wm"):
        mock_svc.verify_selfie_with_id = AsyncMock(return_value={
            "verified": False, "status": "error",
            "data": None, "validation_checks": [], "rejection_reason": "verification_service_unavailable",
        })
        r = await client.post(
            "/verification/identity/upload?document_type=passport",
            files={"file": ("selfie_id.jpg", b"\xff\xd8\xff photo", "image/jpeg")},
            data={"side": "selfie_with_id"},
            headers=auth(user),
        )

    assert r.status_code == 503
    async with sessionmaker_() as s:
        from app.models.user import User as U
        refreshed = await s.get(U, user.id)
        assert refreshed.identity_verified is False
        assert refreshed.identity_status != "verified"


@pytest.mark.asyncio
async def test_selfie_with_id_invalid_file_type(client, sessionmaker_):
    """Non-image MIME type must be rejected before reaching AI."""
    user = await make_user(sessionmaker_, role="tenant")

    r = await client.post(
        "/verification/identity/upload?document_type=passport",
        files={"file": ("selfie.html", b"<html>", "text/html")},
        data={"side": "selfie_with_id"},
        headers=auth(user),
    )
    assert r.status_code == 400
    assert "Invalid file type" in r.json()["detail"]


@pytest.mark.asyncio
async def test_selfie_with_id_rate_limited(client, sessionmaker_):
    """selfie_with_id uploads count against the identity rate limit."""
    user = await make_user(sessionmaker_, role="tenant")

    from fastapi import HTTPException as _HTTPException
    with patch(
        "app.routers.verification._check_upload_rate_limit",
        side_effect=_HTTPException(status_code=429, detail="Rate limit exceeded."),
    ):
        r = await client.post(
            "/verification/identity/upload?document_type=passport",
            files={"file": ("selfie_id.jpg", b"\xff\xd8\xff", "image/jpeg")},
            data={"side": "selfie_with_id"},
            headers=auth(user),
        )
    assert r.status_code == 429


@pytest.mark.asyncio
async def test_selfie_with_id_trust_score_capped_at_100(client, sessionmaker_):
    """Re-verifying when already verified must not push trust_score past 100."""
    user = await make_user(sessionmaker_, role="tenant")
    user.trust_score = 95
    user.identity_verified = True
    async with sessionmaker_() as session:
        session.add(user)
        await session.commit()
        await session.refresh(user)

    with patch("app.services.identity.identity_service") as mock_svc, \
         patch("app.services.storage.storage", _fake_storage()), \
         patch("app.routers.verification.apply_watermark", return_value=b"wm"):
        mock_svc.verify_selfie_with_id = AsyncMock(return_value={
            "verified": True, "status": "verified",
            "data": {}, "validation_checks": [], "rejection_reason": None,
        })
        r = await client.post(
            "/verification/identity/upload?document_type=passport",
            files={"file": ("selfie_id.jpg", b"\xff\xd8\xff", "image/jpeg")},
            data={"side": "selfie_with_id"},
            headers=auth(user),
        )

    assert r.status_code == 200
    assert r.json()["trust_score"] <= 100


# ── 9. selfie_with_id — mobile session endpoint ───────────────────────────

@pytest.mark.asyncio
async def test_selfie_with_id_mobile_session_success(client, sessionmaker_):
    """Mobile QR flow: upload marks session completed and user verified."""
    user = await make_user(sessionmaker_, role="tenant")

    r = await client.post("/verification/identity/session", headers=auth(user))
    assert r.status_code == 200
    code = r.json()["verification_code"]

    with patch("app.services.identity.identity_service") as mock_svc, \
         patch("app.services.storage.storage", _fake_storage()), \
         patch("app.routers.verification.apply_watermark", return_value=b"wm"):
        mock_svc.verify_selfie_with_id = AsyncMock(return_value={
            "verified": True, "status": "verified",
            "data": {"full_name": "Tenant User", "document_type": "passport",
                     "confidence_score": 0.88, "is_same_person": True},
            "validation_checks": [], "rejection_reason": None,
        })
        r = await client.post(
            f"/verification/identity/upload-mobile?verification_code={code}&document_type=passport&side=selfie_with_id",
            files={"file": ("selfie_id.jpg", b"\xff\xd8\xff photo data", "image/jpeg")},
        )

    assert r.status_code == 200
    assert r.json()["verified"] is True
    assert r.json()["status"] == "verified"

    status_r = await client.get(f"/verification/identity/session/{code}/status")
    assert status_r.json()["completed"] is True


@pytest.mark.asyncio
async def test_selfie_with_id_mobile_session_rejected(client, sessionmaker_):
    """Mobile QR flow: AI rejection returns 400 and session stays open for retry."""
    user = await make_user(sessionmaker_, role="tenant")

    r = await client.post("/verification/identity/session", headers=auth(user))
    code = r.json()["verification_code"]

    with patch("app.services.identity.identity_service") as mock_svc:
        mock_svc.verify_selfie_with_id = AsyncMock(return_value={
            "verified": False, "status": "rejected",
            "data": None, "validation_checks": [],
            "rejection_reason": "No live face detected — ensure your face is fully in frame",
        })
        r = await client.post(
            f"/verification/identity/upload-mobile?verification_code={code}&document_type=id_card&side=selfie_with_id",
            files={"file": ("bad.jpg", b"garbage", "image/jpeg")},
        )

    assert r.status_code == 400
    assert "No live face detected" in r.json()["detail"]

    status_r = await client.get(f"/verification/identity/session/{code}/status")
    assert status_r.json()["completed"] is False


@pytest.mark.asyncio
async def test_selfie_with_id_mobile_expired_session(client, sessionmaker_):
    """Uploading to an unknown session code returns 404."""
    r = await client.post(
        "/verification/identity/upload-mobile?verification_code=nonexistent&document_type=passport&side=selfie_with_id",
        files={"file": ("selfie_id.jpg", b"\xff\xd8\xff", "image/jpeg")},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_selfie_with_id_mobile_already_completed(client, sessionmaker_):
    """Re-uploading to a completed session is rejected with 400."""
    user = await make_user(sessionmaker_, role="tenant")

    r = await client.post("/verification/identity/session", headers=auth(user))
    code = r.json()["verification_code"]

    with patch("app.services.identity.identity_service") as mock_svc, \
         patch("app.services.storage.storage", _fake_storage()), \
         patch("app.routers.verification.apply_watermark", return_value=b"wm"):
        mock_svc.verify_selfie_with_id = AsyncMock(return_value={
            "verified": True, "status": "verified",
            "data": {}, "validation_checks": [], "rejection_reason": None,
        })
        await client.post(
            f"/verification/identity/upload-mobile?verification_code={code}&document_type=passport&side=selfie_with_id",
            files={"file": ("selfie_id.jpg", b"\xff\xd8\xff", "image/jpeg")},
        )

    r = await client.post(
        f"/verification/identity/upload-mobile?verification_code={code}&document_type=passport&side=selfie_with_id",
        files={"file": ("selfie_id.jpg", b"\xff\xd8\xff", "image/jpeg")},
    )
    assert r.status_code == 400
    assert "already completed" in r.json()["detail"]


# ── 10. back-side upload — stores file, never approves ────────────────────

@pytest.mark.asyncio
async def test_back_side_stores_without_marking_verified(client, sessionmaker_):
    """side=back stores supplementary file, preserves front file_url, user stays unverified."""
    user = await make_user(sessionmaker_, role="tenant")

    user.identity_data = {
        "verified": False,
        "file_url": "https://r2.test/front.jpg",
        "status": "document_uploaded",
    }
    async with sessionmaker_() as session:
        session.add(user)
        await session.commit()

    with patch("app.services.storage.storage", _fake_storage()), \
         patch("app.routers.verification.apply_watermark", return_value=b"wm"):
        r = await client.post(
            "/verification/identity/upload?document_type=id_card",
            files={"file": ("back.jpg", b"\xff\xd8\xff", "image/jpeg")},
            data={"side": "back"},
            headers=auth(user),
        )

    assert r.status_code == 200

    async with sessionmaker_() as session:
        from sqlalchemy import select
        from app.models.user import User as UserModel
        result = await session.execute(select(UserModel).where(UserModel.id == user.id))
        refreshed = result.scalar_one()

    assert refreshed.identity_verified is False
    assert refreshed.identity_data["file_url"] == "https://r2.test/front.jpg"
    # PR #4 statelessness: back side is processed transiently, not stored in R2
    assert "back_file_url" not in refreshed.identity_data


# ── 11. AI extraction failure on front → queued for manual review, never a silent accept ──

@pytest.mark.asyncio
async def test_front_upload_ai_unavailable_queues_for_manual_review(client, sessionmaker_):
    """AI extraction failure (outage, misconfiguration, or all retries exhausted) must
    never silently accept the document, and must never fully block with no recourse
    either — it's queued for a human admin to review (see test_identity_manual_review.py).

    Regression: this used to return verified=True/status=pending_review directly to
    the caller with NO real review queue behind it — the manual-review path had been
    removed by the GDPR statelessness retrofit (no source document was retained), but
    this fallback was never tightened to match: it kept silently accepting ANY image
    as the front document. Chained with a matching selfie (compare_faces only checks
    face similarity, not document authenticity), this let a user reach
    identity_verified=True having never had a real ID checked by AI or a human. Fixed
    by actually building the human fallback: bounded-retention manual review (see
    app/routers/admin.py's /verifications/{id}/{approve,reject,identity-document}).
    """
    user = await make_user(sessionmaker_, role="tenant")

    with patch("app.services.identity.identity_service") as mock_svc, \
         patch("app.routers.verification.apply_watermark", return_value=b"wm"):
        mock_svc.verify_document = AsyncMock(return_value={
            "verified": False, "status": "error",
            "data": None, "validation_checks": [], "rejection_reason": "verification_service_unavailable",
        })
        r = await client.post(
            "/verification/identity/upload?document_type=passport",
            files={"file": ("blurry.jpg", b"\xff\xd8\xff blurry", "image/jpeg")},
            data={"side": "front"},
            headers=auth(user),
        )

    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending_manual_review"
    async with sessionmaker_() as s:
        from app.models.user import User as U
        refreshed = await s.get(U, user.id)
        assert refreshed.identity_status == "pending_manual_review"
        assert refreshed.identity_verified is False


@pytest.mark.asyncio
async def test_full_attack_chain_blocked_when_front_extraction_fails(client, sessionmaker_):
    """End-to-end: an attacker uploads a non-ID image as the "front document" while
    OCR extraction is down, then a selfie of themselves — compare_faces alone can't
    catch this (it only checks face similarity, not document authenticity), so the
    only thing stopping identity_verified=True is the front step correctly refusing
    to ever accept the "document" as validated, queuing it for manual review instead."""
    user = await make_user(sessionmaker_, role="tenant")

    with patch("app.services.identity.identity_service") as mock_svc, \
         patch("app.routers.verification.apply_watermark", return_value=b"wm"):
        mock_svc.verify_document = AsyncMock(return_value={
            "verified": False, "status": "error",
            "data": None, "validation_checks": [], "rejection_reason": "verification_service_unavailable",
        })
        r1 = await client.post(
            "/verification/identity/upload?document_type=passport",
            files={"file": ("not_an_id.jpg", b"\xff\xd8\xff selfie-not-id", "image/jpeg")},
            data={"side": "front"},
            headers=auth(user),
        )
        assert r1.status_code == 200, r1.text
        assert r1.json()["status"] == "pending_manual_review"

        # compare_faces would happily "match" — same face in both images — but
        # the selfie step must never be reachable while status stays pending
        # review (not document_uploaded), regardless of what compare_faces says.
        mock_svc.compare_faces = AsyncMock(return_value={
            "match": True, "confidence": 0.95, "reason": "same person",
        })
        r2 = await client.post(
            "/verification/identity/upload-selfie",
            files={"file": ("same_selfie.jpg", b"\xff\xd8\xff selfie-not-id", "image/jpeg")},
            headers=auth(user),
        )

    assert r2.status_code == 400
    assert "before submitting a selfie" in r2.json()["detail"]

    async with sessionmaker_() as s:
        from app.models.user import User as U
        refreshed = await s.get(U, user.id)
        assert refreshed.identity_verified is False


@pytest.mark.asyncio
async def test_biometric_consent_gate_403_without_consent(client, sessionmaker_):
    """Real-DB proof of the Art. 9 gate: no consent row -> selfie upload 403."""
    user = await make_user(sessionmaker_, role="tenant", biometric_consent=False)
    r = await client.post(
        "/verification/identity/upload?document_type=id_card",
        headers=auth(user),
        data={"side": "selfie_with_id"},
        files={"file": ("id.jpg", b"\xff\xd8\xff fake-jpeg", "image/jpeg")},
    )
    assert r.status_code == 403, r.text
    assert r.json()["detail"]["code"] == "BIOMETRIC_CONSENT_REQUIRED"

    # Recording consent via the real endpoint clears the gate
    r2 = await client.post("/verification/biometric-consent", headers=auth(user))
    assert r2.status_code == 201, r2.text
    r3 = await client.post(
        "/verification/identity/upload?document_type=id_card",
        headers=auth(user),
        data={"side": "selfie_with_id"},
        files={"file": ("id.jpg", b"\xff\xd8\xff fake-jpeg", "image/jpeg")},
    )
    assert r3.status_code != 403, r3.text
