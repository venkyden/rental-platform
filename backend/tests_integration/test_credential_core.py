"""
Credential core — integration tests.

Covers §2 (credential schema) and §5.2 (assurance-labelling) from the DOSSIER.
Each row in the edge-case matrix has at least one test.

Claims are only ever built by the server (POST /credentials/issue-mine). The
validation rules are tested on the signing service itself; the stored-credential
flows (public verify, revoke, evidence PDF) use credentials signed by the same
service and stored the way issue-mine stores them.

Run: cd backend && DATABASE_URL=... pytest tests_integration/test_credential_core.py -q
"""

from datetime import datetime

import pytest

from app.models.credential import Credential
from app.services.credential import credential_service
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


def _sign(subject_role="tenant", rail="FR", claims=None, name=None) -> dict:
    return credential_service.issue(
        subject_role=subject_role, rail=rail, claims=claims or {}, subject_display_name=name,
    )


async def _store(sm, user, **kwargs) -> dict:
    """Sign a credential for `user` and store it as issue-mine does."""
    payload = _sign(**kwargs)
    async with sm() as s:
        s.add(Credential(
            id=payload["credential_id"],
            subject_role=payload["subject_role"],
            rail=payload["rail"],
            subject_user_id=user.id,
            subject_display_name=payload.get("subject_display_name"),
            issued_at=datetime.fromisoformat(payload["issued_at"].rstrip("Z")),
            expires_at=datetime.fromisoformat(payload["expires_at"].rstrip("Z")),
            claims=payload["claims"],
            disclaimer=payload["disclaimer"],
            signature=payload["signature"],
            kid=payload.get("kid"),
            revoked=False,
        ))
        await s.commit()
    return payload


async def _verify(client, credential_id: str):
    return await client.get(f"/credentials/{credential_id}")


# ── no caller-supplied claims ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_there_is_no_route_that_signs_caller_supplied_claims(client):
    """POST /credentials/issue signed any claims, name and lifetime it was sent."""
    tenant = await make_user(client._sessionmaker, role="tenant")
    r = await client.post("/credentials/issue", json={
        "subject_role": "tenant", "rail": "FR", "claims": VALID_FR_CLAIMS_HIGH,
        "subject_display_name": "Someone Else", "ttl_days": 36500,
    }, headers=auth(tenant))
    assert r.status_code in (404, 405)


@pytest.mark.asyncio
async def test_issue_mine_ignores_claims_in_the_request(client):
    """An unverified user cannot talk issue-mine into a HIGH identity claim."""
    tenant = await make_user(client._sessionmaker, role="tenant")
    r = await client.post("/credentials/issue-mine", json={
        "claims": VALID_FR_CLAIMS_HIGH, "subject_display_name": "Someone Else", "ttl_days": 36500,
    }, headers=auth(tenant))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["claims"].get("identity_assurance") != "HIGH"
    assert body["subject_display_name"] == tenant.full_name
    issued = datetime.fromisoformat(body["issued_at"].rstrip("Z"))
    expires = datetime.fromisoformat(body["expires_at"].rstrip("Z"))
    assert (expires - issued).days <= 30


# ── basic happy paths ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fr_high_credential_verifies(client):
    """A stored FR/HIGH credential has a valid signature on public verify."""
    tenant = await make_user(client._sessionmaker, role="tenant")
    payload = await _store(client._sessionmaker, tenant, claims=VALID_FR_CLAIMS_HIGH, name="Jean Dupont")
    assert payload["credential_id"].startswith("vc_")

    rv = await _verify(client, payload["credential_id"])
    assert rv.status_code == 200
    vb = rv.json()
    assert vb["valid"] is True
    assert vb["signature_valid"] is True
    assert vb["expired"] is False
    assert vb["revoked"] is False


def test_fr_medium_credential_stays_medium():
    """OCR+liveness source produces MEDIUM, never HIGH."""
    assert _sign(claims=VALID_FR_CLAIMS_MEDIUM)["claims"]["identity_assurance"] == "MEDIUM"


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

def test_AS1_ocr_source_cannot_claim_high():
    """AS-1 / AS-3: ocr_liveness (MEDIUM-only source) is refused with HIGH assurance."""
    with pytest.raises(ValueError, match="(?i)inflation|medium"):
        _sign(claims={"identity_verified": True, "identity_assurance": "HIGH", "identity_source": "ocr_liveness"})


def test_AS1_mrz_ocr_source_cannot_claim_high():
    """AS-1: mrz_ocr_liveness (MEDIUM-only) refused when HIGH assurance claimed."""
    with pytest.raises(ValueError):
        _sign(rail="INTL", claims={
            "identity_verified": True, "identity_assurance": "HIGH", "identity_source": "mrz_ocr_liveness",
        })


def test_AS2_solvency_assurance_must_be_valid_band():
    """AS-2: solvency_assurance must be HIGH / MEDIUM / UNVERIFIED."""
    with pytest.raises(ValueError):
        _sign(claims={
            "identity_assurance": "HIGH", "identity_source": "france_identite_justificatif",
            "solvency_ratio": ">=3.0", "solvency_assurance": "VERIFIED",
        })


def test_AS3_raw_solvency_ratio_rejected():
    """AS-3 / SV-7: solvency_ratio must be a banded string, never a raw number."""
    with pytest.raises(ValueError, match="(?i)banded|string"):
        _sign(claims={
            "identity_assurance": "HIGH", "identity_source": "france_identite_justificatif",
            "solvency_ratio": 3.5, "solvency_assurance": "HIGH",
        })


def test_AS3_solvency_ratio_without_operator_rejected():
    """AS-3: solvency_ratio string must begin with a comparison operator."""
    with pytest.raises(ValueError):
        _sign(claims={"solvency_ratio": "3.0", "solvency_assurance": "HIGH"})


# ── revocation ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_revocation_makes_credential_invalid(client):
    """Revoked credential returns valid:false and revoked:true on public verify."""
    tenant = await make_user(client._sessionmaker, role="tenant")
    cid = (await _store(client._sessionmaker, tenant, claims=VALID_FR_CLAIMS_HIGH))["credential_id"]

    revoke_r = await client.post(f"/credentials/{cid}/revoke", headers=auth(tenant))
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
    tenant = await make_user(client._sessionmaker, role="tenant")
    other = await make_user(client._sessionmaker, role="tenant")
    cid = (await _store(client._sessionmaker, tenant, claims=VALID_FR_CLAIMS_HIGH))["credential_id"]

    revoke_r = await client.post(f"/credentials/{cid}/revoke", headers=auth(other))
    assert revoke_r.status_code == 403


# ── evidence PDF ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_evidence_pdf_returns_pdf_content(client):
    """Evidence PDF endpoint returns application/pdf without auth (public)."""
    tenant = await make_user(client._sessionmaker, role="tenant")
    cid = (await _store(client._sessionmaker, tenant, claims=VALID_FR_CLAIMS_HIGH, name="Jean Dupont"))["credential_id"]

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

def test_invalid_subject_role_rejected():
    with pytest.raises(ValueError):
        _sign(subject_role="admin")


def test_invalid_rail_rejected():
    with pytest.raises(ValueError):
        _sign(rail="UK")


def test_unknown_identity_source_rejected():
    """Unknown identity_source values are rejected before signing."""
    with pytest.raises(ValueError):
        _sign(claims={"identity_verified": True, "identity_assurance": "HIGH", "identity_source": "hacked_database"})


# ── landlord + property roles ─────────────────────────────────────────────────

def test_landlord_credential_signs_property_control():
    """Landlord credential with property_control claim signs cleanly."""
    payload = _sign(subject_role="landlord", name="Marie Martin", claims={
        "identity_verified": True, "identity_assurance": "HIGH",
        "identity_source": "france_identite_justificatif",
        "property_control": True, "property_assurance": "MEDIUM",
    })
    assert payload["subject_role"] == "landlord"
    assert payload["claims"]["property_control"] is True


@pytest.mark.asyncio
async def test_assurance_summary_on_verify(client):
    """Verify response includes a human-readable assurance_summary."""
    tenant = await make_user(client._sessionmaker, role="tenant")
    cid = (await _store(client._sessionmaker, tenant, claims=VALID_FR_CLAIMS_HIGH))["credential_id"]

    rv = await _verify(client, cid)
    assert "assurance_summary" in rv.json()
    assert rv.json()["assurance_summary"] != ""


# ── issue-mine endpoint ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_issue_mine_identity_only(client):
    """issue-mine with only identity_data set emits a credential with identity_assurance."""
    from app.models.user import User
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    # Seed identity_data as the verification router would after OCR+liveness
    async with sm() as s:
        u = await s.get(User, tenant.id)
        u.identity_verified = True
        u.identity_data = {"identity_assurance": "MEDIUM", "identity_source": "ocr_liveness"}
        await s.commit()

    r = await client.post("/credentials/issue-mine", headers=auth(tenant))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["claims"]["identity_assurance"] == "MEDIUM"
    assert body["subject_role"] == "tenant"
    assert body["shareable_url"].startswith("https://roomivo.app/c/vc_")
    assert body["credential_id"].startswith("vc_")


@pytest.mark.asyncio
async def test_issue_mine_with_solvency(client):
    """issue-mine includes banded solvency claim when income_data is present."""
    from app.models.user import User
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    async with sm() as s:
        u = await s.get(User, tenant.id)
        u.identity_verified = True
        u.identity_data = {"identity_assurance": "MEDIUM"}
        u.income_data = {"solvency_assurance": "HIGH", "solvency_ratio": ">=3.0"}
        await s.commit()

    r = await client.post("/credentials/issue-mine", headers=auth(tenant))
    assert r.status_code == 201, r.text
    claims = r.json()["claims"]
    assert claims["solvency_ratio"] == ">=3.0"
    assert claims["solvency_assurance"] == "HIGH"


@pytest.mark.asyncio
async def test_issue_mine_requires_auth(client):
    """issue-mine rejects unauthenticated requests."""
    r = await client.post("/credentials/issue-mine")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_issue_mine_shareable_url_is_verifiable(client):
    """The credential_id from issue-mine resolves via the public verify endpoint."""
    from app.models.user import User
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    async with sm() as s:
        u = await s.get(User, tenant.id)
        u.identity_verified = True
        u.identity_data = {"identity_assurance": "MEDIUM"}
        await s.commit()

    r = await client.post("/credentials/issue-mine", headers=auth(tenant))
    cid = r.json()["credential_id"]

    rv = await client.get(f"/credentials/{cid}")
    assert rv.status_code == 200
    assert rv.json()["credential_id"] == cid
    assert rv.json()["signature_valid"] is True
