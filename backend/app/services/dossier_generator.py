import logging
import anyio
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.credential import Credential
from app.services.credential import credential_service

logger = logging.getLogger(__name__)

def _generate_pdf_sync(record_dict: dict) -> bytes:
    return credential_service.export_evidence_pdf(record_dict)

async def generate_trust_dossier_pdf(db: AsyncSession, user_id: str, credential_id: str) -> bytes:
    """
    Generates the complete Dossier PDF:
    Currently restricted to the Credential evidence PDF (cryptographically signed)
    to enforce verify-and-forget and banded-claim privacy rules.
    """
    # 1. Fetch the credential record
    cred_record = await db.scalar(select(Credential).where(Credential.id == credential_id))
    if not cred_record:
        raise ValueError(f"Credential {credential_id} not found")
        
    # Convert Credential model to dict for the credential_service
    record_dict = {
        "credential_id": cred_record.id,
        "subject_role": cred_record.subject_role,
        "rail": cred_record.rail,
        "subject_display_name": cred_record.subject_display_name,
        "issued_at": cred_record.issued_at.isoformat() + "Z",
        "expires_at": cred_record.expires_at.isoformat() + "Z",
        "claims": cred_record.claims,
        "disclaimer": cred_record.disclaimer,
        "signature": cred_record.signature,
        "kid": cred_record.kid,
    }

    # Offload CPU-bound PDF generation to a worker thread
    return await anyio.to_thread.run_sync(_generate_pdf_sync, record_dict)
