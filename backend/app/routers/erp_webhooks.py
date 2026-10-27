"""
ERP Webhooks API for external system integrations.
Allows landlords to subscribe to events and receive HTTP notifications.
"""

import asyncio
import hashlib
import hmac
import ipaddress
import json
import logging
import socket
from datetime import datetime
from app.core.timeutils import naive_utcnow
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
logger = logging.getLogger(__name__)


# SSRF Protection: every address a hostname resolves to must be globally
# routable. is_global already excludes loopback, RFC 1918, link-local (cloud
# metadata), CGNAT, ULA and unspecified; multicast is excluded explicitly.
# IPv6 forms that carry an IPv4 address (mapped, NAT64, v4-compatible) are
# judged by that address, and deprecated site-local is refused.
_NAT64 = ipaddress.ip_network("64:ff9b::/96")
_IPV4_COMPATIBLE = ipaddress.ip_network("::/96")


def _is_public_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if ip.version == 6:
        if ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        elif ip in _NAT64 or ip in _IPV4_COMPATIBLE:
            ip = ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)
        elif ip.is_site_local:
            return False
    return ip.is_global and not ip.is_multicast


def _require_public(infos) -> ipaddress.IPv4Address | ipaddress.IPv6Address:
    """Return the first resolved address, refusing if ANY of them is internal."""
    ips = [ipaddress.ip_address(info[4][0]) for info in infos]
    if not ips or not all(_is_public_ip(ip) for ip in ips):
        raise ValueError("URL must resolve to a public internet address")
    return ips[0]


def _parse_webhook_url(url: str):
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must use http or https")
    if not parsed.hostname:
        raise ValueError("Invalid URL: no hostname")
    return parsed


def validate_webhook_url(url: str) -> str:
    """Validate webhook URL to prevent SSRF attacks."""
    parsed = _parse_webhook_url(url)
    try:
        infos = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise ValueError("URL must resolve to a public internet address")
    _require_public(infos)
    return url


async def _getaddrinfo_async(host: str, port: int):
    return await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)


async def _pinned_request_target(url: str) -> tuple[str, dict, dict]:
    """Re-check the URL at send time and pin the connection to the checked address.

    Validation at save time alone is defeated by DNS rebinding (the name resolves
    publicly when saved, internally when sent). Connecting to the IP we just
    checked, with the original Host header and TLS SNI, closes that window.
    """
    parsed = _parse_webhook_url(url)
    try:
        infos = await _getaddrinfo_async(parsed.hostname, parsed.port or 443)
    except socket.gaierror:
        raise ValueError("URL must resolve to a public internet address")
    ip = _require_public(infos)

    host = f"[{ip}]" if ip.version == 6 else str(ip)
    port = f":{parsed.port}" if parsed.port else ""
    pinned_url = parsed._replace(netloc=f"{host}{port}").geturl()
    extensions = {"sni_hostname": parsed.hostname} if parsed.scheme == "https" else {}
    return pinned_url, {"Host": f"{parsed.hostname}{port}"}, extensions


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

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        return v if v is None else validate_webhook_url(v)


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
    if current_user.role not in [UserRole.LANDLORD, UserRole.PROPERTY_MANAGER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=403, detail="Only landlords or managers can manage webhooks"
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
    if current_user.role not in [UserRole.LANDLORD, UserRole.PROPERTY_MANAGER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=403, detail="Only landlords or managers can create webhooks"
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
        "timestamp": naive_utcnow().isoformat(),
        "data": {
            "message": "This is a test webhook from Roomivo",
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
    start_time = naive_utcnow()

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
        pinned_url, host_header, extensions = await _pinned_request_target(subscription.url)
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            response = await client.post(
                pinned_url,
                content=payload_str,
                headers={**headers, **host_header},
                extensions=extensions,
            )

        end_time = naive_utcnow()
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
        end_time = naive_utcnow()
        duration = int((end_time - start_time).total_seconds() * 1000)

        if isinstance(e, ValueError):
            # Passed the save-time check but now resolves inside: DNS rebinding
            # or a repointed record. Stop delivering until the landlord re-saves.
            logger.warning("WEBHOOK_URL_REFUSED subscription=%s", subscription.id)
            subscription.is_active = False
        else:
            logger.exception("Webhook delivery failed subscription=%s", subscription.id)

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
                "timestamp": naive_utcnow().isoformat(),
                "data": data,
            }
            await send_webhook(sub, event_type, payload, db)
