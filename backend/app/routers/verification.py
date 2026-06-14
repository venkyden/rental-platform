"""
Verification API endpoints for identity and employment verification.
"""

import base64
import json
import secrets
import asyncio
import httpx
from datetime import datetime, timedelta
from app.core.timeutils import naive_utcnow
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.core.cache import cache
import logging
from app.services.storage import storage

logger = logging.getLogger(__name__)
from app.utils.watermark import apply_watermark
from app.services.identity_assurance import OCR_LIVENESS_LABEL, derive_identity_assurance

async def _validate_file_size(file: UploadFile, max_size_mb: int = 10):
    """Validate file size securely before calling await file.read() to prevent memory exhaustion DoS."""
    # Use FastAPI 0.100+ native size property, which is populated securely by python-multipart
    file_size = getattr(file, "size", None)
    
    if file_size is None:
        # Fallback for mocked UploadFiles in test suites
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        
    if file_size > max_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds the {max_size_mb}MB limit."
        )

# Fallback in-memory verification sessions (if Redis is not available)
# Format: { code: { user_id, document_type, expires_at, completed } }
_verification_sessions: dict[str, dict] = {}
_last_cleanup: datetime = naive_utcnow()

async def _save_session(code: str, session_data: dict):
    if cache.redis_client:
        await cache.set(f"verification_session:{code}", session_data, ttl=3600)
    else:
        _verification_sessions[code] = session_data

async def _get_session(code: str):
    global _last_cleanup
    if cache.redis_client:
        return await cache.get(f"verification_session:{code}")
    else:
        # Only run cleanup at most once per 60 seconds to keep hot path fast
        if (naive_utcnow() - _last_cleanup).total_seconds() > 60:
            _cleanup_expired_sessions()
            _last_cleanup = naive_utcnow()
        return _verification_sessions.get(code)

async def _update_session(code: str, session_data: dict):
    if cache.redis_client:
        await cache.set(f"verification_session:{code}", session_data, ttl=3600)
    else:
        _verification_sessions[code] = session_data

router = APIRouter(prefix="/verification", tags=["Verification"])


class VerificationStartRequest(BaseModel):
    """Request to start verification process"""

    verification_type: str  # "identity" or "employment"


class VerificationStatusResponse(BaseModel):
    """Verification status response"""

    identity_verified: bool
    identity_assurance: str = "UNVERIFIED"
    employment_verified: bool
    income_verified: bool = False
    income_status: str = "unverified"
    ownership_verified: bool = False
    kbis_verified: bool = False
    carte_g_verified: bool = False
    identity_data: Optional[dict] = None
    employment_data: Optional[dict] = None
    ownership_data: Optional[dict] = None
    income_data: Optional[dict] = None
    guarantor_type: Optional[str] = None
    guarantor_status: str = "unverified"
    guarantor_assurance: Optional[str] = None  # "MEDIUM" | "DOCUMENT_SUBMITTED" | None
    guarantor_data: Optional[dict] = None
    visale_id: Optional[str] = None
    garantme_ref: Optional[str] = None
    trust_score: int


@router.post("/identity/upload")
async def upload_identity_document(
    document_type: str,
    side: str = Form("front"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload identity document for verification.

    For MVP: Simulates document verification
    For Production: Integrate with Fourthline API
    """

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        logger.warning(f"Invalid file type uploaded: {file.content_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, HEIC, or PDF",
        )

    # Read file content safely
    await _validate_file_size(file)
    content = await file.read()

    await _check_upload_rate_limit(str(current_user.id), "identity")

    from app.services.identity import identity_service
    from io import BytesIO

    # Selfie-with-ID: single image combines liveness + face-match + OCR
    if side == "selfie_with_id":
        result = await identity_service.verify_selfie_with_id(
            file_content=content,
            file_type=file.content_type,
            document_type=document_type,
            expected_name=current_user.full_name,
        )
        if not result["verified"] and result["status"] == "rejected":
            logger.warning(f"Selfie+ID rejected for user {current_user.id}: {result.get('rejection_reason')}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Verification failed: {result.get('rejection_reason')}",
            )
        if not current_user.identity_verified:
            await db.execute(
                update(User).where(User.id == current_user.id)
                .values(trust_score=func.least(100, User.trust_score + 30))
            )
            await db.refresh(current_user)
        current_user.identity_verified = True
        current_user.identity_status = "verified"
        current_user.identity_data = {
            "verified": True,
            "verified_at": naive_utcnow().isoformat(),
            "status": "verified",
            "verification_method": "selfie_with_id",
            "checks": result["validation_checks"],
            **OCR_LIVENESS_LABEL,
        }
        await db.commit()
        await db.refresh(current_user)
        return {
            "message": "Identity verified",
            "verified": True,
            "status": "verified",
            "trust_score": current_user.trust_score,
        }

    # Back side: processed transiently — no storage (source doc is PII, GDPR)
    if side == "back":
        return {
            "message": "Back side uploaded",
            "verified": False,
            "status": (current_user.identity_data or {}).get("status", "document_uploaded"),
            "trust_score": current_user.trust_score,
            "details": "Upload a selfie to complete identity verification",
        }

    # Front side: AI verification BEFORE storing (rejected docs never stored)
    result = await identity_service.verify_document(
        file_content=content,
        file_type=file.content_type,
        expected_name=current_user.full_name,
        document_type=document_type,
    )
    if not result["verified"] and result["status"] == "rejected":
        logger.warning(f"Identity verification rejected for user {current_user.id}: {result.get('rejection_reason')}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Verification failed: {result.get('rejection_reason')}",
        )

    # Store temporarily for face-match: Redis with 10-min TTL preferred; R2 fallback if unavailable.
    # Key includes a per-upload token so concurrent web/mobile sessions don't overwrite each other.
    _redis_key = f"identity_doc:{current_user.id}:{secrets.token_hex(8)}"
    if cache.redis_client:
        await cache.set(_redis_key, {
            "b64": base64.b64encode(content).decode(),
            "content_type": file.content_type,
        }, ttl=600)
        current_user.identity_data = {
            "verified": False,
            "upload_date": naive_utcnow().isoformat(),
            "redis_key": _redis_key,
            "status": "document_uploaded",
            "checks": result["validation_checks"],
        }
    else:
        from io import BytesIO
        storage_result = await storage.upload_file(
            file_data=BytesIO(content),
            filename=file.filename,
            content_type=file.content_type,
            folder=f"verification/identity/{current_user.id}"
        )
        current_user.identity_data = {
            "verified": False,
            "upload_date": naive_utcnow().isoformat(),
            "file_url": storage_result["url"],
            "storage_key": storage_result.get("key"),
            "status": "document_uploaded",
            "checks": result["validation_checks"],
        }
    current_user.identity_verified = False
    current_user.identity_status = "document_uploaded"

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Document verified — please complete liveness check",
        "verified": False,
        "status": "document_uploaded",
        "trust_score": current_user.trust_score,
        "details": "Upload a selfie to complete identity verification",
    }


def _cleanup_expired_sessions():
    """Remove expired sessions from memory"""
    now_iso = naive_utcnow().isoformat()
    expired = [k for k, v in _verification_sessions.items() if v.get("expires_at", "") < now_iso]
    for k in expired:
        del _verification_sessions[k]


@router.post("/identity/session")
async def create_identity_verification_session(
    current_user: User = Depends(get_current_user),
):
    """
    Create a verification session for mobile ID capture.
    Returns a code and capture URL for QR code display on desktop.
    """
    _cleanup_expired_sessions()

    code = secrets.token_urlsafe(32)
    session_data = {
        "user_id": str(current_user.id),
        "expires_at": (naive_utcnow() + timedelta(hours=1)).isoformat(),
        "completed": False,
    }
    await _save_session(code, session_data)

    from app.core.config import settings

    capture_url = f"{settings.FRONTEND_URL}/verify-capture/{code}"

    return {
        "verification_code": code,
        "capture_url": capture_url,
        "expires_at": (naive_utcnow() + timedelta(hours=1)).isoformat(),
    }


@router.get("/identity/session/{code}")
async def get_identity_session(code: str):
    """Get session info (for mobile page to verify code is valid)"""
    session = await _get_session(code)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired session")

    return {
        "valid": True,
        "completed": session["completed"],
    }


@router.get("/identity/session/{code}/status")
async def check_identity_session_status(code: str):
    """Poll endpoint for desktop to check if mobile has completed upload"""
    session = await _get_session(code)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"completed": session["completed"]}


@router.get("/identity/session/{code}/stream")
async def check_identity_session_status_stream(code: str):
    """SSE endpoint for desktop to check if mobile has completed upload"""
    async def event_generator():
        while True:
            session = await _get_session(code)
            if not session:
                yield "event: error\ndata: Session not found\n\n"
                break
            
            yield f"data: {json.dumps({'completed': session['completed']})}\n\n"
            
            if session["completed"]:
                break
                
            await asyncio.sleep(1.5)
            
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )



@router.post("/identity/upload-mobile")
async def upload_identity_mobile(
    verification_code: str = Query(...),
    document_type: str = Query("passport"),
    side: Optional[str] = Query(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload identity document via mobile using a verification session code.
    No auth token needed — the session code links to the user.
    """
    session = await _get_session(verification_code)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired verification code")

    if session["completed"]:
        raise HTTPException(status_code=400, detail="Session already completed")

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        logger.warning(f"Invalid mobile file type: {file.content_type}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, HEIC, or PDF",
        )

    # Get user from session
    import uuid
    user_id = uuid.UUID(session["user_id"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Apply rate limit
    await _check_upload_rate_limit(str(user.id), "identity")

    # Read file content safely
    await _validate_file_size(file)
    content = await file.read()

    from app.services.identity import identity_service
    from io import BytesIO

    # ── Selfie-with-ID path: single image, completes verification ─────────
    if side == "selfie_with_id":
        doc_result = await identity_service.verify_selfie_with_id(
            file_content=content,
            file_type=file.content_type,
            document_type=document_type,
            expected_name=user.full_name,
        )
        if not doc_result["verified"] and doc_result["status"] == "rejected":
            logger.warning(f"Selfie+ID rejected for session {verification_code}: {doc_result.get('rejection_reason')}")
            raise HTTPException(status_code=400, detail=f"Verification failed: {doc_result.get('rejection_reason')}")

        if not user.identity_verified:
            await db.execute(
                update(User).where(User.id == user.id)
                .values(trust_score=func.least(100, User.trust_score + 30))
            )
            await db.refresh(user)
        user.identity_verified = True
        user.identity_status = "verified"
        user.identity_data = {
            "verified": True,
            "verified_at": naive_utcnow().isoformat(),
            "status": "verified",
            "verification_method": "selfie_with_id",
            "checks": doc_result["validation_checks"],
            **OCR_LIVENESS_LABEL,
        }
        session["completed"] = True
        await _update_session(verification_code, session)
        await db.commit()
        await db.refresh(user)
        return {
            "message": "Identity verified",
            "verified": True,
            "status": "verified",
            "trust_score": user.trust_score,
        }

    # ── Selfie path: face-match against stored identity document ──────────
    if side == "selfie":
        if not user.identity_data or user.identity_data.get("status") != "document_uploaded":
            raise HTTPException(
                status_code=400,
                detail="Upload and verify your identity document before submitting a selfie.",
            )

        _redis_key = user.identity_data.get("redis_key")
        if _redis_key:
            _doc = await cache.get(_redis_key)
            if not _doc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Identity document session expired — please re-upload your document.",
                )
            id_bytes = base64.b64decode(_doc["b64"])
            id_content_type = _doc.get("content_type", "image/jpeg")
        else:
            id_url = user.identity_data["file_url"]
            async with httpx.AsyncClient(timeout=15.0) as http_client:
                try:
                    id_resp = await http_client.get(id_url)
                    id_resp.raise_for_status()
                    id_bytes = id_resp.content
                    id_content_type = id_resp.headers.get("content-type", "image/jpeg").split(";")[0]
                except Exception as e:
                    logger.error(f"Failed to fetch identity doc for face compare: {e}")
                    raise HTTPException(status_code=500, detail="Could not retrieve identity document for comparison.")

        face_result = await identity_service.compare_faces(
            id_image=id_bytes,
            id_file_type=id_content_type,
            selfie=content,
            selfie_file_type=file.content_type,
        )

        # Purge the temporarily-stored ID document immediately after comparison — regardless of
        # match result — so the document is never retained after a failed attempt (GDPR).
        _redis_key = user.identity_data.get("redis_key") if user.identity_data else None
        if _redis_key:
            await cache.delete(_redis_key)
        else:
            _id_key = user.identity_data.get("storage_key") if user.identity_data else None
            if _id_key:
                try:
                    await storage.delete_file(_id_key)
                except Exception as _del_exc:
                    logger.warning("purge_identity_doc: failed to delete %s: %s", _id_key, _del_exc)

        if not face_result["match"] or face_result["confidence"] < 0.6:
            raise HTTPException(
                status_code=422,
                detail=f"Face does not match identity document. {face_result['reason']}",
            )

        if not user.identity_verified:
            await db.execute(
                update(User).where(User.id == user.id)
                .values(trust_score=func.least(100, User.trust_score + 30))
            )
            await db.refresh(user)
        user.identity_verified = True
        user.identity_status = "verified"
        user.identity_data = {
            "verified": True,
            "verified_at": naive_utcnow().isoformat(),
            "status": "verified",
            "verification_method": "ocr_selfie",
            "face_match_confidence": face_result["confidence"],
            "checks": (user.identity_data or {}).get("checks"),
            **OCR_LIVENESS_LABEL,
        }

        session["completed"] = True
        await _update_session(verification_code, session)
        await db.commit()
        await db.refresh(user)

        return {
            "message": "Identity fully verified",
            "verified": True,
            "status": "verified",
            "trust_score": user.trust_score,
            "details": "Liveness check passed — identity confirmed",
        }

    # ── Document path ─────────────────────────────────────────────────────

    # Back side: processed transiently — no storage (source doc is PII, GDPR)
    if side == "back":
        return {
            "message": "Back side uploaded — please complete liveness check",
            "verified": False,
            "status": (user.identity_data or {}).get("status", "document_uploaded"),
            "trust_score": user.trust_score,
            "details": "Capture a selfie to complete identity verification",
        }

    # Front / bio page: run AI validation
    doc_result = await identity_service.verify_document(
        file_content=content,
        file_type=file.content_type,
        expected_name=user.full_name,
        document_type=document_type,
    )

    if not doc_result["verified"] and doc_result["status"] == "rejected":
        logger.warning(f"Identity doc rejected for mobile session {verification_code}: {doc_result.get('rejection_reason')}")
        raise HTTPException(
            status_code=400,
            detail=f"Verification failed: {doc_result.get('rejection_reason')}",
        )

    # Store temporarily for face-match: Redis with 10-min TTL preferred; R2 fallback if unavailable.
    # Key includes a per-upload token so concurrent web/mobile sessions don't overwrite each other.
    _redis_key = f"identity_doc:{user.id}:{secrets.token_hex(8)}"
    if cache.redis_client:
        await cache.set(_redis_key, {
            "b64": base64.b64encode(content).decode(),
            "content_type": file.content_type,
        }, ttl=600)
        user.identity_data = {
            "verified": False,
            "upload_date": naive_utcnow().isoformat(),
            "redis_key": _redis_key,
            "source": "mobile_capture",
            "status": "document_uploaded",
            "checks": doc_result["validation_checks"],
        }
    else:
        from io import BytesIO
        storage_result = await storage.upload_file(
            file_data=BytesIO(content),
            filename=file.filename,
            content_type=file.content_type,
            folder=f"verification/identity/{user.id}",
        )
        user.identity_data = {
            "verified": False,
            "upload_date": naive_utcnow().isoformat(),
            "file_url": storage_result["url"],
            "source": "mobile_capture",
            "storage_key": storage_result.get("key"),
            "status": "document_uploaded",
            "checks": doc_result["validation_checks"],
        }
    # Document validated — selfie required to complete identity verification
    user.identity_verified = False
    user.identity_status = "document_uploaded"

    # Session stays open until selfie completes it (never mark complete on doc upload)
    await db.commit()
    await db.refresh(user)

    return {
        "message": "Document verified — please complete liveness check",
        "verified": False,
        "status": "document_uploaded",
        "trust_score": user.trust_score,
        "details": "Capture a selfie to complete identity verification",
    }

@router.post("/identity/upload-selfie")
async def upload_identity_selfie(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload selfie for face-match against the stored identity document."""
    if not current_user.identity_data or current_user.identity_data.get("status") != "document_uploaded":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload and verify your identity document before submitting a selfie.",
        )

    await _check_upload_rate_limit(str(current_user.id), "selfie")

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Please upload JPEG, PNG, or HEIC.",
        )

    await _validate_file_size(file)
    selfie_bytes = await file.read()

    _redis_key = current_user.identity_data.get("redis_key")
    if _redis_key:
        _doc = await cache.get(_redis_key)
        if not _doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Identity document session expired — please re-upload your document.",
            )
        id_bytes = base64.b64decode(_doc["b64"])
        id_content_type = _doc.get("content_type", "image/jpeg")
    else:
        id_url = current_user.identity_data["file_url"]
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            try:
                id_resp = await http_client.get(id_url)
                id_resp.raise_for_status()
                id_bytes = id_resp.content
                id_content_type = id_resp.headers.get("content-type", "image/jpeg").split(";")[0]
            except Exception as e:
                logger.error(f"Failed to fetch identity doc for face compare: {e}")
                raise HTTPException(status_code=500, detail="Could not retrieve identity document for comparison.")

    from app.services.identity import identity_service
    face_result = await identity_service.compare_faces(
        id_image=id_bytes,
        id_file_type=id_content_type,
        selfie=selfie_bytes,
        selfie_file_type=file.content_type,
    )

    # Purge the temporarily-stored ID document immediately after comparison — regardless of match
    # result — so the document is never retained after a failed attempt (GDPR).
    _redis_key = current_user.identity_data.get("redis_key")
    if _redis_key:
        await cache.delete(_redis_key)
    else:
        _id_key = current_user.identity_data.get("storage_key")
        if _id_key:
            try:
                await storage.delete_file(_id_key)
            except Exception as _del_exc:
                logger.warning("purge_identity_doc: failed to delete %s: %s", _id_key, _del_exc)

    if not face_result["match"] or face_result["confidence"] < 0.6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Face does not match identity document. {face_result['reason']}",
        )

    if not current_user.identity_verified:
        await db.execute(
            update(User).where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 30))
        )
        await db.refresh(current_user)
    current_user.identity_verified = True
    current_user.identity_status = "verified"
    current_user.identity_data = {
        "verified": True,
        "verified_at": naive_utcnow().isoformat(),
        "status": "verified",
        "verification_method": "ocr_selfie",
        "face_match_confidence": face_result["confidence"],
        "checks": current_user.identity_data.get("checks"),
        **OCR_LIVENESS_LABEL,
    }

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Identity fully verified",
        "identity_verified": True,
        "trust_score": current_user.trust_score,
    }


@router.post("/identity/avis-cross-check")
async def avis_cross_check(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Corroborate the OCR'd identity name against the DGFiP-signed avis d'imposition
    2D-Doc. Assurance stays MEDIUM (the avis has no presenter binding) — a match only
    sets an anti-fraud flag. The avis is processed transiently and never stored.
    """
    if not current_user.identity_verified:
        raise HTTPException(status_code=400, detail="Verify your identity before cross-checking an avis.")
    id_name: Optional[str] = current_user.full_name  # type: ignore[assignment]
    if not id_name or id_name == "Unknown":
        raise HTTPException(status_code=400, detail="No identity name on file to corroborate.")

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}.")

    await _check_upload_rate_limit(str(current_user.id), "avis")
    await _validate_file_size(file)
    content = await file.read()  # processed transiently, never stored

    from app.services import fr_2ddoc
    try:
        raw = fr_2ddoc.decode_2ddoc(content, file.content_type)
        avis = fr_2ddoc.parse_and_verify_avis(raw)
    except fr_2ddoc.BarcodeUnreadable:
        raise HTTPException(status_code=422, detail="Could not read the 2D-Doc barcode — please rescan the avis.")
    except fr_2ddoc.WrongDocumentType:
        raise HTTPException(status_code=422, detail="This document is not an avis d'imposition (2D-Doc type 28).")
    except fr_2ddoc.SignatureInvalid:
        return {"corroborated": False, "reason": "signature_invalid"}

    matched = fr_2ddoc.name_matches_any(id_name, avis.declarant_names)
    if matched:
        current_user.identity_data = {
            **(current_user.identity_data or {}),
            "identity_name_corroborated_by": "avis_2ddoc",
        }
        await db.commit()
        await db.refresh(current_user)
    return {"corroborated": matched, "reason": "name_match" if matched else "name_mismatch"}


# NOTE: Upload rate limits are backed by Redis (distributed, survives restarts).
# Falls back to fail-open if Redis is unavailable — the per-IP slowapi limits
# still apply as a second layer of defence.
async def _check_upload_rate_limit(user_id: str, doc_type: str):
    key = f"upload_rl:{user_id}:{doc_type}"
    count = await cache.incr_with_expire(key, ttl=3600)
    # incr_with_expire returns 0 when Redis is unavailable (fail-open)
    if count and count > 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Maximum 5 uploads per hour per document type.",
        )


@router.post("/fr/solvency")
async def fr_solvency_check(
    file: UploadFile = File(...),
    monthly_rent: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    FR HIGH solvency rail (DOSSIER §5.3, sub-feature #4).

    Accepts the avis d'imposition upload + the gross monthly rent for the property.
    Decodes the DataMatrix 2D-Doc barcode, verifies the ANTS ECDSA signature, and
    reads the RFR (revenu fiscal de référence) from the SIGNED payload — tampered
    printed text is irrelevant (SV-1). Emits a banded solvency ratio and stores only
    the banded claim on the user profile; the raw RFR is NEVER persisted.

    Assurance: HIGH — the RFR comes from a DGFiP-signed payload (state-cryptographic).
    Recency: flagged (not blocked) if the avis income year is more than 2 years old
    (SV-2: full SVAIR recency verification is deferred).

    DOSSIER SV-8: the response uses "fiscal_capacity" terminology, never "monthly income".
    """
    if not current_user.identity_verified:
        raise HTTPException(status_code=400, detail="Verify your identity before submitting a solvency check.")

    if monthly_rent <= 0:
        raise HTTPException(status_code=422, detail="monthly_rent must be a positive integer (euros).")

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}.")

    await _check_upload_rate_limit(str(current_user.id), "solvency")
    content = await file.read()  # processed transiently, never stored

    from app.services import fr_2ddoc
    try:
        raw = fr_2ddoc.decode_2ddoc(content, file.content_type)
        avis = fr_2ddoc.parse_and_verify_avis(raw)
    except fr_2ddoc.BarcodeUnreadable:
        raise HTTPException(status_code=422, detail="Could not read the 2D-Doc barcode — please rescan the avis.")
    except fr_2ddoc.WrongDocumentType:
        raise HTTPException(status_code=422, detail="This document is not an avis d'imposition (2D-Doc type 28 or 04).")
    except fr_2ddoc.SignatureInvalid:
        raise HTTPException(status_code=422, detail="2D-Doc signature verification failed — document may be forged or use an unknown certificate.")

    rfr = avis.revenu_fiscal_de_reference
    if rfr is None:
        # Signed payload present but RFR field absent (rare legacy format gap).
        solvency_assurance = "UNVERIFIED"
        solvency_ratio = None
    else:
        solvency_assurance = "HIGH"
        solvency_ratio = fr_2ddoc.band_solvency_ratio(rfr, monthly_rent)

    recency_flag = fr_2ddoc.is_avis_stale(avis.annee_des_revenus) if avis.annee_des_revenus else False

    # Name corroboration against the verified identity (anti-fraud flag, no assurance change).
    id_name: Optional[str] = current_user.full_name  # type: ignore[assignment]
    name_corroborated = (
        fr_2ddoc.name_matches_any(id_name, avis.declarant_names) if id_name and id_name != "Unknown" else False
    )

    # Persist only the banded claims — raw RFR is discarded here.
    current_user.identity_data = {
        **(current_user.identity_data or {}),
        "solvency_assurance": solvency_assurance,
        "solvency_ratio": solvency_ratio,
        "solvency_source": "fr_2ddoc_avis",
        "solvency_annee_des_revenus": avis.annee_des_revenus,
        "solvency_recency_flag": recency_flag,
        "solvency_name_corroborated": name_corroborated,
    }
    await db.commit()
    await db.refresh(current_user)

    return {
        "solvency_assurance": solvency_assurance,
        "solvency_ratio": solvency_ratio,
        "fiscal_capacity_label": "Capacité fiscale (RFR — revenu fiscal de référence)",
        "annee_des_revenus": avis.annee_des_revenus,
        "recency_flag": recency_flag,
        "avis_corroborated_name": name_corroborated,
    }


@router.post("/income/upload")
async def upload_income_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload income/resource document for verification.
    """
    # Rate limiting
    await _check_upload_rate_limit(str(current_user.id), document_type)

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, HEIC, or PDF",
        )

    await _validate_file_size(file, max_size_mb=10)
    content = await file.read()

    # Import service
    from app.services.employment import employment_service

    # Process document
    try:
        result = await employment_service.verify_document(
            file_content=content,
            file_type=file.content_type,
            expected_name=current_user.full_name,
            document_type=document_type,
        )
    except Exception as e:
        logger.error(f"Income verification crashed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification processing error: {str(e)}",
        )

    if not result["verified"] and result["status"] == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Verification failed: {result.get('rejection_reason')}",
        )

    # Update user verification status
    current_user.income_verified = result["verified"]
    current_user.income_status = result["status"]
    if result["verified"]:
        # Add trust score points (+20 for verified income)
        await db.execute(
            update(User).where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 20))
        )
        await db.refresh(current_user)

    # Source document processed transiently — never stored (GDPR)
    current_user.income_data = {
        "verified": result["verified"],
        "verified_at": naive_utcnow().isoformat(),
        "status": result["status"],
        "checks": result["validation_checks"],
    }

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Income document processed",
        "verified": result["verified"],
        "status": result["status"],
        "trust_score": current_user.trust_score,
        "details": result.get("rejection_reason") or "Verification successful",
    }


@router.post("/employment/upload")
async def upload_employment_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload professional/resources document for verification.
    Backward compatibility endpoint.
    """
    res = await upload_income_document(document_type, file, current_user, db)
    # Mirror employment fields from the result (income and employment use same flow here)
    current_user.employment_verified = res.get("verified", False)
    current_user.employment_status = res.get("status", "unverified")
    current_user.employment_data = current_user.income_data
    await db.commit()
    return res


@router.get("/status", response_model=VerificationStatusResponse)
async def get_verification_status(current_user: User = Depends(get_current_user)):
    """Get current verification status for user"""
    guarantor_data_raw = current_user.guarantor_data or {}
    safe_guarantor = {k: v for k, v in guarantor_data_raw.items() if k != "files"}
    safe_guarantor["file_count"] = len(guarantor_data_raw.get("files", []))

    return {
        "identity_verified": current_user.identity_verified,
        "identity_assurance": derive_identity_assurance(
            current_user.identity_verified, current_user.identity_data
        ),
        "employment_verified": current_user.employment_verified,
        "employment_status": current_user.employment_status if hasattr(current_user, 'employment_status') else "unverified",
        "income_verified": current_user.income_verified,
        "income_status": current_user.income_status,
        "ownership_verified": current_user.ownership_verified,
        "kbis_verified": current_user.kbis_verified,
        "carte_g_verified": current_user.carte_g_verified,
        "identity_data": current_user.identity_data,
        "employment_data": current_user.employment_data,
        "ownership_data": current_user.ownership_data,
        "income_data": current_user.income_data,
        "guarantor_type": current_user.guarantor_type,
        "guarantor_status": current_user.guarantor_status,
        "guarantor_assurance": (current_user.guarantor_data or {}).get("assurance"),
        "guarantor_data": safe_guarantor,
        "visale_id": current_user.visale_id,
        "garantme_ref": current_user.garantme_ref,
        "trust_score": current_user.trust_score,
    }


class GuarantorInitRequest(BaseModel):
    """Request to initialize guarantor flow"""
    guarantor_type: str  # 'visale' | 'garantme' | 'physical' | 'none'


@router.post("/guarantor/init")
async def init_guarantor(
    request: GuarantorInitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initialize or change guarantor type"""
    # If switching away from verified, decrement trust score
    if current_user.guarantor_status == "verified":
        await db.execute(
            update(User).where(User.id == current_user.id)
            .values(trust_score=func.greatest(0, User.trust_score - 15))
        )
        await db.refresh(current_user)

    current_user.guarantor_type = request.guarantor_type
    current_user.guarantor_status = "unverified"
    current_user.guarantor_data = None
    current_user.visale_id = None
    current_user.garantme_ref = None
    
    if request.guarantor_type == "none":
        current_user.guarantor_status = "unverified"
        
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "message": f"Guarantor flow initialized for type: {request.guarantor_type}",
        "guarantor_type": current_user.guarantor_type,
        "guarantor_status": current_user.guarantor_status,
        "trust_score": current_user.trust_score,
    }


@router.post("/guarantor/visale")
async def verify_visale(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload and AI-verify a Visale guarantee certificate"""
    await _check_upload_rate_limit(str(current_user.id), "visale")

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, or PDF",
        )

    await _validate_file_size(file)
    content = await file.read()

    from app.services.employment import employment_service
    from app.services.guarantor_compliance import assess_guarantor_cert
    from datetime import date

    cert_data = await employment_service.extract_guarantor_cert(
        file_content=content,
        file_type=file.content_type,
        cert_type="visale",
    )
    if cert_data is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not read the Visale certificate. Please upload a clear copy.",
        )

    assessment = assess_guarantor_cert("visale", cert_data, current_user.full_name or "", date.today())
    error_warnings = [w for w in assessment.warnings if w.severity == "error"]
    if error_warnings:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_warnings[0].en,
        )

    # Certificate processed transiently — extracted claims stored, source doc discarded (GDPR)
    current_user.guarantor_type = "visale"
    if current_user.guarantor_status != "verified":
        await db.execute(
            update(User).where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 15))
        )
        await db.refresh(current_user)
    current_user.guarantor_status = "verified"
    if assessment.cert_ref:
        current_user.visale_id = assessment.cert_ref
    current_user.guarantor_data = {
        "verified_at": naive_utcnow().isoformat(),
        "assurance": assessment.assurance,
        "name_matched": assessment.name_matched,
        "name_match_score": assessment.name_match_score,
        "guaranteed_amount": assessment.guaranteed_amount,
        "validity_date": assessment.validity_date.isoformat() if assessment.validity_date else None,
        "warnings": [{"code": w.code, "severity": w.severity, "en": w.en, "fr": w.fr} for w in assessment.warnings],
    }

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Visale certificate verified successfully",
        "guarantor_type": current_user.guarantor_type,
        "guarantor_status": current_user.guarantor_status,
        "guarantor_assurance": assessment.assurance,
        "visale_id": current_user.visale_id,
        "trust_score": current_user.trust_score,
    }


@router.post("/guarantor/garantme")
async def verify_garantme(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload and AI-verify a Garantme guarantee certificate"""
    await _check_upload_rate_limit(str(current_user.id), "garantme")

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, or PDF",
        )

    await _validate_file_size(file)
    content = await file.read()

    from app.services.employment import employment_service
    from app.services.guarantor_compliance import assess_guarantor_cert
    from datetime import date

    cert_data = await employment_service.extract_guarantor_cert(
        file_content=content,
        file_type=file.content_type,
        cert_type="garantme",
    )
    if cert_data is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not read the Garantme certificate. Please upload a clear copy.",
        )

    assessment = assess_guarantor_cert("garantme", cert_data, current_user.full_name or "", date.today())
    error_warnings = [w for w in assessment.warnings if w.severity == "error"]
    if error_warnings:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_warnings[0].en,
        )

    # Certificate processed transiently — extracted claims stored, source doc discarded (GDPR)
    current_user.guarantor_type = "garantme"
    if current_user.guarantor_status != "verified":
        await db.execute(
            update(User).where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 15))
        )
        await db.refresh(current_user)
    current_user.guarantor_status = "verified"
    if assessment.cert_ref:
        current_user.garantme_ref = assessment.cert_ref
    current_user.guarantor_data = {
        "verified_at": naive_utcnow().isoformat(),
        "assurance": assessment.assurance,
        "name_matched": assessment.name_matched,
        "name_match_score": assessment.name_match_score,
        "guaranteed_amount": assessment.guaranteed_amount,
        "validity_date": assessment.validity_date.isoformat() if assessment.validity_date else None,
        "warnings": [{"code": w.code, "severity": w.severity, "en": w.en, "fr": w.fr} for w in assessment.warnings],
    }

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Garantme certificate verified successfully",
        "guarantor_type": current_user.guarantor_type,
        "guarantor_status": current_user.guarantor_status,
        "guarantor_assurance": assessment.assurance,
        "garantme_ref": current_user.garantme_ref,
        "trust_score": current_user.trust_score,
    }


@router.post("/guarantor/upload")
async def upload_guarantor_document(
    file: UploadFile = File(...),
    document_type: str = Form("id_card"),  # 'id_card' | 'payslip' | 'tax_assessment' | 'proof_address'
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload documents for physical guarantor flow"""
    # Rate limit check
    await _check_upload_rate_limit(str(current_user.id), document_type)

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, HEIC, or PDF",
        )

    await _validate_file_size(file)
    content = await file.read()
    watermarked_content = apply_watermark(content)
    
    from io import BytesIO
    storage_result = await storage.upload_file(
        file_data=BytesIO(watermarked_content),
        filename=file.filename,
        content_type=file.content_type,
        folder=f"verification/guarantor/{current_user.id}"
    )
    file_url = storage_result["url"]
    
    # Initialize guarantor_data if empty or if type changed
    if not current_user.guarantor_data or current_user.guarantor_type != "physical":
        current_user.guarantor_data = {"files": []}
        
    current_user.guarantor_type = "physical"
    current_user.guarantor_status = "pending"
    
    files_list = current_user.guarantor_data.get("files", [])
    new_entry = {
        "document_type": document_type,
        "filename": file.filename,
        "file_url": file_url,
        "storage_key": storage_result.get("key"),
        "uploaded_at": naive_utcnow().isoformat()
    }
    # Replace existing entry for same doc_type (last-write-wins)
    files_list = [f for f in files_list if f.get("document_type") != document_type]
    files_list.append(new_entry)
    current_user.guarantor_data = {"files": files_list}
    
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "message": "Guarantor document uploaded successfully",
        "guarantor_type": current_user.guarantor_type,
        "guarantor_status": current_user.guarantor_status,
        "files": files_list,
    }


class PhysicalGuarantorSubmitRequest(BaseModel):
    consent: bool  # explicit GDPR consent that the guarantor agreed to data upload


@router.post("/guarantor/physical/submit")
async def submit_physical_guarantor(
    request: PhysicalGuarantorSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark physical guarantor dossier as submitted once all required docs are uploaded."""
    if current_user.guarantor_type != "physical":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No physical guarantor flow in progress. Please upload documents first.",
        )

    if not request.consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guarantor's explicit GDPR consent is required before submitting their documents.",
        )

    required_doc_types = {"id_card", "payslip", "tax_assessment", "proof_address"}
    existing_files = (current_user.guarantor_data or {}).get("files", [])
    uploaded_types = {f.get("document_type") for f in existing_files}
    missing = required_doc_types - uploaded_types
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required documents: {', '.join(sorted(missing))}",
        )

    current_user.guarantor_status = "submitted"
    current_user.guarantor_data = {
        **current_user.guarantor_data,
        "assurance": "DOCUMENT_SUBMITTED",
        "consent_at": naive_utcnow().isoformat(),
    }

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Physical guarantor dossier submitted successfully.",
        "guarantor_type": current_user.guarantor_type,
        "guarantor_status": current_user.guarantor_status,
        "guarantor_assurance": "DOCUMENT_SUBMITTED",
    }


@router.delete("/guarantor")
async def delete_guarantor(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove guarantor and reset credentials"""
    if current_user.guarantor_status == "verified":
        await db.execute(
            update(User).where(User.id == current_user.id)
            .values(trust_score=func.greatest(0, User.trust_score - 15))
        )
        await db.refresh(current_user)

    current_user.guarantor_type = None
    current_user.guarantor_status = "unverified"
    current_user.guarantor_data = None
    current_user.visale_id = None
    current_user.garantme_ref = None
    
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "message": "Guarantor removed successfully",
        "trust_score": current_user.trust_score,
    }


@router.post("/property/{property_id}/dpe")
async def verify_property_dpe(
    property_id: str,
    dpe_number: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    FR property DPE verification via live ADEME open-data API (DOSSIER §5.4, sub-feature #5).

    Looks up the DPE number in the ADEME database and stores the live energy class on
    the property — never hard-coded (PR-3: Jan 2026 reclassification must be live).

    ADEME 5xx / timeout → non-blocking; returns dpe_assurance="PENDING" (PR-6).
    DPE not found → dpe_assurance="UNVERIFIED" (PR-4).
    Expired DPE (>10yr / pre-Jul-2021 methodology) → flagged, not blocked in Phase 1
    (class-G blocking and zone-tendue advisory are Phase 2 — DOSSIER §9, item 7).
    """
    from app.models.property import Property
    import uuid as _uuid

    try:
        prop_uuid = _uuid.UUID(property_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid property ID")

    result = await db.execute(select(Property).where(Property.id == prop_uuid))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this property")

    from app.services import ademe_dpe

    # PR-2: reject class "H" explicitly — ADEME scale is A–G only.
    # (The service enforces this; the note here is for clarity.)
    try:
        dpe = await ademe_dpe.lookup_dpe(dpe_number)
    except ademe_dpe.InvalidDPENumber as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ademe_dpe.ADEMEUnavailable:
        # PR-6: non-blocking — store PENDING so the frontend can retry later.
        prop.ownership_data = {
            **(prop.ownership_data or {}),
            "dpe_assurance": "PENDING",
            "dpe_number": dpe_number.strip(),
        }
        await db.commit()
        return {
            "dpe_assurance": "PENDING",
            "dpe_class": None,
            "expired": None,
            "note": "ADEME service temporarily unavailable — retry later",
        }
    except ademe_dpe.DPENotFound:
        # PR-4: not found → UNVERIFIED, non-blocking.
        prop.ownership_data = {
            **(prop.ownership_data or {}),
            "dpe_assurance": "UNVERIFIED",
            "dpe_number": dpe_number.strip(),
        }
        await db.commit()
        return {
            "dpe_assurance": "UNVERIFIED",
            "dpe_class": None,
            "expired": None,
            "note": "DPE number not found in ADEME database",
        }

    # PR-3: update property.dpe_rating from live ADEME (never from caller input).
    prop.dpe_rating = dpe.energy_class
    prop.ownership_data = {
        **(prop.ownership_data or {}),
        "dpe_assurance": "HIGH",
        "dpe_number": dpe.dpe_number,
        "dpe_class": dpe.energy_class,
        "dpe_valid_until": dpe.valid_until.isoformat() if dpe.valid_until else None,
        "dpe_established": dpe.established_date.isoformat() if dpe.established_date else None,
        "dpe_expired": dpe.expired,
        # address stored for corroboration display, never treated as ownership proof
        "dpe_ademe_address": dpe.address_line,
    }
    await db.commit()
    await db.refresh(prop)

    return {
        "dpe_assurance": "HIGH",
        "dpe_class": dpe.energy_class,
        "expired": dpe.expired,
        "valid_until": dpe.valid_until.isoformat() if dpe.valid_until else None,
        # Phase 1: G-class is surfaced but not blocked here (blocking is Phase 2).
        # Phase 2 note: class G properties cannot be leased as primary residences
        # (loi Climat, since Jan 2025) — block will be added to lease generation.
        "note": "Classe G — location comme résidence principale interdite depuis jan 2025 (loi Climat)" if dpe.energy_class == "G" else None,
    }


@router.post("/insurance/upload")
async def upload_insurance_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Verify a tenant's MRH insurance attestation certificate (loi 89 art. 7g).

    Checks (DOSSIER §5.8):
      IN-1  Quote → 400 rejected.
      IN-2  Name/address mismatch → 200 flagged (landlord decides; we never gate).
      IN-3  Foreign insurer → 400 rejected (French MRH required for FR property).
      IN-4  Cover-start date stored in insurance_data for lease-start cross-check.
      IN-5  No access gating — verified or flagged, caller sees all data.

    Assurance is always MEDIUM (OCR — no insurer API).
    The source document is processed transiently; only the banded result is stored.
    """
    from app.services.mrh_insurance import mrh_insurance_service

    _INSURANCE_ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png"}
    if file.content_type not in _INSURANCE_ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload PDF, JPEG, or PNG",
        )
    await _validate_file_size(file, max_size_mb=10)
    content = await file.read()

    # Derive expected name from identity_data (for IN-2 cross-check)
    identity_data = current_user.identity_data or {}
    expected_name = (
        (identity_data.get("extracted_data") or {}).get("full_name")
        or current_user.full_name
    )

    result = await mrh_insurance_service.verify(
        file_content=content,
        file_type=file.content_type or "application/pdf",
        expected_name=expected_name,
        expected_address=None,
    )

    # IN-1 / IN-3: hard rejects → 400
    if result["status"] == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["rejection_reason"],
        )

    # Store banded result (source document never persisted)
    current_user.insurance_verified = result["verified"]
    current_user.insurance_status = result["status"]
    current_user.insurance_data = {
        "status": result["status"],
        "upload_date": naive_utcnow().isoformat(),
        "filename": file.filename,
        "mrh_assurance": result["mrh_assurance"],
        "mrh_insurer_fr": result["mrh_insurer_fr"],
        "mrh_cert_type": result["mrh_cert_type"],
        "mrh_cover_start": result["mrh_cover_start"],
        "mrh_cover_end": result["mrh_cover_end"],
        "flags": result["flags"],
    }

    await db.commit()

    return {
        "verified": result["verified"],
        "status": result["status"],
        "mrh_assurance": result["mrh_assurance"],
        "mrh_insurer_fr": result["mrh_insurer_fr"],
        "mrh_cover_start": result["mrh_cover_start"],
        "mrh_cover_end": result["mrh_cover_end"],
        "flags": result["flags"],
    }


@router.post("/property/upload")
async def upload_property_document(
    property_id: str = Query(...),
    document_type: str = Query(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload taxe foncière or titre de propriété to evidence property control.

    DOSSIER PR-8 fix: this endpoint establishes "control, not ownership-attested".
    There is no free ownership oracle at ~€0 OPEX; this document corroborates that
    the submitter has a plausible connection to the property (received the tax notice,
    or holds a titre). The result is labelled MEDIUM (OCR) and explicitly NOT
    ownership_verified — it is property_control = "documented".

    Source document is processed transiently and NEVER stored (no URL in ownership_data).
    """
    from app.models.property import Property
    
    # 1. Validate property
    import uuid
    try:
        prop_uuid = uuid.UUID(property_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid property ID")
        
    result = await db.execute(select(Property).where(Property.id == prop_uuid))
    property_obj = result.scalar_one_or_none()
    
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")
        
    if property_obj.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this property")

    # 2. Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, or PDF",
        )

    # 3. Read content securely
    await _validate_file_size(file)
    content = await file.read()

    # 4. Verify Document via AI
    from app.services.property import property_verification_service
    
    try:
        verification_result = await property_verification_service.verify_document(
            file_content=content,
            file_type=file.content_type,
            expected_owner_name=current_user.full_name,
            expected_address=f"{property_obj.address_line1} {property_obj.address_line2 or ''} {property_obj.city} {property_obj.postal_code} {property_obj.country}".strip(),
            document_type=document_type,
        )
    except Exception as e:
        logger.error(f"Property verification crashed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification processing error: {str(e)}",
        )

    # PR-8 fix: "pending_review" (address mismatch) is a MEDIUM-control result, not a block.
    # Old code blocked on rejection — keep that for hard OCR failures only.
    if verification_result["status"] == "rejected" and not verification_result.get("data"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract any property data from the document — please upload a clearer scan.",
        )

    # Source document is processed transiently — NEVER store it (PR-8 / GDPR).
    # No watermark, no upload to storage, no file_url.
    control_documented = verification_result.get("verified", False)

    # PR-8: store "control, not ownership-attested" — never claim ownership is proven.
    property_obj.ownership_verified = control_documented
    property_obj.ownership_data = {
        **(property_obj.ownership_data or {}),
        "label": "control_not_ownership_attested",
        "assurance": "MEDIUM",
        "control_documented": control_documented,
        "upload_date": naive_utcnow().isoformat(),
        "document_type": document_type,
        "address_match": verification_result.get("status") == "verified",
        # extracted_data carries owner_name + address for corroboration display only;
        # it is NEVER treated as ownership proof and contains no raw identity document data.
        "extracted_data": verification_result.get("data"),
    }

    # Update user-level control status — mirrors property, keeps same "control" framing.
    # Trust score bump is kept (legitimate incentive) but status label is corrected.
    if control_documented:
        await db.execute(
            update(User).where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 20))
        )
        await db.refresh(current_user)
        current_user.ownership_verified = True
        current_user.ownership_status = "control_documented"
        current_user.ownership_data = {
            "label": "control_not_ownership_attested",
            "assurance": "MEDIUM",
        }
    else:
        current_user.ownership_status = "unverified"

    await db.commit()
    await db.refresh(property_obj)
    await db.refresh(current_user)

    return {
        "property_control": control_documented,
        "property_control_assurance": "MEDIUM",
        "label": "control_not_ownership_attested",
        "address_match": verification_result.get("status") == "verified",
        "note": (
            "Property control documented. This does not attest legal ownership — "
            "no free ownership oracle is available. Disclosed limitation."
        ),
    }
