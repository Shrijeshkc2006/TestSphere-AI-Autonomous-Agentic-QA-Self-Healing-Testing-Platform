"""
Celery background tasks for TestSphere.

Main task: run_test_plan
- Loads the test run and plan from the database
- Generates Playwright test code
- Executes each step via the async execution service
- Updates step results and overall run status in real time
- Broadcasts progress over WebSockets via Redis pub/sub
- Generates reports and saves artifacts on completion
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

import structlog
from celery import Task

from app.workers.celery_app import celery_app
from app.config import settings

log = structlog.get_logger()


# ---------------------------------------------------------------------------
# Helper: run async code in a Celery (sync) task
# ---------------------------------------------------------------------------

def _run_async(coro):
    """Run an async coroutine in a new event loop (for Celery tasks)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# WebSocket broadcast helper (via Redis pub/sub)
# ---------------------------------------------------------------------------

async def _broadcast(run_id: str, event: dict):
    """Publish a run status event to Redis for WebSocket consumers."""
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await r.publish(f"run:{run_id}", json.dumps(event, default=str))
        await r.aclose()
    except Exception as exc:
        log.warning("tasks.broadcast_failed", run_id=run_id, error=str(exc))


# ---------------------------------------------------------------------------
# Runner environment helpers
# ---------------------------------------------------------------------------

def _resolve_playwright_runner() -> tuple[str, str, str]:
    """
    Locates Node.js executable, @playwright/test CLI script, and node_modules directory.
    Returns (node_exe, cli_path, node_modules_dir).
    Raises RuntimeError with clear actionable instructions if any component is missing.
    """
    import os
    import shutil
    from pathlib import Path

    node_exe = shutil.which("node")
    if not node_exe:
        raise RuntimeError(
            "Node.js executable was not found in system PATH. "
            "Please ensure Node.js (v18+) is installed and accessible."
        )

    # Search for @playwright/test in candidate node_modules roots
    current_file = Path(__file__).resolve()
    backend_root = current_file.parent.parent.parent  # app/workers/tasks.py -> backend
    repo_root = backend_root.parent

    candidate_roots = [
        backend_root / "node_modules",
        repo_root / "node_modules",
        repo_root / "frontend" / "node_modules",
    ]

    env_node_path = os.environ.get("NODE_PATH")
    if env_node_path:
        for p in env_node_path.split(os.pathsep):
            if p.strip():
                candidate_roots.append(Path(p.strip()))

    for cand in candidate_roots:
        cli_cand = cand / "@playwright" / "test" / "cli.js"
        if cli_cand.exists() and cli_cand.is_file():
            return (node_exe, str(cli_cand), str(cand))

    raise RuntimeError(
        "Playwright test runner dependency '@playwright/test' was not found. "
        "Please run 'npm install' in the backend directory."
    )


def _check_playwright_browsers(browser_name: str = "chromium") -> bool:
    """Check if Playwright browser binaries appear to be installed."""
    import os
    from pathlib import Path

    custom_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if custom_path and custom_path != "0":
        search_dirs = [Path(custom_path)]
    else:
        search_dirs = []
        if os.name == "nt":
            local_app_data = os.environ.get("LOCALAPPDATA")
            if local_app_data:
                search_dirs.append(Path(local_app_data) / "ms-playwright")
        else:
            home = Path.home()
            search_dirs.append(home / ".cache" / "ms-playwright")
            search_dirs.append(home / "Library" / "Caches" / "ms-playwright")

    prefix = (browser_name or "chromium").lower().split("-")[0]
    for base in search_dirs:
        if base.exists() and base.is_dir():
            matches = list(base.glob(f"{prefix}-*"))
            if matches:
                return True
    return False


# ---------------------------------------------------------------------------
# Main execution logic
# ---------------------------------------------------------------------------

async def _execute_run(run_id: str, task_id: str):
    """Core async logic for executing a test run."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.database import AsyncSessionLocal
    from app.models import TestRun, TestPlan, TestStep, StepResult, Artifact, RunStatus, StepStatus, FailureKind, HealAttempt, HealStatus, ArtifactKind
    from app.services.test_generator import generate_playwright_test
    from app.services.self_heal_service import propose_healing
    from app.services.ai_service import explain_failure, suggest_alternative_selectors
    from app.services.report_service import save_reports
    from app.schemas import TestRunOut
    import os, tempfile, subprocess, shutil

    async with AsyncSessionLocal() as db:
        # Load run with plan and steps
        result = await db.execute(
            select(TestRun)
            .options(
                selectinload(TestRun.test_plan).selectinload(TestPlan.steps),
                selectinload(TestRun.project),
            )
            .where(TestRun.id == run_id)
        )
        run = result.scalar_one_or_none()
        if not run:
            log.error("tasks.run_not_found", run_id=run_id)
            return

        # Check runner dependencies before proceeding
        try:
            node_exe, cli_path, node_modules_dir = _resolve_playwright_runner()
        except RuntimeError as exc:
            run.status = RunStatus.ERROR
            run.error_message = str(exc)
            run.finished_at = datetime.now(timezone.utc)
            await db.commit()
            await _broadcast(run_id, {"type": "run.error", "run_id": run_id, "error": run.error_message})
            return

        browser_to_run = run.browser or settings.PLAYWRIGHT_BROWSER or "chromium"
        if not _check_playwright_browsers(browser_to_run):
            log.warning("tasks.browser_not_detected_in_cache", browser=browser_to_run)

        # Mark as running
        run.status = RunStatus.RUNNING
        run.started_at = datetime.now(timezone.utc)
        run.celery_task_id = task_id
        await db.commit()

        await _broadcast(run_id, {"type": "run.started", "run_id": run_id, "status": "running"})

        plan = run.test_plan
        if not plan:
            run.status = RunStatus.ERROR
            run.error_message = "No test plan attached to this run"
            run.finished_at = datetime.now(timezone.utc)
            await db.commit()
            await _broadcast(run_id, {"type": "run.error", "run_id": run_id, "error": run.error_message})
            return

        steps = sorted(plan.steps, key=lambda s: s.order)
        run.total_steps = len(steps)
        await db.commit()

        target_url = run.project.target_url or "http://localhost:3000"

        # ── Generate Playwright test code ──────────────────────────────────
        step_dicts = [
            {
                "order": s.order,
                "title": s.title,
                "description": s.description,
                "action_type": s.action_type,
                "selector": s.selector,
                "value": (
                    run.project.target_url
                    if s.action_type == "navigate" and (
                        not s.value
                        or (run.project.target_url and s.value == "http://localhost:3000" and run.project.target_url != "http://localhost:3000")
                    )
                    else s.value
                ),
                "assertion": s.assertion,
                "timeout_ms": s.timeout_ms,
                "retry_count": s.retry_count,
                "is_sensitive": s.is_sensitive,
            }
            for s in steps
        ]

        try:
            test_code = generate_playwright_test(
                plan_name=plan.name,
                steps=step_dicts,
                total_timeout_ms=settings.TEST_TIMEOUT_SECONDS * 1000,
            )
        except Exception as exc:
            run.status = RunStatus.ERROR
            run.error_message = f"Test generation failed: {exc}"
            run.finished_at = datetime.now(timezone.utc)
            await db.commit()
            await _broadcast(run_id, {"type": "run.error", "run_id": run_id, "error": run.error_message})
            return

        # ── Create StepResult rows ─────────────────────────────────────────
        step_results = []
        for s in steps:
            sr = StepResult(
                run_id=run_id,
                order=s.order,
                title=s.title,
                status=StepStatus.PENDING,
            )
            db.add(sr)
            step_results.append(sr)
        await db.flush()
        await db.commit()

        # ── Execute steps via Playwright in subprocess ─────────────────────
        # We run Playwright in a sandboxed subprocess, not on the API server
        tmp_dir = tempfile.mkdtemp(prefix="ts_run_")
        artifact_run_dir = os.path.abspath(os.path.join(settings.ARTIFACT_DIR, run_id))
        os.makedirs(artifact_run_dir, exist_ok=True)
        screenshot_dir = os.path.join(artifact_run_dir, "screenshots")
        os.makedirs(screenshot_dir, exist_ok=True)

        try:
            test_file = os.path.join(tmp_dir, "test.spec.js")
            with open(test_file, "w", encoding="utf-8") as f:
                f.write(test_code)

            # Playwright config
            pw_config = os.path.join(tmp_dir, "playwright.config.js")
            with open(pw_config, "w", encoding="utf-8") as f:
                f.write(f"""
const {{ defineConfig }} = require('@playwright/test');
module.exports = defineConfig({{
  testDir: '.',
  timeout: {settings.TEST_TIMEOUT_SECONDS * 1000},
  use: {{
    baseURL: '{target_url}',
    screenshot: 'on',
    video: 'off',
    viewport: {{ width: {run.viewport_width}, height: {run.viewport_height} }},
    headless: true,
  }},
  reporter: [['json', {{ outputFile: 'results.json' }}]],
}});
""")

            # Build environment for runner subprocess
            proc_env = {
                **os.environ,
                "NODE_PATH": node_modules_dir,
                "CI": "1",
                "PLAYWRIGHT_JSON_OUTPUT_NAME": "results.json",
            }
            # Preserve PLAYWRIGHT_BROWSERS_PATH only if explicitly configured with valid path
            custom_browser_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
            if custom_browser_path and custom_browser_path != "0":
                proc_env["PLAYWRIGHT_BROWSERS_PATH"] = custom_browser_path
            elif "PLAYWRIGHT_BROWSERS_PATH" in proc_env and proc_env["PLAYWRIGHT_BROWSERS_PATH"] == "0":
                del proc_env["PLAYWRIGHT_BROWSERS_PATH"]

            proc = subprocess.run(
                [
                    node_exe,
                    cli_path,
                    "test",
                    "--config", "playwright.config.js",
                    "--output", screenshot_dir,
                    "test.spec.js",
                ],
                capture_output=True,
                text=True,
                cwd=tmp_dir,
                timeout=settings.TEST_TIMEOUT_SECONDS + 10,
                env=proc_env,
            )

            # Parse JSON results if available
            results_path = os.path.join(tmp_dir, "results.json")
            pw_results = None
            if os.path.exists(results_path):
                try:
                    with open(results_path, encoding="utf-8") as f:
                        pw_results = json.load(f)
                except Exception as json_err:
                    log.warning("tasks.json_report_parse_failed", error=str(json_err))
            elif proc.stdout and proc.stdout.strip().startswith("{"):
                try:
                    pw_results = json.loads(proc.stdout.strip())
                except Exception as json_err:
                    log.warning("tasks.stdout_json_parse_failed", error=str(json_err))

            from app.services.result_mapper import map_playwright_results

            summary = map_playwright_results(
                step_results=step_results,
                pw_results=pw_results,
                proc_returncode=proc.returncode,
                proc_stderr=proc.stderr or "",
                proc_stdout=proc.stdout or "",
                browser_name=browser_to_run,
            )

            for sr in step_results:
                await _broadcast(run_id, {
                    "type": "step.updated",
                    "run_id": run_id,
                    "step_order": sr.order,
                    "status": sr.status.value,
                    "title": sr.title,
                })

            # Final run status
            run.passed_steps = summary.passed_count
            run.failed_steps = summary.failed_count
            run.healed_steps = summary.healed_count
            run.status = summary.run_status
            if summary.error_message:
                run.error_message = summary.error_message

            run.finished_at = datetime.now(timezone.utc)
            if run.started_at and run.finished_at:
                run.duration_ms = int((run.finished_at - run.started_at).total_seconds() * 1000)

            await db.commit()

            # Copy any screenshots produced inside tmp_dir/screenshots to the persistent screenshot_dir
            tmp_screenshots = os.path.join(tmp_dir, "screenshots")
            if os.path.exists(tmp_screenshots):
                for img_file in os.listdir(tmp_screenshots):
                    if img_file.endswith(".png"):
                        src_path = os.path.join(tmp_screenshots, img_file)
                        dst_path = os.path.join(screenshot_dir, img_file)
                        try:
                            shutil.copy2(src_path, dst_path)
                        except Exception:
                            pass

            # Save screenshots as artifacts
            if os.path.exists(screenshot_dir):
                for img_file in os.listdir(screenshot_dir):
                    if img_file.endswith(".png"):
                        stored_img_path = os.path.abspath(os.path.join(screenshot_dir, img_file))
                        art = Artifact(
                            run_id=run_id,
                            kind=ArtifactKind.SCREENSHOT,
                            filename=img_file,
                            stored_path=stored_img_path,
                            file_size=os.path.getsize(stored_img_path),
                            mime_type="image/png",
                        )
                        db.add(art)

            # Generate reports
            run_dict = {
                "id": run_id,
                "status": run.status.value,
                "started_at": run.started_at,
                "duration_ms": run.duration_ms,
                "total_steps": run.total_steps,
                "passed_steps": run.passed_steps,
                "failed_steps": run.failed_steps,
                "healed_steps": run.healed_steps,
                "step_results": [
                    {
                        "order": sr.order,
                        "title": sr.title,
                        "status": sr.status.value,
                        "duration_ms": sr.duration_ms,
                        "error_message": sr.error_message,
                    }
                    for sr in step_results
                ],
            }

            report_paths = await save_reports(run_dict, os.path.abspath(settings.ARTIFACT_DIR), run_id)

            for kind_key, path in report_paths.items():
                kind_map = {"html": ArtifactKind.REPORT_HTML, "junit": ArtifactKind.REPORT_JUNIT, "json": ArtifactKind.REPORT_JSON}
                mime_map = {"html": "text/html", "junit": "application/xml", "json": "application/json"}
                if kind_key in kind_map and os.path.exists(path):
                    abs_report_path = os.path.abspath(path)
                    art = Artifact(
                        run_id=run_id,
                        kind=kind_map[kind_key],
                        filename=os.path.basename(abs_report_path),
                        stored_path=abs_report_path,
                        file_size=os.path.getsize(abs_report_path),
                        mime_type=mime_map[kind_key],
                    )
                    db.add(art)

            await db.commit()

        except subprocess.TimeoutExpired:
            timeout_msg = f"Test execution timed out after {settings.TEST_TIMEOUT_SECONDS}s"
            run.status = RunStatus.ERROR
            run.error_message = timeout_msg
            run.finished_at = datetime.now(timezone.utc)
            if run.started_at and run.finished_at:
                run.duration_ms = int((run.finished_at - run.started_at).total_seconds() * 1000)
            now = datetime.now(timezone.utc)
            first_pending = True
            for sr in step_results:
                if sr.status == StepStatus.PENDING:
                    if first_pending:
                        sr.status = StepStatus.FAILED
                        sr.error_message = timeout_msg
                        sr.failure_kind = FailureKind.TIMEOUT
                        sr.started_at = now
                        sr.finished_at = now
                        sr.duration_ms = 0
                        first_pending = False
                    else:
                        sr.status = StepStatus.SKIPPED
                        sr.error_message = None
            run.passed_steps = sum(1 for sr in step_results if sr.status == StepStatus.PASSED)
            run.failed_steps = sum(1 for sr in step_results if sr.status == StepStatus.FAILED)
            await db.commit()
        except Exception as exc:
            log.exception("tasks.run_failed", run_id=run_id, error=str(exc))
            run.status = RunStatus.ERROR
            run.error_message = str(exc)
            run.finished_at = datetime.now(timezone.utc)
            if run.started_at and run.finished_at:
                run.duration_ms = int((run.finished_at - run.started_at).total_seconds() * 1000)
            now = datetime.now(timezone.utc)
            first_pending = True
            for sr in step_results:
                if sr.status == StepStatus.PENDING:
                    if first_pending:
                        sr.status = StepStatus.FAILED
                        sr.error_message = str(exc)
                        sr.started_at = now
                        sr.finished_at = now
                        sr.duration_ms = 0
                        first_pending = False
                    else:
                        sr.status = StepStatus.SKIPPED
                        sr.error_message = None
            run.passed_steps = sum(1 for sr in step_results if sr.status == StepStatus.PASSED)
            run.failed_steps = sum(1 for sr in step_results if sr.status == StepStatus.FAILED)
            await db.commit()
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            await _broadcast(run_id, {
                "type": "run.finished",
                "run_id": run_id,
                "status": run.status.value,
                "passed": run.passed_steps,
                "failed": run.failed_steps,
                "duration_ms": run.duration_ms,
            })


# ---------------------------------------------------------------------------
# Celery task definition
# ---------------------------------------------------------------------------

@celery_app.task(bind=True, name="testsphere.run_test_plan")
def run_test_plan(self: Task, run_id: str) -> dict:
    """Execute a test run in the background."""
    log.info("tasks.run_test_plan.started", run_id=run_id, task_id=self.request.id)
    try:
        _run_async(_execute_run(run_id, self.request.id))
        return {"status": "completed", "run_id": run_id}
    except Exception as exc:
        log.exception("tasks.run_test_plan.error", run_id=run_id, error=str(exc))
        return {"status": "error", "run_id": run_id, "error": str(exc)}


@celery_app.task(name="testsphere.cancel_run")
def cancel_run(run_id: str) -> dict:
    """Mark a run as cancelled."""
    async def _cancel():
        from app.database import AsyncSessionLocal
        from app.models import TestRun, RunStatus, StepResult, StepStatus
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(TestRun).where(TestRun.id == run_id))
            run = result.scalar_one_or_none()
            if run and run.status in (RunStatus.QUEUED, RunStatus.RUNNING):
                run.status = RunStatus.CANCELLED
                run.finished_at = datetime.now(timezone.utc)
                await db.commit()
            await _broadcast(run_id, {"type": "run.cancelled", "run_id": run_id})

    _run_async(_cancel())
    return {"status": "cancelled", "run_id": run_id}
