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
