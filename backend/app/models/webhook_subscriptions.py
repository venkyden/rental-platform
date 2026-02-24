"""
Webhook subscription model for ERP integrations.
Allows landlords to subscribe to events and receive HTTP notifications.
"""

import secrets
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class WebhookSubscription(Base):
    """
    Webhook subscription for ERP/external system notifications.
    Landlords can subscribe to events and receive HTTP POST notifications.
    """

    __tablename__ = "webhook_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Owner
    landlord_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    # Webhook configuration
    name = Column(String(200), nullable=False)  # e.g., "ERP Integration"
    url = Column(Text, nullable=False)  # Target URL for webhook
    secret = Column(
        String(64), nullable=False, default=lambda: secrets.token_hex(32)
    )  # For signature verification

    # Events to subscribe (stored as array)
    # Options: application.new, visit.booked, visit.confirmed, lease.generated, message.received
    events = Column(ARRAY(String), nullable=False, default=[])

    # Status
    is_active = Column(Boolean, default=True)
    last_triggered_at = Column(DateTime, nullable=True)
    failure_count = Column(String, default="0")  # Track consecutive failures

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    landlord = relationship("User", backref="webhook_subscriptions")


class WebhookDelivery(Base):
    """
    Log of webhook delivery attempts.
    Stores request/response for debugging.
    """

    __tablename__ = "webhook_deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    subscription_id = Column(
        UUID(as_uuid=True),
        ForeignKey("webhook_subscriptions.id"),
        nullable=False,
        index=True,
    )

    # Event details
    event_type = Column(String(50), nullable=False)
    payload = Column(Text)  # JSON payload sent

    # Delivery result
    success = Column(Boolean, default=False)
    status_code = Column(String, nullable=True)
    response_body = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    # Timing
    created_at = Column(DateTime, default=datetime.utcnow)
    delivered_at = Column(DateTime, nullable=True)
    duration_ms = Column(String, nullable=True)  # Response time

    # Relationship
    subscription = relationship("WebhookSubscription", backref="deliveries")
