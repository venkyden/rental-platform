from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_user_optional
from app.models.user import User
from app.models.dossier import TrustDossier, DossierShareLink
from app.services.dossier_service import dossier_service
from app.services.storage import storage
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class DossierCompileRequest(BaseModel):
    role: str

class DossierShareRequest(BaseModel):
    dossier_id: str
    expires_in_days: int = 7
    target_user_id: str | None = None

class DossierResponse(BaseModel):
    id: str
    role: str
    status: str
    created_at: datetime
    expires_at: datetime | None

class ShareLinkResponse(BaseModel):
    token: str
    expires_at: datetime
    url: str

@router.post("/compile", response_model=DossierResponse)
async def compile_dossier(
    request: DossierCompileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Trigger compilation of the Universal Trust Dossier.
    """
    try:
        dossier = await dossier_service.compile_dossier(db, str(current_user.id), request.role)
        return DossierResponse(
            id=str(dossier.id),
            role=dossier.role,
            status=dossier.status,
            created_at=dossier.created_at,
            expires_at=dossier.expires_at
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to compile dossier")

@router.post("/share", response_model=ShareLinkResponse)
def share_dossier(
    request: DossierShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Create a secure share link for a dossier.
    """
    dossier = db.scalar(select(TrustDossier).where(TrustDossier.id == request.dossier_id))
    if not dossier or str(dossier.user_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Dossier not found")
        
    link = dossier_service.create_share_link(
        db, 
        request.dossier_id, 
        expires_in_days=request.expires_in_days,
        target_user_id=request.target_user_id
    )
    
    from app.core.config import settings
    # Assuming frontend URL is in settings or hardcoded for now
    base_url = settings.FRONTEND_URL if hasattr(settings, "FRONTEND_URL") else "https://roomivo.app"
    url = f"{base_url}/d/share/{link.token}"
    
    return ShareLinkResponse(
        token=link.token,
        expires_at=link.expires_at,
        url=url
    )

@router.get("/me", response_model=List[DossierResponse])
def get_my_dossiers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    List all dossiers for the current user.
    """
    dossiers = db.scalars(
        select(TrustDossier)
        .where(TrustDossier.user_id == str(current_user.id))
        .order_by(TrustDossier.created_at.desc())
    ).all()
    
    return [
        DossierResponse(
            id=str(d.id),
            role=d.role,
            status=d.status,
            created_at=d.created_at,
            expires_at=d.expires_at
        ) for d in dossiers
    ]

from fastapi.responses import Response

@router.get("/shared/{token}")
async def view_shared_dossier(
    token: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> Any:
    """
    View a shared dossier using a secure token.
    Returns the raw PDF bytes.
    """
    from app.core.timeutils import naive_utcnow
    
    link = db.scalar(select(DossierShareLink).where(DossierShareLink.token == token))
    
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
        
    if link.expires_at < naive_utcnow():
        raise HTTPException(status_code=403, detail="Link expired")
        
    if link.target_user_id and (not current_user or str(current_user.id) != str(link.target_user_id)):
        raise HTTPException(status_code=403, detail="You do not have permission to view this dossier")
        
    dossier = link.dossier
    if dossier.status != "ready" or not dossier.pdf_s3_key:
        raise HTTPException(status_code=404, detail="Dossier PDF not ready")
        
    # Increment view count
    link.view_count += 1
    db.commit()
    
    try:
        pdf_bytes = await storage.download_file(dossier.pdf_s3_key)
        if not pdf_bytes:
            raise HTTPException(status_code=404, detail="PDF file missing")
            
        return Response(content=pdf_bytes, media_type="application/pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch PDF")
