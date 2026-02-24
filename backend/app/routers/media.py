import os
import secrets
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.models.user import User
from app.routers.auth import get_current_user
from app.services.storage import storage

router = APIRouter(prefix="/media", tags=["Media"])


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    folder: str = "general",
    current_user: User = Depends(get_current_user),
):
    """
    Generic media upload for authenticated users.
    Returns the public URL of the uploaded file.
    Target folders: 'inventory', 'disputes', 'properties'
    """
    # Validation
    allowed_folders = {"inventory", "disputes", "properties", "avatars", "general"}
    if folder not in allowed_folders:
        folder = "general"

    file_ext = os.path.splitext(file.filename)[1].lower()
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".mov", ".mp4"}

    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Invalid file type")

    # Read content
    content = await file.read()
    file_obj = BytesIO(content)

    # Generate cleaner filename
    safe_filename = f"{secrets.token_hex(8)}{file_ext}"

    # Upload
    result = await storage.upload_file(
        file_data=file_obj,
        filename=safe_filename,
        content_type=file.content_type,
        folder=folder,
    )

    return {"url": result["url"], "key": result["key"]}
