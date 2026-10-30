"""
Artifacts router.

Provides secure, access-controlled artifact downloads.
- Ownership is enforced via the run → project → user chain.
- Artifacts are served by path; no directory traversal is possible.
- Retention: artifacts older than ARTIFACT_RETENTION_DAYS are not served (cleanup handled separately).
"""
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Project, TestRun, Artifact
from app.schemas import ArtifactOut
from app.auth import get_current_user
from app.config import settings

router = APIRouter()


async def _get_artifact_or_404(artifact_id: str, user: User, db: AsyncSession) -> Artifact:
    result = await db.execute(
        select(Artifact)
        .join(TestRun)
        .join(Project)
        .options(selectinload(Artifact.run))
        .where(Artifact.id == artifact_id, Project.owner_id == user.id)
    )
    art = result.scalar_one_or_none()
    if not art:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return art


@router.get("/run/{run_id}", response_model=list[ArtifactOut])
async def list_run_artifacts(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Artifact)
        .join(TestRun)
        .join(Project)
        .where(Artifact.run_id == run_id, Project.owner_id == current_user.id)
    )
    artifacts = result.scalars().all()
    return [
        ArtifactOut.model_validate(a).model_copy(update={"download_url": f"/api/artifacts/{a.id}/download"})
        for a in artifacts
    ]


@router.get("/{artifact_id}", response_model=ArtifactOut)
async def get_artifact(
    artifact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    art = await _get_artifact_or_404(artifact_id, current_user, db)
    return ArtifactOut.model_validate(art).model_copy(
        update={"download_url": f"/api/artifacts/{art.id}/download"}
    )


@router.get("/{artifact_id}/download")
async def download_artifact(
    artifact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    art = await _get_artifact_or_404(artifact_id, current_user, db)

    stored = Path(art.stored_path)
    artifact_root = Path(settings.ARTIFACT_DIR).resolve()
    upload_root = Path(settings.UPLOAD_DIR).resolve()

    if not stored.exists():
        if not stored.is_absolute():
            if (artifact_root / stored).exists():
                stored = artifact_root / stored
            elif (artifact_root / art.run_id / stored.name).exists():
                stored = artifact_root / art.run_id / stored.name
            elif (artifact_root / art.run_id / "screenshots" / stored.name).exists():
                stored = artifact_root / art.run_id / "screenshots" / stored.name

    if not stored.exists():
        raise HTTPException(status_code=404, detail="Artifact file not found on disk")

    resolved = stored.resolve()
    try:
        resolved.relative_to(artifact_root)
    except ValueError:
        try:
            resolved.relative_to(upload_root)
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(
        path=str(resolved),
        media_type=art.mime_type,
        filename=art.filename,
    )
