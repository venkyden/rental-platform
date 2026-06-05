"""
Credential core — integration tests.

Covers §2 (credential schema) and §5.2 (assurance-labelling) from the DOSSIER.
Each row in the edge-case matrix has at least one test.

Run: cd backend && DATABASE_URL=... pytest tests_integration/test_credential_core.py -q
"""

import pytest
from tests_integration.conftest import make_user, auth

# ── helpers ──────────────────────────────────────────────────────────────────

def _token(user) -> str:
    return auth(user)["Authorization"].split(" ")[1]


VALID_FR_CLAIMS_HIGH = {
    "identity_verified": True,
    "identity_assurance": "HIGH",
    "identity_source": "france_identite_justificatif",
    "solvency_ratio": ">=3.0",
    "solvency_assurance": "HIGH",
}

VALID_FR_CLAIMS_MEDIUM = {
    "identity_verified": True,
    "identity_assurance": "MEDIUM",
    "identity_source": "ocr_liveness",
}


async def _issue(client, token: str, payload: dict):
    return await client.post(
        "/credentials/issue",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )


async def _verify(client, credential_id: str):
    return await client.get(f"/credentials/{credential_id}")


# ── basic happy paths ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_issue_fr_high_credential(client):
    """Issue a valid FR/HIGH credential; signature must be valid on verify."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    r = await _issue(client, _token(tenant), {
        "subject_role": "tenant",
        "rail": "FR",
        "claims": VALID_FR_CLAIMS_HIGH,
        "subject_display_name": "Jean Dupont",
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["credential_id"].startswith("vc_")
    assert body["claims"]["identity_assurance"] == "HIGH"
    assert body["revoked"] is False

    # Public verify — no auth header
    rv = await _verify(client, body["credential_id"])
    assert rv.status_code == 200
    vb = rv.json()
    assert vb["valid"] is True
    assert vb["signature_valid"] is True
    assert vb["expired"] is False
    assert vb["revoked"] is False


@pytest.mark.asyncio
async def test_issue_fr_medium_credential(client):
    """OCR+liveness source must produce MEDIUM, never HIGH."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    r = await _issue(client, _token(tenant), {
        "subject_role": "tenant",
        "rail": "FR",
        "claims": VALID_FR_CLAIMS_MEDIUM,
    })
    assert r.status_code == 201, r.text
    assert r.json()["claims"]["identity_assurance"] == "MEDIUM"


@pytest.mark.asyncio
async def test_public_key_endpoint(client):
    """Public key endpoint returns PEM without auth."""
    r = await client.get("/credentials/public-key")
    assert r.status_code == 200
    assert b"BEGIN PUBLIC KEY" in r.content


@pytest.mark.asyncio
async def test_verify_unknown_credential_returns_404(client):
    """Verify with an unknown ID returns 404, not 200/valid:false."""
    r = await _verify(client, "vc_doesnotexist1234567890")
    assert r.status_code == 404


# ── AS-1 / AS-2: assurance labelling (DOSSIER §5.2) ─────────────────────────

@pytest.mark.asyncio
async def test_AS1_ocr_source_cannot_claim_high(client):
    """
    AS-1 / AS-3: ocr_liveness (MEDIUM-only source) must not be accepted with
    identity_assurance=HIGH. The signing service rejects before storing.
    """
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    r = await _issue(client, _token(tenant), {
        "subject_role": "tenant",
        "rail": "FR",
        "claims": {
            "identity_verified": True,
            "identity_assurance": "HIGH",       # INVALID — source is MEDIUM-only
            "identity_source": "ocr_liveness",
        },
    })
    assert r.status_code == 422
    detail = r.json()["detail"].lower()
    assert "inflation" in detail or "medium" in detail


@pytest.mark.asyncio
async def test_AS1_mrz_ocr_source_cannot_claim_high(client):
    """AS-1: mrz_ocr_liveness (MEDIUM-only) rejected when HIGH assurance claimed."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    r = await _issue(client, _token(tenant), {
        "subject_role": "tenant",
        "rail": "INTL",
        "claims": {
            "identity_verified": True,
            "identity_assurance": "HIGH",
            "identity_source": "mrz_ocr_liveness",
        },
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_AS2_solvency_assurance_must_be_valid_band(client):
    """AS-2: solvency_assurance must be HIGH / MEDIUM / UNVERIFIED."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    r = await _issue(client, _token(tenant), {
        "subject_role": "tenant",
        "rail": "FR",
        "claims": {
            "identity_assurance": "HIGH",
            "identity_source": "france_identite_justificatif",
            "solvency_ratio": ">=3.0",
            "solvency_assurance": "VERIFIED",   # invalid — not in the enum
        },
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_AS3_raw_solvency_ratio_rejected(client):
    """
    AS-3 / SV-7: solvency_ratio must be a banded string, never a raw number.
    Passing a float must be rejected before signing.
    """
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    r = await _issue(client, _token(tenant), {
        "subject_role": "tenant",
        "rail": "FR",
        "claims": {
            "identity_assurance": "HIGH",
            "identity_source": "france_identite_justificatif",
            "solvency_ratio": 3.5,              # raw number — must be rejected
            "solvency_assurance": "HIGH",
        },
    })
    assert r.status_code == 422
    detail = r.json()["detail"].lower()
    assert "banded" in detail or "string" in detail


@pytest.mark.asyncio
async def test_AS3_solvency_ratio_without_operator_rejected(client):
    """AS-3: solvency_ratio string must begin with a comparison operator."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    r = await _issue(client, _token(tenant), {
        "subject_role": "tenant",
        "rail": "FR",
        "claims": {
            "solvency_ratio": "3.0",            # no operator — rejected
            "solvency_assurance": "HIGH",
        },
    })
    assert r.status_code == 422


# ── revocation ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_revocation_makes_credential_invalid(client):
    """Revoked credential returns valid:false and revoked:true on public verify."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")
    tok = _token(tenant)

    issue_r = await _issue(client, tok, {
        "subject_role": "tenant",
        "rail": "FR",
        "claims": VALID_FR_CLAIMS_HIGH,
    })
    assert issue_r.status_code == 201
    cid = issue_r.json()["credential_id"]

    revoke_r = await client.post(
        f"/credentials/{cid}/revoke",
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert revoke_r.status_code == 200

    verify_r = await _verify(client, cid)
    assert verify_r.status_code == 200
    vb = verify_r.json()
    assert vb["valid"] is False
    assert vb["revoked"] is True
    assert vb["signature_valid"] is True   # sig still holds — revocation is a store flag


@pytest.mark.asyncio
async def test_revocation_by_other_user_forbidden(client):
    """Only the credential subject may revoke their credential."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")
    other = await make_user(sm, role="tenant")

    issue_r = await _issue(client, _token(tenant), {
        "subject_role": "tenant",
        "rail": "FR",
        "claims": VALID_FR_CLAIMS_HIGH,
    })
    cid = issue_r.json()["credential_id"]

    revoke_r = await client.post(
        f"/credentials/{cid}/revoke",
        headers={"Authorization": f"Bearer {_token(other)}"},
    )
    assert revoke_r.status_code == 403


# ── evidence PDF ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_evidence_pdf_returns_pdf_content(client):
    """Evidence PDF endpoint returns application/pdf without auth (public)."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    issue_r = await _issue(client, _token(tenant), {
        "subject_role": "tenant",
        "rail": "FR",
        "claims": VALID_FR_CLAIMS_HIGH,
        "subject_display_name": "Jean Dupont",
    })
    cid = issue_r.json()["credential_id"]

    # No auth header — public endpoint
    pdf_r = await client.get(f"/credentials/{cid}/evidence.pdf")
    assert pdf_r.status_code == 200
    assert pdf_r.headers["content-type"] == "application/pdf"
    assert pdf_r.content[:4] == b"%PDF"


@pytest.mark.asyncio
async def test_evidence_pdf_unknown_credential_404(client):
    """PDF for unknown credential returns 404."""
    r = await client.get("/credentials/vc_notreal1234567890/evidence.pdf")
    assert r.status_code == 404


# ── input validation ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invalid_subject_role_rejected(client):
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    r = await _issue(client, _token(tenant), {
        "subject_role": "admin",    # not a valid role
        "rail": "FR",
        "claims": {},
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_invalid_rail_rejected(client):
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    r = await _issue(client, _token(tenant), {
        "subject_role": "tenant",
        "rail": "UK",               # not FR or INTL
        "claims": {},
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_issue_requires_auth(client):
    """POST /credentials/issue without a token returns 401."""
    r = await client.post("/credentials/issue", json={
        "subject_role": "tenant",
        "rail": "FR",
        "claims": VALID_FR_CLAIMS_HIGH,
    })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_unknown_identity_source_rejected(client):
    """Unknown identity_source values are rejected before signing."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    r = await _issue(client, _token(tenant), {
        "subject_role": "tenant",
        "rail": "FR",
        "claims": {
            "identity_verified": True,
            "identity_assurance": "HIGH",
            "identity_source": "hacked_database",   # not a valid source
        },
    })
    assert r.status_code == 422


# ── landlord + property roles ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_issue_landlord_credential(client):
    """Landlord credential with property_control claim issues cleanly."""
    sm = client._sessionmaker
    landlord = await make_user(sm, role="landlord")

    r = await _issue(client, _token(landlord), {
        "subject_role": "landlord",
        "rail": "FR",
        "claims": {
            "identity_verified": True,
            "identity_assurance": "HIGH",
            "identity_source": "france_identite_justificatif",
            "property_control": True,
            "property_assurance": "MEDIUM",
        },
        "subject_display_name": "Marie Martin",
    })
    assert r.status_code == 201
    body = r.json()
    assert body["subject_role"] == "landlord"
    assert body["claims"]["property_control"] is True


@pytest.mark.asyncio
async def test_assurance_summary_on_verify(client):
    """Verify response includes a human-readable assurance_summary."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    issue_r = await _issue(client, _token(tenant), {
        "subject_role": "tenant",
        "rail": "FR",
        "claims": VALID_FR_CLAIMS_HIGH,
    })
    cid = issue_r.json()["credential_id"]

    rv = await _verify(client, cid)
    assert "assurance_summary" in rv.json()
    assert rv.json()["assurance_summary"] != ""
