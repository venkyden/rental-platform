"""
FR identity MEDIUM rail — assurance labelling (DOSSIER §5.2: AS-1, AS-4).
"""
import pytest
from app.services.identity_assurance import (
    OCR_LIVENESS_LABEL,
    derive_identity_assurance,
)


def test_label_is_medium_ocr_liveness():
    assert OCR_LIVENESS_LABEL == {
        "identity_assurance": "MEDIUM",
        "identity_source": "ocr_liveness",
    }


def test_explicit_label_is_returned():
    data = {"identity_assurance": "MEDIUM", "identity_source": "ocr_liveness"}
    assert derive_identity_assurance(True, data) == "MEDIUM"


def test_verified_but_unlabelled_infers_medium():
    # Legacy user verified before labelling existed.
    assert derive_identity_assurance(True, {"verified": True, "status": "verified"}) == "MEDIUM"


def test_unverified_is_unverified():
    assert derive_identity_assurance(False, {"status": "document_uploaded"}) == "UNVERIFIED"
    assert derive_identity_assurance(False, None) == "UNVERIFIED"


def test_unknown_label_falls_back_to_inference():
    # A garbage label is ignored; falls back to verified→MEDIUM.
    assert derive_identity_assurance(True, {"identity_assurance": "SUPER"}) == "MEDIUM"


import pytest
from tests_integration.conftest import make_user, auth


def _stub_identity_and_storage(monkeypatch):
    """Bypass Gemini OCR, R2 storage and watermarking for the upload path."""
    async def fake_selfie_with_id(**kwargs):
        return {
            "verified": True,
            "status": "verified",
            "data": {"full_name": "Tenant User", "document_type": "id_card"},
            "validation_checks": [],
            "rejection_reason": None,
        }

    async def fake_upload_file(**kwargs):
        return {"url": "https://r2.test/doc.jpg", "key": "doc.jpg"}

    import app.services.identity as identity_mod
    import app.routers.verification as verification_mod
    monkeypatch.setattr(identity_mod.identity_service, "verify_selfie_with_id", fake_selfie_with_id)
    monkeypatch.setattr(verification_mod.storage, "upload_file", fake_upload_file)
    monkeypatch.setattr(verification_mod, "apply_watermark", lambda b: b)


@pytest.mark.asyncio
async def test_AS1_selfie_with_id_is_labelled_medium(client, monkeypatch):
    """AS-1: an OCR+selfie verification stores identity_assurance=MEDIUM, source ocr_liveness."""
    _stub_identity_and_storage(monkeypatch)
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    r = await client.post(
        "/verification/identity/upload?document_type=id_card",
        headers=auth(tenant),
        data={"side": "selfie_with_id"},
        files={"file": ("id.jpg", b"\xff\xd8\xff fake-jpeg", "image/jpeg")},
    )
    assert r.status_code == 200, r.text

    async with sm() as s:
        from app.models.user import User as U
        refreshed = await s.get(U, tenant.id)
        assert refreshed.identity_verified is True
        assert refreshed.identity_data["identity_assurance"] == "MEDIUM"
        assert refreshed.identity_data["identity_source"] == "ocr_liveness"


@pytest.mark.asyncio
async def test_AS4_status_reports_unverified_when_not_verified(client):
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")
    r = await client.get("/verification/status", headers=auth(tenant))
    assert r.status_code == 200
    assert r.json()["identity_assurance"] == "UNVERIFIED"


@pytest.mark.asyncio
async def test_status_infers_medium_for_legacy_verified_user(client):
    """Back-compat: a user verified before labelling existed reads as MEDIUM."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")
    async with sm() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
        u.identity_verified = True
        u.identity_status = "verified"
        u.identity_data = {"verified": True, "status": "verified"}  # no label
        await s.commit()

    r = await client.get("/verification/status", headers=auth(tenant))
    assert r.status_code == 200
    assert r.json()["identity_assurance"] == "MEDIUM"
