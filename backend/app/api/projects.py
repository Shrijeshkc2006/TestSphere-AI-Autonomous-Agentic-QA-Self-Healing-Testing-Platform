"""Projects router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Project, TestRun, StepResult, RunStatus
from app.schemas import ProjectCreate, ProjectUpdate, ProjectOut, DashboardStats, TestRunOut
from app.auth import get_current_user
from app.services.url_validator import validate_url

router = APIRouter()


async def _get_project_or_404(project_id: str, user: User, db: AsyncSession) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Project count
    proj_count = await db.execute(
        select(func.count(Project.id)).where(Project.owner_id == current_user.id)
    )
    total_projects = proj_count.scalar() or 0

    # Run stats
    runs_result = await db.execute(
        select(TestRun)
        .join(Project)
        .options(
            selectinload(TestRun.step_results).selectinload(StepResult.heal_attempts),
            selectinload(TestRun.step_results).selectinload(StepResult.artifacts),
            selectinload(TestRun.artifacts),
        )
        .where(Project.owner_id == current_user.id)
        .order_by(desc(TestRun.created_at))
    )
    runs = runs_result.scalars().all()

    total_runs = len(runs)
    total_passed = sum(1 for r in runs if r.status == RunStatus.PASSED)
    total_failed = sum(1 for r in runs if r.status == RunStatus.FAILED)
    pass_rate = (total_passed / total_runs * 100) if total_runs > 0 else 0.0
    durations = [r.duration_ms for r in runs if r.duration_ms]
    avg_duration = sum(durations) / len(durations) if durations else None
    healed = sum(r.healed_steps for r in runs)

    recent = runs[:10]

    return DashboardStats(
        total_projects=total_projects,
        total_runs=total_runs,
        total_passed=total_passed,
        total_failed=total_failed,
        pass_rate=round(pass_rate, 1),
        avg_duration_ms=avg_duration,
        healed_steps=healed,
        recent_runs=[TestRunOut.model_validate(r) for r in recent],
    )


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    search: Optional[str] = Query(None),
):
    q = select(Project).where(Project.owner_id == current_user.id).order_by(desc(Project.updated_at))
    if search:
        q = q.where(Project.name.ilike(f"%{search}%"))
    result = await db.execute(q)
    projects = result.scalars().all()
    return [ProjectOut.model_validate(p) for p in projects]


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate URL for url/local_url projects
    if data.project_type in ("url", "local_url") and data.target_url:
        validation = await validate_url(data.target_url, allow_local=data.project_type == "local_url")
        if not validation["valid"]:
            raise HTTPException(status_code=400, detail=validation["reason"])

    project = Project(
        owner_id=current_user.id,
        name=data.name,
        description=data.description,
        project_type=data.project_type,
        target_url=data.target_url,
        upload_id=data.upload_id,
        framework=data.framework,
        package_manager=data.package_manager,
        build_command=data.build_command,
        start_command=data.start_command,
        health_check_url=data.health_check_url,
        app_port=data.app_port,
    )
    db.add(project)
    await db.flush()
    return ProjectOut.model_validate(project)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return ProjectOut.model_validate(await _get_project_or_404(project_id, current_user, db))


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project_or_404(project_id, current_user, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(project, field, value)
    await db.flush()
    return ProjectOut.model_validate(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project_or_404(project_id, current_user, db)
    await db.delete(project)
