"""
MRH Insurance verification — unit tests (DOSSIER §5.8 IN-1..IN-5).
Pure check_mrh_extraction tests; no HTTP client, no DB, no AI needed.
"""

import pytest
from app.services.mrh_insurance import check_mrh_extraction


def _cert(overrides=None):
    base = {
        "document_type": "certificate",
        "insurer_country": "FR",
        "insured_name": "Jean Dupont",
        "property_address": "12 rue de la Paix, 75001 Paris",
        "cover_start": "2026-07-01",
        "cover_end": "2027-07-01",
    }
    if overrides:
        base.update(overrides)
    return base


# ── IN-1: quote vs certificate ───────────────────────────────────────────────

def test_quote_document_is_rejected():
    result = check_mrh_extraction(_cert({"document_type": "quote"}), "Jean Dupont", "12 rue de la Paix")
    assert result["status"] == "rejected"
    assert result["verified"] is False
    assert result["rejection_reason"] is not None
    assert "IN-1" in result["rejection_reason"]


def test_certificate_document_passes_in1():
    result = check_mrh_extraction(_cert(), "Jean Dupont", "12 rue de la Paix, 75001 Paris")
    assert result["verified"] is True
    assert result["status"] == "verified"


def test_unknown_doc_type_not_hard_rejected():
    result = check_mrh_extraction(_cert({"document_type": "unknown"}), "Jean Dupont", "12 rue de la Paix")
    assert result["status"] != "rejected"
    assert "doc_type_unknown" in result["flags"]


# ── IN-2: name / address matching ────────────────────────────────────────────

def test_name_match_exact():
    result = check_mrh_extraction(_cert({"insured_name": "Jean Dupont"}), "Jean Dupont", "12 rue de la Paix")
    assert "name_mismatch" not in result["flags"]


def test_name_match_accent_difference():
    # "Élodie" extracted, expected "Elodie" — accent-stripped match → no flag
    result = check_mrh_extraction(
        _cert({"insured_name": "Élodie Martin"}),
        "Elodie",
        "12 rue de la Paix",
    )
    assert "name_mismatch" not in result["flags"]


def test_name_mismatch_flags_not_blocks():
    result = check_mrh_extraction(_cert({"insured_name": "Pierre Martin"}), "Jean Dupont", "12 rue de la Paix")
    assert "name_mismatch" in result["flags"]
    assert result["status"] in ("flagged", "verified")
    assert result["rejection_reason"] is None


def test_name_mismatch_never_builds_regex_from_db():
    # ReDoS trap: malicious expected_name with catastrophic backtracking pattern.
    evil_name = "((a+)+)" * 5
    # Should return in finite time (no RegExp built from expected_name).
    result = check_mrh_extraction(_cert({"insured_name": "Jean Dupont"}), evil_name, "address")
    assert isinstance(result, dict)


# ── IN-3: insurer country ────────────────────────────────────────────────────

def test_foreign_insurer_hard_block():
    result = check_mrh_extraction(_cert({"insurer_country": "UK"}), "Jean Dupont", "12 rue de la Paix")
    assert result["status"] == "rejected"
    assert result["verified"] is False
    assert result["rejection_reason"] is not None
    assert "IN-3" in result["rejection_reason"]


def test_fr_insurer_passes():
    result = check_mrh_extraction(_cert({"insurer_country": "FR"}), "Jean Dupont", "12 rue de la Paix, 75001 Paris")
    assert result["verified"] is True
    assert result["mrh_insurer_fr"] is True


def test_unknown_country_flagged_not_blocked():
    result = check_mrh_extraction(_cert({"insurer_country": None}), "Jean Dupont", "12 rue de la Paix")
    assert "insurer_country_unknown" in result["flags"]
    assert result["status"] in ("flagged", "verified")
    assert result["mrh_insurer_fr"] is None


# ── IN-4: cover dates ────────────────────────────────────────────────────────

def test_cover_start_stored_in_result():
    result = check_mrh_extraction(
        _cert({"cover_start": "2026-07-01", "cover_end": "2027-07-01"}),
        "Jean Dupont",
        "12 rue de la Paix, 75001 Paris",
    )
    assert result["mrh_cover_start"] == "2026-07-01"
    assert result["mrh_cover_end"] == "2027-07-01"


def test_missing_cover_start_flagged():
    result = check_mrh_extraction(
        _cert({"cover_start": None, "cover_end": None}),
        "Jean Dupont",
        "12 rue de la Paix",
    )
    assert "cover_dates_missing" in result["flags"]


# ── IN-5: flagged results are never hard-gated ───────────────────────────────

def test_no_fields_gated_on_insurance():
    # Name mismatch → flagged (200-worthy), never rejected, no rejection_reason
    result = check_mrh_extraction(_cert({"insured_name": "Pierre Martin"}), "Jean Dupont", "12 rue de la Paix")
    assert result["status"] == "flagged"
    assert result["rejection_reason"] is None


# ── assurance always MEDIUM ───────────────────────────────────────────────────

def test_assurance_always_medium():
    # verified path
    assert check_mrh_extraction(_cert(), "Jean Dupont", "12 rue de la Paix, 75001 Paris")["mrh_assurance"] == "MEDIUM"
    # rejected path (IN-1)
    assert check_mrh_extraction(_cert({"document_type": "quote"}), "Jean Dupont", "x")["mrh_assurance"] == "MEDIUM"
    # rejected path (IN-3)
    assert check_mrh_extraction(_cert({"insurer_country": "DE"}), "Jean Dupont", "x")["mrh_assurance"] == "MEDIUM"
    # flagged path
    assert check_mrh_extraction(_cert({"insured_name": "Other Person"}), "Jean Dupont", "x")["mrh_assurance"] == "MEDIUM"


# ── input validation ──────────────────────────────────────────────────────────

def test_non_dict_extracted_raises():
    import pytest
    with pytest.raises(TypeError):
        check_mrh_extraction(None, expected_name=None, expected_address=None)


def test_malformed_cover_date_flagged():
    result = check_mrh_extraction(
        _cert({"cover_start": "01-07-2026", "cover_end": "N/A"}),
        expected_name="Jean Dupont",
        expected_address=None,
    )
    assert "cover_dates_malformed" in result["flags"]


# ── endpoint integration tests ────────────────────────────────────────────────

import io
from tests_integration.conftest import make_user, auth


def _patch_mrh(monkeypatch, *, document_type="certificate", insurer_country="FR",
               insured_name="Jean Dupont", cover_start="2026-07-01", cover_end="2027-07-01"):
    import app.services.mrh_insurance as svc_mod

    async def _mock_verify(file_content=None, file_type=None, expected_name=None, expected_address=None):  # noqa: ARG001
        return svc_mod.check_mrh_extraction(
            {
                "document_type": document_type,
                "insurer_country": insurer_country,
                "insured_name": insured_name,
                "property_address": "12 rue de la Paix, 75001 Paris",
                "cover_start": cover_start,
                "cover_end": cover_end,
            },
            expected_name=expected_name,
            expected_address=expected_address,
        )

    monkeypatch.setattr(svc_mod.mrh_insurance_service, "verify", _mock_verify)


def _pdf_upload(filename="attestation.pdf"):
    return {"file": (filename, io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")}


@pytest.mark.asyncio
async def test_insurance_upload_happy_path(client, monkeypatch):
    sm = client._sessionmaker
    user = await make_user(sm, role="tenant")
    _patch_mrh(monkeypatch, insured_name=user.full_name)
    resp = await client.post(
        "/verification/insurance/upload",
        files=_pdf_upload(),
        headers=auth(user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["verified"] is True
    assert data["mrh_assurance"] == "MEDIUM"
    assert data["mrh_insurer_fr"] is True


@pytest.mark.asyncio
async def test_insurance_upload_quote_rejected(client, monkeypatch):
    sm = client._sessionmaker
    user = await make_user(sm, role="tenant")
    _patch_mrh(monkeypatch, document_type="quote")
    resp = await client.post(
        "/verification/insurance/upload",
        files=_pdf_upload(),
        headers=auth(user),
    )
    assert resp.status_code == 400
    assert "IN-1" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_insurance_upload_foreign_insurer_rejected(client, monkeypatch):
    sm = client._sessionmaker
    user = await make_user(sm, role="tenant")
    _patch_mrh(monkeypatch, insurer_country="UK")
    resp = await client.post(
        "/verification/insurance/upload",
        files=_pdf_upload(),
        headers=auth(user),
    )
    assert resp.status_code == 400
    assert "IN-3" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_insurance_upload_name_mismatch_flagged_not_blocked(client, monkeypatch):
    sm = client._sessionmaker
    user = await make_user(sm, role="tenant")
    _patch_mrh(monkeypatch, insured_name="Paul Autre")
    resp = await client.post(
        "/verification/insurance/upload",
        files=_pdf_upload(),
        headers=auth(user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "flagged"
    assert "name_mismatch" in data["flags"]


@pytest.mark.asyncio
async def test_insurance_upload_requires_auth(client):
    resp = await client.post(
        "/verification/insurance/upload",
        files=_pdf_upload(),
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_insurance_upload_stores_cover_dates(client, monkeypatch):
    from sqlalchemy import select as sa_select
    from app.models.user import User as UserModel

    sm = client._sessionmaker
    user = await make_user(sm, role="tenant")
    _patch_mrh(monkeypatch, cover_start="2026-09-01", cover_end="2027-09-01")
    resp = await client.post(
        "/verification/insurance/upload",
        files=_pdf_upload(),
        headers=auth(user),
    )
    assert resp.status_code == 200
    assert resp.json()["mrh_cover_start"] == "2026-09-01"

    # Verify persistence in DB
    async with sm() as session:
        result = await session.execute(sa_select(UserModel).where(UserModel.id == user.id))
        db_user = result.scalar_one()
        assert db_user.insurance_data["mrh_cover_start"] == "2026-09-01"
