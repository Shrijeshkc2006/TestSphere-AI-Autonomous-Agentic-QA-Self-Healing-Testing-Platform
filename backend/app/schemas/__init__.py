"""Pydantic schemas for TestSphere API."""
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
import re


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[Any]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9_-]+$')
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    project_type: str  # url | local_url | zip_upload
    target_url: Optional[str] = None
    upload_id: Optional[str] = None
    framework: Optional[str] = None
    package_manager: Optional[str] = None
    build_command: Optional[str] = None
    start_command: Optional[str] = None
    health_check_url: Optional[str] = None
    app_port: Optional[int] = None

    @field_validator("target_url")
    @classmethod
    def validate_url(cls, v):
        if v and not re.match(r'^https?://', v):
            raise ValueError("target_url must start with http:// or https://")
        return v


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    target_url: Optional[str] = None
    framework: Optional[str] = None
    package_manager: Optional[str] = None
    build_command: Optional[str] = None
    start_command: Optional[str] = None
    health_check_url: Optional[str] = None
    app_port: Optional[int] = None


class ProjectOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    project_type: str
    status: str
    target_url: Optional[str]
    upload_id: Optional[str]
    framework: Optional[str]
    package_manager: Optional[str]
    build_command: Optional[str]
    start_command: Optional[str]
    health_check_url: Optional[str]
    app_port: Optional[int]
    created_at: datetime
    updated_at: datetime
    # Computed stats (populated from joins)
    total_runs: Optional[int] = 0
    last_run_status: Optional[str] = None
    last_run_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

class UploadOut(BaseModel):
    id: str
    original_filename: str
    file_size: int
    framework: Optional[str]
    package_manager: Optional[str]
    detected_scripts: Optional[Dict[str, str]]
    file_tree_summary: Optional[dict]
    validation_status: str
    validation_errors: Optional[List[str]]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# TestPlan
# ---------------------------------------------------------------------------

class TestStepCreate(BaseModel):
    order: int
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    action_type: str
    selector: Optional[str] = None
    value: Optional[str] = None
    assertion: Optional[str] = None
    timeout_ms: int = 30000
    retry_count: int = 2
    is_sensitive: bool = False


class TestStepOut(BaseModel):
    id: str
    order: int
    title: str
    description: Optional[str]
    action_type: str
    selector: Optional[str]
    value: Optional[str]
    assertion: Optional[str]
    timeout_ms: int
    retry_count: int
    is_sensitive: bool

    model_config = {"from_attributes": True}


class TestPlanCreate(BaseModel):
    project_id: str
    name: str = Field(..., min_length=1, max_length=255)
    requirements: Optional[str] = None
    steps: Optional[List[TestStepCreate]] = None


class TestPlanGenerateRequest(BaseModel):
    project_id: str
    requirements: str = Field(..., min_length=10)
    name: Optional[str] = None


class TestPlanOut(BaseModel):
    id: str
    project_id: str
    name: str
    requirements: Optional[str]
    status: str
    ai_assumptions: Optional[List[str]]
    ai_warnings: Optional[List[str]]
    version: int
    created_at: datetime
    updated_at: datetime
    steps: List[TestStepOut] = []

    model_config = {"from_attributes": True}


class GeneratedTestOut(BaseModel):
    id: str
    plan_id: str
    filename: str
    content: str
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# TestRun
# ---------------------------------------------------------------------------

class TestRunCreate(BaseModel):
    project_id: str
    test_plan_id: Optional[str] = None
    generated_test_id: Optional[str] = None
    browser: str = "chromium"
    viewport_width: int = 1280
    viewport_height: int = 720


class HealAttemptOut(BaseModel):
    id: str
    original_selector: str
    proposed_selector: str
    strategy: str
    confidence: float
    validation_passed: bool
    heal_status: str
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ArtifactOut(BaseModel):
    id: str
    run_id: str
    step_result_id: Optional[str]
    kind: str
    filename: str
    file_size: int
    mime_type: str
    is_on_failure: bool
    created_at: datetime
    download_url: Optional[str] = None

    model_config = {"from_attributes": True}


class StepResultOut(BaseModel):
    id: str
    order: int
    title: str
    status: str
    failure_kind: Optional[str]
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    duration_ms: Optional[int]
    logs: Optional[List[Any]]
    error_message: Optional[str]
    stack_trace: Optional[str]
    console_errors: Optional[List[Any]]
    failed_network_requests: Optional[List[Any]]
    original_selector: Optional[str]
    ai_explanation: Optional[str]
    retry_count: int
    heal_attempts: List[HealAttemptOut] = []
    artifacts: List[ArtifactOut] = []

    model_config = {"from_attributes": True}


class TestRunOut(BaseModel):
    id: str
    project_id: str
    test_plan_id: Optional[str]
    status: str
    browser: str
    viewport_width: int
    viewport_height: int
    total_steps: int
    passed_steps: int
    failed_steps: int
    healed_steps: int
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    duration_ms: Optional[int]
    error_message: Optional[str]
    created_at: datetime
    step_results: List[StepResultOut] = []
    artifacts: List[ArtifactOut] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class DashboardStats(BaseModel):
    total_projects: int
    total_runs: int
    total_passed: int
    total_failed: int
    pass_rate: float
    avg_duration_ms: Optional[float]
    healed_steps: int
    recent_runs: List[TestRunOut] = []
