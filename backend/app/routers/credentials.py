"""
Credential endpoints — issue, verify (public), public-key, evidence PDF.

Access model (DOSSIER §12):
- POST /credentials/issue   — authenticated (subject must be logged-in user or passwordless lane)
- GET  /credentials/{id}    — PUBLIC, no account required
- GET  /credentials/public-key — PUBLIC
- GET  /credentials/{id}/evidence.pdf — PUBLIC (anyone can re-fetch until expiry)
"""

import io
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.timeutils import naive_utcnow
from app.models.credential import Credential
from app.routers.auth import get_current_user
from app.models.user import User
from app.services.credential import credential_service

logger = logging.getLogger(__name__)

# Per-IP rate limiting on the PUBLIC endpoints (verify page, evidence PDF):
# credential IDs are 128-bit so enumeration is hopeless, but the limits stop
# scraping and unauthenticated DB hammering (anti-phishing dossier, WS-6).
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/credentials", tags=["Credentials"])

VERIFY_BASE_URL = "https://roomivo.app"


# ── request / response schemas ───────────────────────────────────────────────

class IssueRequest(BaseModel):
    subject_role: str           # tenant | landlord | property
    rail: str                   # FR | INTL
    claims: dict
    subject_display_name: Optional[str] = None
    ttl_days: int = 30


class CredentialResponse(BaseModel):
    credential_id: str
    subject_role: str
    subject_display_name: Optional[str]
    issued_at: str
    expires_at: str
    rail: str
    claims: dict
    disclaimer: str
    signature: str
    kid: Optional[str] = None    # id of the signing key (see /credentials/public-keys)
    revoked: bool


class VerifyResponse(BaseModel):
    credential_id: str
    valid: bool                  # False if expired, revoked, or sig invalid
    expired: bool
    revoked: bool
    signature_valid: bool
    subject_role: str
    subject_display_name: Optional[str]
    issued_at: str
    expires_at: str
    rail: str
    claims: dict
    disclaimer: str
    kid: Optional[str] = None    # id of the signing key (see /credentials/public-keys)
    assurance_summary: str       # human-readable summary for the verify page


def _assurance_summary(claims: dict) -> str:
    parts = []
    ia = claims.get("identity_assurance")
    if ia:
        parts.append(f"Identité : {ia}")
    sa = claims.get("solvency_assurance")
    if sa:
        parts.append(f"Solvabilité : {sa}")
    pa = claims.get("property_assurance")
    if pa:
        parts.append(f"Bien : {pa}")
    ma = claims.get("mrh_insurance_assurance")
    if ma:
        status_label = "OK" if claims.get("mrh_insurance_verified") else "Signalé"
        parts.append(f"Assurance MRH : {ma} ({status_label})")
    return " | ".join(parts) if parts else "Aucune attestation"


# ── endpoints ────────────────────────────────────────────────────────────────

@router.get("/public-key", summary="Ed25519 public key (PEM)")
async def get_public_key():
    """
    Returns the PEM-encoded Ed25519 public key used to verify credential signatures.
    Technical / B2B verifiers can check signatures independently without calling this API.
    """
    return Response(
        content=credential_service.public_key_pem(),
        media_type="application/x-pem-file",
    )


class KeyHistoryEntry(BaseModel):
    kid: str
    public_key_pem: str
    status: str  # active | retired


class PublicKeysResponse(BaseModel):
    keys: list[KeyHistoryEntry]


@router.get("/public-keys", summary="Verification key history (JSON)", response_model=PublicKeysResponse)
async def get_public_keys():
    """
    All verification keys: active signing key first, then retired keys kept
    verify-only until credentials they signed expire.

    Each entry: {kid, public_key_pem, status: active|retired}. Credential
    `kid` names its signing key; verifiers should reject unknown kids.
    Rotation runbook: docs/features/trust-layer/KEY-LIFECYCLE.md
    """
    return PublicKeysResponse(keys=credential_service.key_history())


@router.post("/issue", response_model=CredentialResponse, status_code=status.HTTP_201_CREATED)
async def issue_credential(
    req: IssueRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Issue a signed, banded credential for the authenticated user.

    Claims are validated before signing — assurance inflation (MEDIUM source → HIGH claim)
    raises 422. Solvency ratios must be banded strings, never raw figures.

    The signed record is stored in the thin credentials store (banded claims only,
    no source documents). The credential_id is the shareable verify key.
    """
    try:
        payload = credential_service.issue(
            subject_role=req.subject_role,
            rail=req.rail,
            claims=req.claims,
            subject_display_name=req.subject_display_name or current_user.full_name,
            ttl_days=req.ttl_days,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    issued_at = datetime.fromisoformat(payload["issued_at"].rstrip("Z"))
    expires_at = datetime.fromisoformat(payload["expires_at"].rstrip("Z"))

    row = Credential(
        id=payload["credential_id"],
        subject_role=payload["subject_role"],
        rail=payload["rail"],
        subject_user_id=current_user.id,
        subject_display_name=payload.get("subject_display_name"),
        issued_at=issued_at,
        expires_at=expires_at,
        claims=payload["claims"],
        disclaimer=payload["disclaimer"],
        signature=payload["signature"],
        kid=payload.get("kid"),
        revoked=False,
    )
    db.add(row)
    await db.flush()

    return CredentialResponse(
        credential_id=row.id,
        subject_role=row.subject_role,
        subject_display_name=row.subject_display_name,
        issued_at=payload["issued_at"],
        expires_at=payload["expires_at"],
        rail=row.rail,
        claims=row.claims,
        disclaimer=row.disclaimer,
        signature=row.signature,
        kid=row.kid,
        revoked=row.revoked,
    )


@router.get("/{credential_id}", response_model=VerifyResponse, summary="Verify credential (public)")
# shared_limit + fixed scope: the default limit buckets per URL PATH, so an
# enumerator rotating credential IDs would get a fresh allowance per guess.
# A shared scope buckets per IP across the whole endpoint.
@limiter.shared_limit("30/minute", scope="credentials-verify")
async def verify_credential(
    request: Request,  # noqa: ARG001 — consumed by @limiter
    credential_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — no account or token required.

    Returns banded claims + validity status. The verifier (landlord/tenant on
    Leboncoin) enters the credential_id they received in chat and gets a plain
    answer: valid / expired / revoked / signature mismatch.

    Never returns raw PII — only the banded claims stored at issuance.
    """
    row: Credential | None = await db.scalar(
        select(Credential).where(Credential.id == credential_id)
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Credential not found")

    now = naive_utcnow()
    expired = now > row.expires_at
    revoked = row.revoked

    record = {
        "credential_id": row.id,
        "subject_role": row.subject_role,
        "issued_at": row.issued_at.isoformat() + "Z",
        "expires_at": row.expires_at.isoformat() + "Z",
        "rail": row.rail,
        "claims": row.claims,
        "disclaimer": row.disclaimer,
        "signature": row.signature,
        "subject_display_name": row.subject_display_name,
    }
    # Legacy rows have no kid — omit the field so key-trial verification applies
    if row.kid:
        record["kid"] = row.kid
    sig_valid = credential_service.verify_signature(record)
    valid = sig_valid and not expired and not revoked

    return VerifyResponse(
        credential_id=row.id,
        valid=valid,
        expired=expired,
        revoked=revoked,
        signature_valid=sig_valid,
        subject_role=row.subject_role,
        subject_display_name=row.subject_display_name,
        issued_at=record["issued_at"],
        expires_at=record["expires_at"],
        rail=row.rail,
        claims=row.claims,
        disclaimer=row.disclaimer,
        kid=row.kid,
        assurance_summary=_assurance_summary(row.claims),
    )


@router.get(
    "/{credential_id}/evidence.pdf",
    summary="Download watermarked evidence document (public)",
    response_class=Response,
)
@limiter.shared_limit("10/minute", scope="credentials-evidence")  # PDF generation is expensive; see scope note above
async def get_evidence_pdf(
    request: Request,  # noqa: ARG001 — consumed by @limiter
    credential_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate and stream the watermarked, evidence-grade PDF for a credential.

    Public endpoint — the victim of a deposit-theft scam can re-fetch this until
    the credential expires. No account required.

    The PDF contains: subject name, banded claims + assurance tiers, timestamps,
    credential_id, verify-by-ID instruction, Ed25519 signature, and disclaimer.
    It does NOT contain raw income figures, identity document numbers, or any PII
    beyond the display name the subject chose to include.
    """
    row: Credential | None = await db.scalar(
        select(Credential).where(Credential.id == credential_id)
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Credential not found")

    record = {
        "credential_id": row.id,
        "subject_role": row.subject_role,
        "subject_display_name": row.subject_display_name,
        "issued_at": row.issued_at.isoformat() + "Z",
        "expires_at": row.expires_at.isoformat() + "Z",
        "rail": row.rail,
        "claims": row.claims,
        "disclaimer": row.disclaimer,
        "signature": row.signature,
    }

    try:
        pdf_bytes = credential_service.export_evidence_pdf(record, verify_base_url=VERIFY_BASE_URL)
    except RuntimeError as exc:
        logger.error("Evidence PDF generation failed: %s", exc)
        raise HTTPException(status_code=503, detail="PDF generation unavailable")

    filename = f"roomivo-verification-{credential_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class IssueMineResponse(BaseModel):
    credential_id: str
    subject_role: str
    subject_display_name: Optional[str]
    issued_at: str
    expires_at: str
    rail: str
    claims: dict
    disclaimer: str
    signature: str
    kid: Optional[str] = None
    shareable_url: str


def _build_claims_for_user(current_user) -> dict:
    """Assemble banded claims from the user's verified state. Never inflates."""
    identity_data = current_user.identity_data or {}
    income_data = current_user.income_data or {}
    ownership_data = current_user.ownership_data or {}

    identity_assurance = identity_data.get("identity_assurance", "UNVERIFIED")
    solvency_assurance = income_data.get("solvency_assurance", "UNVERIFIED")
    solvency_ratio = income_data.get("solvency_ratio")

    claims: dict = {"identity_assurance": identity_assurance}

    if solvency_ratio and solvency_assurance != "UNVERIFIED":
        claims["solvency_ratio"] = solvency_ratio
        claims["solvency_assurance"] = solvency_assurance

    # Fiscal-capacity (funds) claim — MEDIUM only, never inflated
    funds = income_data.get("funds_coverage") or {}
    if funds.get("assurance") == "MEDIUM" and funds.get("funds_band") not in (None, "unavailable"):
        claims["funds_coverage_band"] = funds["funds_band"]
        claims["funds_coverage_source"] = funds.get("funds_source", "self")
        claims["funds_coverage_assurance"] = "MEDIUM"

    dpe_assurance = ownership_data.get("dpe_assurance") or ownership_data.get("assurance")
    control_label = ownership_data.get("label")
    if dpe_assurance and dpe_assurance not in ("UNVERIFIED", "PENDING"):
        claims["property_control_assurance"] = dpe_assurance
    if control_label:
        claims["property_control_label"] = control_label

    # MRH insurance claim (DOSSIER §5.8 — always MEDIUM, never gated)
    insurance_data = current_user.insurance_data or {}
    mrh_status = insurance_data.get("status")
    if mrh_status in ("verified", "flagged"):
        claims["mrh_insurance_verified"] = mrh_status == "verified"
        claims["mrh_insurance_assurance"] = "MEDIUM"
        claims["mrh_insurance_status"] = mrh_status
        if insurance_data.get("flags"):
            claims["mrh_insurance_flags"] = insurance_data["flags"]

    # Deposit-binding (item 15) + entity/SCI (item 16) — landlord-side evidence.
    deposit_binding_data = current_user.deposit_binding_data or {}
    binding = deposit_binding_data.get("binding") if isinstance(deposit_binding_data, dict) else None
    if isinstance(binding, dict):
        claims["deposit_binding"] = {
            "deposit_amount": binding.get("deposit_amount"),
            "lease_type": binding.get("lease_type"),
            "payee_iban_masked": binding.get("payee_iban_masked"),
            "payee_name_match": binding.get("payee_name_match"),
            "payee_match_target": binding.get("payee_match_target"),
            "bank_ownership_confirmed": False,
            "bound_at": binding.get("bound_at"),
        }
    entity = deposit_binding_data.get("landlord_entity") if isinstance(deposit_binding_data, dict) else None
    if isinstance(entity, dict) and entity.get("type"):
        claims["landlord_type"] = entity["type"]
        if entity.get("denomination"):
            claims["entity_verified"] = {
                "denomination": entity["denomination"],
                "gerant_match": entity.get("gerant_match", False),
            }

    return claims


@router.post("/issue-mine", response_model=IssueMineResponse, status_code=status.HTTP_201_CREATED)
async def issue_mine(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Assemble a credential from the user's current verified state and sign it.

    Reads identity_data, income_data, and ownership_data to build banded claims.
    Never inflates assurance — MEDIUM stays MEDIUM, UNVERIFIED stays UNVERIFIED.
    The returned credential_id is the shareable verify key: roomivo.app/c/<id>.
    """
    claims = _build_claims_for_user(current_user)

    # Determine role and rail from what the user has verified
    subject_role = "landlord" if current_user.ownership_verified else "tenant"
    rail = "FR"

    try:
        payload = credential_service.issue(
            subject_role=subject_role,
            rail=rail,
            claims=claims,
            subject_display_name=current_user.full_name,
            ttl_days=30,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    issued_at = datetime.fromisoformat(payload["issued_at"].rstrip("Z"))
    expires_at = datetime.fromisoformat(payload["expires_at"].rstrip("Z"))

    row = Credential(
        id=payload["credential_id"],
        subject_role=payload["subject_role"],
        rail=payload["rail"],
        subject_user_id=current_user.id,
        subject_display_name=payload.get("subject_display_name"),
        issued_at=issued_at,
        expires_at=expires_at,
        claims=payload["claims"],
        disclaimer=payload["disclaimer"],
        signature=payload["signature"],
        kid=payload.get("kid"),
        revoked=False,
    )
    db.add(row)
    await db.flush()

    shareable_url = f"{VERIFY_BASE_URL}/c/{row.id}"
    return IssueMineResponse(
        credential_id=row.id,
        subject_role=row.subject_role,
        subject_display_name=row.subject_display_name,
        issued_at=payload["issued_at"],
        expires_at=payload["expires_at"],
        rail=row.rail,
        claims=row.claims,
        disclaimer=row.disclaimer,
        signature=row.signature,
        kid=row.kid,
        shareable_url=shareable_url,
    )


@router.post("/{credential_id}/revoke", status_code=status.HTTP_200_OK)
async def revoke_credential(
    credential_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Revoke a credential. Only the subject who owns it may revoke.
    Revocation is immediate — the public verify endpoint will return revoked=true.
    """
    row: Credential | None = await db.scalar(
        select(Credential).where(Credential.id == credential_id)
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Credential not found")
    if row.subject_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You may only revoke your own credentials")
    if row.revoked:
        return {"detail": "Already revoked"}

    row.revoked = True
    row.revoked_at = naive_utcnow()
    await db.flush()
    return {"detail": "Revoked", "credential_id": credential_id}
