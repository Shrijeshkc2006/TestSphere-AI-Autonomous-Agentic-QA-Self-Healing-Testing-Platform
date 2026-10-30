"""SQLAlchemy ORM models for TestSphere."""
import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import Optional, List

from sqlalchemy import (
    String, Text, Integer, Float, Boolean, DateTime,
    ForeignKey, Enum, JSON, BigInteger, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ProjectType(str, PyEnum):
    URL = "url"
    LOCAL_URL = "local_url"
    ZIP_UPLOAD = "zip_upload"


class ProjectStatus(str, PyEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class TestPlanStatus(str, PyEnum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    GENERATING = "generating"


class RunStatus(str, PyEnum):
    QUEUED = "queued"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"
    CANCELLED = "cancelled"


class StepStatus(str, PyEnum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    HEALED = "healed"


class FailureKind(str, PyEnum):
    LOCATOR = "locator"
    ASSERTION = "assertion"
    NETWORK = "network"
    TIMEOUT = "timeout"
    APP_ERROR = "app_error"
    ENVIRONMENT = "environment"
    AI_GENERATION = "ai_generation"


class HealStatus(str, PyEnum):
    ATTEMPTED = "attempted"
    VALIDATED = "validated"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    projects: Mapped[List["Project"]] = relationship("Project", back_populates="owner")


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    project_type: Mapped[ProjectType] = mapped_column(Enum(ProjectType), nullable=False)
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.ACTIVE)

    # For URL / local URL projects
    target_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)

    # For ZIP upload projects
    upload_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("uploads.id"), nullable=True)

    # Framework detection (populated after upload or inspection)
    framework: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    package_manager: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    build_command: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    start_command: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    health_check_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    app_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Auth / environment config (redacted in API responses)
    env_vars: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # encrypted at rest ideally

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    owner: Mapped["User"] = relationship("User", back_populates="projects")
    upload: Mapped[Optional["Upload"]] = relationship("Upload", back_populates="project")
    test_plans: Mapped[List["TestPlan"]] = relationship("TestPlan", back_populates="project")
    test_runs: Mapped[List["TestRun"]] = relationship("TestRun", back_populates="project")


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256

    # Detection results
    framework: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    package_manager: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    detected_scripts: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    file_tree_summary: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    validation_status: Mapped[str] = mapped_column(String(50), default="pending")
    validation_errors: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Optional["Project"]] = relationship("Project", back_populates="upload")


# ---------------------------------------------------------------------------
# TestPlan
# ---------------------------------------------------------------------------

class TestPlan(Base):
    __tablename__ = "test_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # natural language input
    status: Mapped[TestPlanStatus] = mapped_column(Enum(TestPlanStatus), default=TestPlanStatus.DRAFT)
    ai_assumptions: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    ai_warnings: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="test_plans")
    steps: Mapped[List["TestStep"]] = relationship("TestStep", back_populates="plan", cascade="all, delete-orphan", order_by="TestStep.order")
    generated_tests: Mapped[List["GeneratedTest"]] = relationship("GeneratedTest", back_populates="plan")
    test_runs: Mapped[List["TestRun"]] = relationship("TestRun", back_populates="test_plan")


class TestStep(Base):
    __tablename__ = "test_steps_plan"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    plan_id: Mapped[str] = mapped_column(String(36), ForeignKey("test_plans.id"), nullable=False, index=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)  # navigate, click, fill, assert, etc.
    selector: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assertion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timeout_ms: Mapped[int] = mapped_column(Integer, default=30000)
    retry_count: Mapped[int] = mapped_column(Integer, default=2)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)  # hides value in logs

    plan: Mapped["TestPlan"] = relationship("TestPlan", back_populates="steps")


# ---------------------------------------------------------------------------
# GeneratedTest
# ---------------------------------------------------------------------------

class GeneratedTest(Base):
    __tablename__ = "generated_tests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    plan_id: Mapped[str] = mapped_column(String(36), ForeignKey("test_plans.id"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # Playwright JS/TS source
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    plan: Mapped["TestPlan"] = relationship("TestPlan", back_populates="generated_tests")


# ---------------------------------------------------------------------------
# TestRun
# ---------------------------------------------------------------------------

class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    test_plan_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("test_plans.id"), nullable=True)
    generated_test_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("generated_tests.id"), nullable=True)

    status: Mapped[RunStatus] = mapped_column(Enum(RunStatus), default=RunStatus.QUEUED, index=True)
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    browser: Mapped[str] = mapped_column(String(50), default="chromium")
    viewport_width: Mapped[int] = mapped_column(Integer, default=1280)
    viewport_height: Mapped[int] = mapped_column(Integer, default=720)

    total_steps: Mapped[int] = mapped_column(Integer, default=0)
    passed_steps: Mapped[int] = mapped_column(Integer, default=0)
    failed_steps: Mapped[int] = mapped_column(Integer, default=0)
    healed_steps: Mapped[int] = mapped_column(Integer, default=0)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="test_runs")
    test_plan: Mapped[Optional["TestPlan"]] = relationship("TestPlan", back_populates="test_runs")
    step_results: Mapped[List["StepResult"]] = relationship("StepResult", back_populates="run", cascade="all, delete-orphan", order_by="StepResult.order")
    artifacts: Mapped[List["Artifact"]] = relationship("Artifact", back_populates="run")


# ---------------------------------------------------------------------------
# StepResult
# ---------------------------------------------------------------------------

class StepResult(Base):
    __tablename__ = "step_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("test_runs.id"), nullable=False, index=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[StepStatus] = mapped_column(Enum(StepStatus), default=StepStatus.PENDING)
    failure_kind: Mapped[Optional[FailureKind]] = mapped_column(Enum(FailureKind), nullable=True)

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    logs: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stack_trace: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    console_errors: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    failed_network_requests: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    original_selector: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    ai_explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    retry_count: Mapped[int] = mapped_column(Integer, default=0)

    run: Mapped["TestRun"] = relationship("TestRun", back_populates="step_results")
    heal_attempts: Mapped[List["HealAttempt"]] = relationship("HealAttempt", back_populates="step_result", cascade="all, delete-orphan")
    artifacts: Mapped[List["Artifact"]] = relationship("Artifact", back_populates="step_result")


# ---------------------------------------------------------------------------
# HealAttempt
# ---------------------------------------------------------------------------

class HealAttempt(Base):
    __tablename__ = "heal_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    step_result_id: Mapped[str] = mapped_column(String(36), ForeignKey("step_results.id"), nullable=False, index=True)
    original_selector: Mapped[str] = mapped_column(String(1024), nullable=False)
    proposed_selector: Mapped[str] = mapped_column(String(1024), nullable=False)
    strategy: Mapped[str] = mapped_column(String(100), nullable=False)  # role, label, text, attribute, semantic
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    validation_passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    heal_status: Mapped[HealStatus] = mapped_column(Enum(HealStatus), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    step_result: Mapped["StepResult"] = relationship("StepResult", back_populates="heal_attempts")


# ---------------------------------------------------------------------------
# Artifact
# ---------------------------------------------------------------------------

class ArtifactKind(str, PyEnum):
    SCREENSHOT = "screenshot"
    VIDEO = "video"
    TRACE = "trace"
    REPORT_HTML = "report_html"
    REPORT_JUNIT = "report_junit"
    REPORT_JSON = "report_json"
    DOM_SNAPSHOT = "dom_snapshot"


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("test_runs.id"), nullable=False, index=True)
    step_result_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("step_results.id"), nullable=True)
    kind: Mapped[ArtifactKind] = mapped_column(Enum(ArtifactKind), nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, default=0)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    is_on_failure: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    run: Mapped["TestRun"] = relationship("TestRun", back_populates="artifacts")
    step_result: Mapped[Optional["StepResult"]] = relationship("StepResult", back_populates="artifacts")
