"""
Verification API endpoints for identity and employment verification.
"""

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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.core.cache import cache
import logging
from app.services.storage import storage

logger = logging.getLogger(__name__)
from app.utils.watermark import apply_watermark
from app.services.feature_flag_service import feature_flag_service

# Fallback in-memory verification sessions (if Redis is not available)
# Format: { code: { user_id, document_type, expires_at, completed } }
_verification_sessions: dict[str, dict] = {}

async def _save_session(code: str, session_data: dict):
    if cache.redis_client:
        await cache.set(f"verification_session:{code}", session_data, ttl=3600)
    else:
        _verification_sessions[code] = session_data

async def _get_session(code: str):
    if cache.redis_client:
        return await cache.get(f"verification_session:{code}")
    else:
        _cleanup_expired_sessions()
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

    # Read file content
    content = await file.read()

    _check_upload_rate_limit(str(current_user.id), "identity")

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
        watermarked_content = apply_watermark(content)
        storage_result = await storage.upload_file(
            file_data=BytesIO(watermarked_content),
            filename=file.filename,
            content_type=file.content_type,
            folder=f"verification/identity/{current_user.id}",
        )
        if not current_user.identity_verified:
            current_user.trust_score = min(100, current_user.trust_score + 30)
        current_user.identity_verified = True
        current_user.identity_status = "verified"
        current_user.identity_data = {
            "verified": True,
            "upload_date": naive_utcnow().isoformat(),
            "filename": file.filename,
            "file_url": storage_result["url"],
            "storage_key": storage_result.get("key"),
            "status": "verified",
            "verification_method": "selfie_with_id",
            "extracted_data": result["data"],
            "checks": result["validation_checks"],
        }
        await db.commit()
        await db.refresh(current_user)
        return {
            "message": "Identity verified",
            "verified": True,
            "status": "verified",
            "trust_score": current_user.trust_score,
        }

    # Apply watermark before upload
    watermarked_content = apply_watermark(content)
    storage_result = await storage.upload_file(
        file_data=BytesIO(watermarked_content),
        filename=file.filename,
        content_type=file.content_type,
        folder=f"verification/identity/{current_user.id}"
    )

    # Back side: store supplementary file, keep existing front file_url intact
    if side == "back":
        current_user.identity_data = {
            **(current_user.identity_data or {}),
            "back_file_url": storage_result["url"],
            "back_storage_key": storage_result.get("key"),
        }
        await db.commit()
        await db.refresh(current_user)
        return {
            "message": "Back side uploaded",
            "verified": False,
            "status": current_user.identity_data.get("status", "document_uploaded"),
            "trust_score": current_user.trust_score,
            "details": "Upload a selfie to complete identity verification",
        }

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

    current_user.identity_verified = False
    current_user.identity_status = "document_uploaded"
    current_user.identity_data = {
        "verified": False,
        "upload_date": naive_utcnow().isoformat(),
        "filename": file.filename,
        "file_url": storage_result["url"],
        "storage_key": storage_result.get("key"),
        "status": "document_uploaded",
        "extracted_data": result["data"],
        "checks": result["validation_checks"],
    }

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

    # Read file content
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

        watermarked = apply_watermark(content)
        storage_result = await storage.upload_file(
            file_data=BytesIO(watermarked),
            filename=file.filename or "selfie_with_id.jpg",
            content_type=file.content_type,
            folder=f"verification/identity/{user.id}",
        )
        if not user.identity_verified:
            user.trust_score = min(100, user.trust_score + 30)
        user.identity_verified = True
        user.identity_status = "verified"
        user.identity_data = {
            "verified": True,
            "upload_date": naive_utcnow().isoformat(),
            "file_url": storage_result["url"],
            "storage_key": storage_result.get("key"),
            "status": "verified",
            "verification_method": "selfie_with_id",
            "extracted_data": doc_result["data"],
            "checks": doc_result["validation_checks"],
            "verified_at": naive_utcnow().isoformat(),
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

        if not face_result["match"] or face_result["confidence"] < 0.6:
            raise HTTPException(
                status_code=422,
                detail=f"Face does not match identity document. {face_result['reason']}",
            )

        watermarked = apply_watermark(content)
        selfie_storage = await storage.upload_file(
            file_data=BytesIO(watermarked),
            filename=file.filename or "selfie.jpg",
            content_type=file.content_type,
            folder=f"verification/selfie/{user.id}",
        )

        if not user.identity_verified:
            user.trust_score = min(100, user.trust_score + 30)
        user.identity_verified = True
        user.identity_status = "verified"
        user.identity_data = {
            **user.identity_data,
            "selfie_url": selfie_storage["url"],
            "selfie_storage_key": selfie_storage.get("key"),
            "face_match_confidence": face_result["confidence"],
            "verified_at": naive_utcnow().isoformat(),
            "status": "verified",
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
    watermarked_content = apply_watermark(content)
    storage_result = await storage.upload_file(
        file_data=BytesIO(watermarked_content),
        filename=file.filename,
        content_type=file.content_type,
        folder=f"verification/identity/{user.id}",
    )

    # Back side: store supplementary file, keep existing front file_url intact
    if side == "back":
        user.identity_data = {
            **(user.identity_data or {}),
            "back_file_url": storage_result["url"],
            "back_storage_key": storage_result.get("key"),
        }
        await db.commit()
        await db.refresh(user)
        return {
            "message": "Back side uploaded — please complete liveness check",
            "verified": False,
            "status": user.identity_data.get("status", "document_uploaded"),
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

    # Document validated — selfie required to complete identity verification
    user.identity_verified = False
    user.identity_status = "document_uploaded"
    user.identity_data = {
        "verified": False,
        "upload_date": naive_utcnow().isoformat(),
        "filename": file.filename,
        "file_url": storage_result["url"],
        "source": "mobile_capture",
        "storage_key": storage_result.get("key"),
        "status": "document_uploaded",
        "extracted_data": doc_result["data"],
        "checks": doc_result["validation_checks"],
    }

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

    _check_upload_rate_limit(str(current_user.id), "selfie")

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Please upload JPEG, PNG, or HEIC.",
        )

    selfie_bytes = await file.read()

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

    if not face_result["match"] or face_result["confidence"] < 0.6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Face does not match identity document. {face_result['reason']}",
        )

    watermarked = apply_watermark(selfie_bytes)
    from io import BytesIO
    selfie_storage = await storage.upload_file(
        file_data=BytesIO(watermarked),
        filename=file.filename or "selfie.jpg",
        content_type=file.content_type,
        folder=f"verification/selfie/{current_user.id}",
    )

    if not current_user.identity_verified:
        current_user.trust_score = min(100, current_user.trust_score + 30)
    current_user.identity_verified = True
    current_user.identity_status = "verified"
    current_user.identity_data = {
        **current_user.identity_data,
        "selfie_url": selfie_storage["url"],
        "selfie_storage_key": selfie_storage.get("key"),
        "face_match_confidence": face_result["confidence"],
        "verified_at": naive_utcnow().isoformat(),
        "status": "verified",
    }

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Identity fully verified",
        "identity_verified": True,
        "trust_score": current_user.trust_score,
    }


_upload_rate_limits: dict[str, list[datetime]] = {}

def _check_upload_rate_limit(user_id: str, doc_type: str):
    now = naive_utcnow()
    key = f"{user_id}:{doc_type}"
    
    # Clean up old timestamps
    if key in _upload_rate_limits:
        _upload_rate_limits[key] = [t for t in _upload_rate_limits[key] if now - t < timedelta(hours=1)]
    else:
        _upload_rate_limits[key] = []
        
    if len(_upload_rate_limits[key]) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Maximum 5 uploads per hour per document type.",
        )
        
    _upload_rate_limits[key].append(now)


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
    _check_upload_rate_limit(str(current_user.id), document_type)

    # File size validation: max 10MB per file
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, HEIC, or PDF",
        )

    # Read content to check file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 10MB limit.",
        )

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
        current_user.trust_score = min(100, current_user.trust_score + 20)

    # Apply watermark before upload
    watermarked_content = apply_watermark(content)
    
    # Save file to Cloud Storage
    from io import BytesIO
    storage_result = await storage.upload_file(
        file_data=BytesIO(watermarked_content),
        filename=file.filename,
        content_type=file.content_type,
        folder=f"verification/income/{current_user.id}"
    )
    
    file_url = storage_result["url"]

    # Store verification data
    extracted = result.get("data")
    if extracted and isinstance(extracted, dict):
        for k, v in extracted.items():
            if hasattr(v, 'as_integer_ratio'):  # duck-type check for Decimal/float
                extracted[k] = float(v)

    current_user.income_data = {
        "verified": result["verified"],
        "upload_date": naive_utcnow().isoformat(),
        "filename": file.filename,
        "file_url": file_url,
        "storage_key": storage_result.get("key"),
        "status": result["status"],
        "extracted_data": extracted,
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
    # Also update employment fields for safety
    current_user.employment_verified = current_user.income_verified
    current_user.employment_status = current_user.income_status
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
        "employment_verified": current_user.employment_verified,
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
        current_user.trust_score = max(0, current_user.trust_score - 15)
        
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
    _check_upload_rate_limit(str(current_user.id), "visale")

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, or PDF",
        )

    content = await file.read()

    from app.services.employment import employment_service
    result = await employment_service.verify_document(
        file_content=content,
        file_type=file.content_type,
        expected_name=current_user.full_name,
        document_type="visale_certificate",
    )

    if not result["verified"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result.get("rejection_reason") or "Visale certificate could not be verified. Please upload a valid certificate.",
        )

    watermarked_content = apply_watermark(content)
    from io import BytesIO
    storage_result = await storage.upload_file(
        file_data=BytesIO(watermarked_content),
        filename=file.filename,
        content_type=file.content_type,
        folder=f"verification/guarantor/{current_user.id}",
    )

    current_user.guarantor_type = "visale"
    if current_user.guarantor_status != "verified":
        current_user.trust_score = min(100, current_user.trust_score + 15)
    current_user.guarantor_status = "verified"
    current_user.guarantor_data = {
        "file_url": storage_result["url"],
        "storage_key": storage_result.get("key"),
        "verified_at": naive_utcnow().isoformat(),
        "extracted_data": result.get("data", {}),
    }

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Visale certificate verified successfully",
        "guarantor_type": current_user.guarantor_type,
        "guarantor_status": current_user.guarantor_status,
        "trust_score": current_user.trust_score,
    }


@router.post("/guarantor/garantme")
async def verify_garantme(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload and AI-verify a Garantme guarantee certificate"""
    _check_upload_rate_limit(str(current_user.id), "garantme")

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, or PDF",
        )

    content = await file.read()

    from app.services.employment import employment_service
    result = await employment_service.verify_document(
        file_content=content,
        file_type=file.content_type,
        expected_name=current_user.full_name,
        document_type="garantme_certificate",
    )

    if not result["verified"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result.get("rejection_reason") or "Garantme certificate could not be verified. Please upload a valid certificate.",
        )

    watermarked_content = apply_watermark(content)
    from io import BytesIO
    storage_result = await storage.upload_file(
        file_data=BytesIO(watermarked_content),
        filename=file.filename,
        content_type=file.content_type,
        folder=f"verification/guarantor/{current_user.id}",
    )

    current_user.guarantor_type = "garantme"
    if current_user.guarantor_status != "verified":
        current_user.trust_score = min(100, current_user.trust_score + 15)
    current_user.guarantor_status = "verified"
    current_user.guarantor_data = {
        "file_url": storage_result["url"],
        "storage_key": storage_result.get("key"),
        "verified_at": naive_utcnow().isoformat(),
        "extracted_data": result.get("data", {}),
    }

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Garantme certificate verified successfully",
        "guarantor_type": current_user.guarantor_type,
        "guarantor_status": current_user.guarantor_status,
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
    _check_upload_rate_limit(str(current_user.id), document_type)

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, HEIC, or PDF",
        )

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
    files_list.append({
        "document_type": document_type,
        "filename": file.filename,
        "file_url": file_url,
        "storage_key": storage_result.get("key"),
        "uploaded_at": naive_utcnow().isoformat()
    })
    
    current_user.guarantor_data = {"files": files_list}
    
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "message": "Guarantor document uploaded successfully",
        "guarantor_type": current_user.guarantor_type,
        "guarantor_status": current_user.guarantor_status,
        "files": files_list,
    }


@router.delete("/guarantor")
async def delete_guarantor(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove guarantor and reset credentials"""
    if current_user.guarantor_status == "verified":
        current_user.trust_score = max(0, current_user.trust_score - 15)
        
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


@router.post("/property/upload")
async def upload_property_document(
    property_id: str = Query(...),
    document_type: str = Query(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload property ownership document (Titre de propriété or Taxe foncière).
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

    # 3. Read content
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

    if not verification_result["verified"] and verification_result["status"] == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Verification failed: {verification_result.get('rejection_reason')}",
        )

    # Apply watermark before upload
    watermarked_content = apply_watermark(content)
    
    # Save file to Cloud Storage
    from io import BytesIO
    storage_result = await storage.upload_file(
        file_data=BytesIO(watermarked_content),
        filename=file.filename,
        content_type=file.content_type,
        folder=f"verification/property/{current_user.id}"
    )
    
    file_url = storage_result["url"]

    # 6. Update property
    property_obj.ownership_verified = verification_result["verified"]
    property_obj.ownership_data = {
        "verified": verification_result["verified"],
        "upload_date": naive_utcnow().isoformat(),
        "filename": file.filename,
        "file_url": file_url,
        "status": verification_result["status"],
        "extracted_data": verification_result.get("data"),
        "checks": verification_result.get("validation_checks"),
    }
    
    # Update landlord trust score if verified
    if verification_result["verified"]:
        current_user.trust_score = min(100, current_user.trust_score + 20)
        current_user.ownership_verified = True
        current_user.ownership_data = property_obj.ownership_data

    await db.commit()
    await db.refresh(property_obj)
    await db.refresh(current_user)

    return {
        "message": "Property document processed",
        "verified": verification_result["verified"],
        "status": verification_result["status"],
        "details": verification_result.get("rejection_reason") or "Verification successful",
    }


# ============================================================
# GLI (Rent Guarantee Insurance) Endpoints
# ============================================================


class GLIQuoteRequest(BaseModel):
    """Request for GLI quote"""

    monthly_rent: float
    tenant_monthly_income: float
    tenant_employment_type: str  # 'cdi', 'cdd', 'freelance', 'retired', 'student'
    tenant_employment_verified: bool = False
    tenant_identity_verified: bool = False


@router.post("/gli/quote")
async def get_gli_quote(
    request: GLIQuoteRequest,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a GLI (Garantie Loyers Impayés) quote.
    One-click insurance quote for landlords.
    """
    if not await feature_flag_service.get_flag_state(db, "gli_quote", default=True):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GLI services are currently undergoing maintenance. Please try again later.",
        )
    from app.services.gli import TenantProfile, gli_service

    tenant = TenantProfile(
        monthly_income=request.tenant_monthly_income,
        employment_type=request.tenant_employment_type,
        employment_verified=request.tenant_employment_verified,
        identity_verified=request.tenant_identity_verified,
    )

    quote = gli_service.generate_quote(monthly_rent=request.monthly_rent, tenant=tenant)

    return {
        "eligible": quote.eligible,
        "monthly_premium": quote.monthly_premium,
        "annual_premium": quote.annual_premium,
        "coverage_amount": quote.coverage_amount,
        "coverage_months": quote.coverage_months,
        "premium_rate": quote.premium_rate,
        "eligibility_reason": quote.eligibility_reason,
        "quote_valid_until": (
            quote.quote_valid_until.isoformat() if quote.quote_valid_until else None
        ),
    }


@router.post("/gli/apply")
async def apply_gli(
    request: GLIQuoteRequest,
    property_id: str,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit GLI application.
    In production, this would submit to a GLI provider.
    For MVP: Mock application submission.
    """
    if not await feature_flag_service.get_flag_state(db, "gli_quote", default=True):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GLI services are currently undergoing maintenance. Please try again later.",
        )
    from app.services.gli import TenantProfile, gli_service

    tenant = TenantProfile(
        monthly_income=request.tenant_monthly_income,
        employment_type=request.tenant_employment_type,
        employment_verified=request.tenant_employment_verified,
        identity_verified=request.tenant_identity_verified,
    )

    quote = gli_service.generate_quote(
        monthly_rent=request.monthly_rent, tenant=tenant, property_id=property_id
    )

    if not quote.eligible:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not eligible for GLI: {quote.eligibility_reason}",
        )

    # Mock application submission
    application_id = f"GLI-{naive_utcnow().strftime('%Y%m%d%H%M%S')}"

    return {
        "status": "submitted",
        "application_id": application_id,
        "property_id": property_id,
        "quote": {
            "monthly_premium": quote.monthly_premium,
            "annual_premium": quote.annual_premium,
            "coverage_amount": quote.coverage_amount,
        },
        "next_steps": [
            "Un conseiller vous contactera sous 24h",
            "Documents requis: pièce d'identité du locataire, justificatif de revenus",
        ],
    }
