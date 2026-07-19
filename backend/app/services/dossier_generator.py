import io
import logging
from typing import List, Optional
import fitz  # PyMuPDF

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.document import Document
from app.models.credential import Credential
from app.services.credential import credential_service
from app.services.storage import storage, StorageUnavailableError

logger = logging.getLogger(__name__)

async def _add_watermark_to_pdf(pdf_bytes: bytes, watermark_text: str = "ROOMIVO VÉRIFIÉ") -> bytes:
    """
    Apply a diagonal watermark across all pages of the given PDF bytes using PyMuPDF.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        for page in doc:
            rect = page.rect
            # Diagonal placement: approx 45 degrees, centered
            page.insert_text(
                fitz.Point(rect.width / 4, rect.height / 2),
                watermark_text,
                fontsize=55,
                color=(0.85, 0.85, 0.85),
                rotate=45,
                fill_opacity=0.35
            )
            
        out_buf = io.BytesIO()
        doc.save(out_buf)
        doc.close()
        return out_buf.getvalue()
    except Exception as e:
        logger.error(f"Failed to watermark PDF: {e}")
        # Return original if watermark fails, or raise? Better to return original so compilation doesn't fail
        return pdf_bytes

async def _convert_image_to_pdf(image_bytes: bytes) -> bytes:
    """
    Convert an image (JPEG, PNG) to a single-page PDF.
    """
    try:
        img_doc = fitz.open(stream=image_bytes, filetype="img")
        pdf_bytes = img_doc.convert_to_pdf()
        img_doc.close()
        return pdf_bytes
    except Exception as e:
        logger.error(f"Failed to convert image to PDF: {e}")
        raise ValueError("Unsupported image format") from e

async def generate_trust_dossier_pdf(db: Session, user_id: str, credential_id: str) -> bytes:
    """
    Generates the complete Dossier PDF:
    1. Anchor page: The Credential evidence PDF (cryptographically signed)
    2. Append pages: Watermarked source documents from the user's Vault (if allowed by privacy rules).
    
    Note: For Verify-and-Forget documents (like international solvency bank statements),
    they will not be found in storage, enforcing the privacy rule cryptographically by omission.
    """
    # 1. Fetch the credential record
    cred_record = db.scalar(select(Credential).where(Credential.id == credential_id))
    if not cred_record:
        raise ValueError(f"Credential {credential_id} not found")
        
    # Convert Credential model to dict for the credential_service
    record_dict = {
        "credential_id": cred_record.id,
        "subject_role": cred_record.subject_role,
        "rail": cred_record.rail,
        "subject_display_name": cred_record.subject_display_name,
        "issued_at": cred_record.issued_at.isoformat() + "Z",
        "expires_at": cred_record.expires_at.isoformat() + "Z",
        "claims": cred_record.claims,
        "disclaimer": cred_record.disclaimer,
        "signature": cred_record.signature,
        "kid": cred_record.kid,
    }

    # 2. Generate Anchor Page
    anchor_pdf_bytes = credential_service.export_evidence_pdf(record_dict)
    
    # Initialize the output PDF with the anchor
    final_doc = fitz.open(stream=anchor_pdf_bytes, filetype="pdf")
    
    # 3. Fetch user's stored documents (excluding those verified and forgotten)
    # Get the storage keys (file_urls)
    docs = db.scalars(
        select(Document)
        .where(Document.user_id == user_id)
        .order_by(Document.created_at.desc())
    ).all()
    
    for doc_record in docs:
        if not doc_record.file_url:
            continue
            
        # Try to download the file from storage
        try:
            # We assume file_url contains the storage key if using cloudflare R2
            # or it's a relative path if local. 
            key = doc_record.file_url.replace("https://", "").split("/", 1)[-1] 
            if doc_record.file_url.startswith("/uploads/"):
                key = doc_record.file_url.lstrip("/")
                
            file_bytes = await storage.download_file(key)
            if not file_bytes:
                # File deleted (Verify-and-Forget in action, or just removed)
                continue
                
            # Convert to PDF if image
            is_image = doc_record.mime_type and doc_record.mime_type.startswith("image/")
            if is_image or key.lower().endswith((".png", ".jpg", ".jpeg")):
                pdf_bytes = await _convert_image_to_pdf(file_bytes)
            else:
                pdf_bytes = file_bytes
                
            # Watermark the source document
            watermarked_pdf_bytes = await _add_watermark_to_pdf(pdf_bytes)
            
            # Append to the final document
            try:
                src_doc = fitz.open(stream=watermarked_pdf_bytes, filetype="pdf")
                final_doc.insert_pdf(src_doc)
                src_doc.close()
            except Exception as e:
                logger.error(f"Failed to insert document {doc_record.id} into dossier: {e}")
                
        except StorageUnavailableError:
            logger.warning(f"Storage unavailable for document {doc_record.id}, skipping in dossier.")
        except Exception as e:
            logger.error(f"Error processing document {doc_record.id} for dossier: {e}")
            
    # Return the bytes
    out_buf = io.BytesIO()
    final_doc.save(out_buf)
    final_doc.close()
    
    return out_buf.getvalue()
