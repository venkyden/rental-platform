"""
ERP Webhooks API for external system integrations.
Allows landlords to subscribe to events and receive HTTP notifications.
"""

import hashlib
import hmac
import ipaddress
import json
import socket
from datetime import datetime
from typing import List, Optional
from urllib.parse import urlparse
from uuid import UUID

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, HttpUrl, field_validator
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.webhook_subscriptions import (WebhookDelivery,
                                              WebhookSubscription)
from app.routers.auth import get_current_user

router = APIRouter(prefix="/webhooks/subscriptions", tags=["ERP Webhooks"])


# SSRF Protection: blocked hostnames and IP ranges
BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}
PRIVATE_IP_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),  # Link-local
    ipaddress.ip_network("127.0.0.0/8"),  # Loopback
]


def validate_webhook_url(url: str) -> str:
    """Validate webhook URL to prevent SSRF attacks."""
    try:
        parsed = urlparse(url)

        # Must be HTTPS in production (allow HTTP for testing)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("URL must use http or https")

        hostname = parsed.hostname
        if not hostname:
            raise ValueError("Invalid URL: no hostname")

        # Block known internal hostnames
        if hostname.lower() in BLOCKED_HOSTS:
            raise ValueError("Internal hosts not allowed")

        # Block AWS/cloud metadata endpoints
        if hostname in ["169.254.169.254", "metadata.google.internal"]:
            raise ValueError("Cloud metadata endpoints not allowed")

        # Resolve hostname and check if IP is private
        try:
            ip = ipaddress.ip_address(socket.gethostbyname(hostname))
            for private_range in PRIVATE_IP_RANGES:
                if ip in private_range:
                    raise ValueError("Private IP addresses not allowed")
        except socket.gaierror:
            pass  # Allow unresolvable hostnames (might be valid external hosts)

        return url
    except ValueError as e:
        raise ValueError(str(e))


# Available events
WEBHOOK_EVENTS = [
    "application.new",  # New tenant application
    "visit.booked",  # Visit slot booked by tenant
    "visit.confirmed",  # Visit confirmed
    "lease.generated",  # Lease document generated
    "message.received",  # New message in inbox
    "property.created",  # New property created
    "property.updated",  # Property updated
]


# --- Schemas ---


class CreateSubscriptionRequest(BaseModel):
    name: str
    url: str
    events: List[str]

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        return validate_webhook_url(v)


class UpdateSubscriptionRequest(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    events: Optional[List[str]] = None
    is_active: Optional[bool] = None


class SubscriptionResponse(BaseModel):
    id: str
    name: str
    url: str
    events: List[str]
    is_active: bool
    secret: str
    last_triggered_at: Optional[datetime]
    failure_count: str
    created_at: datetime

    class Config:
        from_attributes = True


class DeliveryResponse(BaseModel):
    id: str
    event_type: str
    success: bool
    status_code: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    duration_ms: Optional[str]

    class Config:
        from_attributes = True


# --- Endpoints ---


@router.get("", response_model=List[SubscriptionResponse])
async def list_subscriptions(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """List all webhook subscriptions for the current landlord."""
    if current_user.role not in [UserRole.LANDLORD, UserRole.PROPERTY_MANAGER]:
        raise HTTPException(
            status_code=403, detail="Only landlords can manage webhooks"
        )

    result = await db.execute(
        select(WebhookSubscription)
        .where(WebhookSubscription.landlord_id == current_user.id)
        .order_by(desc(WebhookSubscription.created_at))
    )
    subscriptions = result.scalars().all()

    return [
        SubscriptionResponse(
            id=str(sub.id),
            name=sub.name,
            url=sub.url,
            events=sub.events or [],
            is_active=sub.is_active,
            secret=sub.secret,
            last_triggered_at=sub.last_triggered_at,
            failure_count=sub.failure_count,
            created_at=sub.created_at,
        )
        for sub in subscriptions
    ]


@router.post("", response_model=SubscriptionResponse)
async def create_subscription(
    data: CreateSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new webhook subscription."""
    if current_user.role not in [UserRole.LANDLORD, UserRole.PROPERTY_MANAGER]:
        raise HTTPException(
            status_code=403, detail="Only landlords can create webhooks"
        )

    # Validate events
    invalid_events = [e for e in data.events if e not in WEBHOOK_EVENTS]
    if invalid_events:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid events: {invalid_events}. Valid: {WEBHOOK_EVENTS}",
        )

    subscription = WebhookSubscription(
        landlord_id=current_user.id,
        name=data.name,
        url=data.url,
        events=data.events,
        is_active=True,
    )
    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)

    return SubscriptionResponse(
        id=str(subscription.id),
        name=subscription.name,
        url=subscription.url,
        events=subscription.events or [],
        is_active=subscription.is_active,
        secret=subscription.secret,
        last_triggered_at=subscription.last_triggered_at,
        failure_count=subscription.failure_count,
        created_at=subscription.created_at,
    )


@router.patch("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: UUID,
    data: UpdateSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a webhook subscription."""
    sub = (
        await db.execute(
            select(WebhookSubscription).where(WebhookSubscription.id == subscription_id)
        )
    ).scalar_one_or_none()

    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if data.name is not None:
        sub.name = data.name
    if data.url is not None:
        sub.url = data.url
    if data.events is not None:
        invalid = [e for e in data.events if e not in WEBHOOK_EVENTS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid events: {invalid}")
        sub.events = data.events
    if data.is_active is not None:
        sub.is_active = data.is_active

    await db.commit()
    await db.refresh(sub)

    return SubscriptionResponse(
        id=str(sub.id),
        name=sub.name,
        url=sub.url,
        events=sub.events or [],
        is_active=sub.is_active,
        secret=sub.secret,
        last_triggered_at=sub.last_triggered_at,
        failure_count=sub.failure_count,
        created_at=sub.created_at,
    )


@router.delete("/{subscription_id}")
async def delete_subscription(
    subscription_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a webhook subscription."""
    sub = (
        await db.execute(
            select(WebhookSubscription).where(WebhookSubscription.id == subscription_id)
        )
    ).scalar_one_or_none()

    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(sub)
    await db.commit()

    return {"message": "Subscription deleted"}


@router.post("/{subscription_id}/test")
async def test_webhook(
    subscription_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a test event to the webhook."""
    sub = (
        await db.execute(
            select(WebhookSubscription).where(WebhookSubscription.id == subscription_id)
        )
    ).scalar_one_or_none()

    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Send test event
    test_payload = {
        "event": "test",
        "timestamp": datetime.utcnow().isoformat(),
        "data": {
            "message": "This is a test webhook from Rental Platform",
            "subscription_id": str(subscription_id),
        },
    }

    result = await send_webhook(sub, "test", test_payload, db)

    return {
        "success": result["success"],
        "status_code": result.get("status_code"),
        "message": result.get("error") or "Test event sent successfully",
    }


@router.get("/{subscription_id}/deliveries", response_model=List[DeliveryResponse])
async def get_deliveries(
    subscription_id: UUID,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get delivery history for a subscription."""
    sub = (
        await db.execute(
            select(WebhookSubscription).where(WebhookSubscription.id == subscription_id)
        )
    ).scalar_one_or_none()

    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.landlord_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(WebhookDelivery)
        .where(WebhookDelivery.subscription_id == subscription_id)
        .order_by(desc(WebhookDelivery.created_at))
        .limit(limit)
    )
    deliveries = result.scalars().all()

    return [
        DeliveryResponse(
            id=str(d.id),
            event_type=d.event_type,
            success=d.success,
            status_code=d.status_code,
            error_message=d.error_message,
            created_at=d.created_at,
            duration_ms=d.duration_ms,
        )
        for d in deliveries
    ]


@router.get("/events")
async def list_available_events():
    """List all available webhook events."""
    return {
        "events": WEBHOOK_EVENTS,
        "descriptions": {
            "application.new": "Nouvelle candidature de locataire",
            "visit.booked": "Visite réservée par un locataire",
            "visit.confirmed": "Visite confirmée",
            "lease.generated": "Bail généré",
            "message.received": "Nouveau message reçu",
            "property.created": "Nouveau bien créé",
            "property.updated": "Bien mis à jour",
        },
    }


# --- Webhook sender function ---


async def send_webhook(
    subscription: WebhookSubscription, event_type: str, payload: dict, db: AsyncSession
) -> dict:
    """
    Send webhook to subscription URL.
    Records delivery in database.
    """
    start_time = datetime.utcnow()

    # Create signature
    payload_str = json.dumps(payload)
    signature = hmac.new(
        subscription.secret.encode(), payload_str.encode(), hashlib.sha256
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": f"sha256={signature}",
        "X-Webhook-Event": event_type,
        "User-Agent": "RentalPlatform-Webhook/1.0",
    }

    delivery = WebhookDelivery(
        subscription_id=subscription.id, event_type=event_type, payload=payload_str
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                subscription.url, content=payload_str, headers=headers
            )

        end_time = datetime.utcnow()
        duration = int((end_time - start_time).total_seconds() * 1000)

        delivery.success = response.status_code < 400
        delivery.status_code = str(response.status_code)
        delivery.response_body = response.text[:500] if response.text else None
        delivery.delivered_at = end_time
        delivery.duration_ms = str(duration)

        # Update subscription
        subscription.last_triggered_at = end_time
        if delivery.success:
            subscription.failure_count = "0"
        else:
            subscription.failure_count = str(int(subscription.failure_count or "0") + 1)

        result = {"success": delivery.success, "status_code": delivery.status_code}

    except Exception as e:
        end_time = datetime.utcnow()
        duration = int((end_time - start_time).total_seconds() * 1000)

        delivery.success = False
        delivery.error_message = str(e)[:500]
        delivery.delivered_at = end_time
        delivery.duration_ms = str(duration)

        subscription.failure_count = str(int(subscription.failure_count or "0") + 1)

        result = {"success": False, "error": str(e)}

    db.add(delivery)
    await db.commit()

    return result


# --- Helper to trigger webhooks from other parts of the app ---


async def trigger_webhooks(
    db: AsyncSession, landlord_id: UUID, event_type: str, data: dict
):
    """
    Trigger all active webhooks for a landlord that subscribe to the event.
    Call this from other endpoints when events occur.
    """
    result = await db.execute(
        select(WebhookSubscription).where(
            WebhookSubscription.landlord_id == landlord_id,
            WebhookSubscription.is_active == True,
        )
    )
    subscriptions = result.scalars().all()

    for sub in subscriptions:
        if event_type in (sub.events or []):
            payload = {
                "event": event_type,
                "timestamp": datetime.utcnow().isoformat(),
                "data": data,
            }
            await send_webhook(sub, event_type, payload, db)
