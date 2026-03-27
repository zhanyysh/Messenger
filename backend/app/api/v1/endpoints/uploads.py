import os
import uuid
import shutil
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.api import deps
from app.models.user import User
from app.schemas.media import MediaResponse
from app.core.config import settings

router = APIRouter()

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.post("/", response_model=MediaResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Upload a file (image, document, or audio).
    """
    # Generate a unique filename to prevent collisions
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")

    # In a real app, this would be a full URL
    # For local dev, we'll return the path that our StaticFiles mount serves
    url = f"/uploads/{unique_filename}"
    
    return MediaResponse(
        url=url,
        filename=file.filename,
        content_type=file.content_type
    )
