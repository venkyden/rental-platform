"""
Full HTTP round trip for the credential layer with REAL Ed25519 signing:

    POST /credentials/issue-mine  (authenticated)
        → GET /credentials/{id}   (public, no auth)

The store is faked (stateful in-memory session) but nothing else is mocked:
the actual CredentialService signs at issuance and verifies on the public
endpoint. Also covers tampering (signature must break) and revocation.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.routers.auth import get_current_user

from tests.conftest import make_mock_user


class FakeCredentialSession:
    """Minimal stateful stand-in for the async session: keeps Credential rows
    added by issue-mine so the public verify endpoint can read them back."""

    def __init__(self):
        self.rows = {}

    def add(self, row):
        self.rows[row.id] = row

    async def flush(self):
        pass

    async def commit(self):
        pass

    async def refresh(self, _obj=None):
        pass

    async def close(self):
        pass

    async def scalar(self, stmt):
        # Single-credential tests: match on the literal id bound in the WHERE
        # clause when extractable, else fall back to the only stored row.
        try:
            wanted = stmt.whereclause.right.value
            return self.rows.get(wanted)
        except AttributeError:
            return next(iter(self.rows.values()), None)


def make_verified_user():
    user = make_mock_user(role="tenant")
    user.full_name = "Test Tenant"
    user.identity_data = {"identity_assurance": "MEDIUM", "identity_source": "ocr_liveness"}
    user.income_data = {}
    user.ownership_data = {}
    user.insurance_data = {}
    user.deposit_binding_data = {}
    user.ownership_verified = False
    return user


def make_client(session: FakeCredentialSession, user):
    target_app = app.app if hasattr(app, "app") else app

    def fake_get_db():
        yield session

    target_app.dependency_overrides[get_current_user] = lambda: user
    target_app.dependency_overrides[get_db] = fake_get_db
    return TestClient(app)


def _issue(client) -> dict:
    res = client.post("/credentials/issue-mine")
    assert res.status_code == 201, res.text
    return res.json()


def test_issue_then_public_verify_round_trip():
    session = FakeCredentialSession()
    client = make_client(session, make_verified_user())

    issued = _issue(client)
    assert issued["claims"]["identity_assurance"] == "MEDIUM"
    assert issued["shareable_url"].endswith(f"/c/{issued['credential_id']}")

    # Public verify — the real signature check runs against the stored row
    res = client.get(f"/credentials/{issued['credential_id']}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["signature_valid"] is True
    assert body["valid"] is True
    assert body["expired"] is False
    assert body["revoked"] is False
    assert body["claims"]["identity_assurance"] == "MEDIUM"
    assert body["does_not_prove"], "honest-disclosure list must be present"


def test_tampered_claims_break_the_signature():
    session = FakeCredentialSession()
    client = make_client(session, make_verified_user())

    issued = _issue(client)
    row = session.rows[issued["credential_id"]]
    row.claims = {**row.claims, "identity_assurance": "HIGH"}  # inflate after signing

    res = client.get(f"/credentials/{issued['credential_id']}")
    assert res.status_code == 200
    body = res.json()
    assert body["signature_valid"] is False
    assert body["valid"] is False


def test_revoked_credential_reports_revoked():
    session = FakeCredentialSession()
    client = make_client(session, make_verified_user())

    issued = _issue(client)
    res = client.post(f"/credentials/{issued['credential_id']}/revoke")
    assert res.status_code == 200, res.text

    res = client.get(f"/credentials/{issued['credential_id']}")
    body = res.json()
    assert body["revoked"] is True
    assert body["valid"] is False
    # signature itself is still intact — only the status changed
    assert body["signature_valid"] is True


def test_unknown_credential_is_404():
    session = FakeCredentialSession()
    client = make_client(session, make_verified_user())
    res = client.get("/credentials/does-not-exist")
    assert res.status_code == 404
