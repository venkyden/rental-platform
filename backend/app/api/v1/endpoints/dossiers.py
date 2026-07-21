from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.routers.auth import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.dossier import TrustDossier, DossierShareLink
from app.services.dossier_service import dossier_service
from app.services.storage import storage, StorageUnavailableError
from pydantic import BaseModel
from datetime import datetime

# Per-IP rate limiting on the PUBLIC share endpoint. Tokens are 256-bit so
# enumeration is hopeless, but the limit stops scraping and unauthenticated
# DB/storage hammering — same posture as the credential verify endpoint.
limiter = Limiter(key_func=get_remote_address)

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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
async def share_dossier(
    request: DossierShareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Create a secure share link for a dossier.
    """
    dossier = await db.scalar(select(TrustDossier).where(TrustDossier.id == request.dossier_id))
    if not dossier or str(dossier.user_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Dossier not found")
        
    link = await dossier_service.create_share_link(
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
async def get_my_dossiers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    List all dossiers for the current user.
    """
    dossiers = (await db.scalars(
        select(TrustDossier)
        .where(TrustDossier.user_id == str(current_user.id))
        .order_by(TrustDossier.created_at.desc())
    )).all()
    
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


class SharedDossierMeta(BaseModel):
    """Non-sensitive descriptor shown before the PDF is downloaded. Carries no
    claims and no PII — just enough to render the viewer."""
    role: str
    status: str
    expires_at: datetime


async def _resolve_shared_link(token: str, db: AsyncSession, current_user: User | None):
    """Shared guards for every public token route: unknown → 404, expired →
    403, targeted-at-someone-else → 403, not compiled → 404. Kept in one place
    so the metadata and PDF routes can never drift apart."""
    from app.core.timeutils import naive_utcnow

    # Eager-load the dossier: a lazy relationship access under AsyncSession
    # raises MissingGreenlet.
    link = await db.scalar(
        select(DossierShareLink)
        .where(DossierShareLink.token == token)
        .options(selectinload(DossierShareLink.dossier))
    )

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if link.expires_at < naive_utcnow():
        raise HTTPException(status_code=403, detail="Link expired")

    if link.target_user_id and (not current_user or str(current_user.id) != str(link.target_user_id)):
        raise HTTPException(status_code=403, detail="You do not have permission to view this dossier")

    dossier = link.dossier
    if dossier is None:
        raise HTTPException(status_code=404, detail="Dossier not found")
    if dossier.status != "ready" or not dossier.pdf_s3_key:
        raise HTTPException(status_code=404, detail="Dossier PDF not ready")

    return link, dossier


@router.get("/shared/{token}/meta", response_model=SharedDossierMeta)
@limiter.shared_limit("30/minute", scope="dossier-shared")
async def view_shared_dossier_meta(
    request: Request,  # noqa: ARG001 — consumed by @limiter
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> Any:
    """Describe a shared dossier without transferring the PDF, so the viewer can
    show validity (and a clear expired/not-found message) before downloading."""
    _link, dossier = await _resolve_shared_link(token, db, current_user)
    return SharedDossierMeta(
        role=dossier.role,
        status=dossier.status,
        expires_at=dossier.expires_at,
    )


@router.get("/shared/{token}")
@limiter.shared_limit("30/minute", scope="dossier-shared")
async def view_shared_dossier(
    request: Request,  # noqa: ARG001 — consumed by @limiter
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> Any:
    """
    View a shared dossier using a secure token.
    Returns the raw PDF bytes.
    """
    link, dossier = await _resolve_shared_link(token, db, current_user)
        
    # Increment view count
    link.view_count += 1
    await db.commit()
    
    try:
        pdf_bytes = await storage.download_file(dossier.pdf_s3_key)
        if not pdf_bytes:
            raise HTTPException(status_code=404, detail="PDF file missing")
            
        return Response(content=pdf_bytes, media_type="application/pdf")
    except (HTTPException, StorageUnavailableError):
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch PDF")
