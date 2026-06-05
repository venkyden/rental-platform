"""
Integration tests for verification system fixes.
Tests the 7 critical hotfixes and 8 cleanup schema/logic fixes.
"""
import os
import sys
import uuid
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
    """Create a TestClient with the given mock user and mock DB."""
    # Handle CORSSafetyNet wrapper if present
    target_app = app.app if hasattr(app, "app") else app
    target_app.dependency_overrides[get_current_user] = lambda: mock_user
    target_app.dependency_overrides[get_db] = mock_get_db
    return TestClient(app)


# ── Fix 1: VerificationGate routing is frontend-only, tested in E2E ──────────

# ── Fix 2: Guarantor "none" must set status="unverified" ─────────────────────

def test_guarantor_none_status_is_unverified():
    """guarantor_type='none' must leave status as 'unverified', never auto-verify."""
    user = make_mock_user("tenant")
    user.guarantor_status = "unverified"
    user.trust_score = 50

    client = make_client(user)
    response = client.post("/verification/guarantor/init", json={"guarantor_type": "none"})
    assert response.status_code == 200
    data = response.json()
    assert data["guarantor_status"] == "unverified", (
        f"Expected 'unverified', got '{data['guarantor_status']}' — "
        f"guarantor_type='none' must not auto-verify"
    )
    # Trust score must not increase
    assert data["trust_score"] == 50


# ── Fix 3: Identity intermediate state flags ──────────────────────────────────

def test_identity_document_uploaded_state_string():
    """After front-of-ID upload, status must be 'document_uploaded', not 'document_verified'."""
    import io
    user = make_mock_user("tenant")
    user.identity_verified = False
    user.identity_status = "unverified"
    user.identity_data = None

    from app.services.identity import identity_service
    mock_result = {
        "verified": True,
        "status": "document_uploaded",
        "data": {},
        "validation_checks": [],
    }

    client = make_client(user)

    with patch.object(identity_service, "verify_document", new=AsyncMock(return_value=mock_result)), \
         patch("app.routers.verification.apply_watermark", return_value=b"watermarked"), \
         patch("app.routers.verification.storage") as mock_storage:
        mock_storage.upload_file = AsyncMock(
            return_value={"url": "https://storage/doc.jpg", "key": "doc"}
        )
        response = client.post(
            "/verification/identity/upload",
            params={"document_type": "id_card"},
            files={"file": ("id_front.jpg", io.BytesIO(b"fake-image"), "image/jpeg")},
            data={"side": "front"},
        )

    assert response.status_code == 200, f"Unexpected status: {response.status_code} — {response.text}"
    # The stored status should be "document_uploaded"
    assert user.identity_status == "document_uploaded", (
        f"Expected 'document_uploaded', got '{user.identity_status}'"
    )
    assert user.identity_verified is False


# ── Fix 4: Guarantor data must not expose file URLs ───────────────────────────

def test_guarantor_data_strips_file_urls():
    """GET /verification/status must strip 'files' (which contains file_url) from guarantor_data."""
    user = make_mock_user("tenant")
    user.guarantor_type = "physical"
    user.guarantor_status = "pending"
    user.guarantor_data = {
        "files": [
            {
                "document_type": "id_card",
                "filename": "id.jpg",
                "file_url": "https://storage/secret-signed-url",
                "uploaded_at": "2026-01-01",
            }
        ]
    }
    # VerificationStatusResponse has Optional[dict] fields — ensure they're None not MagicMock
    user.identity_data = None
    user.employment_data = None
    user.ownership_data = None
    user.income_data = None

    client = make_client(user)
    response = client.get("/verification/status")
    assert response.status_code == 200
    data = response.json()
    gdata = data.get("guarantor_data", {})
    assert "files" not in gdata, (
        "file_url-containing 'files' key must be stripped from API response"
    )
    assert "file_count" in gdata, "file_count must be present"
    assert gdata["file_count"] == 1


# ── Guarantor dedup ───────────────────────────────────────────────────────────

def test_guarantor_dedup_same_doc_type():
    """Re-uploading the same doc_type via /guarantor/upload must replace, not append."""
    import io
    user = make_mock_user("tenant")
    user.guarantor_type = "physical"
    user.guarantor_status = "pending"
    user.guarantor_data = {
        "files": [
            {
                "document_type": "id_card",
                "filename": "old_id.jpg",
                "file_url": "https://storage/old.jpg",
                "uploaded_at": "2026-01-01",
            }
        ]
    }

    client = make_client(user)

    with patch("app.routers.verification.apply_watermark", return_value=b"watermarked"), \
         patch("app.routers.verification.storage") as mock_storage:
        mock_storage.upload_file = AsyncMock(
            return_value={"url": "https://storage/new.jpg", "key": "new"}
        )
        resp = client.post(
            "/verification/guarantor/upload",
            files={"file": ("new_id.jpg", io.BytesIO(b"fake-image"), "image/jpeg")},
            data={"document_type": "id_card"},
        )

    assert resp.status_code == 200, f"Upload failed: {resp.status_code} — {resp.text}"
    files = user.guarantor_data.get("files", [])
    assert len(files) == 1, (
        f"Expected 1 file after re-upload, got {len(files)} — dedup not working"
    )
    assert files[0]["filename"] == "new_id.jpg"


# ── Ownership status ──────────────────────────────────────────────────────────

def test_ownership_status_set_on_verification():
    """Property verification must set current_user.ownership_status."""
    import io
    user = make_mock_user("landlord")
    user.ownership_verified = False
    user.ownership_status = None  # must be set after upload

    mock_property = MagicMock()
    mock_property.id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    mock_property.landlord_id = user.id
    mock_property.address_line1 = "1 Rue de Rivoli"
    mock_property.address_line2 = None
    mock_property.city = "Paris"
    mock_property.postal_code = "75001"
    mock_property.country = "France"

    mock_verification = {
        "verified": True,
        "status": "verified",
        "data": {},
        "validation_checks": [],
    }

    from app.services.property import property_verification_service

    # Build a mock DB that returns the property
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=mock_property)
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    def override_db():
        yield mock_db

    target_app = app.app if hasattr(app, "app") else app
    target_app.dependency_overrides[get_current_user] = lambda: user
    target_app.dependency_overrides[get_db] = override_db

    client = TestClient(app)

    with patch("app.routers.verification.apply_watermark", return_value=b"watermarked"), \
         patch("app.routers.verification.storage") as mock_storage, \
         patch.object(
             property_verification_service,
             "verify_document",
             new=AsyncMock(return_value=mock_verification),
         ):
        mock_storage.upload_file = AsyncMock(
            return_value={"url": "https://storage/deed.pdf", "key": "deed"}
        )
        response = client.post(
            "/verification/property/upload",
            params={
                "property_id": "00000000-0000-0000-0000-000000000001",
                "document_type": "property_deed",
            },
            files={"file": ("deed.pdf", io.BytesIO(b"fake-pdf"), "application/pdf")},
        )

    assert response.status_code == 200, f"Unexpected: {response.status_code} — {response.text}"
    assert user.ownership_status in ("verified", "rejected"), (
        f"Expected ownership_status to be set, got: {user.ownership_status!r}"
    )
