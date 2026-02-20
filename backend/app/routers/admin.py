from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from pydantic import BaseModel
from app.core.database import get_db
from app.services.feature_flag_service import feature_flag_service

router = APIRouter(prefix="/admin", tags=["Admin"])

class FeatureFlagResponse(BaseModel):
    name: str
    is_enabled: bool
    description: str | None

class ToggleRequest(BaseModel):
    is_enabled: bool

@router.post("/features/{name}/toggle", response_model=bool)
async def toggle_feature(
    name: str, 
    request: ToggleRequest, 
    db: AsyncSession = Depends(get_db)
):
    """
    Kill Switch: Enable/Disable a feature instantly.
    Invalidates cache immediately.
    """
    success = await feature_flag_service.toggle_flag(db, name, request.is_enabled)
    if not success:
        raise HTTPException(status_code=404, detail=f"Flag {name} not found")
    return success

@router.post("/features", response_model=FeatureFlagResponse)
async def create_feature(
    response: FeatureFlagResponse,
    db: AsyncSession = Depends(get_db)
):
    """Create a new feature flag"""
    flag = await feature_flag_service.create_flag(
        db, 
        name=response.name, 
        description=response.description, 
        is_enabled=response.is_enabled
    )
    return flag
