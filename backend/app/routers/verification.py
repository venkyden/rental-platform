"""
Verification API endpoints for identity and employment verification.
"""

import json
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
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
    ownership_verified: bool = False
    kbis_verified: bool = False
    carte_g_verified: bool = False
    identity_data: Optional[dict] = None
    employment_data: Optional[dict] = None
    ownership_data: Optional[dict] = None
    trust_score: int


@router.post("/identity/upload")
async def upload_identity_document(
    document_type: str,
    file: UploadFile = File(...),
    side: Optional[str] = Form(None),
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

    # Process document with AI — non-blocking (accept upload, store result for review)
    from app.services.identity import identity_service
    if side == "back":
        result = {
            "verified": True, "status": "verified", "data": {},
            "validation_checks": [], "rejection_reason": None
        }
    else:
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

    # Apply watermark before upload
    watermarked_content = apply_watermark(content)
    
    # Save file to Cloud Storage
    from io import BytesIO
    storage_result = await storage.upload_file(
        file_data=BytesIO(watermarked_content),
        filename=file.filename,
        content_type=file.content_type,
        folder="verification/identity"
    )
    
    file_url = storage_result["url"]

    # Update user verification status
    current_user.identity_verified = result["verified"]
    
    if result["verified"]:
        current_user.trust_score = min(100, current_user.trust_score + 30)

    # Store verification data
    current_user.identity_data = {
        "verified": result["verified"],
        "upload_date": datetime.utcnow().isoformat(),
        "filename": file.filename,
        "file_url": file_url,
        "storage_key": storage_result.get("key"),
        "status": result["status"],
        "extracted_data": result["data"],
        "checks": result["validation_checks"],
    }

    await db.commit()
    await db.refresh(current_user)

    return {
        "message": "Identity document processed",
        "verified": result["verified"],
        "status": result["status"],
        "trust_score": current_user.trust_score,
        "details": result.get("rejection_reason") or "Identity document verified successfully",
    }


def _cleanup_expired_sessions():
    """Remove expired sessions from memory"""
    now_iso = datetime.utcnow().isoformat()
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
        "expires_at": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
        "completed": False,
    }
    await _save_session(code, session_data)

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


@router.post("/identity/upload-mobile")
async def upload_identity_mobile(
    verification_code: str = Query(...),
    document_type: str = Query("passport"),
    file: UploadFile = File(...),
    side: Optional[str] = Form(None),
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

    # Process document with AI — non-blocking (accept upload, store result for review)
    from app.services.identity import identity_service
    
    if side == "back":
        result = {
            "verified": True, "status": "verified", "data": {}, 
            "validation_checks": [], "rejection_reason": None
        }
    else:
        result = await identity_service.verify_document(
            file_content=content,
            file_type=file.content_type,
            expected_name=user.full_name,
            document_type=document_type,
        )

    if not result["verified"] and result["status"] == "rejected":
        logger.warning(f"Identity verification rejected for mobile session {verification_code}: {result.get('rejection_reason')}")
        raise HTTPException(
            status_code=400,
            detail=f"Verification failed: {result.get('rejection_reason')}",
        )

    # Apply watermark before upload
    watermarked_content = apply_watermark(content)
    
    # Save file to Cloud Storage
    from io import BytesIO
    storage_result = await storage.upload_file(
        file_data=BytesIO(watermarked_content),
        filename=file.filename,
        content_type=file.content_type,
        folder="verification/identity"
    )
    
    file_url = storage_result["url"]

    user.identity_verified = result["verified"]
    if result["verified"]:
        user.trust_score = min(100, user.trust_score + 30)

    user.identity_data = {
        "verified": result["verified"],
        "upload_date": datetime.utcnow().isoformat(),
        "filename": file.filename,
        "file_url": file_url,
        "source": "mobile_capture",
        "storage_key": storage_result.get("key"),
        "status": result["status"],
        "extracted_data": result["data"],
        "checks": result["validation_checks"],
    }

    # Determine if this is the final upload for this document type
    # For passports it's 1 capture. For others it's usually front + back.
    # If it's front and not a passport, we don't finish yet. 
    is_final = True
    if side == "front" and document_type in ("id_card", "drivers_license", "residence_permit"):
        is_final = False

    if is_final:
        # Mark session as completed only when all parts are done
        session["completed"] = True
        await _update_session(verification_code, session)

    await db.commit()
    await db.refresh(user)

    return {
        "message": "Identity document processed",
        "verified": result["verified"],
        "status": result["status"],
        "trust_score": user.trust_score,
        "details": result.get("rejection_reason") or "Identity document verified successfully",
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
    """

    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, HEIC, or PDF",
        )

    # Read file content
    content = await file.read()

    # Import service here to avoid circular imports if any
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
        logger.error(f"Employment verification crashed: {e}", exc_info=True)
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
    current_user.employment_verified = result["verified"]
    if result["verified"]:
        # Add trust score points (30 for verified employment)
        current_user.trust_score = min(100, current_user.trust_score + 30)

    # Apply watermark before upload
    watermarked_content = apply_watermark(content)
    
    # Save file to Cloud Storage
    from io import BytesIO
    storage_result = await storage.upload_file(
        file_data=BytesIO(watermarked_content),
        filename=file.filename,
        content_type=file.content_type,
        folder="verification/employment"
    )
    
    file_url = storage_result["url"]

    # Store verification data — convert any Decimal values to float for JSON serialization
    extracted = result.get("data")
    if extracted and isinstance(extracted, dict):
        for k, v in extracted.items():
            if hasattr(v, 'as_integer_ratio'):  # duck-type check for Decimal/float
                extracted[k] = float(v)

    current_user.employment_data = {
        "verified": result["verified"],
        "upload_date": datetime.utcnow().isoformat(),
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
        "ownership_verified": current_user.ownership_verified,
        "kbis_verified": current_user.kbis_verified,
        "carte_g_verified": current_user.carte_g_verified,
        "identity_data": current_user.identity_data,
        "employment_data": current_user.employment_data,
        "ownership_data": current_user.ownership_data,
        "trust_score": current_user.trust_score,
    }

@router.post("/guarantor/upload")
async def upload_guarantor_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Minimalist endpoint for Guarantor Dossier upload.
    Accepts a single combined PDF and stores it.
    """
    from app.models.document import Document, DocumentType
    import os
    import secrets

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type: {file.content_type}. Please upload JPEG, PNG, or PDF",
        )

    content = await file.read()
    
    upload_dir = "uploads/verification/guarantor"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_extension = os.path.splitext(file.filename)[1]
    filename = f"guarantor_{current_user.id}_{secrets.token_urlsafe(8)}{file_extension}"
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as f:
        f.write(content)

    file_url = f"/uploads/verification/guarantor/{filename}"

    new_doc = Document(
        user_id=current_user.id,
        document_type=DocumentType.GUARANTOR_FORM,
        file_url=file_url,
        file_name=file.filename,
        mime_type=file.content_type,
        verification_status="pending",
    )
    
    db.add(new_doc)
    await db.commit()

    return {
        "message": "Guarantor dossier uploaded successfully",
        "file_url": file_url
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
            expected_address=property_obj.address_line1,
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
        folder="verification/property"
    )
    
    file_url = storage_result["url"]

    # 6. Update property
    property_obj.ownership_verified = verification_result["verified"]
    property_obj.ownership_data = {
        "verified": verification_result["verified"],
        "upload_date": datetime.utcnow().isoformat(),
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
