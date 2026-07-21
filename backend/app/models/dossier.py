import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutils import naive_utcnow

class TrustDossier(Base):
    __tablename__ = "trustdossiers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(50), nullable=False) # tenant, landlord, guarantor, agency
    
    # FK to the cryptographic credential layer
    credential_id = Column(
        String(64), 
        ForeignKey("credentials.id", ondelete="SET NULL"), 
        nullable=True,
        index=True
    )
    
    status = Column(String(50), default="compiling", nullable=False) # compiling, ready, expired
    pdf_s3_key = Column(String(1024), nullable=True)
    
    created_at = Column(DateTime, default=naive_utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="dossiers")
    credential = relationship("Credential", lazy="select")
    share_links = relationship("DossierShareLink", back_populates="dossier", cascade="all, delete-orphan")


class DossierShareLink(Base):
    __tablename__ = "dossier_share_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dossier_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("trustdossiers.id", ondelete="CASCADE"), 
        nullable=False, 
        index=True
    )
    
    # If shared directly with a registered user, tie it to their ID
    target_user_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("users.id", ondelete="SET NULL"), 
        nullable=True,
        index=True
    )
    
    token = Column(String(128), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    view_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=naive_utcnow, nullable=False)

    dossier = relationship("TrustDossier", back_populates="share_links")
    target_user = relationship("User", foreign_keys=[target_user_id], lazy="select")
