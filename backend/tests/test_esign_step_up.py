"""E-sign step-up: a one-time code emailed to the signer gates /sign.

Before this, signing needed only the session token plus consent=true and a
typed name, so a script running in the page — or a stolen access token —
could sign a lease as the user. The code is bound to the lease, the signer
and the exact document hash, expires, and allows a few attempts.
"""

import hashlib
import types
import uuid
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.timeutils import utcnow
from app.main import app
from app.routers import esign as esign_router
from app.routers.auth import get_current_user

PDF = b"%PDF-1.4 lease body"


@pytest.fixture
def tenant():
    return types.SimpleNamespace(
        id=uuid.uuid4(), email="tenant@example.com", full_name="Jean Dupont",
        identity_verified=True, is_active=True,
    )


@pytest.fixture
def lease(tenant):
    return types.SimpleNamespace(
        id=uuid.uuid4(), property_id=uuid.uuid4(), landlord_id=uuid.uuid4(), tenant_id=tenant.id,
        document_hash=hashlib.sha256(PDF).hexdigest(), pdf_path="leases/x.pdf",
        document_source="uploaded", status="awaiting_signatures",
        signature_data={"esign_audit": [], "legality": None},
        landlord_signature=None, tenant_signature=None, esign_manifest=None,
    )


@pytest.fixture
def sent_codes(monkeypatch):
    codes = []

    async def fake_send(to_email, code, full_name):
        codes.append(code)
        return True

    monkeypatch.setattr(esign_router.email_service, "send_esign_code", fake_send)
    return codes


@pytest.fixture
def client(tenant, lease, monkeypatch, sent_codes):
    monkeypatch.setattr(esign_router.storage, "download_file", AsyncMock(return_value=PDF))
    limiter.reset()

    async def db_with_lease():
        session = MagicMock()
        session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=lease)))
        session.commit = AsyncMock()
        yield session

    target = app.app if hasattr(app, "app") else app
    target.dependency_overrides[get_db] = db_with_lease
    target.dependency_overrides[get_current_user] = lambda: tenant
    yield TestClient(app, base_url="http://testserver/api/v1")
    target.dependency_overrides.clear()
    limiter.reset()


def _sign(client, lease, code=None):
    body = {"typed_name": "Jean Dupont", "consent": True}
    if code is not None:
        body["code"] = code
    return client.post(f"/esign/leases/{lease.id}/sign", json=body)


def _request_code(client, lease):
    return client.post(f"/esign/leases/{lease.id}/sign-code")


def test_signing_without_a_code_is_refused(client, lease):
    resp = _sign(client, lease)
    assert resp.status_code == 400
    assert lease.tenant_signature is None


def test_the_code_is_emailed_and_only_its_digest_is_stored(client, lease, sent_codes):
    assert _request_code(client, lease).status_code == 200
    [code] = sent_codes
    assert len(code) == 6 and code.isdigit()
    stored = lease.signature_data["step_up"]["tenant"]
    assert code not in str(stored)


def test_the_right_code_signs_once_and_is_recorded(client, lease, sent_codes):
    _request_code(client, lease)
    resp = _sign(client, lease, sent_codes[-1])
    assert resp.status_code == 200, resp.text
    assert lease.tenant_signature == "typed:Jean Dupont"
    assert "tenant" not in lease.signature_data.get("step_up", {})
    [entry] = lease.signature_data["esign_audit"]
    assert entry["step_up"] == "email_code"


def test_wrong_codes_lock_after_five_attempts(client, lease, sent_codes):
    _request_code(client, lease)
    code = sent_codes[-1]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        assert _sign(client, lease, wrong).status_code == 400
    assert _sign(client, lease, code).status_code == 400  # locked: ask for a new code
    assert lease.tenant_signature is None


def test_an_expired_code_is_refused(client, lease, sent_codes):
    _request_code(client, lease)
    lease.signature_data["step_up"]["tenant"]["expires_at"] = (utcnow() - timedelta(seconds=1)).isoformat()
    assert _sign(client, lease, sent_codes[-1]).status_code == 400
    assert lease.tenant_signature is None


def test_a_code_does_not_survive_a_new_document(client, lease, sent_codes):
    _request_code(client, lease)
    lease.document_hash = hashlib.sha256(b"%PDF-1.4 another lease").hexdigest()
    esign_router.storage.download_file.return_value = b"%PDF-1.4 another lease"
    assert _sign(client, lease, sent_codes[-1]).status_code == 400
    assert lease.tenant_signature is None


def test_a_non_party_cannot_request_a_code(client, lease, tenant, sent_codes):
    lease.tenant_id = uuid.uuid4()
    assert _request_code(client, lease).status_code == 403
    assert sent_codes == []
