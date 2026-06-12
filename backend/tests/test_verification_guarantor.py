"""
Integration tests for guarantor verification endpoints.
Mocks AI extraction and storage so no real I/O is required.
"""

import io
import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from conftest import MOCK_TENANT, make_mock_user


# Shared fake file bytes used across tests
FAKE_PDF = b"%PDF-1.4 fake pdf content for testing"


def _make_guarantor_user(
    guarantor_type=None,
    guarantor_status="unverified",
    guarantor_data=None,
    visale_id=None,
    garantme_ref=None,
):
    user = make_mock_user("tenant", "guarantor_test@example.com")
    user.full_name = "Jean Dupont"
    user.guarantor_type = guarantor_type
    user.guarantor_status = guarantor_status
    user.guarantor_data = guarantor_data
    user.visale_id = visale_id
    user.garantme_ref = garantme_ref
    return user


def _physical_user_with_all_docs():
    files = [
        {"document_type": "id_card", "filename": "id.pdf", "file_url": "http://x/id.pdf", "uploaded_at": "2026-01-01"},
        {"document_type": "payslip", "filename": "pay.pdf", "file_url": "http://x/pay.pdf", "uploaded_at": "2026-01-01"},
        {"document_type": "tax_assessment", "filename": "tax.pdf", "file_url": "http://x/tax.pdf", "uploaded_at": "2026-01-01"},
        {"document_type": "proof_address", "filename": "addr.pdf", "file_url": "http://x/addr.pdf", "uploaded_at": "2026-01-01"},
    ]
    return _make_guarantor_user(
        guarantor_type="physical",
        guarantor_status="pending",
        guarantor_data={"files": files},
    )


def _cert_data(cert_id="VS-2025-123", validity_date=date(2027, 1, 1), tenant_name="Jean Dupont"):
    from app.services.guarantor_compliance import GuarantorCertData
    return GuarantorCertData(
        cert_id=cert_id,
        guaranteed_amount=1200.0,
        validity_date=validity_date,
        tenant_name=tenant_name,
        institution="Visale",
    )


def _override_db_and_user(app_obj, user):
    from app.core.database import get_db
    from app.routers.auth import get_current_user

    mock_db = MagicMock()
    mock_db.execute = AsyncMock(return_value=MagicMock())
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def override_db():
        yield mock_db

    target = app_obj.app if hasattr(app_obj, "app") else app_obj
    target.dependency_overrides[get_db] = override_db
    target.dependency_overrides[get_current_user] = lambda: user
    return target, mock_db


class TestVisaleVerify:
    def test_valid_cert_returns_200_and_sets_visale_id(self):
        from app.main import app
        from app.services import employment as emp_mod
        from app.services.storage import storage

        user = _make_guarantor_user()
        target, _ = _override_db_and_user(app, user)

        try:
            with (
                patch.object(
                    emp_mod.employment_service,
                    "extract_guarantor_cert",
                    new=AsyncMock(return_value=_cert_data()),
                ),
                patch.object(
                    storage,
                    "upload_file",
                    new=AsyncMock(return_value={"url": "http://r2/cert.pdf", "key": "k1"}),
                ),
                patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()),
                patch("app.routers.verification.apply_watermark", return_value=FAKE_PDF),
            ):
                from fastapi.testclient import TestClient
                with TestClient(app) as c:
                    resp = c.post(
                        "/verification/guarantor/visale",
                        files={"file": ("cert.pdf", io.BytesIO(FAKE_PDF), "application/pdf")},
                    )

            assert resp.status_code == 200
            data = resp.json()
            assert data["guarantor_status"] == "verified"
            assert data["guarantor_assurance"] == "MEDIUM"
            assert data["visale_id"] == "VS-2025-123"
        finally:
            target.dependency_overrides.clear()

    def test_expired_cert_returns_422(self):
        from app.main import app
        from app.services import employment as emp_mod

        user = _make_guarantor_user()
        target, _ = _override_db_and_user(app, user)

        expired_cert = _cert_data(validity_date=date(2025, 1, 1))  # past
        try:
            with (
                patch.object(
                    emp_mod.employment_service,
                    "extract_guarantor_cert",
                    new=AsyncMock(return_value=expired_cert),
                ),
                patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()),
                patch("app.routers.verification.apply_watermark", return_value=FAKE_PDF),
            ):
                from fastapi.testclient import TestClient
                with TestClient(app) as c:
                    resp = c.post(
                        "/verification/guarantor/visale",
                        files={"file": ("cert.pdf", io.BytesIO(FAKE_PDF), "application/pdf")},
                    )

            assert resp.status_code == 422
            assert "expired" in resp.json()["detail"].lower()
        finally:
            target.dependency_overrides.clear()

    def test_name_mismatch_returns_422(self):
        from app.main import app
        from app.services import employment as emp_mod

        user = _make_guarantor_user()
        target, _ = _override_db_and_user(app, user)

        mismatched_cert = _cert_data(tenant_name="Pierre Durand")  # different name
        try:
            with (
                patch.object(
                    emp_mod.employment_service,
                    "extract_guarantor_cert",
                    new=AsyncMock(return_value=mismatched_cert),
                ),
                patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()),
                patch("app.routers.verification.apply_watermark", return_value=FAKE_PDF),
            ):
                from fastapi.testclient import TestClient
                with TestClient(app) as c:
                    resp = c.post(
                        "/verification/guarantor/visale",
                        files={"file": ("cert.pdf", io.BytesIO(FAKE_PDF), "application/pdf")},
                    )

            assert resp.status_code == 422
            assert "name" in resp.json()["detail"].lower()
        finally:
            target.dependency_overrides.clear()

    def test_extraction_failure_returns_422(self):
        from app.main import app
        from app.services import employment as emp_mod

        user = _make_guarantor_user()
        target, _ = _override_db_and_user(app, user)

        try:
            with (
                patch.object(
                    emp_mod.employment_service,
                    "extract_guarantor_cert",
                    new=AsyncMock(return_value=None),  # AI failed
                ),
                patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()),
            ):
                from fastapi.testclient import TestClient
                with TestClient(app) as c:
                    resp = c.post(
                        "/verification/guarantor/visale",
                        files={"file": ("cert.pdf", io.BytesIO(FAKE_PDF), "application/pdf")},
                    )

            assert resp.status_code == 422
        finally:
            target.dependency_overrides.clear()


class TestGarantmeVerify:
    def test_valid_cert_returns_200_and_sets_garantme_ref(self):
        from app.main import app
        from app.services import employment as emp_mod
        from app.services.storage import storage
        from app.services.guarantor_compliance import GuarantorCertData

        user = _make_guarantor_user()
        target, _ = _override_db_and_user(app, user)

        garantme_cert = GuarantorCertData(
            cert_id="GM-REF-789",
            guaranteed_amount=900.0,
            validity_date=date(2027, 6, 1),
            tenant_name="Jean Dupont",
            institution="Garantme",
        )
        try:
            with (
                patch.object(
                    emp_mod.employment_service,
                    "extract_guarantor_cert",
                    new=AsyncMock(return_value=garantme_cert),
                ),
                patch.object(
                    storage,
                    "upload_file",
                    new=AsyncMock(return_value={"url": "http://r2/gm.pdf", "key": "k2"}),
                ),
                patch("app.routers.verification._check_upload_rate_limit", new=AsyncMock()),
                patch("app.routers.verification.apply_watermark", return_value=FAKE_PDF),
            ):
                from fastapi.testclient import TestClient
                with TestClient(app) as c:
                    resp = c.post(
                        "/verification/guarantor/garantme",
                        files={"file": ("cert.pdf", io.BytesIO(FAKE_PDF), "application/pdf")},
                    )

            assert resp.status_code == 200
            data = resp.json()
            assert data["guarantor_status"] == "verified"
            assert data["guarantor_assurance"] == "MEDIUM"
            assert data["garantme_ref"] == "GM-REF-789"
        finally:
            target.dependency_overrides.clear()


class TestPhysicalGuarantorSubmit:
    def test_all_docs_and_consent_returns_submitted(self):
        from app.main import app

        user = _physical_user_with_all_docs()
        target, _ = _override_db_and_user(app, user)

        try:
            from fastapi.testclient import TestClient
            with TestClient(app) as c:
                resp = c.post(
                    "/verification/guarantor/physical/submit",
                    json={"consent": True},
                )

            assert resp.status_code == 200
            data = resp.json()
            assert data["guarantor_status"] == "submitted"
            assert data["guarantor_assurance"] == "DOCUMENT_SUBMITTED"
        finally:
            target.dependency_overrides.clear()

    def test_consent_false_returns_400(self):
        from app.main import app

        user = _physical_user_with_all_docs()
        target, _ = _override_db_and_user(app, user)

        try:
            from fastapi.testclient import TestClient
            with TestClient(app) as c:
                resp = c.post(
                    "/verification/guarantor/physical/submit",
                    json={"consent": False},
                )

            assert resp.status_code == 400
            assert "consent" in resp.json()["detail"].lower()
        finally:
            target.dependency_overrides.clear()

    def test_missing_docs_returns_400(self):
        from app.main import app

        # Only 2 of 4 docs uploaded
        user = _make_guarantor_user(
            guarantor_type="physical",
            guarantor_status="pending",
            guarantor_data={"files": [
                {"document_type": "id_card", "filename": "id.pdf", "file_url": "http://x/id.pdf", "uploaded_at": "2026-01-01"},
                {"document_type": "payslip", "filename": "pay.pdf", "file_url": "http://x/pay.pdf", "uploaded_at": "2026-01-01"},
            ]},
        )
        target, _ = _override_db_and_user(app, user)

        try:
            from fastapi.testclient import TestClient
            with TestClient(app) as c:
                resp = c.post(
                    "/verification/guarantor/physical/submit",
                    json={"consent": True},
                )

            assert resp.status_code == 400
            assert "missing" in resp.json()["detail"].lower()
        finally:
            target.dependency_overrides.clear()

    def test_wrong_guarantor_type_returns_400(self):
        from app.main import app

        user = _make_guarantor_user(guarantor_type="visale", guarantor_status="verified")
        target, _ = _override_db_and_user(app, user)

        try:
            from fastapi.testclient import TestClient
            with TestClient(app) as c:
                resp = c.post(
                    "/verification/guarantor/physical/submit",
                    json={"consent": True},
                )

            assert resp.status_code == 400
        finally:
            target.dependency_overrides.clear()


class TestVerificationStatus:
    def test_guarantor_assurance_present_in_status(self):
        """Status endpoint returns guarantor_assurance field."""
        from app.main import app
        from app.routers.auth import get_current_user

        user = _make_guarantor_user(
            guarantor_type="visale",
            guarantor_status="verified",
            guarantor_data={"assurance": "MEDIUM", "file_count": 1},
            visale_id="VS-2025-999",
        )
        # VerificationStatusResponse validates these as Optional[dict]
        user.identity_data = None
        user.employment_data = None
        user.ownership_data = None
        user.income_data = None
        target = app.app if hasattr(app, "app") else app
        target.dependency_overrides[get_current_user] = lambda: user

        try:
            from fastapi.testclient import TestClient
            with TestClient(app) as c:
                resp = c.get("/verification/status")

            assert resp.status_code == 200
            data = resp.json()
            assert "guarantor_assurance" in data
            assert data["guarantor_assurance"] == "MEDIUM"
            assert data["visale_id"] == "VS-2025-999"
        finally:
            target.dependency_overrides.clear()
