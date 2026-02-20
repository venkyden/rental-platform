"""
API endpoints for user notifications.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.services.notification_service import NotificationService


router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    action_url: Optional[str]
    read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    count: int


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    unread_only: bool = False,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's notifications"""
    service = NotificationService(db)
    notifications = await service.get_user_notifications(
        user_id=current_user.id,
        unread_only=unread_only,
        limit=min(limit, 50)  # Cap at 50
    )
    return [
        NotificationResponse(
            id=str(n.id),
            type=n.type,
            title=n.title,
            message=n.message,
            action_url=n.action_url,
            read=n.read,
            created_at=n.created_at
        )
        for n in notifications
    ]


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get count of unread notifications (for badge)"""
    service = NotificationService(db)
    count = await service.get_unread_count(current_user.id)
    return UnreadCountResponse(count=count)


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a single notification as read"""
    service = NotificationService(db)
    success = await service.mark_as_read(notification_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "read"}


@router.post("/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications as read"""
    service = NotificationService(db)
    count = await service.mark_all_as_read(current_user.id)
    return {"status": "ok", "marked_read": count}
