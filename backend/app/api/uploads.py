"""
Uploads router.

Handles ZIP archive uploads with:
- File size enforcement
- Extension whitelist (.zip only)
- Async processing via upload_service
- Progress stored in Upload model
"""
import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Upload
from app.schemas import UploadOut
from app.auth import get_current_user
from app.config import settings
from app.services.upload_service import process_upload

router = APIRouter()


@router.post("", response_model=UploadOut, status_code=201)
async def upload_zip(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Extension check
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are accepted")

    # Read in chunks, enforcing size limit
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    upload_id = str(uuid.uuid4())
    safe_filename = f"{upload_id}.zip"
    stored_path = str(upload_dir / safe_filename)

    total_size = 0
    try:
        async with aiofiles.open(stored_path, "wb") as f:
            while True:
                chunk = await file.read(65536)  # 64 KB chunks
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > settings.MAX_UPLOAD_SIZE_BYTES:
                    await f.close()
                    os.remove(stored_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit",
                    )
                await f.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        if os.path.exists(stored_path):
            os.remove(stored_path)
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}")

    # Process the archive
    result = await process_upload(
        file_path=stored_path,
        original_filename=file.filename,
        file_size=total_size,
    )

    upload = Upload(
        id=upload_id,
        owner_id=current_user.id,
        original_filename=file.filename,
        stored_path=stored_path,
        file_size=total_size,
        content_hash=result["content_hash"],
        framework=result.get("framework"),
        package_manager=result.get("package_manager"),
        detected_scripts=result.get("detected_scripts"),
        file_tree_summary=result.get("file_tree_summary"),
        validation_status=result["validation_status"],
        validation_errors=result.get("validation_errors"),
    )
    db.add(upload)
    await db.flush()
    return UploadOut.model_validate(upload)


@router.get("/{upload_id}", response_model=UploadOut)
async def get_upload(
    upload_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Upload).where(Upload.id == upload_id, Upload.owner_id == current_user.id)
    )
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    return UploadOut.model_validate(upload)
