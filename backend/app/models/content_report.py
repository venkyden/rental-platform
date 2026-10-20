"""
A report that a listing is illegal or breaks the terms (DSA art. 16), and the
decision taken on it (art. 17 when the listing is taken down).

The reporter's name and email are kept only until the decision has been sent to
them; they are erased when the report is decided.
"""

import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.core.timeutils import naive_utcnow

REASONS = ("discrimination", "scam", "misleading", "unsafe_housing", "other_illegal")
GROUNDS = ("illegal", "terms")


class ContentReport(Base):
    __tablename__ = "content_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reason = Column(String(30), nullable=False)
    explanation = Column(Text, nullable=False)
    notifier_name = Column(String(120), nullable=True)
    notifier_email = Column(String(255), nullable=True)
    good_faith = Column(Boolean, nullable=False)
    # 'received' -> 'upheld' | 'rejected'; 'upheld' -> 'reversed' after the owner contests
    status = Column(String(20), nullable=False, default="received", index=True)
    ground = Column(String(20), nullable=True)
    decision_reason = Column(Text, nullable=True)
    decided_at = Column(DateTime, nullable=True)
    decided_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=naive_utcnow, nullable=False)
