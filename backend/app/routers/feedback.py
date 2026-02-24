from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user_optional
from app.services.feedback_service import feedback_service

router = APIRouter(prefix="/feedback", tags=["Feedback"])


class FeedbackCreate(BaseModel):
    category: str = Field(..., description="bug, feature, ux, other")
    message: str = Field(..., min_length=5)
    rating: Optional[int] = Field(None, ge=1, le=5)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    submission: FeedbackCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit user feedback (Category Y - Feedback Loops).
    Supports anonymous or authenticated submissions.
    """
    user_id = current_user.id if current_user else None

    return await feedback_service.submit_feedback(
        db=db,
        message=submission.message,
        category=submission.category,
        rating=submission.rating,
        user_id=user_id,
    )
