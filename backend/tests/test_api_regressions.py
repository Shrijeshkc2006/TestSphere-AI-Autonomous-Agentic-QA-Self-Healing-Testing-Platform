import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.database import get_db, Base
from app.auth import get_password_hash, create_access_token
from app.models import User, Project, TestPlan, TestStep, TestRun, StepResult, Artifact, RunStatus, StepStatus, ArtifactKind
from app.services.ai_service import _demo_plan, generate_test_plan


@pytest.fixture
async def test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def client(test_db):
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_user(test_db):
    user = User(
        email="test_qa@example.com",
        username="test_qa",
        hashed_password=get_password_hash("password123"),
        is_active=True,
    )
    test_db.add(user)
    await test_db.flush()
    token = create_access_token({"sub": str(user.id)})
    return user, token


@pytest.mark.asyncio
async def test_demo_plan_smoke_test_generation():
    """Verify demo-mode smoke test produces the 3 required steps against target_url."""
    plan = await generate_test_plan(
        requirements="Run smoke test",
        target_url="https://example.com",
    )
    assert len(plan.steps) == 3

    # Step 1: Navigate to actual target_url
    assert plan.steps[0].action_type == "navigate"
    assert plan.steps[0].value == "https://example.com"

    # Step 2: Assert body visible (not generic heading assertion)
    assert plan.steps[1].action_type == "assert_visible"
    assert plan.steps[1].selector == "body"

    # Step 3: Screenshot
    assert plan.steps[2].action_type == "screenshot"

    # Assumptions and warnings exist
    assert any("demo" in a.lower() for a in plan.assumptions)
    assert any("GOOGLE_API_KEY" in w for w in plan.warnings)


@pytest.mark.asyncio
async def test_list_runs_eager_loading_no_500(client, test_db, auth_user):
    """Verify GET /api/test-runs/project/{project_id} serializes step_results and artifacts without HTTP 500."""
    user, token = auth_user
    headers = {"Authorization": f"Bearer {token}"}

    project = Project(
        owner_id=user.id,
        name="Example Project",
        project_type="url",
        target_url="https://example.com",
    )
    test_db.add(project)
    await test_db.flush()

    plan = TestPlan(
        project_id=project.id,
        name="Smoke Plan",
        status="APPROVED",
    )
    test_db.add(plan)
    await test_db.flush()

    run = TestRun(
        project_id=project.id,
        test_plan_id=plan.id,
        status=RunStatus.PASSED,
        total_steps=3,
        passed_steps=3,
        failed_steps=0,
    )
    test_db.add(run)
    await test_db.flush()

    step = StepResult(
        run_id=run.id,
        order=1,
        title="Navigate to application",
        status=StepStatus.PASSED,
    )
    test_db.add(step)
    await test_db.flush()

    art = Artifact(
        run_id=run.id,
        kind=ArtifactKind.SCREENSHOT,
        filename="step-3.png",
        stored_path="artifacts/test.png",
        file_size=1024,
        mime_type="image/png",
    )
    test_db.add(art)
    await test_db.commit()

    # Query project test runs
    response = await client.get(f"/api/test-runs/project/{project.id}", headers=headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == run.id
    assert len(data[0]["step_results"]) == 1
    assert data[0]["step_results"][0]["title"] == "Navigate to application"
    assert len(data[0]["artifacts"]) == 1


@pytest.mark.asyncio
async def test_dashboard_eager_loading_no_500(client, test_db, auth_user):
    """Verify GET /api/projects/dashboard serializes recent_runs without HTTP 500."""
    user, token = auth_user
    headers = {"Authorization": f"Bearer {token}"}

    project = Project(
        owner_id=user.id,
        name="Example Project 2",
        project_type="url",
        target_url="https://example.com",
    )
    test_db.add(project)
    await test_db.flush()

    run = TestRun(
        project_id=project.id,
        status=RunStatus.PASSED,
        total_steps=1,
        passed_steps=1,
        failed_steps=0,
    )
    test_db.add(run)
    await test_db.flush()

    step = StepResult(
        run_id=run.id,
        order=1,
        title="Check body",
        status=StepStatus.PASSED,
    )
    test_db.add(step)
    await test_db.commit()

    response = await client.get("/api/projects/dashboard", headers=headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert data["total_projects"] >= 1
    assert data["total_runs"] >= 1
    assert len(data["recent_runs"]) >= 1
    assert data["recent_runs"][0]["id"] == run.id
