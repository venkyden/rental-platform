"""
Tests for admin router — stranded-upload monitor (Item 12 downstream fix).
Pattern: mock DB + mock auth, same as test_intl_identity.py.
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.routers.auth import get_current_user
from tests.conftest import make_mock_user, mock_get_db


def make_admin_client():
    admin = make_mock_user("admin", "admin@test.com")
    target_app = app.app if hasattr(app, "app") else app
    target_app.dependency_overrides[get_current_user] = lambda: admin
    target_app.dependency_overrides[get_db] = mock_get_db
    return TestClient(app)


class TestVerificationReviewModel:
    def test_model_has_minutes_stalled_and_checks(self):
        from app.routers.admin import VerificationReview
        r = VerificationReview(
            id="abc",
            user_name="Jean Dupont",
            type="identity_stalled",
            status="stalled_upload",
            upload_date="2026-06-16T09:00:00",
            minutes_stalled=45,
            checks={"document_detected": True},
        )
        assert r.minutes_stalled == 45
        assert r.checks == {"document_detected": True}

    def test_model_has_no_file_url_field(self):
        from app.routers.admin import VerificationReview
        fields = VerificationReview.model_fields
        assert "file_url" not in fields
        assert "extracted_data" not in fields

    def test_model_checks_nullable(self):
        from app.routers.admin import VerificationReview
        r = VerificationReview(
            id="abc",
            user_name="Jean Dupont",
            type="identity_stalled",
            status="stalled_upload",
            upload_date="2026-06-16T09:00:00",
            minutes_stalled=20,
            checks=None,
        )
        assert r.checks is None


class TestPendingVerificationsQueue:
    def _make_stalled_user(self, minutes_ago: int):
        """Create a mock user stuck at document_uploaded N minutes ago."""
        from datetime import datetime, timedelta, timezone
        user = make_mock_user("tenant")
        user.identity_verified = False
        user.identity_status = "document_uploaded"
        upload_dt = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=minutes_ago)
        user.identity_data = {
            "status": "document_uploaded",
            "upload_date": upload_dt.isoformat(),
            "checks": {"document_detected": True},
        }
        return user

    def test_stalled_user_over_threshold_appears_in_queue(self):
        stalled = self._make_stalled_user(minutes_ago=30)
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [stalled]

        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(side_effect=[mock_result, empty_result])

        target_app = app.app if hasattr(app, "app") else app
        admin = make_mock_user("admin", "admin@test.com")
        target_app.dependency_overrides[get_current_user] = lambda: admin
        target_app.dependency_overrides[get_db] = lambda: mock_db

        with TestClient(app) as client:
            response = client.get("/admin/verifications/pending")

        target_app.dependency_overrides.clear()
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        item = next(x for x in data if x["type"] == "identity_stalled")
        assert item["status"] == "stalled_upload"
        assert item["minutes_stalled"] >= 28
        assert "file_url" not in item
        assert "extracted_data" not in item

    def test_recent_upload_under_threshold_excluded(self):
        """User uploaded 5 min ago — may still self-complete. Not shown."""
        recent = self._make_stalled_user(minutes_ago=5)
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [recent]

        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(side_effect=[mock_result, empty_result])

        target_app = app.app if hasattr(app, "app") else app
        admin = make_mock_user("admin", "admin@test.com")
        target_app.dependency_overrides[get_current_user] = lambda: admin
        target_app.dependency_overrides[get_db] = lambda: mock_db

        with TestClient(app) as client:
            response = client.get("/admin/verifications/pending")

        target_app.dependency_overrides.clear()
        assert response.status_code == 200
        identity_items = [x for x in response.json() if x["type"] == "identity_stalled"]
        assert identity_items == []

    def test_missing_identity_data_skipped_silently(self):
        """Users with identity_status=document_uploaded but no identity_data don't crash."""
        user = make_mock_user("tenant")
        user.identity_verified = False
        user.identity_status = "document_uploaded"
        user.identity_data = None

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [user]

        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(side_effect=[mock_result, empty_result])

        target_app = app.app if hasattr(app, "app") else app
        admin = make_mock_user("admin", "admin@test.com")
        target_app.dependency_overrides[get_current_user] = lambda: admin
        target_app.dependency_overrides[get_db] = lambda: mock_db

        with TestClient(app) as client:
            response = client.get("/admin/verifications/pending")

        target_app.dependency_overrides.clear()
        assert response.status_code == 200
        assert response.json() == []

    def test_non_admin_gets_403(self):
        target_app = app.app if hasattr(app, "app") else app
        tenant = make_mock_user("tenant")
        target_app.dependency_overrides[get_current_user] = lambda: tenant
        target_app.dependency_overrides[get_db] = mock_get_db
        with TestClient(app) as client:
            response = client.get("/admin/verifications/pending")
        target_app.dependency_overrides.clear()
        assert response.status_code == 403


class TestResetVerification:
    def _make_db_with_user(self, user):
        mock_db = MagicMock()
        mock_db.get = AsyncMock(return_value=user)
        mock_db.commit = AsyncMock()
        return mock_db

    def _admin_client_with_db(self, mock_db):
        target_app = app.app if hasattr(app, "app") else app
        admin = make_mock_user("admin", "admin@test.com")
        target_app.dependency_overrides[get_current_user] = lambda: admin
        target_app.dependency_overrides[get_db] = lambda: mock_db
        return target_app

    def test_reset_stalled_user_returns_200(self):
        user = make_mock_user("tenant")
        user.identity_verified = False
        user.identity_status = "document_uploaded"
        user.identity_data = {"status": "document_uploaded", "upload_date": "2026-06-16T09:00:00"}
        mock_db = self._make_db_with_user(user)
        target_app = self._admin_client_with_db(mock_db)

        with TestClient(app) as client:
            response = client.post(f"/admin/verifications/{user.id}/reset?type=identity")

        target_app.dependency_overrides.clear()
        assert response.status_code == 200
        assert response.json()["status"] == "reset"
        assert user.identity_status == "unverified"
        assert user.identity_data is None

    def test_reset_already_verified_returns_409(self):
        user = make_mock_user("tenant")
        user.identity_verified = True
        user.identity_status = "verified"
        mock_db = self._make_db_with_user(user)
        target_app = self._admin_client_with_db(mock_db)

        with TestClient(app) as client:
            response = client.post(f"/admin/verifications/{user.id}/reset?type=identity")

        target_app.dependency_overrides.clear()
        assert response.status_code == 409
        assert "already completed" in response.json()["detail"]

    def test_reset_user_not_found_returns_404(self):
        mock_db = MagicMock()
        mock_db.get = AsyncMock(return_value=None)
        target_app = self._admin_client_with_db(mock_db)

        with TestClient(app) as client:
            response = client.post(f"/admin/verifications/{uuid.uuid4()}/reset?type=identity")

        target_app.dependency_overrides.clear()
        assert response.status_code == 404

    def test_reset_unsupported_type_returns_400(self):
        user = make_mock_user("tenant")
        mock_db = self._make_db_with_user(user)
        target_app = self._admin_client_with_db(mock_db)

        with TestClient(app) as client:
            response = client.post(f"/admin/verifications/{user.id}/reset?type=property")

        target_app.dependency_overrides.clear()
        assert response.status_code == 400

    def test_reset_does_not_touch_trust_score(self):
        user = make_mock_user("tenant")
        user.trust_score = 50
        user.identity_verified = False
        user.identity_status = "document_uploaded"
        user.identity_data = {"status": "document_uploaded", "upload_date": "2026-06-16T09:00:00"}
        mock_db = self._make_db_with_user(user)
        target_app = self._admin_client_with_db(mock_db)

        with TestClient(app) as client:
            client.post(f"/admin/verifications/{user.id}/reset?type=identity")

        target_app.dependency_overrides.clear()
        assert user.trust_score == 50


class TestApproveGuard:
    def test_approve_identity_returns_400(self):
        user = make_mock_user("tenant")
        user.identity_data = {"status": "document_uploaded"}
        mock_db = MagicMock()
        mock_db.get = AsyncMock(return_value=user)

        target_app = app.app if hasattr(app, "app") else app
        admin = make_mock_user("admin", "admin@test.com")
        target_app.dependency_overrides[get_current_user] = lambda: admin
        target_app.dependency_overrides[get_db] = lambda: mock_db

        with TestClient(app) as client:
            response = client.post(f"/admin/verifications/{user.id}/approve?type=identity")

        target_app.dependency_overrides.clear()
        assert response.status_code == 400
        assert "/reset" in response.json()["detail"]

    def test_approve_property_still_works(self):
        prop = MagicMock()
        prop.id = uuid.uuid4()
        mock_db = MagicMock()
        mock_db.get = AsyncMock(return_value=prop)
        mock_db.commit = AsyncMock()

        target_app = app.app if hasattr(app, "app") else app
        admin = make_mock_user("admin", "admin@test.com")
        target_app.dependency_overrides[get_current_user] = lambda: admin
        target_app.dependency_overrides[get_db] = lambda: mock_db

        with TestClient(app) as client:
            response = client.post(f"/admin/verifications/{prop.id}/approve?type=property")

        target_app.dependency_overrides.clear()
        assert response.status_code == 200
        assert prop.ownership_verified is True
