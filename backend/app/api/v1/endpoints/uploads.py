import io
import uuid
from typing import Any

import cloudinary
import cloudinary.uploader
from app.api import deps
from app.core.config import settings
from app.models.user import User
from app.schemas.media import MediaResponse
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

router = APIRouter()


def configure_cloudinary():
    # Support either full CLOUDINARY_URL or individual settings
    if settings.CLOUDINARY_URL:
        try:
            cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL)
            return True
        except Exception:
            return False

    if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        return True

    return False


@router.post("/", response_model=MediaResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Upload a file to Cloudinary (recommended for production) or return error if not configured."""

    if not configure_cloudinary():
        raise HTTPException(status_code=500, detail="Cloudinary is not configured on the server")

    # Read file content into memory (Cloud Run has memory limits; this is reasonable for images)
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {e}")

    public_id = str(uuid.uuid4())
    upload_params = {
        "public_id": public_id,
        "use_filename": False,
        "unique_filename": False,
        "resource_type": "auto",
    }
    if settings.CLOUDINARY_UPLOAD_FOLDER:
        upload_params["folder"] = settings.CLOUDINARY_UPLOAD_FOLDER

    try:
        # Cloudinary accepts file-like objects; wrap bytes in BytesIO
        res = cloudinary.uploader.upload(io.BytesIO(contents), **upload_params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cloudinary upload failed: {e}")

    url = res.get("secure_url") or res.get("url")
    if not url:
        raise HTTPException(status_code=500, detail="Cloudinary did not return a file URL")

    return MediaResponse(url=url, filename=file.filename, content_type=file.content_type)
