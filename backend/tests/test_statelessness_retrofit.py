"""
Tests for Item 12 — Statelessness retrofit.

Verifies that source documents are never persisted at rest for the identity,
income, and guarantor domains. Each test asserts:
  - storage.upload_file is NOT called for source documents
  - PII fields (extracted_data, file_url, storage_key) are absent from JSONB
  - Extracted claims that belong in the JSONB ARE present
"""
import io
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.routers.auth import get_current_user
from tests.conftest import make_mock_user, mock_get_db


def make_client(mock_user):
    target_app = app.app if hasattr(app, "app") else app
    target_app.dependency_overrides[get_current_user] = lambda: mock_user
    target_app.dependency_overrides[get_db] = mock_get_db
    return TestClient(app)


# ── Identity: selfie_with_id (one-shot) ──────────────────────────────────────

class TestIdentitySelfieWithId:
    def _user(self):
        u = make_mock_user("tenant")
        u.identity_verified = False
        u.identity_status = "unverified"
        u.identity_data = None
        return u

    def test_no_file_stored(self):
        """selfie_with_id must not call storage.upload_file."""
        user = self._user()
        client = make_client(user)
        from app.services.identity import identity_service
        mock_result = {
            "verified": True,
            "status": "verified",
            "data": {"full_name": "Test User", "document_number": "ABC123"},
            "validation_checks": [{"check": "name_match", "passed": True}],
        }
        with patch.object(identity_service, "verify_selfie_with_id", new=AsyncMock(return_value=mock_result)), \
             patch("app.routers.verification.storage") as mock_storage:
            mock_storage.upload_file = AsyncMock(return_value={"url": "https://r2/doc.jpg", "key": "k"})
            response = client.post(
                "/verification/identity/upload?document_type=national_id",
                files={"file": ("selfie.jpg", io.BytesIO(b"imgdata"), "image/jpeg")},
                data={"side": "selfie_with_id"},
            )
        assert response.status_code == 200
        mock_storage.upload_file.assert_not_called()

    def test_no_pii_in_identity_data(self):
        """selfie_with_id must not store file_url, storage_key, or extracted_data."""
        user = self._user()
        client = make_client(user)
        from app.services.identity import identity_service
        mock_result = {
            "verified": True,
            "status": "verified",
            "data": {"full_name": "Test User", "document_number": "ABC123"},
            "validation_checks": [{"check": "name_match", "passed": True}],
        }
        with patch.object(identity_service, "verify_selfie_with_id", new=AsyncMock(return_value=mock_result)), \
             patch("app.routers.verification.storage"):
            client.post(
                "/verification/identity/upload?document_type=national_id",
                files={"file": ("selfie.jpg", io.BytesIO(b"imgdata"), "image/jpeg")},
                data={"side": "selfie_with_id"},
            )
        stored = user.identity_data or {}
        assert "file_url" not in stored
        assert "storage_key" not in stored
        assert "extracted_data" not in stored
        assert "filename" not in stored

    def test_assurance_label_present(self):
        """selfie_with_id must stamp identity_assurance: MEDIUM."""
        user = self._user()
        client = make_client(user)
        from app.services.identity import identity_service
        mock_result = {
            "verified": True, "status": "verified",
            "data": {}, "validation_checks": [],
        }
        with patch.object(identity_service, "verify_selfie_with_id", new=AsyncMock(return_value=mock_result)), \
             patch("app.routers.verification.storage"):
            client.post(
                "/verification/identity/upload?document_type=national_id",
                files={"file": ("selfie.jpg", io.BytesIO(b"imgdata"), "image/jpeg")},
                data={"side": "selfie_with_id"},
            )
        stored = user.identity_data or {}
        assert stored.get("identity_assurance") == "MEDIUM"
        assert stored.get("verified_at") is not None


# ── Identity: back side ───────────────────────────────────────────────────────

class TestIdentityBackSide:
    def test_back_side_no_storage(self):
        """Back side of ID must not call storage.upload_file."""
        user = make_mock_user("tenant")
        user.identity_data = {"status": "document_uploaded", "file_url": "https://r2/front.jpg", "storage_key": "front-key"}
        client = make_client(user)
        with patch("app.routers.verification.storage") as mock_storage:
            mock_storage.upload_file = AsyncMock(return_value={"url": "x", "key": "y"})
            response = client.post(
                "/verification/identity/upload?document_type=national_id",
                files={"file": ("back.jpg", io.BytesIO(b"backdata"), "image/jpeg")},
                data={"side": "back"},
            )
        assert response.status_code == 200
        mock_storage.upload_file.assert_not_called()

    def test_back_side_identity_data_unchanged(self):
        """Back side upload must not modify existing identity_data."""
        original = {"status": "document_uploaded", "file_url": "https://r2/front.jpg", "storage_key": "front-key"}
        user = make_mock_user("tenant")
        user.identity_data = dict(original)
        client = make_client(user)
        with patch("app.routers.verification.storage"):
            client.post(
                "/verification/identity/upload?document_type=national_id",
                files={"file": ("back.jpg", io.BytesIO(b"backdata"), "image/jpeg")},
                data={"side": "back"},
            )
        # identity_data must not have gained back_file_url or back_storage_key
        stored = user.identity_data or {}
        assert "back_file_url" not in stored
        assert "back_storage_key" not in stored


# ── Identity: front + selfie two-step ────────────────────────────────────────

class TestIdentityFrontAndSelfie:
    def test_front_stores_temporarily_without_extracted_data(self):
        """Front doc upload stores in R2 for face comparison but must not store extracted_data."""
        user = make_mock_user("tenant")
        user.identity_verified = False
        user.identity_status = "unverified"
        user.identity_data = None
        client = make_client(user)
        from app.services.identity import identity_service
        mock_result = {
            "verified": True,
            "status": "document_uploaded",
            "data": {"full_name": "Test User", "document_number": "SECRET123"},
            "validation_checks": [{"check": "name_match", "passed": True}],
        }
        with patch.object(identity_service, "verify_document", new=AsyncMock(return_value=mock_result)), \
             patch("app.routers.verification.storage") as mock_storage:
            mock_storage.upload_file = AsyncMock(return_value={"url": "https://r2/front.jpg", "key": "tmp-key"})
            response = client.post(
                "/verification/identity/upload?document_type=national_id",
                files={"file": ("front.jpg", io.BytesIO(b"frontdata"), "image/jpeg")},
                data={"side": "front"},
            )
        assert response.status_code == 200
        # Storage IS called (doc needed for selfie comparison)
        mock_storage.upload_file.assert_called_once()
        # But extracted PII must not be stored
        stored = user.identity_data or {}
        assert "extracted_data" not in stored
        assert "filename" not in stored
        # file_url and storage_key ARE present (needed for selfie step)
        assert "file_url" in stored
        assert "storage_key" in stored

    def test_selfie_deletes_id_doc_and_stores_no_selfie(self):
        """
        upload_identity_selfie must:
          - call storage.delete_file with the stored ID key
          - NOT call storage.upload_file (selfie not persisted)
          - strip file_url/storage_key from identity_data
        """
        user = make_mock_user("tenant")
        user.identity_verified = False
        user.identity_status = "document_uploaded"
        user.identity_data = {
            "status": "document_uploaded",
            "file_url": "https://r2/front.jpg",
            "storage_key": "id-doc-key-to-delete",
            "checks": [{"check": "name_match", "passed": True}],
        }
        client = make_client(user)
        from app.services.identity import identity_service
        face_result = {"match": True, "confidence": 0.92, "reason": "faces match"}
        with patch.object(identity_service, "compare_faces", new=AsyncMock(return_value=face_result)), \
             patch("app.routers.verification.storage") as mock_storage, \
             patch("app.routers.verification.httpx") as mock_httpx:
            # Mock httpx fetch of the stored ID doc
            mock_resp = MagicMock()
            mock_resp.content = b"id_image_bytes"
            mock_resp.headers = {"content-type": "image/jpeg"}
            mock_resp.raise_for_status = MagicMock()
            mock_client_ctx = AsyncMock()
            mock_client_ctx.__aenter__ = AsyncMock(return_value=AsyncMock(get=AsyncMock(return_value=mock_resp)))
            mock_client_ctx.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = mock_client_ctx
            mock_storage.delete_file = AsyncMock(return_value=True)
            mock_storage.upload_file = AsyncMock(return_value={"url": "x", "key": "y"})
            response = client.post(
                "/verification/identity/upload-selfie",
                files={"file": ("selfie.jpg", io.BytesIO(b"selfiedata"), "image/jpeg")},
            )
        assert response.status_code == 200
        # ID doc must be deleted
        mock_storage.delete_file.assert_called_once_with("id-doc-key-to-delete")
        # Selfie must NOT be uploaded
        mock_storage.upload_file.assert_not_called()
        # Clean identity_data
        stored = user.identity_data or {}
        assert "file_url" not in stored
        assert "storage_key" not in stored
        assert "selfie_url" not in stored
        assert "selfie_storage_key" not in stored
        assert stored.get("verified") is True
        assert stored.get("identity_assurance") == "MEDIUM"


# ── Income domain ─────────────────────────────────────────────────────────────

class TestIncomeStateless:
    def _user(self):
        u = make_mock_user("tenant")
        u.income_verified = False
        u.income_status = "unverified"
        u.income_data = None
        return u

    def test_income_upload_no_file_stored(self):
        """Income upload must not call storage.upload_file."""
        user = self._user()
        client = make_client(user)
        from app.services.employment import employment_service
        mock_result = {
            "verified": True,
            "status": "verified",
            "data": {"rfr": 45000, "year": 2023},
            "validation_checks": [{"check": "doc_type", "passed": True}],
        }
        with patch.object(employment_service, "verify_document", new=AsyncMock(return_value=mock_result)), \
             patch("app.routers.verification.storage") as mock_storage:
            mock_storage.upload_file = AsyncMock(return_value={"url": "x", "key": "y"})
            response = client.post(
                "/verification/income/upload",
                files={"file": ("avis.pdf", io.BytesIO(b"pdfdata"), "application/pdf")},
                data={"document_type": "tax_assessment"},
            )
        assert response.status_code == 200
        mock_storage.upload_file.assert_not_called()

    def test_income_data_has_no_pii(self):
        """Income data JSONB must not contain file_url, storage_key, or extracted_data."""
        user = self._user()
        client = make_client(user)
        from app.services.employment import employment_service
        mock_result = {
            "verified": True,
            "status": "verified",
            "data": {"rfr": 45000, "account_number": "SECRET"},
            "validation_checks": [],
        }
        with patch.object(employment_service, "verify_document", new=AsyncMock(return_value=mock_result)), \
             patch("app.routers.verification.storage"):
            client.post(
                "/verification/income/upload",
                files={"file": ("avis.pdf", io.BytesIO(b"data"), "application/pdf")},
                data={"document_type": "tax_assessment"},
            )
        stored = user.income_data or {}
        assert "file_url" not in stored
        assert "storage_key" not in stored
        assert "extracted_data" not in stored
        assert "filename" not in stored
        # Claim fields must be present
        assert "verified" in stored
        assert "verified_at" in stored


# ── Guarantor domain ──────────────────────────────────────────────────────────

class TestGuarantorStateless:
    def _mock_assessment(self):
        a = MagicMock()
        a.assurance = "MEDIUM"
        a.name_matched = True
        a.name_match_score = 0.95
        a.guaranteed_amount = 1200.0
        a.validity_date = None
        a.cert_ref = "VISALE-2024-001"
        a.warnings = []
        return a

    def test_visale_no_file_stored(self):
        """Visale upload must not call storage.upload_file."""
        user = make_mock_user("tenant")
        client = make_client(user)
        from app.services.employment import employment_service
        from app.services.guarantor_compliance import assess_guarantor_cert
        cert_data = {"cert_ref": "VISALE-2024-001", "guaranteed_amount": 1200}
        assessment = self._mock_assessment()
        with patch.object(employment_service, "extract_guarantor_cert", new=AsyncMock(return_value=cert_data)), \
             patch("app.services.guarantor_compliance.assess_guarantor_cert", return_value=assessment), \
             patch("app.routers.verification.storage") as mock_storage:
            mock_storage.upload_file = AsyncMock(return_value={"url": "x", "key": "y"})
            response = client.post(
                "/verification/guarantor/visale",
                files={"file": ("visale.pdf", io.BytesIO(b"certdata"), "application/pdf")},
            )
        assert response.status_code == 200
        mock_storage.upload_file.assert_not_called()

    def test_visale_claims_present_no_storage_keys(self):
        """Visale guarantor_data must have extracted claims but no file_url/storage_key."""
        user = make_mock_user("tenant")
        client = make_client(user)
        from app.services.employment import employment_service
        cert_data = {"cert_ref": "VISALE-2024-001"}
        assessment = self._mock_assessment()
        with patch.object(employment_service, "extract_guarantor_cert", new=AsyncMock(return_value=cert_data)), \
             patch("app.services.guarantor_compliance.assess_guarantor_cert", return_value=assessment), \
             patch("app.routers.verification.storage"):
            client.post(
                "/verification/guarantor/visale",
                files={"file": ("visale.pdf", io.BytesIO(b"certdata"), "application/pdf")},
            )
        stored = user.guarantor_data or {}
        assert "file_url" not in stored
        assert "storage_key" not in stored
        # Claims must be present
        assert "assurance" in stored
        assert "name_matched" in stored
        assert "guaranteed_amount" in stored
        assert "verified_at" in stored

    def test_garantme_no_file_stored(self):
        """Garantme upload must not call storage.upload_file."""
        user = make_mock_user("tenant")
        client = make_client(user)
        from app.services.employment import employment_service
        cert_data = {"cert_ref": "GM-2024-002"}
        assessment = self._mock_assessment()
        assessment.cert_ref = "GM-2024-002"
        with patch.object(employment_service, "extract_guarantor_cert", new=AsyncMock(return_value=cert_data)), \
             patch("app.services.guarantor_compliance.assess_guarantor_cert", return_value=assessment), \
             patch("app.routers.verification.storage") as mock_storage:
            mock_storage.upload_file = AsyncMock(return_value={"url": "x", "key": "y"})
            response = client.post(
                "/verification/guarantor/garantme",
                files={"file": ("garantme.pdf", io.BytesIO(b"certdata"), "application/pdf")},
            )
        assert response.status_code == 200
        mock_storage.upload_file.assert_not_called()

    def test_garantme_claims_present_no_storage_keys(self):
        """Garantme guarantor_data must have extracted claims but no file_url/storage_key."""
        user = make_mock_user("tenant")
        client = make_client(user)
        from app.services.employment import employment_service
        cert_data = {"cert_ref": "GM-2024-002"}
        assessment = self._mock_assessment()
        assessment.cert_ref = "GM-2024-002"
        with patch.object(employment_service, "extract_guarantor_cert", new=AsyncMock(return_value=cert_data)), \
             patch("app.services.guarantor_compliance.assess_guarantor_cert", return_value=assessment), \
             patch("app.routers.verification.storage"):
            client.post(
                "/verification/guarantor/garantme",
                files={"file": ("garantme.pdf", io.BytesIO(b"certdata"), "application/pdf")},
            )
        stored = user.guarantor_data or {}
        assert "file_url" not in stored
        assert "storage_key" not in stored
        assert "assurance" in stored
        assert "name_matched" in stored
