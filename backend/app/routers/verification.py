"""
Verification API endpoints for identity and employment verification.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
import json

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User

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
    db: AsyncSession = Depends(get_db)
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
            detail="Invalid file type. Please upload JPEG, PNG, or PDF"
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
            "confidence_score": 0.95
        }
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
        "trust_score": current_user.trust_score
    }


@router.post("/employment/upload")
async def upload_employment_document(
    document_type: str,  # "payslip", "contract", "tax_return"
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
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
            detail="Invalid file type. Please upload JPEG, PNG, or PDF"
        )
    
    # Read file content
    content = await file.read()
    
    # Import service here to avoid circular imports if any
    from app.services.employment import employment_service
    
    # Process document
    result = await employment_service.verify_payslip(
        file_content=content,
        file_type=file.content_type,
        expected_name=current_user.full_name
    )
    
    if not result["verified"] and result["status"] == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Verification failed: {result.get('rejection_reason')}"
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
        "checks": result["validation_checks"]
    }
    
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "message": "Employment document processed",
        "verified": result["verified"],
        "status": result["status"],
        "trust_score": current_user.trust_score,
        "details": result.get("rejection_reason") or "Verification successful"
    }


@router.get("/status", response_model=VerificationStatusResponse)
async def get_verification_status(
    current_user: User = Depends(get_current_user)
):
    """Get current verification status for user"""
    return {
        "identity_verified": current_user.identity_verified,
        "employment_verified": current_user.employment_verified,
        "identity_data": current_user.identity_data,
        "employment_data": current_user.employment_data,
        "trust_score": current_user.trust_score
    }


@router.post("/identity/reset")
async def reset_identity_verification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
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
    request: GLIQuoteRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Get a GLI (Garantie Loyers Impayés) quote.
    One-click insurance quote for landlords.
    """
    from app.services.gli import gli_service, TenantProfile
    
    tenant = TenantProfile(
        monthly_income=request.tenant_monthly_income,
        employment_type=request.tenant_employment_type,
        employment_verified=request.tenant_employment_verified,
        identity_verified=request.tenant_identity_verified
    )
    
    quote = gli_service.generate_quote(
        monthly_rent=request.monthly_rent,
        tenant=tenant
    )
    
    return {
        "eligible": quote.eligible,
        "monthly_premium": quote.monthly_premium,
        "annual_premium": quote.annual_premium,
        "coverage_amount": quote.coverage_amount,
        "coverage_months": quote.coverage_months,
        "premium_rate": quote.premium_rate,
        "eligibility_reason": quote.eligibility_reason,
        "quote_valid_until": quote.quote_valid_until.isoformat() if quote.quote_valid_until else None
    }


@router.post("/gli/apply")
async def apply_gli(
    request: GLIQuoteRequest,
    property_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Submit GLI application.
    In production, this would submit to a GLI provider.
    For MVP: Mock application submission.
    """
    from app.services.gli import gli_service, TenantProfile
    
    tenant = TenantProfile(
        monthly_income=request.tenant_monthly_income,
        employment_type=request.tenant_employment_type,
        employment_verified=request.tenant_employment_verified,
        identity_verified=request.tenant_identity_verified
    )
    
    quote = gli_service.generate_quote(
        monthly_rent=request.monthly_rent,
        tenant=tenant,
        property_id=property_id
    )
    
    if not quote.eligible:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not eligible for GLI: {quote.eligibility_reason}"
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
            "coverage_amount": quote.coverage_amount
        },
        "next_steps": [
            "Un conseiller vous contactera sous 24h",
            "Documents requis: pièce d'identité du locataire, justificatif de revenus"
        ]
    }

