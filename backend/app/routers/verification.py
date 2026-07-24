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

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.core.cache import cache
import logging
from app.services.storage import storage

logger = logging.getLogger(__name__)
from app.utils.watermark import apply_watermark
from app.models.biometric_consent import BIOMETRIC_CONSENT_VERSION, BiometricConsent
from app.services.identity_assurance import OCR_LIVENESS_LABEL, derive_identity_assurance


async def _has_biometric_consent(user_id, db: AsyncSession) -> bool:
    result = await db.execute(
        select(BiometricConsent.id)
        .where(
            BiometricConsent.user_id == user_id,
            BiometricConsent.consent_version == BIOMETRIC_CONSENT_VERSION,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _require_biometric_consent(user_id, db: AsyncSession) -> None:
    """GDPR Art. 9: block selfie/face-match processing without recorded
    explicit consent at current wording version."""
    if not await _has_biometric_consent(user_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "BIOMETRIC_CONSENT_REQUIRED",
                "message": (
                    "Explicit consent to the selfie face-match is required before "
                    "any biometric processing. Record it via POST "
                    "/verification/biometric-consent, or use a "
                    "document-only verification instead."
                ),
                "consent_version": BIOMETRIC_CONSENT_VERSION,
            },
        )

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
    # True if income OR a MEDIUM funds_coverage (INTL funds rail) is verified — the
    # rollup the dashboard uses so a funds-only applicant reads as solvency-verified.
    solvency_verified: bool = False
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


@router.post("/biometric-consent", status_code=status.HTTP_201_CREATED)
async def record_biometric_consent(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record explicit GDPR Art. 9 consent to the selfie face-match.

    Stores who/when/version only — never biometric data. Required once per
    consent-wording version before any selfie endpoint will process images.
    """
    if await _has_biometric_consent(current_user.id, db):
        return {"status": "already_recorded", "consent_version": BIOMETRIC_CONSENT_VERSION}

    db.add(
        BiometricConsent(
            user_id=current_user.id,
            consent_version=BIOMETRIC_CONSENT_VERSION,
            user_agent=(request.headers.get("user-agent") or "")[:400] or None,
        )
    )
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        # Only the unique-constraint race means "consent already on record";
        # any other integrity failure must not report a false success on a
        # legal consent record. String match: asyncpg's constraint_name sits
        # behind driver wrappers (exc.orig.__cause__) and is version-brittle.
        if "uq_biometric_consents_user_version" in str(exc.orig):
            return {"status": "already_recorded", "consent_version": BIOMETRIC_CONSENT_VERSION}
        raise
    return {"status": "recorded", "consent_version": BIOMETRIC_CONSENT_VERSION}


@router.get("/biometric-consent")
async def get_biometric_consent_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Whether the user has consented at the current wording version."""
    return {
        "consented": await _has_biometric_consent(current_user.id, db),
        "consent_version": BIOMETRIC_CONSENT_VERSION,
    }


@router.post("/identity/upload")
async def upload_identity_document(
    document_type: Optional[str] = Form(None),
    document_type_query: Optional[str] = Query(None, alias="document_type"),
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
    final_doc_type = document_type or document_type_query or "passport"
    # GDPR Art. 9: the selfie_with_id path runs a face-match on the image
    if side == "selfie_with_id":
        await _require_biometric_consent(current_user.id, db)

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
        if not result["verified"]:
            # Fail closed: a service error (AI down) is a retryable 503, a genuine
            # face/OCR mismatch is a 400. Neither may mark the user verified.
            if result["status"] == "error":
                logger.error(f"Selfie+ID verification unavailable for user {current_user.id}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Identity verification is temporarily unavailable. Please try again in a moment. Detail: {result.get('rejection_reason')}",
                )
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

    # Purge any previous temp doc before overwriting the pointer (orphaned keys = GDPR leak).
    _prev = current_user.identity_data or {}
    if _prev.get("redis_key"):
        _prev_rk = str(_prev["redis_key"])
        deleted = await cache.delete(_prev_rk)
        if not deleted:
            logger.warning("purge_identity_doc: failed to delete redis key %s", _prev_rk)
    elif _prev.get("storage_key"):
        _prev_sk = str(_prev["storage_key"])
        try:
            await storage.delete_file(_prev_sk)
        except Exception as _exc:
            logger.warning("purge_identity_doc: failed to delete %s: %s", _prev_sk, _exc)

    # Store temporarily for face-match: Redis with 10-min TTL primary; R2 fallback if Redis unavailable.
    # Per-upload token suffix isolates concurrent web/mobile sessions.
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



@router.post("/identity/upload-multi-mobile")
async def upload_identity_multi_mobile(
    verification_code: str = Form(...),
    document_type: str = Form("passport"),
    front: UploadFile = File(...),
    back: Optional[UploadFile] = File(None),
    selfie: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(verification_code)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired verification code")
    if session["completed"]:
        raise HTTPException(status_code=400, detail="Session already completed")

    import uuid
    user_id = uuid.UUID(session["user_id"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await _require_biometric_consent(user.id, db)
    await _check_upload_rate_limit(str(user.id), "identity")

    await _validate_file_size(front)
    await _validate_file_size(selfie)
    front_content = await front.read()
    selfie_content = await selfie.read()
    back_content = None
    if back:
        await _validate_file_size(back)
        back_content = await back.read()

    from app.services.identity import identity_service
    doc_result = await identity_service.verify_three_step_kyc(
        front_img=front_content,
        front_type=front.content_type or "image/jpeg",
        back_img=back_content,
        back_type=back.content_type if back else None,
        selfie_img=selfie_content,
        selfie_type=selfie.content_type or "image/jpeg",
        document_type=document_type,
        expected_name=user.full_name,
    )

    if not doc_result["verified"]:
        if doc_result["status"] == "error":
            # Log internals; never surface raw AI errors to the client
            logger.error(
                f"3-step KYC verification unavailable for session {verification_code}: "
                f"{doc_result.get('rejection_reason')}"
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "VERIFICATION_UNAVAILABLE",
                    "message": "Identity verification is temporarily unavailable. Please try again in a few minutes.",
                },
            )
        failed_checks = [
            c["name"]
            for c in doc_result.get("validation_checks", [])
            if isinstance(c, dict) and c.get("critical") and not c.get("passed")
        ]
        logger.warning(f"3-step KYC rejected for session {verification_code}: {doc_result.get('rejection_reason')}")
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VERIFICATION_FAILED",
                "failed_checks": failed_checks,
                "message": f"Verification failed: {doc_result.get('rejection_reason')}",
            },
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
        "verification_method": "three_step_kyc",
        # PII rule: store pass/fail booleans only — check "details" strings embed
        # the extracted name, expiry date, and document type (never at rest)
        "checks": [
            {"name": c.get("name"), "passed": bool(c.get("passed")), "critical": bool(c.get("critical", False))}
            for c in doc_result.get("validation_checks", [])
            if isinstance(c, dict) and c.get("name")
        ],
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


@router.post("/identity/upload-mobile")
async def upload_identity_mobile(
    verification_code: Optional[str] = Query(None),
    verification_code_form: Optional[str] = Form(None, alias="verification_code"),
    document_type: Optional[str] = Query(None),
    document_type_form: Optional[str] = Form(None, alias="document_type"),
    side: Optional[str] = Query(None),
    side_form: Optional[str] = Form(None, alias="side"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload identity document via mobile using a verification session code.
    No auth token needed — the session code links to the user.
    """
    code = verification_code or verification_code_form
    if not code:
        raise HTTPException(status_code=400, detail="Verification code is required")
    doc_type = document_type or document_type_form or "passport"
    sd = side or side_form

    session = await _get_session(code)
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

    # GDPR Art. 9: selfie sides run a face-match on the image
    if side in ("selfie_with_id", "selfie"):
        await _require_biometric_consent(user.id, db)

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
        if not doc_result["verified"]:
            # Fail closed (see the authenticated path above): AI-down → 503, mismatch → 400.
            if doc_result["status"] == "error":
                logger.error(f"Selfie+ID verification unavailable for session {verification_code}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Identity verification is temporarily unavailable. Please try again in a moment. Detail: {doc_result.get('rejection_reason')}",
                )
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

        try:
            face_result = await identity_service.compare_faces(
                id_image=id_bytes,
                id_file_type=id_content_type,
                selfie=content,
                selfie_file_type=file.content_type or "image/jpeg",
            )
        except HTTPException:
            raise
        except Exception as _cmp_exc:
            logger.error("compare_faces failed: %s", _cmp_exc)
            raise HTTPException(status_code=500, detail="Face comparison failed.") from _cmp_exc
        finally:
            # Purge temp ID doc regardless of compare_faces outcome (GDPR: no retention on failure).
            _rk = str(user.identity_data.get("redis_key")) if user.identity_data and user.identity_data.get("redis_key") else None
            if _rk:
                _deleted = await cache.delete(_rk)
                if not _deleted:
                    logger.warning("purge_identity_doc: failed to delete redis key %s", _rk)
            else:
                _sk = str(user.identity_data.get("storage_key")) if user.identity_data and user.identity_data.get("storage_key") else None
                if _sk:
                    try:
                        await storage.delete_file(_sk)
                    except Exception as _del_exc:
                        logger.warning("purge_identity_doc: failed to delete %s: %s", _sk, _del_exc)

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

    # Purge any previous temp doc before overwriting the pointer (orphaned keys = GDPR leak).
    _prev = user.identity_data or {}
    if _prev.get("redis_key"):
        _prev_rk = str(_prev["redis_key"])
        deleted = await cache.delete(_prev_rk)
        if not deleted:
            logger.warning("purge_identity_doc: failed to delete redis key %s", _prev_rk)
    elif _prev.get("storage_key"):
        _prev_sk = str(_prev["storage_key"])
        try:
            await storage.delete_file(_prev_sk)
        except Exception as _exc:
            logger.warning("purge_identity_doc: failed to delete %s: %s", _prev_sk, _exc)

    # Store temporarily for face-match: Redis with 10-min TTL primary; R2 fallback if Redis unavailable.
    # Per-upload token suffix isolates concurrent web/mobile sessions.
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
    await _require_biometric_consent(current_user.id, db)
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
    try:
        face_result = await identity_service.compare_faces(
            id_image=id_bytes,
            id_file_type=id_content_type,
            selfie=selfie_bytes,
            selfie_file_type=file.content_type or "image/jpeg",
        )
    except HTTPException:
        raise
    except Exception as _cmp_exc:
        logger.error("compare_faces failed: %s", _cmp_exc)
        raise HTTPException(status_code=500, detail="Face comparison failed.") from _cmp_exc
    finally:
        # Purge temp ID doc regardless of compare_faces outcome (GDPR: no retention on failure).
        _rk = str(current_user.identity_data.get("redis_key")) if current_user.identity_data and current_user.identity_data.get("redis_key") else None
        if _rk:
            _deleted = await cache.delete(_rk)
            if not _deleted:
                logger.warning("purge_identity_doc: failed to delete redis key %s", _rk)
        else:
            _sk = str(current_user.identity_data.get("storage_key")) if current_user.identity_data and current_user.identity_data.get("storage_key") else None
            if _sk:
                try:
                    await storage.delete_file(_sk)
                except Exception as _del_exc:
                    logger.warning("purge_identity_doc: failed to delete %s: %s", _sk, _del_exc)

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
    # The name-match check is critical: without an account name every document
    # would be rejected (full_name is nullable — e.g. Google sign-in accounts).
    if not current_user.full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add your full name to your profile first — we match the name on the document against your account.",
        )

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

    if result["status"] == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Verification failed: {result.get('rejection_reason')}",
        )

    is_verified = result["verified"]
    final_status = result["status"]

    if result["status"] == "pending_review":
        failed_checks = [c["name"] for c in result.get("validation_checks", []) if isinstance(c, dict) and not c.get("passed")]
        
        # French Law/KYC: A CDD contract is a legal employment type, so 'stable_employment' can fail.
        # However, poor OCR, invalid salary data, or SIRET mismatch imply poor document quality or fraud.
        allowed_soft_failures = {"stable_employment"}
        unauthorized_failures = set(failed_checks) - allowed_soft_failures
        
        if unauthorized_failures:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Verification failed: Document quality too low or data invalid ({', '.join(unauthorized_failures)})"
            )
            
        # If only allowed soft failures occurred, it's legally authentic.
        is_verified = True
        final_status = "verified"

    # Trust score: +20 for first income verification (idempotent guard)
    if is_verified and not current_user.income_verified:
        await db.execute(
            update(User).where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 20))
        )
        await db.refresh(current_user)

    # ORM attributes AFTER refresh to avoid clobbering by the SELECT
    current_user.income_verified = is_verified
    current_user.income_status = final_status

    # Source document processed transiently — never stored (GDPR)
    current_user.income_data = {
        "verified": is_verified,
        "verified_at": naive_utcnow().isoformat(),
        "status": final_status,
        "checks": result["validation_checks"],
    }

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Income document processed",
        "verified": is_verified,
        "status": final_status,
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


def _strip_check_pii(data: Optional[dict]) -> Optional[dict]:
    """Copy a *_data blob for API exposure, dropping PII the UI never reads:
    check 'details' strings (extracted name, expiry date, document type) and
    any legacy 'extracted_data' payload. Pass/fail booleans survive."""
    if not data or not isinstance(data, dict):
        return data
    safe = {k: v for k, v in data.items() if k != "extracted_data"}
    if isinstance(safe.get("checks"), list):
        safe["checks"] = [
            {k: c[k] for k in ("name", "description", "passed", "critical") if k in c}
            for c in safe["checks"]
            if isinstance(c, dict)
        ]
    return safe


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
        "solvency_verified": current_user.solvency_verified,
        "ownership_verified": current_user.ownership_verified,
        "kbis_verified": current_user.kbis_verified,
        "carte_g_verified": current_user.carte_g_verified,
        "identity_data": _strip_check_pii(current_user.identity_data),
        "employment_data": _strip_check_pii(current_user.employment_data),
        "ownership_data": _strip_check_pii(current_user.ownership_data),
        "income_data": _strip_check_pii(current_user.income_data),
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
    if current_user.guarantor_status != "verified":
        await db.execute(
            update(User).where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 15))
        )
        await db.refresh(current_user)
    # ORM attributes AFTER refresh to avoid clobbering by the SELECT
    current_user.guarantor_type = "visale"
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
    if current_user.guarantor_status != "verified":
        await db.execute(
            update(User).where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 15))
        )
        await db.refresh(current_user)
    # ORM attributes AFTER refresh to avoid clobbering by the SELECT
    current_user.guarantor_type = "garantme"
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
    # Replace existing entry for same doc_type (last-write-wins) — purge the
    # replaced storage object so no orphaned guarantor PII stays at rest (GDPR)
    _kept = []
    for _f in files_list:
        if _f.get("document_type") == document_type:
            if _f.get("storage_key"):
                await storage.purge_object(_f["storage_key"], "guarantor_reupload")
        else:
            _kept.append(_f)
    files_list = _kept
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

    # Purge stored guarantor files before dropping their last reference (GDPR)
    for _f in (current_user.guarantor_data or {}).get("files", []):
        if _f.get("storage_key"):
            await storage.purge_object(_f["storage_key"], "guarantor_delete")

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

    # Throttle live ADEME lookups per property so the open-data API isn't hammered.
    await _check_upload_rate_limit(str(current_user.id), f"dpe:{property_id}")

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
        try:
            from app.workers.tasks import retry_pending_dpe_task
            retry_pending_dpe_task.apply_async(
                args=[str(prop.id), dpe_number.strip()],
                countdown=60,
            )
        except Exception as _celery_exc:
            logger.warning(
                "retry_pending_dpe: failed to enqueue background retry for property %s: %s",
                prop.id,
                _celery_exc,
            )
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
    await _check_upload_rate_limit(str(current_user.id), "insurance")
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
    property_id: Optional[str] = Query(None),
    property_id_form: Optional[str] = Form(None, alias="property_id"),
    document_type: Optional[str] = Query(None),
    document_type_form: Optional[str] = Form(None, alias="document_type"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload taxe foncière or titre de propriété to evidence property control.
    """
    prop_id = property_id or property_id_form
    doc_type = document_type or document_type_form
    if not prop_id:
        raise HTTPException(status_code=400, detail="Property ID is required")
    if not doc_type:
        raise HTTPException(status_code=400, detail="Document type is required")
    from app.models.property import Property
    
    # 1. Validate property
    import uuid
    try:
        prop_uuid = uuid.UUID(prop_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid property ID")
        
    result = await db.execute(select(Property).where(Property.id == prop_uuid))
    property_obj = result.scalar_one_or_none()
    
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")
        
    if property_obj.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this property")

    # Per-property upload throttle (OCR is expensive) — keyed by property so a
    # landlord verifying several properties isn't blocked across all of them.
    await _check_upload_rate_limit(str(current_user.id), f"property_doc:{prop_id}")

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


# ── Deposit-binding evidence layer (item 15) ────────────────────────────────────

class DepositBindRequest(BaseModel):
    property_id: str
    lease_type: str  # vide | meuble | etudiant | mobilite
    monthly_rent_hors_charges: float
    deposit_amount: float
    payee_iban: str
    payee_holder_name: str
    tenant_credential_id: Optional[str] = None
    consent: bool = False


@router.post("/deposit/bind")
async def bind_deposit(
    body: DepositBindRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Bind an agreed deposit to a specific payee (item 15 — the deposit-safety wedge).

    Records verified landlord ↔ property ↔ deposit amount ↔ payee IBAN + name-match ↔
    date into the user's signed evidence layer so a deposit-theft victim (the tenant)
    can prove exactly who they were told to pay.

    Roomivo is NEVER in the money flow (DOSSIER §0.15): the deposit flows directly
    tenant→landlord off-platform. This endpoint neither initiates nor confirms any
    payment, and does NOT prove the IBAN belongs to the landlord's account at the bank
    (disclosed limit — bank-side Verification of Payee runs in the payer's bank).

    GDPR: the payee IBAN is the landlord's personal data → emit-and-forget. Only the
    masked IBAN + the name-match verdict are stored; the raw IBAN and the declared
    holder name are never persisted.
    """
    from app.models.property import Property
    from app.services.iban import validate_iban
    from app.services.lease_rules import validate_deposit
    from app.services.fr_2ddoc import name_matches_any
    import uuid

    # 1. Explicit consent — IBAN is landlord PII.
    if not body.consent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Consent is required to bind a payee IBAN (landlord personal data).",
        )

    # 2. Identity must be verified (MEDIUM+) — a binding by an unverified party is worthless.
    if not current_user.identity_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Identity must be verified before binding a deposit.",
        )

    # 3. Property must belong to this landlord.
    try:
        prop_uuid = uuid.UUID(body.property_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid property_id.")
    prop_result = await db.execute(
        select(Property).where(Property.id == prop_uuid, Property.landlord_id == current_user.id)
    )
    property_obj = prop_result.scalar_one_or_none()
    if property_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found.")

    # 4. IBAN structural validation (offline mod-97; NOT a bank/ownership check).
    iban_result = validate_iban(body.payee_iban)
    if not iban_result["valid"]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=iban_result["error"])

    # 5. Deposit cap (LG-1) + bail mobilité must be 0 (LG-2) — reuse lease_rules.
    cap_errors = validate_deposit(body.lease_type, body.deposit_amount, body.monthly_rent_hors_charges)
    if cap_errors:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=cap_errors[0])

    # 6. Payee-name ↔ verified-landlord name-match. For an SCI (item 16) the target is
    # the verified entity denomination; otherwise the landlord's verified personal name.
    existing = current_user.deposit_binding_data if isinstance(current_user.deposit_binding_data, dict) else {}
    entity = existing.get("landlord_entity") or {}
    if entity.get("type") == "sci" and entity.get("denomination"):
        match_target, target_label = entity["denomination"], "sci"
    else:
        match_target, target_label = (current_user.full_name or ""), "individual"
    name_match = "MATCH" if name_matches_any(body.payee_holder_name, [match_target]) else "MISMATCH"

    # 7. Persist emit-and-forget: masked IBAN + verdict only, NEVER the raw IBAN/name.
    binding = {
        "deposit_amount": body.deposit_amount,
        "lease_type": body.lease_type,
        "payee_iban_masked": iban_result["masked"],
        "iban_country": iban_result["country"],
        "payee_name_match": name_match,
        "payee_match_target": target_label,
        "bank_ownership_confirmed": False,  # disclosed limit — never confirmed at the bank
        "property_id": body.property_id,
        "tenant_credential_id": body.tenant_credential_id,
        "consent_at": naive_utcnow().isoformat(),
        "bound_at": naive_utcnow().isoformat(),
    }
    current_user.deposit_binding_data = {**existing, "binding": binding}
    await db.commit()
    await db.refresh(current_user)

    return {
        **binding,
        "note": (
            "Deposit binding recorded. Roomivo is not in the money flow — this proves "
            "who you were told to pay, not that funds moved. The IBAN was checked for "
            "structural validity only; ownership of the account was not confirmed."
        ),
    }


# ── Entity / SCI landlord verification (item 16) ────────────────────────────────

class LandlordEntityRequest(BaseModel):
    landlord_type: str  # individual | sci | manager
    siren: Optional[str] = None


@router.post("/landlord-entity/verify")
async def verify_landlord_entity(
    body: LandlordEntityRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Record the landlord type and, for an SCI, chain the verified gérant → SCI → payee
    (item 16). When the lessor is an entity the account/lease are in the entity name,
    so the item-15 payee name-match must target the SCI denomination, not the gérant's
    personal name.

    Verify-only. The `manager` (Hoguet carte G mandataire) branch records the type but
    builds NO mandate/brokering flow — that would cross the entremise red line.
    Only the public entity denomination + match booleans are stored at rest.
    """
    from app.services.french_government_api import french_gov_service
    from app.services.fr_2ddoc import name_matches_any

    if body.landlord_type not in ("individual", "sci", "manager"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid landlord_type.")

    # Throttle per user — the SCI branch hits the external SIREN register.
    await _check_upload_rate_limit(str(current_user.id), "landlord_entity")

    if not current_user.identity_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Identity must be verified before verifying a landlord entity.",
        )

    existing = current_user.deposit_binding_data if isinstance(current_user.deposit_binding_data, dict) else {}
    entity: dict = {"type": body.landlord_type, "verified_at": naive_utcnow().isoformat()}

    if body.landlord_type == "sci":
        if not body.siren:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="SIREN is required for an SCI.")
        result = await french_gov_service.verify_entity(body.siren)
        if not result.get("valid"):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=result.get("error", "SIREN verification failed."))
        if not result.get("is_active"):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Entity is not active in the national register.")

        # Chain: does this verified user appear as a gérant of the SCI?
        gerants = [d for d in result["dirigeants"] if "gérant" in (d.get("qualite", "").lower())] or result["dirigeants"]
        candidates = [f"{d.get('prenoms', '')} {d.get('nom', '')}".strip() for d in gerants]
        gerant_match = name_matches_any(current_user.full_name or "", candidates)

        entity.update({
            "siren": body.siren,
            "denomination": result["denomination"],
            "legal_form": result["legal_form"],
            "gerant_match": gerant_match,
        })
        # Only mark the entity verified when the CHAIN succeeds (entity real AND this
        # user is a gérant of it). Setting it on a gérant mismatch would let anyone
        # claim a real SCI's SIREN and read as a "verified entity landlord".
        current_user.kbis_verified = gerant_match

    elif body.landlord_type == "manager":
        # Carte G mandataire scaffolding only — no mandate/brokering surface (Hoguet).
        current_user.carte_g_verified = True

    current_user.deposit_binding_data = {**existing, "landlord_entity": entity}
    await db.commit()
    await db.refresh(current_user)

    return {
        "landlord_type": entity["type"],
        "denomination": entity.get("denomination"),
        "gerant_match": entity.get("gerant_match"),
        "note": (
            "Landlord type recorded. For an SCI, the deposit-binding payee name-match "
            "now targets the verified entity denomination. Verification only — Roomivo "
            "holds no mandate and brokers nothing."
        ),
    }


# ── INTL rails ─────────────────────────────────────────────────────────────────

async def _ai_extract_intl_income(
    file_content: bytes, content_type: str, ai_client=None
) -> Optional[dict]:
    """Extract income data from a foreign income document via Gemini AI."""
    prompt = (
        "Extract income data from this foreign income document "
        "(payslip, tax return, bank statement, or equivalent).\n\n"
        "Return ONLY this JSON — no markdown:\n"
        '{"income_amount": <number or null>, "income_currency": "<ISO 4217>", '
        '"income_period": "monthly"|"annual"|"unknown", '
        '"employee_name": "<name or null>", '
        '"document_type": "payslip"|"tax_return"|"bank_statement"|"other"}\n\n'
        "Rules:\n"
        "- income_amount: primary gross/net income figure (not deductions)\n"
        "- income_currency: must be ISO 4217 (INR, USD, GBP, CNY, JPY, etc.)\n"
        "- income_period: monthly for payslips, annual for tax returns\n"
        "- Return null for income_amount if you cannot determine it"
    )
    try:
        from google import genai as _genai
        from google.genai import types as _types
        from app.core.config import settings

        client = ai_client
        if client is None and getattr(settings, "GEMINI_API_KEY", None):
            client = _genai.Client(api_key=settings.GEMINI_API_KEY)
        if client is None:
            return None

        image_part = _types.Part.from_bytes(data=file_content, mime_type=content_type)
        for model in ("gemini-2.5-flash",):
            try:
                response = client.models.generate_content(
                    model=model, contents=[image_part, prompt]
                )
                import json as _json
                text = response.text.strip()
                if text.startswith("```"):
                    text = text.split("```")[1].lstrip("json").strip()
                return _json.loads(text)
            except Exception as _exc:
                logger.warning("AI intl income extraction (%s) failed: %s", model, _exc)
    except Exception as _exc:
        logger.error("_ai_extract_intl_income crashed: %s", _exc)
    return None


def _name_present(user_full_name: str, document_name: str | None) -> bool:
    """MEDIUM-grade anti-fraud flag: does the applicant's name appear on the doc?

    For self-funds the applicant is the account holder; for sponsor-funds the
    applicant should appear as the named beneficiary. Token-overlap check only —
    this raises a flag, never an assurance tier.
    """
    if not user_full_name or not document_name:
        return False

    def _tokens(s: str) -> set:
        return {t for t in "".join(c.lower() if c.isalnum() else " " for c in s).split() if len(t) >= 2}

    return bool(_tokens(user_full_name) & _tokens(document_name))


async def _ai_extract_intl_funds(
    file_content: bytes, content_type: str, ai_client=None
) -> Optional[dict]:
    """Extract fiscal-capacity data from a funding document via Gemini AI.

    Covers bank statements, scholarship/sponsorship letters, and loan approvals.
    """
    prompt = (
        "Extract funding/fiscal-capacity data from this document "
        "(bank statement, scholarship award letter, sponsorship letter, or "
        "education loan approval).\n\n"
        "Return ONLY this JSON — no markdown:\n"
        '{"funds_amount": <number or null>, "funds_currency": "<ISO 4217>", '
        '"coverage_period_months": <number or null>, '
        '"beneficiary_name": "<name or null>", '
        '"issuer": "<bank/awarding body/sponsor/lender or null>"}\n\n'
        "Rules:\n"
        "- funds_amount: total available balance, awarded amount, sponsored sum, "
        "or sanctioned loan amount\n"
        "- funds_currency: must be ISO 4217 (INR, USD, GBP, CNY, EUR, etc.)\n"
        "- coverage_period_months: for time-bounded funding (scholarship/loan/"
        "sponsorship) the number of months it covers; null for a bank balance\n"
        "- beneficiary_name: the person who holds or receives the funds\n"
        "- Return null for funds_amount if you cannot determine it"
    )
    try:
        from google import genai as _genai
        from google.genai import types as _types
        from app.core.config import settings

        client = ai_client
        if client is None and getattr(settings, "GEMINI_API_KEY", None):
            client = _genai.Client(api_key=settings.GEMINI_API_KEY)
        if client is None:
            return None

        image_part = _types.Part.from_bytes(data=file_content, mime_type=content_type)
        for model in ("gemini-2.5-flash",):
            try:
                response = client.models.generate_content(
                    model=model, contents=[image_part, prompt]
                )
                import json as _json
                text = response.text.strip()
                if text.startswith("```"):
                    text = text.split("```")[1].lstrip("json").strip()
                return _json.loads(text)
            except Exception as _exc:
                logger.warning("AI intl funds extraction (%s) failed: %s", model, _exc)
    except Exception as _exc:
        logger.error("_ai_extract_intl_funds crashed: %s", _exc)
    return None


@router.post("/intl/identity/upload")
async def upload_intl_identity_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Passport upload for INTL MEDIUM rail: MRZ scan + expiry check + temp store."""
    import base64
    from datetime import date
    from difflib import SequenceMatcher
    from app.services.mrz import extract_mrz

    allowed = {"image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")
    await _validate_file_size(file)
    await _check_upload_rate_limit(str(current_user.id), "intl_identity")
    content = await file.read()

    # Purge previous temp doc before overwriting pointer — GDPR
    _prev = current_user.identity_data or {}
    if _prev.get("redis_key"):
        deleted = await cache.delete(str(_prev["redis_key"]))
        if not deleted:
            logger.warning("purge_intl_doc: redis delete failed for %s", _prev["redis_key"])
    elif _prev.get("storage_key"):
        try:
            await storage.delete_file(str(_prev["storage_key"]))
        except Exception as _exc:
            logger.warning("purge_intl_doc: storage delete failed for %s: %s", _prev["storage_key"], _exc)

    mrz = await extract_mrz(content, file.content_type or "image/jpeg")
    if not mrz.mrz_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "MRZ_CHECKSUM_FAIL — Le document ne peut pas être lu. Veuillez reprendre "
                "une photo nette de la page de données du passeport. / "
                "The document could not be read. Please retake a clear photo of the passport data page."
            ),
        )

    # Expiry: YYMMDD where YY<50 -> 2000s, YY>=50 -> 1900s
    try:
        exp_yy = int(mrz.expiry[0:2])
        exp_year = 2000 + exp_yy if exp_yy < 50 else 1900 + exp_yy
        if date(exp_year, int(mrz.expiry[2:4]), int(mrz.expiry[4:6])) < date.today():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "PASSPORT_EXPIRED — Passeport expiré. Veuillez utiliser un passeport "
                    "en cours de validité. / Passport expired. Please use a valid passport."
                ),
            )
    except HTTPException:
        raise
    except Exception:
        pass  # malformed expiry — not a hard block

    # Name match — advisory only, never blocks (same as FR avis cross-check)
    name_mismatch = False
    name_transliteration_mismatch = False
    mrz_name = f"{mrz.surname} {mrz.given_names}".strip()
    if current_user.full_name and mrz_name:
        similarity = SequenceMatcher(
            None,
            current_user.full_name.upper(),
            mrz_name.upper(),
        ).ratio()
        if similarity < 0.6:
            if not current_user.full_name.isascii():
                name_transliteration_mismatch = True  # ID-9
            else:
                name_mismatch = True

    # Store temp doc in Redis (TTL 600s) or R2 fallback
    _redis_key = f"intl_passport:{current_user.id}:{secrets.token_hex(8)}"
    if cache.redis_client:
        await cache.set(
            _redis_key,
            {"b64": base64.b64encode(content).decode(), "content_type": file.content_type},
            ttl=600,
        )
        current_user.identity_data = {
            "verified": False,
            "upload_date": naive_utcnow().isoformat(),
            "redis_key": _redis_key,
            "identity_rail": "INTL",
            "status": "document_uploaded",
            "name_mismatch": name_mismatch,
            "name_transliteration_mismatch": name_transliteration_mismatch,
            "mrz_valid": True,
            "extraction_path": mrz.extraction_path,
        }
    else:
        from io import BytesIO
        r2 = await storage.upload_file(
            file_data=BytesIO(content),
            filename=file.filename or "passport.jpg",
            content_type=file.content_type or "image/jpeg",
            folder=f"verification/intl/identity/{current_user.id}",
        )
        current_user.identity_data = {
            "verified": False,
            "upload_date": naive_utcnow().isoformat(),
            "file_url": r2["url"],
            "storage_key": r2.get("key"),
            "identity_rail": "INTL",
            "status": "document_uploaded",
            "name_mismatch": name_mismatch,
            "name_transliteration_mismatch": name_transliteration_mismatch,
            "mrz_valid": True,
            "extraction_path": mrz.extraction_path,
        }

    current_user.identity_verified = False
    current_user.identity_status = "document_uploaded"
    await db.commit()
    await db.refresh(current_user)

    return {
        "message": (
            "Passeport scanné — veuillez compléter la vérification de vivacité. / "
            "Passport scanned — please complete the liveness check."
        ),
        "verified": False,
        "status": "document_uploaded",
        "identity_rail": "INTL",
        "name_mismatch": name_mismatch,
        "name_transliteration_mismatch": name_transliteration_mismatch,
    }


@router.post("/intl/identity/selfie")
async def upload_intl_identity_selfie(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Selfie face-match against stored INTL passport -> MEDIUM identity credential."""
    await _require_biometric_consent(current_user.id, db)
    import base64
    from app.services.identity import identity_service

    allowed = {"image/jpeg", "image/png", "image/jpg", "image/heic", "image/heif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")
    await _validate_file_size(file)
    await _check_upload_rate_limit(str(current_user.id), "intl_selfie")
    content = await file.read()

    if not current_user.identity_data or current_user.identity_data.get("status") != "document_uploaded":
        raise HTTPException(
            status_code=400,
            detail="Upload passport first / Veuillez d'abord télécharger votre passeport.",
        )

    _id_data = current_user.identity_data or {}
    _redis_key = _id_data.get("redis_key")
    _storage_key = _id_data.get("storage_key")
    _file_url = _id_data.get("file_url")

    id_bytes: bytes = b""
    id_content_type = "image/jpeg"

    if _redis_key:
        cached = await cache.get(str(_redis_key))
        if cached and isinstance(cached, dict):
            id_bytes = base64.b64decode(cached["b64"])
            id_content_type = cached.get("content_type", "image/jpeg")

    # Single try/finally so passport is purged even if R2 fetch or compare_faces raises
    try:
        if not id_bytes and _file_url:
            try:
                async with httpx.AsyncClient(timeout=15.0) as http:
                    resp = await http.get(_file_url)
                    resp.raise_for_status()
                    id_bytes = resp.content
                    id_content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
            except Exception as exc:
                logger.error("Failed to retrieve INTL passport for face compare: %s", exc)
                raise HTTPException(status_code=500, detail="Could not retrieve passport for comparison.")

        if not id_bytes:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Session expirée — veuillez télécharger à nouveau votre passeport. / "
                    "Session expired — re-upload passport."
                ),
            )

        face_result = await identity_service.compare_faces(
            id_image=id_bytes,
            id_file_type=id_content_type,
            selfie=content,
            selfie_file_type=file.content_type or "image/jpeg",
        )
    except HTTPException:
        raise
    except Exception as _exc:
        logger.error("compare_faces failed (INTL): %s", _exc)
        raise HTTPException(status_code=500, detail="Face comparison failed.") from _exc
    finally:
        if _redis_key:
            deleted = await cache.delete(str(_redis_key))
            if not deleted:
                logger.warning("purge_intl_passport: redis delete failed for %s", _redis_key)
        elif _storage_key:
            try:
                await storage.delete_file(str(_storage_key))
            except Exception as _del:
                logger.warning("purge_intl_passport: storage delete failed for %s: %s", _storage_key, _del)

    if not face_result["match"] or face_result["confidence"] < 0.6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Face does not match passport. {face_result['reason']}",
        )

    if not current_user.identity_verified:
        await db.execute(
            update(User)
            .where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 30))
        )
        await db.refresh(current_user)

    prev = _id_data
    current_user.identity_verified = True
    current_user.identity_status = "verified"
    current_user.identity_data = {
        "verified": True,
        "verified_at": naive_utcnow().isoformat(),
        "status": "verified",
        "identity_assurance": "MEDIUM",
        "identity_rail": "INTL",
        "verification_method": "mrz_selfie",
        "mrz_valid": prev.get("mrz_valid", True),
        "name_mismatch": prev.get("name_mismatch", False),
        "name_transliteration_mismatch": prev.get("name_transliteration_mismatch", False),
        "face_match_confidence": face_result["confidence"],
        # storage_key, file_url, redis_key intentionally NOT carried forward
    }
    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Identité vérifiée (MEDIUM) / Identity verified (MEDIUM)",
        "verified": True,
        "status": "verified",
        "identity_assurance": "MEDIUM",
        "identity_rail": "INTL",
        "trust_score": current_user.trust_score,
    }


@router.post("/intl/solvency")
async def upload_intl_solvency_document(
    file: UploadFile = File(...),
    monthly_rent: Optional[float] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Foreign income doc -> FX-normalised banded solvency -> MEDIUM (or UNVERIFIED if FX unavailable)."""
    from app.services.fx_normalise import convert_to_eur, normalise_income_to_monthly, band_solvency_ratio

    if not current_user.identity_verified:
        raise HTTPException(
            status_code=400,
            detail=(
                "Vérifiez d'abord votre identité. / "
                "Identity verification required before solvency check."
            ),
        )

    allowed = {"image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")
    await _validate_file_size(file)
    await _check_upload_rate_limit(str(current_user.id), "intl_solvency")
    content = await file.read()

    extraction = await _ai_extract_intl_income(content, file.content_type or "image/jpeg")
    if not extraction or extraction.get("income_amount") is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Impossible d'extraire les revenus du document. / "
                "Could not extract income from document."
            ),
        )

    raw_amount = float(extraction["income_amount"])
    currency = str(extraction.get("income_currency", "EUR")).upper()
    income_period = str(extraction.get("income_period", "unknown"))

    monthly_amount, normalised_period, period_unclear = normalise_income_to_monthly(
        raw_amount, income_period
    )

    fx = await convert_to_eur(monthly_amount, currency)

    # Band ratio — raw amounts discarded after this point (data minimisation)
    if fx.eur_amount is not None and monthly_rent and monthly_rent > 0:
        solvency_ratio = band_solvency_ratio(fx.eur_amount / monthly_rent)
        solvency_assurance = "MEDIUM"
    elif fx.eur_amount is not None:
        solvency_ratio = "income_only"
        solvency_assurance = "MEDIUM"
    else:
        solvency_ratio = "unavailable"
        solvency_assurance = "UNVERIFIED"

    was_income_verified = current_user.income_verified
    _prior_income = current_user.income_data or {}  # capture BEFORE merge/reassignment
    _prior_funds = _prior_income.get("funds_coverage") or {}
    had_solvency = bool(was_income_verified) or _prior_funds.get("assurance") == "MEDIUM"
    current_user.income_verified = fx.eur_amount is not None
    current_user.income_status = "verified" if fx.eur_amount is not None else "unverified"
    _income = dict(current_user.income_data or {})
    _income.update({
        "verified": current_user.income_verified,
        "upload_date": naive_utcnow().isoformat(),
        "solvency_assurance": solvency_assurance,
        "solvency_ratio": solvency_ratio,
        "income_currency": currency,
        "income_period": income_period,
        "income_period_normalised": normalised_period,
        "income_period_unclear": period_unclear,
        "fx_source": fx.fx_source,
        "fx_margin_applied": fx.margin_applied,
        "fx_margin_label": fx.fx_margin_label,
        "decret_2015_1437_disclaimer": True,
        "status": current_user.income_status,
        # raw eur_amount and raw foreign amount intentionally NOT stored
    })
    current_user.income_data = _income

    if fx.eur_amount is not None and not had_solvency:
        await db.execute(
            update(User)
            .where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 20))
        )
        await db.refresh(current_user)

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Revenus vérifiés / Income verified",
        "verified": current_user.income_verified,
        "solvency_assurance": solvency_assurance,
        "solvency_ratio": solvency_ratio,
        "income_currency": currency,
        "fx_source": fx.fx_source,
        "decret_2015_1437_disclaimer": True,
        "trust_score": current_user.trust_score,
    }


@router.post("/intl/funds")
async def upload_intl_funds_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),   # bank_statement|scholarship_letter|sponsorship_letter|loan_approval
    funds_source: str = Form(...),    # self|sponsor
    monthly_rent: Optional[float] = Form(None),
    lease_months: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Foreign funding doc -> FX-normalised banded fiscal capacity -> MEDIUM.

    Document discarded after banding (verify-and-forget). Never inflates to HIGH.
    """
    from app.services.fx_normalise import convert_to_eur, band_funds_coverage

    if not current_user.identity_verified:
        raise HTTPException(
            status_code=400,
            detail=(
                "Vérifiez d'abord votre identité. / "
                "Identity verification required before funds check."
            ),
        )

    valid_types = {"bank_statement", "scholarship_letter", "sponsorship_letter", "loan_approval"}
    if document_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid document_type: {document_type}")
    if funds_source not in {"self", "sponsor"}:
        raise HTTPException(status_code=400, detail=f"Invalid funds_source: {funds_source}")

    allowed = {"image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")
    await _validate_file_size(file)
    await _check_upload_rate_limit(str(current_user.id), "intl_funds")
    content = await file.read()

    extraction = await _ai_extract_intl_funds(content, file.content_type or "image/jpeg")
    if not extraction or extraction.get("funds_amount") is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Impossible d'extraire les fonds du document. / "
                "Could not extract funds from document."
            ),
        )

    try:
        raw_amount = float(extraction["funds_amount"])
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Could not parse funds amount.")
    if raw_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Funds amount must be greater than 0.",
        )
    currency = str(extraction.get("funds_currency", "EUR")).upper()
    coverage_period = extraction.get("coverage_period_months")
    beneficiary_name = extraction.get("beneficiary_name")

    fx = await convert_to_eur(raw_amount, currency)

    if fx.eur_amount is not None:
        funds_band = band_funds_coverage(fx.eur_amount, monthly_rent or 0.0)
        funds_assurance = "MEDIUM"
    else:
        funds_band = "unavailable"
        funds_assurance = "UNVERIFIED"

    source_strength = "proof" if document_type == "bank_statement" else "promise"

    duration_flag = None
    if coverage_period is not None and lease_months:
        try:
            duration_flag = int(coverage_period) >= int(lease_months)
        except (ValueError, TypeError):
            duration_flag = None  # unparseable period → treat as N/A, never crash

    name_present = _name_present(current_user.full_name or "", beneficiary_name)

    prior = current_user.income_data or {}
    prior_funds = prior.get("funds_coverage") or {}
    had_solvency = bool(current_user.income_verified) or prior_funds.get("assurance") == "MEDIUM"

    new_income = dict(prior)
    new_income["funds_coverage"] = {
        "funds_band": funds_band,
        "funds_source": funds_source,
        "document_type": document_type,
        "source_strength": source_strength,
        "assurance": funds_assurance,
        "flags": {"name_present": name_present, "duration_covers_lease": duration_flag},
        "fx_source": fx.fx_source,
        "fx_margin_applied": fx.margin_applied,
        "fx_margin_label": fx.fx_margin_label,
        "upload_date": naive_utcnow().isoformat(),
    }
    current_user.income_data = new_income

    if funds_assurance == "MEDIUM" and not had_solvency:
        await db.execute(
            update(User)
            .where(User.id == current_user.id)
            .values(trust_score=func.least(100, User.trust_score + 20))
        )

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Capacité fiscale vérifiée / Fiscal capacity verified",
        "funds_band": funds_band,
        "funds_source": funds_source,
        "source_strength": source_strength,
        "assurance": funds_assurance,
        "fx_source": fx.fx_source,
        "trust_score": current_user.trust_score,
    }
