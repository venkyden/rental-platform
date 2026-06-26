"""
E-sign Path B router — landlord uploads their own lease → both verified parties
e-sign → tamper-evident evidence pack. In-house Ed25519 (DOSSIER §0.16, §5.6, §5.7).

Endpoints (all under /esign):
- POST /esign/leases/{id}/document    landlord uploads the lease PDF to be signed
- POST /esign/leases/{id}/sign        a verified party signs (SG-1, SG-3, consent)
- GET  /esign/leases/{id}/status      current signing state (for the UI)
- GET  /esign/leases/{id}/evidence.pdf  signature evidence pack, once fully signed (SG-4)
"""

import logging
from io import BytesIO

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
from app.services import esign, lease_legality
from app.services.notification_service import NotificationService
from app.services.storage import storage, StorageUnavailableError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/esign", tags=["esign"])

MAX_PDF_MB = 15
VERIFY_BASE_URL = "https://roomivo.app"


def _client_ip(request: Request) -> str | None:
    # Use X-Real-IP — our nginx overwrites it with $remote_addr on every request, so it
    # is not client-spoofable. Do NOT trust X-Forwarded-For[0]: nginx *appends* the real
    # IP to the client-supplied value, so the first hop is attacker-controlled, and this
    # IP is sealed into the signed manifest (eIDAS audit trail).
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else None


async def _notify(db: AsyncSession, method_name: str, recipient_id, lease_id) -> None:
    """Best-effort notification — a delivery failure must never break signing."""
    try:
        await getattr(NotificationService(db), method_name)(recipient_id, lease_id)
    except Exception:
        logger.warning("e-sign notification %s failed", method_name, exc_info=True)
        # Clear any half-applied notification write so the shared session stays usable.
        try:
            await db.rollback()
        except Exception:
            pass


async def _get_lease_or_404(lease_id: UUID, db: AsyncSession) -> Lease:
    result = await db.execute(select(Lease).where(Lease.id == lease_id))
    lease = result.scalar_one_or_none()
    if not lease:
        raise HTTPException(status_code=404, detail="Bail introuvable")
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
        raise HTTPException(status_code=403, detail="Seul le bailleur peut téléverser le document du bail")
    if not current_user.identity_verified:
        raise HTTPException(status_code=403, detail="Vérification d'identité requise pour téléverser un bail")
    if lease.status == "signed":
        raise HTTPException(status_code=409, detail="Le bail est déjà signé ; le document ne peut être remplacé")

    # Reject oversized uploads BEFORE reading into memory (DoS guard).
    max_bytes = MAX_PDF_MB * 1024 * 1024
    declared_size = getattr(file, "size", None)
    if declared_size is not None and declared_size > max_bytes:
        raise HTTPException(status_code=400, detail=f"Le fichier dépasse la limite de {MAX_PDF_MB} Mo")

    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"Le fichier dépasse la limite de {MAX_PDF_MB} Mo")
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Le document doit être un PDF")

    # Store via the durable storage service (R2 in prod; local fallback in dev).
    try:
        result = await storage.upload_file(
            BytesIO(content),
            filename=f"{lease_id}.pdf",
            content_type="application/pdf",
            folder=f"leases/{lease_id}",
        )
    except Exception:
        logger.exception("Lease document storage failed for lease %s", lease_id)
        raise HTTPException(status_code=500, detail="Impossible d'enregistrer le document")

    # Deterministic legality red-line screen (§5.6) — advisory, never blocks signing.
    legality = lease_legality.screen_lease_pdf(content).as_dict()

    # New document → fresh signing round: clear any prior signatures/manifest.
    superseded_key = lease.pdf_path  # a prior upload being replaced (if any)
    lease.document_hash = esign.compute_document_hash(content)
    lease.document_source = "uploaded"
    lease.pdf_path = result["key"]  # storage key (cloud or local), not a raw path
    lease.signature_data = {"esign_audit": [], "legality": legality}
    lease.landlord_signature = None
    lease.tenant_signature = None
    lease.esign_manifest = None
    lease.status = "awaiting_signatures"

    await db.commit()

    # Best-effort: drop the superseded document so re-uploads don't orphan objects.
    if superseded_key and superseded_key != result["key"]:
        try:
            await storage.delete_file(superseded_key)
        except Exception:
            logger.warning("Could not delete superseded lease document %s", superseded_key)

    # Best-effort: nudge the tenant that a lease awaits their signature.
    if lease.tenant_id is not None:
        await _notify(db, "notify_lease_ready_to_sign", lease.tenant_id, lease.id)

    return {
        "lease_id": str(lease.id),
        "status": lease.status,
        "document_hash": lease.document_hash,
        "legality_status": legality["status"],
        "legality_flags": legality["flags"],
        "legality_notes": legality["notes"],
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
        raise HTTPException(status_code=400, detail="Aucun document n'a été téléversé pour signature")
    if lease.status == "signed":
        raise HTTPException(status_code=409, detail="Le bail est déjà entièrement signé")
    if not body.consent:
        raise HTTPException(status_code=400, detail="Le consentement explicite est requis pour signer")
    if not body.signature_image and not body.typed_name:
        raise HTTPException(status_code=400, detail="Une signature manuscrite ou saisie est requise")
    # Bound the signature inputs — a drawn PNG is small; reject oversized payloads.
    if body.signature_image and len(body.signature_image) > 1_500_000:
        raise HTTPException(status_code=400, detail="L'image de signature est trop volumineuse")
    if body.typed_name and len(body.typed_name) > 200:
        raise HTTPException(status_code=400, detail="Le nom saisi est trop long")

    # SG-3 — re-read the stored document and recompute its hash; reject if altered.
    # A transient storage failure (503) must NOT be reported as a missing/tampered
    # document (409) — they are semantically opposite for a signing flow.
    try:
        stored = await storage.download_file(lease.pdf_path)
    except StorageUnavailableError:
        logger.exception("Storage unavailable during SG-3 re-check, lease %s", lease_id)
        raise HTTPException(
            status_code=503,
            detail="Le stockage du document est temporairement indisponible. Réessayez dans un instant.",
        )
    if stored is None:
        logger.error("SG-3: stored lease document is gone, lease %s key %s", lease_id, lease.pdf_path)
        raise HTTPException(status_code=409, detail="Le document signé est introuvable et ne peut être vérifié")
    current_hash = esign.compute_document_hash(stored)
    if current_hash != lease.document_hash:
        raise HTTPException(status_code=409, detail="Le document a été modifié depuis le téléversement ; signature bloquée")

    party = esign.party_of(current_user, lease)
    if party is None:  # already guaranteed by can_sign(); keeps the contract explicit
        raise HTTPException(status_code=403, detail="Non autorisé")
    sig_data = lease.signature_data or {}
    audit = list(sig_data.get("esign_audit", []))
    legality = sig_data.get("legality")  # recorded at upload — preserved through signing
    if any(e.get("party") == party for e in audit):
        raise HTTPException(status_code=409, detail="Cette partie a déjà signé")

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

    lease.signature_data = {"esign_audit": audit, "legality": legality}

    finalised = esign.is_fully_signed(audit, lease)
    if finalised:
        manifest = esign.sign_manifest(
            esign.build_manifest(lease, lease.document_hash, audit, legality=legality)
        )
        lease.esign_manifest = manifest
        lease.status = "signed"

    await db.commit()

    if finalised:
        # Best-effort: tell both parties the lease is signed and proof is ready.
        # (The "ready to sign" nudge already went to the tenant at upload time.)
        for recipient_id in (lease.landlord_id, lease.tenant_id):
            if recipient_id is not None:
                await _notify(db, "notify_lease_fully_signed", recipient_id, lease.id)

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
        raise HTTPException(status_code=403, detail="Non autorisé")

    sig_data = lease.signature_data or {}
    audit = sig_data.get("esign_audit", [])
    legality = sig_data.get("legality") or {}
    signed_parties = [e["party"] for e in audit]
    return {
        "lease_id": str(lease.id),
        "status": lease.status,
        "your_party": your_party,
        "you_signed": your_party in signed_parties,
        "document_present": bool(lease.document_hash),
        "document_hash": lease.document_hash,
        "document_source": lease.document_source,
        "legality_status": legality.get("status"),
        "legality_flags": legality.get("flags", []),
        "legality_notes": legality.get("notes", []),
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
        raise HTTPException(status_code=403, detail="Non autorisé")
    if lease.status != "signed" or not lease.esign_manifest:
        raise HTTPException(status_code=409, detail="Le bail n'est pas encore entièrement signé")

    # Defensive: the manifest is a dispute artifact — refuse to emit a pack whose
    # stored signature no longer verifies (DB tamper / key mismatch).
    if not esign.verify_manifest(lease.esign_manifest):
        raise HTTPException(status_code=409, detail="La vérification du procès-verbal de signature a échoué")

    pdf_bytes = esign.export_signature_evidence_pdf(lease.esign_manifest, verify_base_url=VERIFY_BASE_URL)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Roomivo_signature_{lease.id}.pdf"},
    )
