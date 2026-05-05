"""
Onboarding API endpoints for user segmentation questionnaire.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import OnboardingResponse, User
from app.routers.auth import get_current_user

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
    db: AsyncSession = Depends(get_db),
):
    """Complete onboarding for the user's currently active role"""

    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    # Update or create OnboardingResponse record
    stmt = select(OnboardingResponse).where(OnboardingResponse.user_id == current_user.id)
    result = await db.execute(stmt)
    onboarding = result.scalar_one_or_none()

    if onboarding:
        # Update existing record, keeping other roles' data if we structured it
        # For now, let's just update the responses
        existing_responses = onboarding.responses or {}
        if isinstance(existing_responses, dict):
            existing_responses[role_str] = request.responses
            onboarding.responses = existing_responses
        else:
            onboarding.responses = {role_str: request.responses}
    else:
        onboarding = OnboardingResponse(
            user_id=current_user.id,
            responses={role_str: request.responses},
            detected_segment="DIRECT",
        )
        db.add(onboarding)

    # Update user preferences specifically for this role
    all_prefs = current_user.preferences or {}
    if not isinstance(all_prefs, dict):
        all_prefs = {}
    
    all_prefs[role_str] = request.responses
    current_user.preferences = all_prefs
    current_user.segment = "DIRECT"

    # Mark the active role as onboarded in the per-role status dict
    status_dict = dict(current_user.onboarding_status or {})
    status_dict[role_str] = True
    current_user.onboarding_status = status_dict

    # Keep the legacy boolean in sync
    current_user.onboarding_completed = True

    await db.commit()
    await db.refresh(current_user)

    return {
        "segment": "DIRECT",
        "onboarding_completed": True,
        "active_role": role_str,
        "message": f"Welcome! Onboarding for {role_str} completed successfully.",
    }


@router.get("/status")
async def get_onboarding_status(current_user: User = Depends(get_current_user)):
    """Check if user has completed onboarding for their active role"""
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    status_dict = current_user.onboarding_status or {}
    role_completed = status_dict.get(role_str, False)
    
    all_prefs = current_user.preferences or {}
    # Return flat preferences for the active role if they exist in the new structure,
    # otherwise fallback to the whole object for backward compatibility
    role_prefs = all_prefs.get(role_str, all_prefs) if isinstance(all_prefs, dict) else {}
    
    return {
        "completed": role_completed,
        "segment": current_user.segment,
        "preferences": role_prefs,
        "active_role": role_str,
        "onboarding_status": status_dict,
    }


@router.get("/resume")
async def resume_onboarding(current_user: User = Depends(get_current_user)):
    """Resume incomplete onboarding for the active role"""
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    status_dict = current_user.onboarding_status or {}
    role_completed = status_dict.get(role_str, False)
    if role_completed:
        return {"completed": True, "segment": current_user.segment}

    all_prefs = current_user.preferences or {}
    role_prefs = all_prefs.get(role_str, all_prefs) if isinstance(all_prefs, dict) else {}

    # Return partial responses if they exist
    return {"completed": False, "responses": role_prefs}


@router.put("/preferences")
async def update_preferences(
    request: OnboardingAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user preferences for the active role (merge new values into existing)."""
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    all_prefs = current_user.preferences or {}
    
    if not isinstance(all_prefs, dict):
        all_prefs = {}
        
    # Get preferences for active role
    role_prefs = all_prefs.get(role_str, {})
    # If the prefs were flat and didn't have role keys, migrate them if they look like they belong here
    # (Simplified: if no role keys exist, we treat the whole thing as role_prefs)
    if not any(r in all_prefs for r in ["tenant", "landlord", "property_manager"]):
        role_prefs = all_prefs
        all_prefs = {}

    role_prefs.update(request.responses)
    all_prefs[role_str] = role_prefs
    current_user.preferences = all_prefs

    # Do not detect segment anymore
    current_user.segment = "DIRECT"

    await db.commit()
    await db.refresh(current_user)

    return {"preferences": role_prefs, "segment": current_user.segment}
