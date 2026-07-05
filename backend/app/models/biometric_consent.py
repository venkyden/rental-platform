import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.core.timeutils import naive_utcnow

# GDPR Art. 9(2)(a): selfie face-match processes biometric data, requires
# explicit consent recorded BEFORE any capture. Bump version whenever consent
# wording changes materially — users must then re-consent.
BIOMETRIC_CONSENT_VERSION = "2026-07-04"


class BiometricConsent(Base):
    """Proof of explicit consent to selfie↔ID face-match.

    Holds NO biometric data — only who consented, when, and to which wording
    version. Retained after account anonymisation as evidence of lawful
    processing (Art. 17(3)(b)).
    """

    __tablename__ = "biometric_consents"
    # one row per user per wording version — closes double-submit race
    __table_args__ = (
        UniqueConstraint("user_id", "consent_version", name="uq_biometric_consents_user_version"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    consent_version = Column(String(20), nullable=False)
    consented_at = Column(DateTime, default=naive_utcnow, nullable=False)
    user_agent = Column(String(400), nullable=True)
