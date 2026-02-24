"""
Notification service for creating and sending notifications.
Respects user contact preferences and verification status.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType
from app.models.user import User


class NotificationService:
    """
    Service for managing notifications.

    Privacy rules:
    - Contact info (phone, email) only shared after BOTH parties verified
    - In-app notifications always work
    - Email/SMS notifications respect user preferences
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_notification(
        self,
        user_id: UUID,
        notification_type: str,
        title: str,
        message: str,
        action_url: Optional[str] = None,
        extra_data: Optional[str] = None,
    ) -> Notification:
        """Create an in-app notification"""
        notification = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            action_url=action_url,
            extra_data=extra_data,
        )
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        return notification

    async def notify_application_received(
        self,
        landlord_id: UUID,
        tenant_name: str,
        property_title: str,
        application_id: UUID,
    ):
        """Notify landlord of new application"""
        action_url = f"/applications/{application_id}"

        # 1. Always create in-app notification
        await self.create_notification(
            user_id=landlord_id,
            notification_type=NotificationType.APPLICATION.value,
            title="New Application Received",
            message=f"{tenant_name} applied for {property_title}",
            action_url=action_url,
        )

        # 2. Send via preferred channels based on user preferences
        await self._send_via_preferred_channels(
            user_id=landlord_id,
            subject=f"📋 New application from {tenant_name}",
            message=f"{tenant_name} has applied for {property_title}. View in app to respond.",
            action_url=action_url,
        )

    async def _send_via_preferred_channels(
        self, user_id: UUID, subject: str, message: str, action_url: str
    ):
        """Send notification via user's preferred channels (email, SMS, WhatsApp)"""
        from app.services.notification_delivery import NotificationDelivery

        # Get user and their preferences
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return

        prefs = user.contact_preferences or {}
        delivery = NotificationDelivery()

        # Full action URL
        from app.core.config import settings

        base_url = settings.FRONTEND_URL
        full_url = f"{base_url}{action_url}"

        # Email notification
        if prefs.get("email_notifications", True):
            await delivery.send_email(
                to=user.email, subject=subject, body=f"{message}\n\nView: {full_url}"
            )

        # SMS/WhatsApp notification (only if phone provided and enabled)
        if user.phone and prefs.get("sms_notifications", False):
            # Prefer WhatsApp over SMS (cheaper and richer)
            whatsapp_sent = await delivery.send_whatsapp(
                to=user.phone, message=f"{message}\n\n{full_url}"
            )
            # Fallback to SMS if WhatsApp fails
            if not whatsapp_sent:
                await delivery.send_sms(
                    to=user.phone, message=f"{message[:140]}"  # SMS limit
                )

    async def notify_application_status_changed(
        self,
        tenant_id: UUID,
        property_title: str,
        new_status: str,
        application_id: UUID,
    ):
        """Notify tenant of application status change"""
        status_emoji = (
            "✅"
            if new_status == "approved"
            else "❌" if new_status == "rejected" else "📋"
        )
        status_text = {
            "approved": "approved",
            "rejected": "declined",
            "pending": "pending review",
        }.get(new_status, new_status)

        await self.create_notification(
            user_id=tenant_id,
            notification_type=NotificationType.APPLICATION.value,
            title=f"Application {status_text.title()}",
            message=f"{status_emoji} Your application for {property_title} has been {status_text}",
            action_url=f"/applications/{application_id}",
        )

    async def notify_visit_scheduled(
        self,
        user_id: UUID,
        property_title: str,
        visit_date: str,
        visit_id: UUID,
        is_landlord: bool = False,
    ):
        """Notify about scheduled visit"""
        role = "tenant" if not is_landlord else "landlord"
        await self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.VISIT.value,
            title="Visit Scheduled",
            message=f"📅 Visit for {property_title} scheduled on {visit_date}",
            action_url=f"/visits/{visit_id}",
        )

    async def notify_new_message(
        self, recipient_id: UUID, sender_name: str, preview: str, conversation_id: UUID
    ):
        """Notify about new message"""
        await self.create_notification(
            user_id=recipient_id,
            notification_type=NotificationType.MESSAGE.value,
            title=f"New message from {sender_name}",
            message=preview[:100] + "..." if len(preview) > 100 else preview,
            action_url=f"/messages/{conversation_id}",
        )

    async def notify_new_match(
        self,
        user_id: UUID,
        match_type: str,  # "tenant" or "property"
        match_name: str,
        match_score: int,
        match_url: str,
    ):
        """Notify about new high-quality match"""
        if match_type == "tenant":
            title = "New Matched Tenant"
            message = f"🎯 {match_name} is a {match_score}% match for your property"
        else:
            title = "New Property Match"
            message = f"🏠 {match_name} is a {match_score}% match for you"

        await self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.MATCH.value,
            title=title,
            message=message,
            action_url=match_url,
        )

    async def notify_verification_complete(
        self, user_id: UUID, verification_type: str  # identity, employment, email
    ):
        """Notify user their verification is complete"""
        type_names = {
            "identity": "ID verification",
            "employment": "Employment verification",
            "email": "Email verification",
        }
        await self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.VERIFICATION.value,
            title="Verification Complete ✓",
            message=f"Your {type_names.get(verification_type, verification_type)} has been approved.",
            action_url="/profile/verification",
        )

    async def get_user_notifications(
        self, user_id: UUID, unread_only: bool = False, limit: int = 20
    ) -> List[Notification]:
        """Get notifications for a user"""
        query = select(Notification).where(Notification.user_id == user_id)

        if unread_only:
            query = query.where(Notification.read == False)

        query = query.order_by(Notification.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_unread_count(self, user_id: UUID) -> int:
        """Get count of unread notifications"""
        from sqlalchemy import func

        result = await self.db.execute(
            select(func.count(Notification.id))
            .where(Notification.user_id == user_id)
            .where(Notification.read == False)
        )
        return result.scalar() or 0

    async def mark_as_read(self, notification_id: UUID, user_id: UUID) -> bool:
        """Mark a notification as read"""
        result = await self.db.execute(
            update(Notification)
            .where(Notification.id == notification_id)
            .where(Notification.user_id == user_id)
            .values(read=True, read_at=datetime.utcnow())
        )
        await self.db.commit()
        return result.rowcount > 0

    async def mark_all_as_read(self, user_id: UUID) -> int:
        """Mark all notifications as read for a user"""
        result = await self.db.execute(
            update(Notification)
            .where(Notification.user_id == user_id)
            .where(Notification.read == False)
            .values(read=True, read_at=datetime.utcnow())
        )
        await self.db.commit()
        return result.rowcount


def can_share_contact_info(user1: User, user2: User) -> bool:
    """
    Privacy check: Contact info only shared when BOTH parties are verified.

    This is used by the notification service and display components
    to determine if phone/email should be shown.
    """
    return user1.identity_verified and user2.identity_verified
