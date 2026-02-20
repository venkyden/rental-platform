from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True) # Optional: Anonymous feedback
    category = Column(String, nullable=False) # e.g. "bug", "feature", "ux"
    message = Column(Text, nullable=False)
    rating = Column(Integer, nullable=True) # 1-5 stars
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="feedback_submissions")
