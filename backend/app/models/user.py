import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, TIMESTAMP, Boolean, Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class UserRole(str, enum.Enum):
    TENANT = "tenant"
    LANDLORD = "landlord"
    PROPERTY_MANAGER = "property_manager"
    ADMIN = "admin"


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    FAILED = "failed"
    EXPIRED = "expired"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)  # Nullable for Google-only accounts
    google_id = Column(String, unique=True, nullable=True, index=True)
    role = Column(
        SQLEnum(
            UserRole,
            name="userrole",
            native_enum=True,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )

    # Profile fields
    full_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    # Verification status
    email_verified = Column(Boolean, default=False)
    identity_verified = Column(Boolean, default=False)
    employment_verified = Column(Boolean, default=False)

    # Identity verification data (JSONB for flexibility)
    identity_data = Column(
        JSON, nullable=True
    )  # Stores eIDV results, trust score, etc.
    employment_data = Column(
        JSON, nullable=True
    )  # Stores employment verification results

    # Trust scoring
    trust_score = Column(Integer, default=0)  # 0-100
    risk_tier = Column(String, nullable=True)  # LOW_RISK, MEDIUM_RISK, etc.

    # Onboarding & Segmentation
    segment = Column(String, nullable=True)  # D1/D2/D3/S1/S2/S3
    preferences = Column(JSON, nullable=True)  # User preferences from questionnaire
    onboarding_completed = Column(Boolean, default=False)

    # GDPR consent tracking
    marketing_consent = Column(Boolean, default=False)
    marketing_consent_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Soft delete
    is_active = Column(Boolean, default=True)


class VerificationRecord(Base):
    __tablename__ = "verification_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Verification type
    verification_type = Column(
        String, nullable=False
    )  # passive_eidv, document, liveness, employment

    # Status and results
    status = Column(SQLEnum(VerificationStatus), nullable=False)
    confidence_score = Column(Integer, nullable=True)  # 0-100

    # Data collected during verification
    verification_data = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class OnboardingResponse(Base):
    """Store onboarding questionnaire responses"""

    __tablename__ = "onboarding_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)

    responses = Column(JSONB)  # Store all questionnaire answers

    # Detected segment
    detected_segment = Column(String, nullable=True)  # D1, D2, D3, S1, S2, S3

    # Metadata
    completed_at = Column(DateTime, default=datetime.utcnow)
