"""
Endpoint tests for INTL identity + solvency endpoints (Item 11).
Mock DB + mock services — no real I/O. Same pattern as test_verification_fixes.py.
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
from app.routers.auth import get_current_user
from tests.conftest import make_mock_user, mock_get_db


_FAKE_JPEG = b"\xff\xd8\xff" + b"\x00" * 100


def make_client(mock_user):
    target_app = app.app if hasattr(app, "app") else app
    target_app.dependency_overrides[get_current_user] = lambda: mock_user
    target_app.dependency_overrides[get_db] = mock_get_db
    return TestClient(app)


def _valid_mrz_result():
    from app.services.mrz import MRZResult
    return MRZResult(
        surname="SMITH", given_names="JOHN",
        doc_number="A1234567", dob="900101", expiry="320101",
        mrz_valid=True, rescan_required=False,
        assurance="MEDIUM", extraction_path="ai",
    )


# ── POST /verification/intl/identity/upload ───────────────────────────────────

class TestIntlIdentityUpload:
    def test_valid_passport_200(self):
        user = make_mock_user("tenant")
        user.full_name = "John Smith"
        user.identity_data = None
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.mrz.extract_mrz", new=AsyncMock(return_value=_valid_mrz_result())), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = True
            mc.set = AsyncMock()
            mc.delete = AsyncMock(return_value=True)
            response = client.post(
                "/verification/intl/identity/upload",
                files={"file": ("p.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 200
        stored = user.identity_data
        assert stored["status"] == "document_uploaded"
        assert stored["identity_rail"] == "INTL"
        assert "nationality" not in stored
        assert "redis_key" in stored

    def test_mrz_checksum_fail_returns_422(self):
        from app.services.mrz import MRZResult
        user = make_mock_user("tenant")
        user.identity_data = None
        client = make_client(user)

        bad = MRZResult(
            surname="", given_names="", doc_number="", dob="", expiry="",
            mrz_valid=False, rescan_required=True, assurance="MEDIUM",
            extraction_path="failed",
        )
        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.mrz.extract_mrz", new=AsyncMock(return_value=bad)), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = True
            mc.delete = AsyncMock(return_value=True)
            response = client.post(
                "/verification/intl/identity/upload",
                files={"file": ("p.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 422
        assert "MRZ_CHECKSUM_FAIL" in response.json()["detail"]

    def test_expired_passport_returns_422(self):
        from app.services.mrz import MRZResult
        user = make_mock_user("tenant")
        user.identity_data = None
        client = make_client(user)

        expired = MRZResult(
            surname="SMITH", given_names="JOHN",
            doc_number="A1234567", dob="900101", expiry="200101",
            mrz_valid=True, rescan_required=False,
            assurance="MEDIUM", extraction_path="ai",
        )
        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.mrz.extract_mrz", new=AsyncMock(return_value=expired)), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = True
            mc.delete = AsyncMock(return_value=True)
            response = client.post(
                "/verification/intl/identity/upload",
                files={"file": ("p.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 422
        assert "PASSPORT_EXPIRED" in response.json()["detail"]

    def test_non_ascii_name_sets_transliteration_flag(self):
        user = make_mock_user("tenant")
        user.full_name = "محمد علي"  # Arabic
        user.identity_data = None
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.mrz.extract_mrz", new=AsyncMock(return_value=_valid_mrz_result())), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = True
            mc.set = AsyncMock()
            mc.delete = AsyncMock(return_value=True)
            response = client.post(
                "/verification/intl/identity/upload",
                files={"file": ("p.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 200
        stored = user.identity_data
        assert stored["name_transliteration_mismatch"] is True
        assert stored["name_mismatch"] is False


# ── POST /verification/intl/identity/selfie ───────────────────────────────────

class TestIntlIdentitySelfie:
    def test_face_match_emits_intl_medium_credential(self):
        user = make_mock_user("tenant")
        user.identity_verified = False
        user.identity_status = "document_uploaded"
        user.identity_data = {
            "status": "document_uploaded",
            "storage_key": "intl-passport-key",
            "file_url": "https://example.com/passport.jpg",
            "identity_rail": "INTL",
        }
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.identity.IdentityVerificationService.compare_faces",
                   new=AsyncMock(return_value={"match": True, "confidence": 0.88, "reason": "ok"})), \
             patch("app.routers.verification.storage") as mock_storage, \
             patch("app.routers.verification.cache") as mc, \
             patch("app.routers.verification.httpx") as mock_httpx:
            mc.redis_client = None
            mock_resp = MagicMock()
            mock_resp.content = b"passport_bytes"
            mock_resp.headers = {"content-type": "image/jpeg"}
            mock_resp.raise_for_status = MagicMock()
            inner = MagicMock()
            inner.get = AsyncMock(return_value=mock_resp)
            ctx = MagicMock()
            ctx.__aenter__ = AsyncMock(return_value=inner)
            ctx.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = ctx
            mock_storage.delete_file = AsyncMock(return_value=True)

            response = client.post(
                "/verification/intl/identity/selfie",
                files={"file": ("s.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 200
        stored = user.identity_data
        assert stored["identity_assurance"] == "MEDIUM"
        assert stored["identity_rail"] == "INTL"
        assert stored["verified"] is True
        assert "storage_key" not in stored
        assert "file_url" not in stored
        mock_storage.delete_file.assert_called_once_with("intl-passport-key")

    def test_face_mismatch_422_and_passport_purged(self):
        user = make_mock_user("tenant")
        user.identity_data = {
            "status": "document_uploaded",
            "storage_key": "intl-key-mismatch",
            "file_url": "https://example.com/pp.jpg",
            "identity_rail": "INTL",
        }
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.identity.IdentityVerificationService.compare_faces",
                   new=AsyncMock(return_value={"match": False, "confidence": 0.1, "reason": "mismatch"})), \
             patch("app.routers.verification.storage") as mock_storage, \
             patch("app.routers.verification.cache") as mc, \
             patch("app.routers.verification.httpx") as mock_httpx:
            mc.redis_client = None
            mock_resp = MagicMock()
            mock_resp.content = b"pp"
            mock_resp.headers = {"content-type": "image/jpeg"}
            mock_resp.raise_for_status = MagicMock()
            inner = MagicMock()
            inner.get = AsyncMock(return_value=mock_resp)
            ctx = MagicMock()
            ctx.__aenter__ = AsyncMock(return_value=inner)
            ctx.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = ctx
            mock_storage.delete_file = AsyncMock(return_value=True)

            response = client.post(
                "/verification/intl/identity/selfie",
                files={"file": ("s.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 422
        mock_storage.delete_file.assert_called_once_with("intl-key-mismatch")

    def test_compare_faces_exception_purges_passport(self):
        user = make_mock_user("tenant")
        user.identity_data = {
            "status": "document_uploaded",
            "storage_key": "intl-key-exception",
            "file_url": "https://example.com/pp.jpg",
            "identity_rail": "INTL",
        }
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.services.identity.IdentityVerificationService.compare_faces",
                   new=AsyncMock(side_effect=RuntimeError("GPU OOM"))), \
             patch("app.routers.verification.storage") as mock_storage, \
             patch("app.routers.verification.cache") as mc, \
             patch("app.routers.verification.httpx") as mock_httpx:
            mc.redis_client = None
            mock_resp = MagicMock()
            mock_resp.content = b"pp"
            mock_resp.headers = {"content-type": "image/jpeg"}
            mock_resp.raise_for_status = MagicMock()
            inner = MagicMock()
            inner.get = AsyncMock(return_value=mock_resp)
            ctx = MagicMock()
            ctx.__aenter__ = AsyncMock(return_value=inner)
            ctx.__aexit__ = AsyncMock(return_value=None)
            mock_httpx.AsyncClient.return_value = ctx
            mock_storage.delete_file = AsyncMock(return_value=True)

            response = client.post(
                "/verification/intl/identity/selfie",
                files={"file": ("s.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 500
        mock_storage.delete_file.assert_called_once_with("intl-key-exception")


# ── POST /verification/intl/solvency ─────────────────────────────────────────

def _fx_inr_live():
    from app.services.fx_normalise import FXResult
    return FXResult(
        eur_amount=836.0, currency="INR", rate=0.011,
        margin_applied=0.05, fx_source="live",
        fx_margin_label="currency volatility buffer",
    )


def _fx_unavailable():
    from app.services.fx_normalise import FXResult
    return FXResult(
        eur_amount=None, currency="XYZ", rate=None,
        margin_applied=0.05, fx_source="unavailable",
        fx_margin_label="currency volatility buffer",
    )


class TestIntlSolvency:
    def test_inr_income_returns_medium_solvency(self):
        user = make_mock_user("tenant")
        user.identity_verified = True
        user.income_verified = False
        user.income_data = None
        client = make_client(user)

        ai_extraction = {
            "income_amount": 80000.0, "income_currency": "INR",
            "income_period": "monthly", "employee_name": "Test User",
            "document_type": "payslip",
        }

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.routers.verification._ai_extract_intl_income",
                   new=AsyncMock(return_value=ai_extraction)), \
             patch("app.services.fx_normalise.convert_to_eur",
                   new=AsyncMock(return_value=_fx_inr_live())), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = None
            response = client.post(
                "/verification/intl/solvency",
                data={"monthly_rent": "800"},
                files={"file": ("slip.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 200
        stored = user.income_data
        assert stored["solvency_assurance"] == "MEDIUM"
        assert stored["income_currency"] == "INR"
        assert stored["fx_source"] == "live"
        assert stored["fx_margin_label"] == "currency volatility buffer"
        assert stored["decret_2015_1437_disclaimer"] is True
        assert "eur_amount" not in stored
        assert "income_amount" not in stored

    def test_unknown_currency_fx_unavailable_returns_200_unverified(self):
        user = make_mock_user("tenant")
        user.identity_verified = True
        user.income_data = None
        client = make_client(user)

        ai_extraction = {
            "income_amount": 5000.0, "income_currency": "XYZ",
            "income_period": "monthly", "employee_name": "Test User",
            "document_type": "payslip",
        }

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.routers.verification._ai_extract_intl_income",
                   new=AsyncMock(return_value=ai_extraction)), \
             patch("app.services.fx_normalise.convert_to_eur",
                   new=AsyncMock(return_value=_fx_unavailable())), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = None
            response = client.post(
                "/verification/intl/solvency",
                files={"file": ("slip.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 200
        assert user.income_data["solvency_assurance"] == "UNVERIFIED"

    def test_ai_extraction_failure_returns_422(self):
        user = make_mock_user("tenant")
        user.identity_verified = True
        user.income_data = None
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.routers.verification._ai_extract_intl_income",
                   new=AsyncMock(return_value=None)), \
             patch("app.routers.verification.cache") as mc:
            mc.redis_client = None
            response = client.post(
                "/verification/intl/solvency",
                files={"file": ("slip.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 422

    def test_solvency_without_identity_returns_400(self):
        """INTL solvency must require identity_verified — no skipping the prerequisite."""
        user = make_mock_user("tenant")
        user.identity_verified = False
        client = make_client(user)

        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()):
            response = client.post(
                "/verification/intl/solvency",
                files={"file": ("slip.jpg", io.BytesIO(_FAKE_JPEG), "image/jpeg")},
            )

        assert response.status_code == 400
