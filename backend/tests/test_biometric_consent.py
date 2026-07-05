"""
GDPR Art. 9 biometric-consent gate (master plan WS-2).

Every selfie/face-match endpoint must 403 with BIOMETRIC_CONSENT_REQUIRED
until the user records explicit consent at the current wording version.
Mock DB + mock services — no real I/O. Same pattern as test_intl_identity.py.
"""
import io
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.models.biometric_consent import BIOMETRIC_CONSENT_VERSION
from app.routers.auth import get_current_user
from tests.conftest import make_mock_user, mock_get_db

_FAKE_JPEG = b"\xff\xd8\xff" + b"\x00" * 100


def make_client(mock_user, raise_server_exceptions=True):
    target_app = app.app if hasattr(app, "app") else app
    target_app.dependency_overrides[get_current_user] = lambda: mock_user
    target_app.dependency_overrides[get_db] = mock_get_db
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def _consent_error(response):
    assert response.status_code == 403
    detail = response.json()["detail"]
    assert detail["code"] == "BIOMETRIC_CONSENT_REQUIRED"
    assert detail["consent_version"] == BIOMETRIC_CONSENT_VERSION
    return detail


# ── POST /verification/biometric-consent ─────────────────────────────────────

class TestRecordConsent:
    def test_records_consent_201(self):
        user = make_mock_user("tenant")
        client = make_client(user)
        response = client.post("/verification/biometric-consent")
        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "recorded"
        assert body["consent_version"] == BIOMETRIC_CONSENT_VERSION

    def test_idempotent_when_already_consented(self):
        user = make_mock_user("tenant")
        client = make_client(user)
        with patch(
            "app.routers.verification._has_biometric_consent",
            new=AsyncMock(return_value=True),
        ):
            response = client.post("/verification/biometric-consent")
        assert response.status_code == 201
        assert response.json()["status"] == "already_recorded"

    def test_status_endpoint_defaults_to_not_consented(self):
        user = make_mock_user("tenant")
        client = make_client(user)
        response = client.get("/verification/biometric-consent")
        assert response.status_code == 200
        body = response.json()
        assert body["consented"] is False
        assert body["consent_version"] == BIOMETRIC_CONSENT_VERSION


# ── Enforcement: selfie endpoints blocked without consent ────────────────────

class TestConsentEnforcement:
    def test_upload_selfie_403_without_consent(self):
        user = make_mock_user("tenant")
        user.identity_data = {"status": "document_uploaded", "redis_key": "k"}
        client = make_client(user)
        response = client.post(
            "/verification/identity/upload-selfie",
            files={"file": ("s.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
        )
        _consent_error(response)

    def test_intl_selfie_403_without_consent(self):
        user = make_mock_user("tenant")
        user.identity_data = {"status": "document_uploaded", "identity_rail": "INTL"}
        client = make_client(user)
        response = client.post(
            "/verification/intl/identity/selfie",
            files={"file": ("s.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
        )
        _consent_error(response)

    def test_identity_upload_selfie_with_id_403_without_consent(self):
        user = make_mock_user("tenant")
        user.identity_data = None
        client = make_client(user)
        response = client.post(
            "/verification/identity/upload?document_type=national_id",
            data={"side": "selfie_with_id"},
            files={"file": ("s.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
        )
        _consent_error(response)

    def test_identity_upload_front_side_skips_consent_check(self):
        """Document-only path must stay open as the consent-free alternative."""
        user = make_mock_user("tenant")
        user.identity_data = None
        client = make_client(user, raise_server_exceptions=False)
        spy = AsyncMock()
        with patch("app.routers.verification._require_biometric_consent", new=spy), \
             patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()):
            response = client.post(
                "/verification/identity/upload?document_type=national_id",
                data={"side": "front"},
                files={"file": ("f.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )
        spy.assert_not_awaited()
        assert response.status_code != 403

    def test_mobile_selfie_403_without_consent(self):
        user = make_mock_user("tenant")
        client = make_client(user)

        def _result(value):
            r = MagicMock()
            r.scalar_one_or_none = MagicMock(return_value=value)
            return r

        target_app = app.app if hasattr(app, "app") else app

        def session_override():
            s = MagicMock()
            # 1st execute: user lookup → user; 2nd: consent lookup → none
            s.execute = AsyncMock(side_effect=[_result(user), _result(None)])
            s.add = MagicMock()
            s.commit = AsyncMock()
            yield s

        target_app.dependency_overrides[get_db] = session_override
        session = {"user_id": str(user.id), "completed": False}
        with patch("app.routers.verification._get_session", new=AsyncMock(return_value=session)):
            response = client.post(
                "/verification/identity/upload-mobile?verification_code=ABC123&side=selfie_with_id",
                files={"file": ("s.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )
        _consent_error(response)

    def test_selfie_allowed_with_consent_reaches_processing(self):
        """With consent recorded, the gate passes and the flow proceeds to the
        normal pre-checks (here: 400 because no document session exists)."""
        user = make_mock_user("tenant")
        user.identity_data = None  # no document uploaded yet
        client = make_client(user)
        with patch(
            "app.routers.verification._has_biometric_consent",
            new=AsyncMock(return_value=True),
        ):
            response = client.post(
                "/verification/identity/upload-selfie",
                files={"file": ("s.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )
        assert response.status_code == 400
        assert "document" in response.json()["detail"].lower()


class TestConsentIntegrityHandling:
    """PR #39 follow-up: only the unique-constraint race maps to
    already_recorded; other integrity failures must not fake success."""

    def _client_with_commit_error(self, user, orig_message):
        from sqlalchemy.exc import IntegrityError as SAIntegrityError
        from fastapi.testclient import TestClient
        from app.main import app
        from app.core.database import get_db
        from app.routers.auth import get_current_user

        target_app = app.app if hasattr(app, "app") else app
        target_app.dependency_overrides[get_current_user] = lambda: user

        def failing_session():
            s = MagicMock()
            s.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
            s.add = MagicMock()
            s.commit = AsyncMock(side_effect=SAIntegrityError("stmt", {}, Exception(orig_message)))
            s.rollback = AsyncMock()
            yield s

        target_app.dependency_overrides[get_db] = failing_session
        return TestClient(app, raise_server_exceptions=False)

    def test_unique_race_returns_already_recorded(self):
        user = make_mock_user("tenant")
        client = self._client_with_commit_error(
            user, 'duplicate key value violates unique constraint "uq_biometric_consents_user_version"'
        )
        resp = client.post("/verification/biometric-consent")
        assert resp.status_code == 201
        assert resp.json()["status"] == "already_recorded"

    def test_other_integrity_error_is_not_swallowed(self):
        user = make_mock_user("tenant")
        client = self._client_with_commit_error(
            user, 'insert violates foreign key constraint "biometric_consents_user_id_fkey"'
        )
        resp = client.post("/verification/biometric-consent")
        assert resp.status_code == 500  # surfaced, not a fake "already_recorded"
