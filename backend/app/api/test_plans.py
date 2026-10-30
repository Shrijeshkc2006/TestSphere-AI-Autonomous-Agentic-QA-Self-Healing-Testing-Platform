"""Test plans router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Project, TestPlan, TestStep, GeneratedTest, TestPlanStatus
from app.schemas import (
    TestPlanCreate, TestPlanOut, TestPlanGenerateRequest,
    TestStepCreate, TestStepOut, GeneratedTestOut,
)
from app.auth import get_current_user
from app.services.ai_service import generate_test_plan
from app.services.test_generator import generate_playwright_test

router = APIRouter()


async def _get_plan_or_404(plan_id: str, user: User, db: AsyncSession) -> TestPlan:
    result = await db.execute(
        select(TestPlan)
        .join(Project)
        .options(selectinload(TestPlan.steps))
        .where(TestPlan.id == plan_id, Project.owner_id == user.id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Test plan not found")
    return plan


@router.get("/project/{project_id}", response_model=list[TestPlanOut])
async def list_plans(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TestPlan)
        .join(Project)
        .options(selectinload(TestPlan.steps))
        .where(TestPlan.project_id == project_id, Project.owner_id == current_user.id)
    )
    return [TestPlanOut.model_validate(p) for p in result.scalars().all()]


@router.post("", response_model=TestPlanOut, status_code=201)
async def create_plan(
    data: TestPlanCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify project ownership
    proj = await db.execute(
        select(Project).where(Project.id == data.project_id, Project.owner_id == current_user.id)
    )
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    plan = TestPlan(
        project_id=data.project_id,
        name=data.name,
        requirements=data.requirements,
        status=TestPlanStatus.DRAFT,
    )
    db.add(plan)
    await db.flush()

    if data.steps:
        for step_data in data.steps:
            step = TestStep(plan_id=plan.id, **step_data.model_dump())
            db.add(step)

    await db.flush()

    result = await db.execute(
        select(TestPlan).options(selectinload(TestPlan.steps)).where(TestPlan.id == plan.id)
    )
    return TestPlanOut.model_validate(result.scalar_one())


@router.post("/generate", response_model=TestPlanOut, status_code=201)
async def generate_plan(
    data: TestPlanGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a test plan from natural-language requirements using AI."""
    proj_result = await db.execute(
        select(Project).where(Project.id == data.project_id, Project.owner_id == current_user.id)
    )
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        ai_plan = await generate_test_plan(
            requirements=data.requirements,
            target_url=project.target_url,
            framework=project.framework,
            plan_name=data.name,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}")

    plan = TestPlan(
        project_id=data.project_id,
        name=ai_plan.name,
        requirements=data.requirements,
        status=TestPlanStatus.PENDING_REVIEW,
        ai_assumptions=ai_plan.assumptions,
        ai_warnings=ai_plan.warnings,
    )
    db.add(plan)
    await db.flush()

    for step_data in ai_plan.steps:
        step = TestStep(
            plan_id=plan.id,
            order=step_data.order,
            title=step_data.title,
            description=step_data.description,
            action_type=step_data.action_type,
            selector=step_data.selector,
            value=step_data.value,
            assertion=step_data.assertion,
            timeout_ms=step_data.timeout_ms,
            retry_count=step_data.retry_count,
            is_sensitive=step_data.is_sensitive,
        )
        db.add(step)

    await db.flush()

    result = await db.execute(
        select(TestPlan).options(selectinload(TestPlan.steps)).where(TestPlan.id == plan.id)
    )
    return TestPlanOut.model_validate(result.scalar_one())


@router.get("/{plan_id}", response_model=TestPlanOut)
async def get_plan(
    plan_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return TestPlanOut.model_validate(await _get_plan_or_404(plan_id, current_user, db))


@router.patch("/{plan_id}/approve", response_model=TestPlanOut)
async def approve_plan(
    plan_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_plan_or_404(plan_id, current_user, db)
    plan.status = TestPlanStatus.APPROVED
    await db.flush()
    return TestPlanOut.model_validate(plan)


@router.patch("/{plan_id}/steps/{step_id}", response_model=TestStepOut)
async def update_step(
    plan_id: str,
    step_id: str,
    data: TestStepCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_plan_or_404(plan_id, current_user, db)
    step = next((s for s in plan.steps if s.id == step_id), None)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(step, field, value)
    await db.flush()
    return TestStepOut.model_validate(step)


@router.post("/{plan_id}/generate-code", response_model=GeneratedTestOut, status_code=201)
async def generate_code(
    plan_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate Playwright test code from the approved test plan."""
    plan = await _get_plan_or_404(plan_id, current_user, db)

    step_dicts = [
        {
            "order": s.order, "title": s.title, "description": s.description,
            "action_type": s.action_type, "selector": s.selector,
            "value": s.value, "assertion": s.assertion,
            "timeout_ms": s.timeout_ms, "retry_count": s.retry_count,
            "is_sensitive": s.is_sensitive,
        }
        for s in plan.steps
    ]

    code = generate_playwright_test(plan_name=plan.name, steps=step_dicts)
    filename = f"{plan.name.lower().replace(' ', '_')}_v{plan.version + 1}.spec.js"

    gen = GeneratedTest(
        plan_id=plan_id,
        filename=filename,
        content=code,
        version=plan.version + 1,
    )
    db.add(gen)
    plan.version += 1
    plan.status = TestPlanStatus.GENERATING
    await db.flush()
    return GeneratedTestOut.model_validate(gen)


@router.delete("/{plan_id}", status_code=204)
async def delete_plan(
    plan_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_plan_or_404(plan_id, current_user, db)
    await db.delete(plan)
