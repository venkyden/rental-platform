from sqlalchemy import Column, String, Boolean, DateTime
from datetime import datetime
import uuid
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, index=True, nullable=False)
    is_enabled = Column(Boolean, default=False, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
