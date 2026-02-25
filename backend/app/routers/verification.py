"""
Verification API endpoints for identity and employment verification.
"""

import json
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user

# In-memory verification sessions (no migration needed)
# Format: { code: { user_id, document_type, expires_at, completed } }
_verification_sessions: dict[str, dict] = {}

router = APIRouter(prefix="/verification", tags=["Verification"])


class VerificationStartRequest(BaseModel):
    """Request to start verification process"""

    verification_type: str  # "identity" or "employment"


class VerificationStatusResponse(BaseModel):
    """Verification status response"""

    identity_verified: bool
    employment_verified: bool
    identity_data: Optional[dict] = None
    employment_data: Optional[dict] = None
    trust_score: int


@router.post("/identity/upload")
async def upload_identity_document(
    document_type: str,
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
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload JPEG, PNG, or PDF",
        )

    # For MVP: Simulate document processing
    # In production, this would:
    # 1. Upload to cloud storage (S3, etc.)
    # 2. Send to Fourthline API for OCR + verification
    # 3. Get verification results

    # Mock verification data (simulating Fourthline response)
    verification_data = {
        "document_type": document_type,
        "upload_date": datetime.utcnow().isoformat(),
        "filename": file.filename,
        "status": "verified",  # Mock: auto-verify for MVP
        "extracted_data": {
            "full_name": current_user.full_name,
            "document_number": "MOCK123456",
            "expiry_date": "2030-12-31",
            "confidence_score": 0.95,
        },
    }

    # Update user verification status
    current_user.identity_verified = True
    current_user.identity_data = verification_data

    # Update trust score (identity verification adds 30 points)
    current_user.trust_score = min(100, current_user.trust_score + 30)

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Identity document verified successfully",
        "verified": True,
        "trust_score": current_user.trust_score,
    }


def _cleanup_expired_sessions():
    """Remove expired sessions from memory"""
    now = datetime.utcnow()
    expired = [k for k, v in _verification_sessions.items() if v["expires_at"] < now]
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
    _verification_sessions[code] = {
        "user_id": str(current_user.id),
        "expires_at": datetime.utcnow() + timedelta(hours=1),
        "completed": False,
    }

    from app.core.config import settings

    capture_url = f"{settings.FRONTEND_URL}/verify-capture/{code}"

    return {
        "verification_code": code,
        "capture_url": capture_url,
        "expires_at": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
    }


@router.get("/identity/session/{code}")
async def get_identity_session(code: str):
    """Get session info (for mobile page to verify code is valid)"""
    _cleanup_expired_sessions()

    session = _verification_sessions.get(code)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired session")

    return {
        "valid": True,
        "completed": session["completed"],
    }


@router.get("/identity/session/{code}/status")
async def check_identity_session_status(code: str):
    """Poll endpoint for desktop to check if mobile has completed upload"""
    session = _verification_sessions.get(code)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"completed": session["completed"]}


@router.post("/identity/upload-mobile")
async def upload_identity_mobile(
    verification_code: str = Query(...),
    document_type: str = Query("passport"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload identity document via mobile using a verification session code.
    No auth token needed — the session code links to the user.
    """
    _cleanup_expired_sessions()

    session = _verification_sessions.get(verification_code)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired verification code")

    if session["completed"]:
        raise HTTPException(status_code=400, detail="Session already completed")

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload JPEG, PNG, or PDF",
        )

    # Get user from session
    import uuid
    user_id = uuid.UUID(session["user_id"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Same verification logic as the authenticated endpoint
    verification_data = {
        "document_type": document_type,
        "upload_date": datetime.utcnow().isoformat(),
        "filename": file.filename,
        "status": "verified",
        "source": "mobile_capture",
        "extracted_data": {
            "full_name": user.full_name,
            "document_number": "MOCK123456",
            "expiry_date": "2030-12-31",
            "confidence_score": 0.95,
        },
    }

    user.identity_verified = True
    user.identity_data = verification_data
    user.trust_score = min(100, user.trust_score + 30)

    # Mark session as completed
    session["completed"] = True

    await db.commit()
    await db.refresh(user)

    return {
        "message": "Identity document verified successfully",
        "verified": True,
        "trust_score": user.trust_score,
    }

@router.post("/employment/upload")
async def upload_employment_document(
    document_type: str,  # "payslip", "contract", "tax_return"
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload employment document for verification.

    For MVP: Simulates employment verification
    For Production: Integrate with income verification API
    """

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload JPEG, PNG, or PDF",
        )

    # Read file content
    content = await file.read()

    # Import service here to avoid circular imports if any
    from app.services.employment import employment_service

    # Process document
    result = await employment_service.verify_payslip(
        file_content=content,
        file_type=file.content_type,
        expected_name=current_user.full_name,
    )

    if not result["verified"] and result["status"] == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Verification failed: {result.get('rejection_reason')}",
        )

    # Update user verification status
    current_user.employment_verified = result["verified"]
    if result["verified"]:
        # Add trust score points (30 for verified employment)
        current_user.trust_score = min(100, current_user.trust_score + 30)

    # Store verification data
    current_user.employment_data = {
        "verified": result["verified"],
        "upload_date": datetime.utcnow().isoformat(),
        "filename": file.filename,
        "status": result["status"],
        "extracted_data": result["data"],
        "checks": result["validation_checks"],
    }

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Employment document processed",
        "verified": result["verified"],
        "status": result["status"],
        "trust_score": current_user.trust_score,
        "details": result.get("rejection_reason") or "Verification successful",
    }


@router.get("/status", response_model=VerificationStatusResponse)
async def get_verification_status(current_user: User = Depends(get_current_user)):
    """Get current verification status for user"""
    return {
        "identity_verified": current_user.identity_verified,
        "employment_verified": current_user.employment_verified,
        "identity_data": current_user.identity_data,
        "employment_data": current_user.employment_data,
        "trust_score": current_user.trust_score,
    }


@router.post("/identity/reset")
async def reset_identity_verification(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Reset identity verification (for testing)"""
    current_user.identity_verified = False
    current_user.identity_data = None
    current_user.trust_score = max(0, current_user.trust_score - 30)

    await db.commit()
    await db.refresh(current_user)

    return {"message": "Identity verification reset"}


@router.post("/employment/reset")
async def reset_employment_verification(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Reset employment verification (for testing)"""
    current_user.employment_verified = False
    current_user.employment_data = None
    current_user.trust_score = max(0, current_user.trust_score - 30)

    await db.commit()
    await db.refresh(current_user)

    return {"message": "Employment verification reset"}


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
    request: GLIQuoteRequest, current_user: User = Depends(get_current_user)
):
    """
    Get a GLI (Garantie Loyers Impayés) quote.
    One-click insurance quote for landlords.
    """
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit GLI application.
    In production, this would submit to a GLI provider.
    For MVP: Mock application submission.
    """
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
    application_id = f"GLI-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

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
