"""
API endpoints for Document Management and Verification.
"""

import os
import secrets
from datetime import datetime
from typing import List, Optional

from fastapi import (APIRouter, Depends, File, Form, HTTPException, UploadFile,
                     status)
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.document import Document, DocumentType, VerificationStatus
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/documents", tags=["Documents"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR_DOCS", "uploads/documents")
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except PermissionError:
    pass


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form("other"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generic document upload"""

    # Save file
    file_extension = os.path.splitext(file.filename)[1]
    filename = f"{secrets.token_urlsafe(16)}{file_extension}"
    user_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)

    file_path = os.path.join(user_dir, filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    file_url = f"/uploads/documents/{current_user.id}/{filename}"

    # Create record
    doc = Document(
        user_id=current_user.id,
        file_url=file_url,
        file_name=file.filename,
        mime_type=file.content_type,
        size_bytes=len(content),
        document_type=document_type,
        verification_status="pending",
    )

    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return doc


@router.get("", response_model=List[dict])  # Simple dict response for now
async def list_documents(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """List my documents"""
    result = await db.execute(
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()

    return [
        {
            "id": str(d.id),
            "file_name": d.file_name,
            "document_type": d.document_type,
            "verification_status": d.verification_status,
            "created_at": d.created_at,
            "file_url": d.file_url,
        }
        for d in docs
    ]


# Specialized Verification Endpoints


@router.post("/verify/guarantor", status_code=status.HTTP_201_CREATED)
async def submit_guarantor(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit Guarantor Form/Visale Certificate"""
    doc = await upload_document(
        file=file, document_type="guarantor_form", current_user=current_user, db=db
    )

    # Trigger 'Pending Verification' logic (Mock)
    doc.verification_status = "pending"
    await db.commit()

    return {
        "message": "Guarantor document submitted for verification",
        "document_id": str(doc.id),
    }


@router.post("/verify/income", status_code=status.HTTP_201_CREATED)
async def submit_income_proof(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit Income Proof (Payslip/Tax Return)"""
    doc = await upload_document(
        file=file, document_type="payslip", current_user=current_user, db=db
    )

    return {"message": "Income proof submitted", "document_id": str(doc.id)}


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a document"""
    import uuid

    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    result = await db.execute(select(Document).where(Document.id == doc_uuid))
    doc = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your document")

    await db.delete(doc)
    await db.commit()
    return
