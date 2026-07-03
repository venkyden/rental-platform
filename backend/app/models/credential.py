import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutils import naive_utcnow


class Credential(Base):
    """
    Thin banded store for signed verification credentials.

    Only banded claims are stored (never raw PII or source documents).
    The Ed25519 signature is independently verifiable against the public key
    without touching this store.
    """

    __tablename__ = "credentials"

    # vc_<32 hex chars> — human-typeable for verify-by-ID flow
    id = Column(String(64), primary_key=True)

    subject_role = Column(String(20), nullable=False)   # tenant | landlord | property
    rail = Column(String(10), nullable=False)            # FR | INTL

    # Nullable: passwordless-lane subjects may not have a full Roomivo account yet
    subject_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Display name shown on the public verify page so verifiers can match to chat
    subject_display_name = Column(String(256), nullable=True)

    issued_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)

    # Banded claims only — e.g. {"identity_assurance": "HIGH", "solvency_ratio": ">=3.0"}
    claims = Column(JSONB, nullable=False)

    disclaimer = Column(String(512), nullable=False)

    # Hex-encoded Ed25519 signature over the canonical payload JSON
    signature = Column(String(128), nullable=False)

    # Key id of the signing key (inside the signed payload). Nullable: credentials
    # issued before key rotation existed carry no kid and verify by key trial.
    kid = Column(String(32), nullable=True)

    revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=naive_utcnow, nullable=False)

    subject = relationship("User", foreign_keys=[subject_user_id], lazy="noload")
