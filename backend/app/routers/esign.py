"""
E-sign Path B router — landlord uploads their own lease → both verified parties
e-sign → tamper-evident evidence pack. In-house Ed25519 (DOSSIER §0.16, §5.6, §5.7).

Endpoints (all under /esign):
- POST /esign/leases/{id}/document    landlord uploads the lease PDF to be signed
- POST /esign/leases/{id}/sign        a verified party signs (SG-1, SG-3, consent)
- GET  /esign/leases/{id}/status      current signing state (for the UI)
- GET  /esign/leases/{id}/evidence.pdf  signature evidence pack, once fully signed (SG-4)
"""

import os

from fastapi import (
    APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status,
)
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.models.user import User
from app.models.visits_and_leases import Lease
from app.routers.auth import get_current_user
from app.services import esign

router = APIRouter(prefix="/esign", tags=["esign"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR_LEASES", "uploads/leases")
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except PermissionError:
    pass

MAX_PDF_MB = 15
VERIFY_BASE_URL = "https://roomivo.app"


def _lease_pdf_path(lease_id) -> str:
    return os.path.join(UPLOAD_DIR, f"{lease_id}.pdf")


def _client_ip(request: Request) -> str | None:
    # Honour the proxy header but only take the first hop; fall back to the socket.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


async def _get_lease_or_404(lease_id: UUID, db: AsyncSession) -> Lease:
    result = await db.execute(select(Lease).where(Lease.id == lease_id))
    lease = result.scalar_one_or_none()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")
    return lease


class SignRequest(BaseModel):
    signature_image: str | None = None  # Base64 PNG of a drawn signature
    typed_name: str | None = None       # typed-name signature (alternative to drawn)
    consent: bool = False


@router.post("/leases/{lease_id}/document", status_code=status.HTTP_201_CREATED)
async def upload_lease_document(
    lease_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Landlord uploads their own lease PDF (Path B). We pin its SHA-256 (SG-3 anchor),
    store it, and open the signing round. Roomivo authors no wording (loi 1971 clear);
    the document is recorded as ATTACHED / NOT LEGALITY-VERIFIED.
    """
    lease = await _get_lease_or_404(lease_id, db)

    if lease.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the landlord can upload the lease document")
    if not current_user.identity_verified:
        raise HTTPException(status_code=403, detail="Identity verification required to upload a lease")
    if lease.status == "signed":
        raise HTTPException(status_code=409, detail="Lease is already signed; document cannot be replaced")

    # Reject oversized uploads BEFORE reading into memory (DoS guard).
    max_bytes = MAX_PDF_MB * 1024 * 1024
    declared_size = getattr(file, "size", None)
    if declared_size is not None and declared_size > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds the {MAX_PDF_MB}MB limit")

    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds the {MAX_PDF_MB}MB limit")
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Document must be a PDF")

    try:
        with open(_lease_pdf_path(lease_id), "wb") as f:
            f.write(content)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not store the document: {exc}")

    # New document → fresh signing round: clear any prior signatures/manifest.
    lease.document_hash = esign.compute_document_hash(content)
    lease.document_source = "uploaded"
    lease.pdf_path = _lease_pdf_path(lease_id)
    lease.signature_data = {"esign_audit": []}
    lease.landlord_signature = None
    lease.tenant_signature = None
    lease.esign_manifest = None
    lease.status = "awaiting_signatures"

    await db.commit()
    return {
        "lease_id": str(lease.id),
        "status": lease.status,
        "document_hash": lease.document_hash,
        "legality_status": esign.LEGALITY_STATUS_ATTACHED,
    }


@router.post("/leases/{lease_id}/sign")
async def sign_lease(
    lease_id: UUID,
    body: SignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    A verified party signs the uploaded lease. Enforces SG-1 (verified party only),
    SG-3 (document unaltered since upload), and explicit consent. When both parties
    have signed, emits the Ed25519-signed manifest and marks the lease signed (SG-2).
    """
    lease = await _get_lease_or_404(lease_id, db)

    # SG-1 — signer must be a verified party.
    allowed, reason = esign.can_sign(current_user, lease)
    if not allowed:
        raise HTTPException(status_code=403, detail=reason)

    if not lease.document_hash or not lease.pdf_path:
        raise HTTPException(status_code=400, detail="No document has been uploaded for signing")
    if lease.status == "signed":
        raise HTTPException(status_code=409, detail="Lease is already fully signed")
    if not body.consent:
        raise HTTPException(status_code=400, detail="Explicit consent is required to sign")
    if not body.signature_image and not body.typed_name:
        raise HTTPException(status_code=400, detail="A drawn or typed signature is required")

    # SG-3 — recompute the hash of the document on disk; reject if altered.
    try:
        with open(lease.pdf_path, "rb") as f:
            current_hash = esign.compute_document_hash(f.read())
    except OSError:
        raise HTTPException(status_code=409, detail="Stored document is unavailable")
    if current_hash != lease.document_hash:
        raise HTTPException(status_code=409, detail="Document has been altered since upload; signing blocked")

    party = esign.party_of(current_user, lease)
    if party is None:  # already guaranteed by can_sign(); keeps the contract explicit
        raise HTTPException(status_code=403, detail="Not authorized")
    audit = list((lease.signature_data or {}).get("esign_audit", []))
    if any(e.get("party") == party for e in audit):
        raise HTTPException(status_code=409, detail="This party has already signed")

    audit.append(esign.build_audit_entry(
        party,
        current_user,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        consent="Je consens à signer électroniquement ce bail (eIDAS).",
    ))

    # Persist the visible signature into the party's column.
    sig_value = body.signature_image or f"typed:{body.typed_name}"
    if party == "landlord":
        lease.landlord_signature = sig_value
    else:
        lease.tenant_signature = sig_value

    lease.signature_data = {"esign_audit": audit}

    finalised = esign.is_fully_signed(audit, lease)
    if finalised:
        manifest = esign.sign_manifest(
            esign.build_manifest(lease, lease.document_hash, audit)
        )
        lease.esign_manifest = manifest
        lease.status = "signed"

    await db.commit()
    return {
        "lease_id": str(lease.id),
        "status": lease.status,
        "signed_parties": [e["party"] for e in audit],
        "fully_signed": finalised,
    }


@router.get("/leases/{lease_id}/status")
async def esign_status(
    lease_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Signing state for the two parties to drive the UI."""
    lease = await _get_lease_or_404(lease_id, db)
    your_party = esign.party_of(current_user, lease)
    if your_party is None:
        raise HTTPException(status_code=403, detail="Not authorized")

    audit = (lease.signature_data or {}).get("esign_audit", [])
    signed_parties = [e["party"] for e in audit]
    return {
        "lease_id": str(lease.id),
        "status": lease.status,
        "your_party": your_party,
        "you_signed": your_party in signed_parties,
        "document_present": bool(lease.document_hash),
        "document_hash": lease.document_hash,
        "document_source": lease.document_source,
        "signed_parties": signed_parties,
        "fully_signed": lease.status == "signed",
    }


@router.get("/leases/{lease_id}/evidence.pdf")
async def esign_evidence(
    lease_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SG-4 — the watermarked signature evidence pack, once both parties have signed."""
    lease = await _get_lease_or_404(lease_id, db)
    if esign.party_of(current_user, lease) is None:
        raise HTTPException(status_code=403, detail="Not authorized")
    if lease.status != "signed" or not lease.esign_manifest:
        raise HTTPException(status_code=409, detail="Lease is not fully signed yet")

    # Defensive: the manifest is a dispute artifact — refuse to emit a pack whose
    # stored signature no longer verifies (DB tamper / key mismatch).
    if not esign.verify_manifest(lease.esign_manifest):
        raise HTTPException(status_code=409, detail="Signature manifest failed verification")

    pdf_bytes = esign.export_signature_evidence_pdf(lease.esign_manifest, verify_base_url=VERIFY_BASE_URL)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Roomivo_signature_{lease.id}.pdf"},
    )
