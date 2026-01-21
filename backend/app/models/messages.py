"""
Messaging models for Unified Inbox feature.
Supports conversations between landlords and tenants about properties.
"""
from sqlalchemy import Column, String, Integer, Boolean, Text, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


class Conversation(Base):
    """
    Thread between landlord and tenant about a property.
    Each property can have multiple conversations (one per tenant).
    """
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    landlord_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Conversation metadata
    subject = Column(String(200))  # Auto-generated or custom subject
    status = Column(String(20), default='active')  # 'active', 'archived', 'resolved'
    
    # Timestamps and read tracking
    last_message_at = Column(TIMESTAMP, server_default=func.now())
    unread_count_landlord = Column(Integer, default=0)
    unread_count_tenant = Column(Integer, default=0)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    property = relationship("Property", backref="conversations")
    landlord = relationship("User", foreign_keys=[landlord_id], backref="landlord_conversations")
    tenant = relationship("User", foreign_keys=[tenant_id], backref="tenant_conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    """
    Individual message within a conversation.
    Supports different message types for rich interactions.
    """
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Message content
    content = Column(Text, nullable=False)
    message_type = Column(String(30), default='text')  # 'text', 'visit_request', 'visit_confirmed', 'lease_generated', 'system'
    
    # Structured metadata for rich message types
    # Examples:
    # - visit_request: {"slot_id": "...", "slot_time": "..."}
    # - lease_generated: {"lease_id": "...", "download_url": "..."}
    extra_data = Column(JSONB, default={})
    
    # Read status
    is_read = Column(Boolean, default=False)
    read_at = Column(TIMESTAMP)
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", backref="sent_messages")
