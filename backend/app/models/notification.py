"""
Notification models for the platform notification system.
"""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.core.database import Base


class NotificationType(str, enum.Enum):
    APPLICATION = "application"
    MESSAGE = "message"
    VISIT = "visit"
    MATCH = "match"
    VERIFICATION = "verification"
    SYSTEM = "system"


class Notification(Base):
    """User notifications"""
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Notification content
    type = Column(String, nullable=False)  # application, message, visit, match, verification, system
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    action_url = Column(String, nullable=True)  # Link to relevant page (e.g., /applications/123)
    
    # Metadata
    extra_data = Column(String, nullable=True)  # JSON string for additional data
    
    # Status
    read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="notifications")
