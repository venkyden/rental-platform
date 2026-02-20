from sqlalchemy.ext.asyncio import AsyncSession
from app.models.feedback import Feedback
from typing import Optional

class FeedbackService:
    async def submit_feedback(
        self, 
        db: AsyncSession, 
        message: str, 
        category: str, 
        rating: Optional[int] = None, 
        user_id: Optional[str] = None
    ) -> Feedback:
        feedback = Feedback(
            user_id=user_id,
            message=message,
            category=category,
            rating=rating
        )
        db.add(feedback)
        await db.commit()
        await db.refresh(feedback)
        return feedback

feedback_service = FeedbackService()
