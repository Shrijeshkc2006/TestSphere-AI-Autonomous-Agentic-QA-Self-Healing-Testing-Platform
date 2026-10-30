"""Test runs router."""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Project, TestPlan, TestRun, StepResult, RunStatus
from app.schemas import TestRunCreate, TestRunOut
from app.auth import get_current_user

router = APIRouter()


async def _get_run_or_404(run_id: str, user: User, db: AsyncSession) -> TestRun:
    result = await db.execute(
        select(TestRun)
        .join(Project)
        .options(
            selectinload(TestRun.step_results).selectinload(StepResult.heal_attempts),
            selectinload(TestRun.step_results).selectinload(StepResult.artifacts),
            selectinload(TestRun.artifacts),
        )
        .where(TestRun.id == run_id, Project.owner_id == user.id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return run


@router.get("/project/{project_id}", response_model=list[TestRunOut])
async def list_runs(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
):
    result = await db.execute(
        select(TestRun)
        .join(Project)
        .options(
            selectinload(TestRun.step_results).selectinload(StepResult.heal_attempts),
            selectinload(TestRun.step_results).selectinload(StepResult.artifacts),
            selectinload(TestRun.artifacts),
        )
        .where(TestRun.project_id == project_id, Project.owner_id == current_user.id)
        .order_by(desc(TestRun.created_at))
        .limit(limit).offset(offset)
    )
    return [TestRunOut.model_validate(r) for r in result.scalars().all()]


@router.post("", response_model=TestRunOut, status_code=201)
async def create_run(
    data: TestRunCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    proj = await db.execute(
        select(Project).where(Project.id == data.project_id, Project.owner_id == current_user.id)
    )
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify plan is approved if provided
    if data.test_plan_id:
        plan_result = await db.execute(
            select(TestPlan).where(TestPlan.id == data.test_plan_id, TestPlan.project_id == data.project_id)
        )
        plan = plan_result.scalar_one_or_none()
        if not plan:
            raise HTTPException(status_code=404, detail="Test plan not found")

    run = TestRun(
        project_id=data.project_id,
        test_plan_id=data.test_plan_id,
        generated_test_id=data.generated_test_id,
        browser=data.browser,
        viewport_width=data.viewport_width,
        viewport_height=data.viewport_height,
        status=RunStatus.QUEUED,
    )
    db.add(run)
    await db.flush()

    run_id = run.id

    # Dispatch Celery task in background (falls back to direct execution if Redis unavailable)
    def _dispatch():
        try:
            from app.workers.tasks import run_test_plan
            run_test_plan.delay(run_id)
        except Exception as exc:
            import structlog
            _log = structlog.get_logger()
            _log.warning("test_runs.celery_unavailable_running_direct", run_id=run_id, error=str(exc))
            # Fallback: run directly in a thread
            try:
                import threading
                from app.workers.tasks import _run_async, _execute_run
                def _run_in_thread():
                    try:
                        _run_async(_execute_run(run_id, "direct"))
                    except Exception as e2:
                        _log.error("test_runs.direct_run_failed", run_id=run_id, error=str(e2))
                t = threading.Thread(target=_run_in_thread, daemon=True)
                t.start()
            except Exception as e2:
                _log.error("test_runs.dispatch_failed", run_id=run_id, error=str(e2))

    background_tasks.add_task(_dispatch)

    result = await db.execute(
        select(TestRun)
        .options(
            selectinload(TestRun.step_results).selectinload(StepResult.heal_attempts),
            selectinload(TestRun.step_results).selectinload(StepResult.artifacts),
            selectinload(TestRun.artifacts),
        )
        .where(TestRun.id == run_id)
    )
    return TestRunOut.model_validate(result.scalar_one())


@router.get("/{run_id}", response_model=TestRunOut)
async def get_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return TestRunOut.model_validate(await _get_run_or_404(run_id, current_user, db))


@router.post("/{run_id}/cancel", response_model=TestRunOut)
async def cancel_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = await _get_run_or_404(run_id, current_user, db)
    if run.status not in (RunStatus.QUEUED, RunStatus.RUNNING):
        raise HTTPException(status_code=400, detail="Run cannot be cancelled in its current state")

    run.status = RunStatus.CANCELLED
    from datetime import datetime, timezone
    run.finished_at = datetime.now(timezone.utc)
    await db.flush()

    # Revoke Celery task if known
    if run.celery_task_id:
        try:
            from app.workers.celery_app import celery_app
            celery_app.control.revoke(run.celery_task_id, terminate=True)
        except Exception:
            pass

    return TestRunOut.model_validate(run)
