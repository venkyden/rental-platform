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


import pytest


@pytest.fixture(autouse=True)
def _biometric_consent_granted(biometric_consent_granted):
    """Flows predate Art. 9 gate — run as consented user (shared fixture in conftest)."""
    yield



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


# ── POST /verification/intl/funds ──────────────────────────────────────────────

def _mock_user_id_verified():
    from tests.conftest import make_mock_user
    u = make_mock_user("tenant")
    u.identity_verified = True
    u.full_name = "Priya Sharma"
    u.income_verified = False
    u.income_data = None
    u.trust_score = 50
    u.identity_data = {"identity_assurance": "MEDIUM"}
    u.ownership_data = None
    u.insurance_data = None
    return u


def _intl_client_for(user):
    from app.main import app
    from app.core.database import get_db
    from app.routers.auth import get_current_user
    from tests.conftest import mock_get_db
    from fastapi.testclient import TestClient
    target_app = app.app if hasattr(app, "app") else app
    target_app.dependency_overrides[get_current_user] = lambda: user
    target_app.dependency_overrides[get_db] = mock_get_db
    return target_app, TestClient(app)


class TestIntlFunds:
    def _patches(self, extraction):
        from unittest.mock import AsyncMock, patch
        return [
            patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()),
            patch("app.routers.verification._ai_extract_intl_funds",
                  new=AsyncMock(return_value=extraction)),
            patch("app.routers.verification.cache"),
        ]

    def test_self_bank_statement_funds_covers_12m(self):
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 13000.0, "funds_currency": "EUR",
            "coverage_period_months": None,
            "beneficiary_name": "Priya Sharma", "issuer": "Revolut",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self",
                          "monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        body = resp.json()
        assert body["funds_band"] == "covers_12m_plus"
        assert body["funds_source"] == "self"
        assert body["source_strength"] == "proof"
        assert body["assurance"] == "MEDIUM"
        assert user.income_data["funds_coverage"]["funds_band"] == "covers_12m_plus"
        assert user.income_data["funds_coverage"]["flags"]["name_present"] is True
        assert user.income_data["funds_coverage"]["flags"]["duration_covers_lease"] is None

    def test_sponsor_loan_is_promise_and_duration_flag(self):
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 8000.0, "funds_currency": "EUR",
            "coverage_period_months": 6,
            "beneficiary_name": "Priya Sharma", "issuer": "HDFC Credila",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "loan_approval", "funds_source": "sponsor",
                          "monthly_rent": "1000", "lease_months": "12"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        body = resp.json()
        assert body["source_strength"] == "promise"
        assert user.income_data["funds_coverage"]["flags"]["duration_covers_lease"] is False

    def test_fx_unavailable_returns_unverified(self):
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 500000.0, "funds_currency": "XYZ",
            "coverage_period_months": None,
            "beneficiary_name": "Priya Sharma", "issuer": "Bank",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self",
                          "monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        assert resp.json()["assurance"] == "UNVERIFIED"

    def test_name_mismatch_sets_flag_false(self):
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 13000.0, "funds_currency": "EUR",
            "coverage_period_months": None,
            "beneficiary_name": "John Smith", "issuer": "Revolut",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self",
                          "monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        assert user.income_data["funds_coverage"]["flags"]["name_present"] is False

    def test_no_rent_gives_amount_only(self):
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 13000.0, "funds_currency": "EUR",
            "coverage_period_months": None,
            "beneficiary_name": "Priya Sharma", "issuer": "Revolut",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        assert resp.json()["funds_band"] == "amount_only"

    def test_extraction_failure_returns_422(self):
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(None):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self",
                          "monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 422

    def test_no_identity_returns_400(self):
        """Identity verification is a prerequisite for /intl/funds."""
        user = _mock_user_id_verified()
        user.identity_verified = False
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 13000.0, "funds_currency": "EUR",
            "coverage_period_months": None,
            "beneficiary_name": "Priya Sharma", "issuer": "Revolut",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self",
                          "monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 400

    def test_raw_funds_amount_not_persisted(self):
        """Statelessness guard: raw amounts never stored in income_data."""
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 13000.0, "funds_currency": "EUR",
            "coverage_period_months": None,
            "beneficiary_name": "Priya Sharma", "issuer": "Revolut",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self",
                          "monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        import json
        stored = json.dumps(user.income_data)
        assert "13000" not in stored
        assert "funds_amount" not in user.income_data["funds_coverage"]

    def test_solvency_upload_preserves_funds_coverage(self):
        """A /intl/solvency upload must merge into income_data, not erase an
        existing funds_coverage block left by a prior /intl/funds upload."""
        from unittest.mock import AsyncMock, patch
        user = _mock_user_id_verified()
        user.income_data = {
            "funds_coverage": {
                "funds_band": "covers_12m_plus",
                "assurance": "MEDIUM",
                "funds_source": "self",
            }
        }
        target_app, client = _intl_client_for(user)
        import contextlib
        with contextlib.ExitStack() as stack:
            stack.enter_context(
                patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock())
            )
            stack.enter_context(
                patch(
                    "app.routers.verification._ai_extract_intl_income",
                    new=AsyncMock(return_value={
                        "income_amount": 3000.0,
                        "income_currency": "EUR",
                        "income_period": "monthly",
                    }),
                )
            )
            stack.enter_context(patch("app.routers.verification.cache"))
            with client:
                resp = client.post(
                    "/verification/intl/solvency",
                    data={"monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        assert user.income_data["funds_coverage"]["funds_band"] == "covers_12m_plus"
        assert "solvency_ratio" in user.income_data

    def test_non_numeric_funds_amount_returns_422(self):
        """Untrusted AI output that isn't numeric must yield 422, not an uncaught 500."""
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": "twelve thousand", "funds_currency": "EUR",
            "coverage_period_months": None,
            "beneficiary_name": "Priya Sharma", "issuer": "X",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self",
                          "monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 422

    def test_zero_funds_amount_returns_422(self):
        """A zero/negative funds amount must not become a verified MEDIUM claim."""
        user = _mock_user_id_verified()
        target_app, client = _intl_client_for(user)
        extraction = {
            "funds_amount": 0, "funds_currency": "EUR",
            "coverage_period_months": None,
            "beneficiary_name": "Priya Sharma", "issuer": "Revolut",
        }
        import contextlib
        with contextlib.ExitStack() as stack:
            for p in self._patches(extraction):
                stack.enter_context(p)
            with client:
                resp = client.post(
                    "/verification/intl/funds",
                    data={"document_type": "bank_statement", "funds_source": "self",
                          "monthly_rent": "1000"},
                    files={"file": ("s.jpg", b"x", "image/jpeg")},
                )
        target_app.dependency_overrides.clear()
        assert resp.status_code == 422
        assert user.income_data is None  # nothing persisted for a rejected amount

    def test_solvency_skips_trust_bump_when_funds_already_verified(self):
        """funds→solvency must not double-count trust (+20 once, not +40)."""
        from unittest.mock import AsyncMock, MagicMock, patch
        from app.main import app
        from app.core.database import get_db
        from app.routers.auth import get_current_user
        from fastapi.testclient import TestClient

        user = _mock_user_id_verified()
        user.income_verified = False
        # prior MEDIUM funds_coverage already granted a bump
        user.income_data = {"funds_coverage": {"funds_band": "covers_12m_plus", "assurance": "MEDIUM", "funds_source": "self"}}

        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        target_app = app.app if hasattr(app, "app") else app
        target_app.dependency_overrides[get_current_user] = lambda: user
        target_app.dependency_overrides[get_db] = lambda: mock_db

        extraction = {"income_amount": 3000.0, "income_currency": "EUR", "income_period": "monthly"}
        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.routers.verification._ai_extract_intl_income", new=AsyncMock(return_value=extraction)), \
             patch("app.routers.verification.cache"):
            with TestClient(app) as client:
                resp = client.post("/verification/intl/solvency",
                                   data={"monthly_rent": "1000"},
                                   files={"file": ("s.jpg", b"x", "image/jpeg")})
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        # no trust-bump UPDATE should have been issued (prior funds already counted)
        assert mock_db.execute.await_count == 0

    def test_solvency_bumps_trust_for_fresh_user(self):
        """Sanity: a user with no prior solvency DOES get the solvency bump."""
        from unittest.mock import AsyncMock, MagicMock, patch
        from app.main import app
        from app.core.database import get_db
        from app.routers.auth import get_current_user
        from fastapi.testclient import TestClient

        user = _mock_user_id_verified()
        user.income_verified = False
        user.income_data = None

        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        target_app = app.app if hasattr(app, "app") else app
        target_app.dependency_overrides[get_current_user] = lambda: user
        target_app.dependency_overrides[get_db] = lambda: mock_db

        extraction = {"income_amount": 3000.0, "income_currency": "EUR", "income_period": "monthly"}
        with patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()), \
             patch("app.routers.verification._ai_extract_intl_income", new=AsyncMock(return_value=extraction)), \
             patch("app.routers.verification.cache"):
            with TestClient(app) as client:
                resp = client.post("/verification/intl/solvency",
                                   data={"monthly_rent": "1000"},
                                   files={"file": ("s.jpg", b"x", "image/jpeg")})
        target_app.dependency_overrides.clear()
        assert resp.status_code == 200
        assert mock_db.execute.await_count == 1   # the +20 bump fired


class TestIssueMineFundsClaim:
    def test_medium_funds_emitted(self):
        from app.routers.credentials import _build_claims_for_user
        user = _mock_user_id_verified()
        user.income_data = {
            "funds_coverage": {
                "funds_band": "covers_12m_plus", "funds_source": "sponsor",
                "assurance": "MEDIUM",
            }
        }
        claims = _build_claims_for_user(user)
        assert claims["funds_coverage_band"] == "covers_12m_plus"
        assert claims["funds_coverage_source"] == "sponsor"
        assert claims["funds_coverage_assurance"] == "MEDIUM"

    def test_unverified_funds_not_emitted(self):
        from app.routers.credentials import _build_claims_for_user
        user = _mock_user_id_verified()
        user.income_data = {"funds_coverage": {"funds_band": "unavailable", "assurance": "UNVERIFIED"}}
        claims = _build_claims_for_user(user)
        assert "funds_coverage_band" not in claims


class TestEvidencePdfRows:
    """The evidence-PDF claims table is built from `_evidence_claim_rows`, which
    must render every claim for BOTH vocabularies (direct /issue and /issue-mine)
    and never leak internal tier words. Asserting on the helper's text tuples is
    reliable; the PDF bytes themselves are FlateDecode-compressed and opaque."""

    def _labels(self, rows):
        return [r[0] for r in rows]

    def test_issue_mine_vocabulary_renders_identity_and_property(self):
        # Regression: /issue-mine emits identity_assurance + property_control_*,
        # NOT identity_verified/property_control. Both rows must still appear.
        from app.services.credential import _evidence_claim_rows
        rows = _evidence_claim_rows({
            "identity_assurance": "MEDIUM",
            "property_control_assurance": "MEDIUM",
            "property_control_label": "Contrôle documenté (taxe foncière)",
            "funds_coverage_band": "covers_12m_plus",
            "funds_coverage_source": "sponsor",
            "funds_coverage_assurance": "MEDIUM",
        })
        labels = self._labels(rows)
        assert "Identité vérifiée" in labels          # was silently dropped before the fix
        assert "Contrôle du bien (documentaire — n'atteste PAS la propriété)" in labels
        assert "Capacité fiscale (fonds)" in labels
        # property value cell uses the qualification label, not Oui/Non
        prop = next(r for r in rows if r[0].startswith("Contrôle du bien"))
        assert prop[1] == "Contrôle documenté (taxe foncière)"

    def test_direct_issue_vocabulary_still_renders(self):
        # The older direct-/issue keys must keep working unchanged.
        from app.services.credential import _evidence_claim_rows
        rows = _evidence_claim_rows({
            "identity_verified": True,
            "identity_assurance": "HIGH",
            "property_control": True,
            "property_assurance": "MEDIUM",
        })
        labels = self._labels(rows)
        assert "Identité vérifiée" in labels
        assert "Contrôle du bien (documentaire — n'atteste PAS la propriété)" in labels
        ident = next(r for r in rows if r[0] == "Identité vérifiée")
        assert ident[1] == "Oui"

    def test_no_internal_tier_words_in_assurance_cells(self):
        from app.services.credential import _evidence_claim_rows
        rows = _evidence_claim_rows({
            "identity_assurance": "MEDIUM",
            "funds_coverage_band": "covers_6m",
            "funds_coverage_assurance": "MEDIUM",
        })
        for _, _, assur in rows:
            assert assur in ("Vérifié ✓", "Non vérifié")  # never HIGH/MEDIUM/INTERMÉDIAIRE

    def test_unverified_identity_row_hidden(self):
        from app.services.credential import _evidence_claim_rows
        rows = _evidence_claim_rows({"identity_assurance": "UNVERIFIED"})
        assert rows == []

    def test_pdf_still_generates(self):
        from app.services.credential import credential_service
        record = {
            "subject_role": "tenant", "subject_display_name": "Priya Sharma",
            "rail": "INTL", "issued_at": "2026-06-17T00:00:00",
            "expires_at": "2026-07-17T00:00:00", "credential_id": "test-id",
            "claims": {
                "identity_assurance": "MEDIUM",
                "property_control_assurance": "MEDIUM",
                "property_control_label": "Contrôle documenté",
                "funds_coverage_band": "covers_12m_plus",
                "funds_coverage_source": "sponsor",
                "funds_coverage_assurance": "MEDIUM",
            },
            "disclaimer": "x", "signature": "y",
        }
        pdf = credential_service.export_evidence_pdf(record)
        assert isinstance(pdf, bytes) and len(pdf) > 800
