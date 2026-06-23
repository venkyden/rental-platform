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


def test_solvency_verified_property_rollup():
    """User.solvency_verified = income_verified OR a MEDIUM funds_coverage.
    Tested on a real User (MagicMock can't run the property)."""
    from app.models.user import User
    u = User()

    # nothing → False
    u.income_verified = False
    u.income_data = None
    assert u.solvency_verified is False

    # income rail verified → True
    u.income_verified = True
    assert u.solvency_verified is True

    # funds-only, MEDIUM → True (income rail still False)
    u.income_verified = False
    u.income_data = {"funds_coverage": {"funds_band": "covers_12m_plus", "assurance": "MEDIUM"}}
    assert u.solvency_verified is True

    # funds present but UNVERIFIED (FX failed) → False
    u.income_data = {"funds_coverage": {"funds_band": "unavailable", "assurance": "UNVERIFIED"}}
    assert u.solvency_verified is False

    # income_data present but no funds_coverage → False
    u.income_data = {"solvency_ratio": ">=3.0", "solvency_assurance": "MEDIUM"}
    assert u.solvency_verified is False


def _summary_user(email):
    """Real (unsaved) User with the fields TenantSummary reads explicitly set —
    unsaved instances have None (not the column default) until a DB flush."""
    from app.models.user import User
    u = User()
    u.id = uuid.uuid4()
    u.email = email
    u.full_name = "Intl Student"
    u.identity_verified = False
    u.employment_verified = False
    u.income_verified = False
    u.trust_score = 0
    return u


def test_solvency_verified_flows_through_schema_via_from_attributes():
    """The feature's core mechanism: from_attributes must INVOKE User.solvency_verified
    when serialising the landlord-facing applicant schema — not fall back to the schema
    default. A funds-only User must serialise as solvency_verified=True."""
    from app.models.schemas import TenantSummary

    funds_only = _summary_user("intl@student.test")
    funds_only.income_data = {"funds_coverage": {"funds_band": "covers_12m_plus", "assurance": "MEDIUM"}}
    # True proves the @property ran; if from_attributes skipped it, the schema
    # default (False) would win.
    assert TenantSummary.model_validate(funds_only).solvency_verified is True

    bare = _summary_user("bare@test.test")
    bare.income_data = None
    assert TenantSummary.model_validate(bare).solvency_verified is False


def test_status_response_includes_solvency_verified():
    """GET /verification/status surfaces the solvency_verified rollup field."""
    user = make_mock_user("tenant")
    user.solvency_verified = True  # endpoint reads current_user.solvency_verified
    user.identity_data = None
    user.employment_data = None
    user.ownership_data = None
    user.guarantor_data = None
    client = make_client(user)
    resp = client.get("/verification/status")
    assert resp.status_code == 200
    assert resp.json()["solvency_verified"] is True


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
    assert user.ownership_status in ("control_documented", "rejected"), (
        f"Expected ownership_status to be set, got: {user.ownership_status!r}"
    )


# ── Security Audit Fixes ──────────────────────────────────────────────────────

def test_gdpr_erasure_deactivates_properties():
    """Verify GDPR right to erasure process marks properties as inactive."""
    landlord = make_mock_user("landlord")
    landlord.id = uuid.uuid4()

    property_owned = MagicMock()
    property_owned.id = uuid.uuid4()
    property_owned.landlord_id = landlord.id
    property_owned.status = "active"

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[property_owned])))
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.commit = AsyncMock()

    client = make_client(landlord)
    target_app = app.app if hasattr(app, "app") else app
    def override_db():
        yield mock_db
    target_app.dependency_overrides[get_db] = override_db
    
    with patch("app.services.storage.storage") as mock_storage:
        mock_storage.delete_files_by_prefix = AsyncMock()
        response = client.delete("/gdpr/delete")

    assert response.status_code == 200
    assert property_owned.status == "inactive"


def test_inventory_details_idor():
    """Verify GET /inventory/{id} checks lease membership."""
    attacker = make_mock_user("tenant")
    attacker.id = uuid.uuid4()

    lease = MagicMock()
    lease.id = uuid.uuid4()
    lease.landlord_id = uuid.uuid4() # someone else
    lease.tenant_id = uuid.uuid4()   # someone else

    inventory = MagicMock()
    inventory.id = uuid.uuid4()
    inventory.lease_id = lease.id
    inventory.lease = lease

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=inventory)
    mock_db.execute = AsyncMock(return_value=mock_result)

    client = make_client(attacker)
    target_app = app.app if hasattr(app, "app") else app
    def override_db():
        yield mock_db
    target_app.dependency_overrides[get_db] = override_db

    response = client.get(f"/inventory/{inventory.id}")
    assert response.status_code == 403


def test_inventory_signature_forgery():
    """Verify users cannot forge signatures on inventories."""
    landlord = make_mock_user("landlord")
    landlord.id = uuid.uuid4()

    lease = MagicMock()
    lease.id = uuid.uuid4()
    lease.landlord_id = landlord.id
    lease.tenant_id = uuid.uuid4() # different tenant

    inventory = MagicMock()
    inventory.id = uuid.uuid4()
    inventory.lease_id = lease.id
    inventory.lease = lease
    inventory.signature_tenant = None

    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=inventory)
    mock_db.execute = AsyncMock(return_value=mock_result)

    client = make_client(landlord)
    target_app = app.app if hasattr(app, "app") else app
    def override_db():
        yield mock_db
    target_app.dependency_overrides[get_db] = override_db
    
    # Landlord attempts to forge tenant signature
    response = client.post(
        f"/inventory/{inventory.id}/sign",
        json={"signature_tenant": {"signature": "forged_tenant_sig"}}
    )
    assert response.status_code == 403
    assert "Only the tenant" in response.json()["detail"]


def test_bulk_import_idor_prevention():
    """Verify that updating a property via bulk import checks landlord ownership."""
    landlord_a = make_mock_user("landlord")
    landlord_a.id = uuid.uuid4()

    # Mock DB execute returning None for unauthorized (ID belongs to other landlord)
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.commit = AsyncMock()

    client = make_client(landlord_a)
    # override db specifically for this mock session
    target_app = app.app if hasattr(app, "app") else app
    def override_db():
        yield mock_db
    target_app.dependency_overrides[get_db] = override_db

    csv_content = "id,title,status\n00000000-0000-0000-0000-000000000001,Hacked Title,active\n"
    import io
    csv_bytes = io.BytesIO(csv_content.encode("utf-8"))
    
    with patch("app.routers.bulk.Property") as mock_property_class, \
         patch("app.routers.bulk.select") as mock_select:
        response = client.post(
            "/bulk/properties/import",
            files={"file": ("import.csv", csv_bytes, "text/csv")}
        )

    assert response.status_code == 200
    data = response.json()
    assert data["failed"] == 1
    assert "unauthorized" in data["errors"][0].lower()


def test_bulk_import_compliance_degradation():
    """Verify active property with compliance errors degrades to draft during import."""
    landlord = make_mock_user("landlord")
    landlord.id = uuid.uuid4()

    # Mock DB execute returning None so it creates a new property
    mock_db = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.commit = AsyncMock()

    client = make_client(landlord)
    target_app = app.app if hasattr(app, "app") else app
    def override_db():
        yield mock_db
    target_app.dependency_overrides[get_db] = override_db

    # G rating is invalid for active properties under French law
    csv_content = "title,status,energy_class,price,surface_area,rooms,bedrooms,bathrooms\nNice Appt,active,G,1000,50,2,1,1\n"
    import io
    csv_bytes = io.BytesIO(csv_content.encode("utf-8"))

    # Mock the Property instance returned by Property constructor
    mock_property_instance = MagicMock()
    mock_property_instance.status = "active"
    mock_property_instance.dpe_rating = "G"
    mock_property_instance.deposit = None
    mock_property_instance.monthly_rent = 1000
    mock_property_instance.size_sqm = 50
    mock_property_instance.loyer_reference_majore = None
    mock_property_instance.complement_de_loyer = None
    mock_property_instance.complement_de_loyer_justification = None

    with patch("app.routers.bulk.Property", return_value=mock_property_instance), \
         patch("app.routers.bulk.select") as mock_select:
        response = client.post(
            "/bulk/properties/import",
            files={"file": ("import.csv", csv_bytes, "text/csv")}
        )

    assert response.status_code == 200
    data = response.json()
    assert data["created"] == 1
    assert len(data["errors"]) == 1
    assert "reverted to draft" in data["errors"][0].lower()
