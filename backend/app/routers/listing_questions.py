"""
The question box, step 1: a student asks the owner about a listing privately.

Answers the owner already gave in the walk-through are matched on the page as
the student types (frontend/lib/questionMatch.ts). A question they do not cover
starts, or continues, the student's conversation with the owner about that
listing. Nothing is published. A question about who may rent is not sent
(app/services/question_screen.py).
"""

from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.timeutils import naive_utcnow
from app.models.messages import Conversation, Message
from app.models.property import Property
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.notification_service import NotificationService
from app.services.question_screen import asks_who_may_rent

router = APIRouter(prefix="/properties", tags=["Listing questions"])

QUESTIONS_PER_LISTING_PER_DAY = 5


class QuestionCreate(BaseModel):
    question: str = Field(..., min_length=5, max_length=500)


@router.post("/{property_id}/questions", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/hour")
async def ask_question(
    request: Request,  # noqa: ARG001 — consumed by @limiter
    property_id: UUID,
    body: QuestionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await db.get(Property, property_id)
    if prop is None or prop.status != "active":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    if prop.landlord_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This is your own listing.")

    question = body.question.strip()
    if asks_who_may_rent(question):
        # Not stored, not sent: the page shows a fixed notice instead.
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="who_may_rent")

    conv = (await db.execute(
        select(Conversation).where(and_(
            Conversation.property_id == prop.id,
            Conversation.landlord_id == prop.landlord_id,
            Conversation.tenant_id == current_user.id,
        ))
    )).scalar_one_or_none()

    if conv is not None:
        asked_today = (await db.execute(
            select(func.count(Message.id)).where(and_(
                Message.conversation_id == conv.id,
                Message.sender_id == current_user.id,
                Message.message_type == "listing_question",
                # created_at defaults to the database's now(); compare on the same clock.
                Message.created_at >= func.now() - timedelta(days=1),
            ))
        )).scalar_one()
        if asked_today >= QUESTIONS_PER_LISTING_PER_DAY:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="too_many_questions")
    else:
        conv = Conversation(
            property_id=prop.id,
            landlord_id=prop.landlord_id,
            tenant_id=current_user.id,
            subject=f"Question about: {prop.title}"[:200],
            status="active",
            unread_count_landlord=0,
            unread_count_tenant=0,
        )
        db.add(conv)
        await db.flush()

    db.add(Message(
        conversation_id=conv.id,
        sender_id=current_user.id,
        content=question,
        message_type="listing_question",
    ))
    conv.status = "active"
    conv.last_message_at = naive_utcnow()
    conv.unread_count_landlord = (conv.unread_count_landlord or 0) + 1
    await db.commit()

    # In the app, and by email or phone as the owner chose (create_notification commits on its own).
    notifications = NotificationService(db)
    action_url = f"/inbox?conversation={conv.id}"
    await notifications.create_notification(
        user_id=prop.landlord_id,
        notification_type="message",
        title=f"New question about {prop.title}"[:200],
        message=question[:120],
        action_url=action_url,
    )
    await notifications._send_via_preferred_channels(
        user_id=prop.landlord_id,
        subject=f"New question about {prop.title}"[:200],
        message=f"A student asked about {prop.title}: \"{question}\" Reply in Roomivo.",
        action_url=action_url,
    )
    return {"conversation_id": str(conv.id)}
