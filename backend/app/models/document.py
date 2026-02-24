"""
Document model for storing user uploads (Vault & Verification).
"""

import enum
import uuid

from sqlalchemy import TIMESTAMP, Boolean, Column
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class DocumentType(str, enum.Enum):
    IDENTITY = "identity"
    PAYSLIP = "payslip"
    TAX_RETURN = "tax_return"
    EMPLOYMENT_CONTRACT = "employment_contract"
    GUARANTOR_FORM = "guarantor_form"
    RENT_RECEIPT = "rent_receipt"
    OTHER = "other"


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # File Info
    file_url = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    mime_type = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=True)

    # Classification
    document_type = Column(
        String, nullable=False
    )  # mapped to DocumentType enum logically

    # Verification
    verification_status = Column(String, default="pending")
    verification_data = Column(JSONB)  # Store API confidence scores etc.

    # Metadata
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", backref="documents")


class DocumentExtraction(Base):
    __tablename__ = "document_extractions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_hash = Column(String, unique=True, index=True, nullable=False)
    extraction_data = Column(JSONB, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
