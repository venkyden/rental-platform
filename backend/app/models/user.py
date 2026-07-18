import enum
import uuid
from datetime import datetime
from app.core.timeutils import naive_utcnow

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
    # Dedicated given name — trust lines must never parse full_name (surname leak,
    # see 830556e). Nullable: captured at profile/onboarding, never backfilled by guess.
    first_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    profile_picture_url = Column(String, nullable=True)
    # storage key of current avatar — avatars/ keys are randomized, not per-user
    # prefixable, so replace/erasure purge needs this (GDPR purge parity)
    avatar_storage_key = Column(String, nullable=True)

    # Verification status
    email_verified = Column(Boolean, default=False)
    identity_verified = Column(Boolean, default=False)
    identity_status = Column(String, default="unverified") # unverified, pending, verified, rejected
    employment_verified = Column(Boolean, default=False)
    employment_status = Column(String, default="unverified")
    income_verified = Column(Boolean, default=False)
    income_status = Column(String, default="unverified")
    ownership_verified = Column(Boolean, default=False)
    ownership_status = Column(String, default="unverified")
    kbis_verified = Column(Boolean, default=False)
    carte_g_verified = Column(Boolean, default=False)
    
    guarantor_type = Column(String, nullable=True) # 'visale' | 'garantme' | 'physical' | 'none'
    guarantor_status = Column(String, default="unverified")
    visale_id = Column(String, nullable=True)
    garantme_ref = Column(String, nullable=True)

    # Identity verification data (Encrypted for GDPR Compliance)
    from app.utils.encryption import EncryptedJSON
    identity_data = Column(EncryptedJSON, nullable=True)
    employment_data = Column(EncryptedJSON, nullable=True)
    ownership_data = Column(EncryptedJSON, nullable=True)
    income_data = Column(EncryptedJSON, nullable=True)
    guarantor_data = Column(EncryptedJSON, nullable=True)
    insurance_verified = Column(Boolean, default=False)
    insurance_status = Column(String, default="unverified")
    insurance_data = Column(EncryptedJSON, nullable=True)
    # Deposit-binding (item 15) + entity/SCI landlord verification (item 16).
    # Own column, NOT ownership_data: the property/control endpoint reassigns
    # ownership_data wholesale, which would clobber a nested binding.
    deposit_binding_data = Column(EncryptedJSON, nullable=True)

    @property
    def solvency_verified(self) -> bool:
        """Single source of truth for "is this user solvency-verified?": the income
        rail OR a MEDIUM funds_coverage (INTL funds rail). Consumed by the status
        endpoint, the auth/me UserResponse, and the landlord-facing applicant schema,
        so funds-only applicants read as verified everywhere — not just their own
        dashboard. Does NOT mutate income_verified (the rails stay distinct axes)."""
        funds = (self.income_data or {}).get("funds_coverage") or {}
        return bool(self.income_verified) or funds.get("assurance") == "MEDIUM"

    # Trust scoring
    trust_score = Column(Integer, default=0)  # 0-100
    risk_tier = Column(String, nullable=True)  # LOW_RISK, MEDIUM_RISK, etc.

    # Onboarding & Segmentation
    segment = Column(String, nullable=True)  # D1/D2/D3/S1/S2/S3
    preferences = Column(JSON, nullable=True)  # User preferences from questionnaire
    
    # Track which roles the user has unlocked
    available_roles = Column(JSON, default=lambda: ["tenant"])
    # Track onboarding completion per role (e.g. {"tenant": True, "property_manager": False})
    onboarding_status = Column(JSON, default=dict)
    
    # Deprecated: use onboarding_status instead. Kept for backward compatibility
    onboarding_completed = Column(Boolean, default=False)

    # GDPR consent tracking
    marketing_consent = Column(Boolean, default=False)
    marketing_consent_at = Column(DateTime, nullable=True)
    contact_preferences = Column(JSON, nullable=True)  # Notification/contact prefs

    # Timestamps
    created_at = Column(DateTime, default=naive_utcnow)
    updated_at = Column(DateTime, default=naive_utcnow, onupdate=naive_utcnow)
    last_login = Column(DateTime, nullable=True)
    refresh_token_version = Column(Integer, default=1)

    # Soft delete
    is_active = Column(Boolean, default=True)

    # Relationships
    applications = relationship("Application", back_populates="tenant")


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
    created_at = Column(DateTime, default=naive_utcnow)
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
    completed_at = Column(DateTime, default=naive_utcnow)
