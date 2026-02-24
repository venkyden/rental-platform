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


@router.post("/complete")
async def complete_onboarding(
    request: OnboardingCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Complete onboarding without segmentation"""
    
    # Save onboarding response directly
    onboarding = OnboardingResponse(
        user_id=current_user.id,
        responses=request.responses,
        detected_segment="DIRECT" # Legacy field placeholder
    )
    db.add(onboarding)
    
    # Update user directly
    current_user.segment = "DIRECT" # Legacy field placeholder
    current_user.preferences = request.responses
    current_user.onboarding_completed = True
    
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "segment": "DIRECT",
        "onboarding_completed": True,
        "message": "Welcome! Onboarding completed successfully."
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


@router.put("/preferences")
async def update_preferences(
    request: OnboardingAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user preferences (merge new values into existing)."""
    existing = current_user.preferences or {}
    existing.update(request.responses)
    current_user.preferences = existing

    # Do not detect segment anymore
    current_user.segment = "DIRECT"

    await db.commit()
    await db.refresh(current_user)

    return {
        "preferences": current_user.preferences,
        "segment": current_user.segment
    }
