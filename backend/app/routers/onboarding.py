"""
Onboarding API endpoints for user segmentation questionnaire.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User, OnboardingResponse

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


class OnboardingAnswerRequest(BaseModel):
    """Request to save questionnaire answers"""
    responses: Dict[str, Any]
    

class OnboardingCompleteRequest(BaseModel):
    """Request to complete onboarding"""
    responses: Dict[str, Any]


def detect_segment(responses: Dict[str, Any]) -> str:
    """
    Detect user segment based on questionnaire responses.
    
    Returns: D1/D2/D3 for tenants, S1/S2/S3 for landlords
    """
    user_type = responses.get("user_type", "").lower()
    
    if user_type == "landlord":
        # Landlord segment detection (S1/S2/S3)
        property_count = responses.get("property_count", 0)
        if isinstance(property_count, str):
            # Parse string like "1-4" or "5-100"
            if "100+" in property_count or property_count.startswith("100"):
                return "S3"
            elif "5-" in property_count or property_count.startswith("5"):
                return "S2"
            else:
                return "S1"
        else:
            # Numeric count
            if property_count >= 100:
                return "S3"
            elif property_count >= 5:
                return "S2"
            else:
                return "S1"
    
    elif user_type == "tenant":
        # Tenant segment detection (D1/D2/D3)
        situation = responses.get("situation", "").lower()
        
        # Primary detection from refined situation values
        if situation == "student_budget":
            return "D1"
        elif situation == "family_stability":
            return "D2"
        elif situation == "flexibility_relocation":
            return "D3"
            
        # Fallback for legacy or fuzzy matching
        if "student" in situation or "budget" in situation:
            segment = "D1"
        elif "family" in situation or "stability" in situation:
            segment = "D2"
        elif "relocating" in situation or "remote" in situation or "flexibility" in situation:
            segment = "D3"
        else:
            segment = "D1" # Default
        
        return segment
    
    return "UNKNOWN"


@router.post("/complete")
async def complete_onboarding(
    request: OnboardingCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Complete onboarding and detect segment"""
    
    # Detect segment
    segment = detect_segment(request.responses)
    
    # Save onboarding response
    onboarding = OnboardingResponse(
        user_id=current_user.id,
        responses=request.responses,
        detected_segment=segment
    )
    db.add(onboarding)
    
    # Update user
    current_user.segment = segment
    current_user.preferences = request.responses
    current_user.onboarding_completed = True
    
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "segment": segment,
        "onboarding_completed": True,
        "message": f"Welcome! You've been matched to segment {segment}"
    }


@router.get("/status")
async def get_onboarding_status(
    current_user: User = Depends(get_current_user)
):
    """Check if user has completed onboarding"""
    return {
        "completed": current_user.onboarding_completed,
        "segment": current_user.segment,
        "preferences": current_user.preferences
    }


@router.get("/resume")
async def resume_onboarding(
    current_user: User = Depends(get_current_user)
):
    """Resume incomplete onboarding"""
    if current_user.onboarding_completed:
        return {
            "completed": True,
            "segment": current_user.segment
        }
    
    # Return partial responses if they exist
    return {
        "completed": False,
        "responses": current_user.preferences or {}
    }
