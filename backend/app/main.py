"""TestSphere FastAPI application factory."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.config import settings
from app.database import engine, Base
from app.api import projects, test_plans, test_runs, uploads, artifacts, ws, auth

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    log.info("testsphere.startup", env=settings.APP_ENV, db_type="sqlite" if settings.IS_SQLITE else "postgresql")
    # Tables are created via Alembic migrations in production.
    # For development convenience, we create them here if they don't exist.
    if settings.APP_ENV == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    yield
    log.info("testsphere.shutdown")
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="TestSphere API",
        version="1.0.0",
        description="AI-assisted web testing & self-healing platform",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS_LIST,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
    app.include_router(test_plans.router, prefix="/api/test-plans", tags=["test-plans"])
    app.include_router(test_runs.router, prefix="/api/test-runs", tags=["test-runs"])
    app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])
    app.include_router(artifacts.router, prefix="/api/artifacts", tags=["artifacts"])
    app.include_router(ws.router, prefix="/ws", tags=["websocket"])

    @app.get("/api/health")
    async def health():
        return {
            "status": "ok",
            "version": "1.0.0",
            "db_type": "sqlite" if settings.IS_SQLITE else "postgresql",
            "ai_available": settings.AI_AVAILABLE,
        }

    return app


app = create_app()
