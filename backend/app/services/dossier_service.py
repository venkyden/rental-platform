import io
import uuid
import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.dossier import TrustDossier, DossierShareLink
from app.models.user import User
from app.services.dossier_generator import generate_trust_dossier_pdf
from app.services.storage import storage
from app.core.timeutils import naive_utcnow

class DossierService:
    async def compile_dossier(self, db: AsyncSession, user_id: str, role: str) -> TrustDossier:
        """
        Orchestrates the compilation of a Universal Trust Dossier.
        Fetches the latest Credential, generates the PDF, stores it in S3, and returns the TrustDossier.
        """
        # Note: In a real flow, this would first check if a valid credential exists
        # If not, it would either issue one based on VerificationRecords or fail.
        # For now, we assume the latest credential for this user/role exists.
        from app.models.credential import Credential
        
        latest_cred = await db.scalar(
            select(Credential)
            .where(Credential.subject_user_id == user_id, Credential.subject_role == role)
            .order_by(Credential.issued_at.desc())
        )
        
        if not latest_cred:
            raise ValueError(f"No valid credential found for user {user_id} and role {role}")
            
        # 1. Create or update the TrustDossier record
        dossier = await db.scalar(
            select(TrustDossier)
            .where(TrustDossier.user_id == user_id, TrustDossier.role == role)
        )
        
        if not dossier:
            dossier = TrustDossier(
                user_id=user_id,
                role=role,
                status="compiling",
                credential_id=latest_cred.id
            )
            db.add(dossier)
            await db.commit()
            await db.refresh(dossier)
        else:
            dossier.status = "compiling"
            dossier.credential_id = latest_cred.id
            await db.commit()

        # 2. Generate PDF
        try:
            pdf_bytes = await generate_trust_dossier_pdf(db, user_id, latest_cred.id)
            
            # 3. Store PDF
            file_data = io.BytesIO(pdf_bytes)
            filename = f"dossier_{user_id}_{role}.pdf"
            
            # Upload to storage
            upload_res = await storage.upload_file(
                file_data=file_data,
                filename=filename,
                content_type="application/pdf",
                folder=f"dossiers/{user_id}"
            )
            
            # 4. Finalize
            dossier.pdf_s3_key = upload_res["key"]
            dossier.status = "ready"
            dossier.expires_at = latest_cred.expires_at
            
            await db.commit()
            await db.refresh(dossier)
            return dossier
            
        except Exception as e:
            dossier.status = "failed"
            await db.commit()
            raise RuntimeError(f"Dossier compilation failed: {e}") from e

    async def create_share_link(
        self, 
        db: AsyncSession, 
        dossier_id: str, 
        expires_in_days: int = 7, 
        target_user_id: Optional[str] = None
    ) -> DossierShareLink:
        """
        Creates a securely tokenized share link for a given Dossier.
        """
        dossier = await db.scalar(select(TrustDossier).where(TrustDossier.id == dossier_id))
        if not dossier:
            raise ValueError("Dossier not found")
            
        token = secrets.token_urlsafe(32)
        expires_at = naive_utcnow() + timedelta(days=expires_in_days)
        
        # If the dossier itself expires sooner, clamp the link expiration
        if dossier.expires_at and dossier.expires_at < expires_at:
            expires_at = dossier.expires_at
            
        link = DossierShareLink(
            dossier_id=dossier.id,
            target_user_id=target_user_id,
            token=token,
            expires_at=expires_at
        )
        db.add(link)
        await db.commit()
        await db.refresh(link)
        return link

dossier_service = DossierService()
