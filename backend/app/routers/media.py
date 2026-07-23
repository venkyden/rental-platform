import os
import secrets
from io import BytesIO

from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.models.user import User
from app.routers.auth import get_current_user
from app.services.storage import storage

router = APIRouter(prefix="/media", tags=["Media"])


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    folder: Optional[str] = Query(None),
    folder_form: Optional[str] = Form(None, alias="folder"),
    current_user: User = Depends(get_current_user),
):
    """
    Generic media upload for authenticated users.
    Returns the public URL of the uploaded file.
    Target folders: 'inventory', 'disputes', 'properties', 'incidents'
    """
    target_folder = folder or folder_form or "general"
    allowed_folders = {"inventory", "disputes", "properties", "avatars", "incidents", "general"}
    if target_folder not in allowed_folders:
        target_folder = "general"

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
        folder=target_folder,
    )

    return {"url": result["url"], "key": result["key"]}
