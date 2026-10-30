"""
TestSphere — Phase 2 Regression Tests: Playwright Test-Step Result Mapping.

Covers:
- Scenario A: All steps pass -> Every step marked passed with duration.
- Scenario B: First step fails -> First step marked failed; subsequent steps skipped.
- Scenario C: Middle step fails -> Earlier steps passed, failing step failed, subsequent skipped.
- Scenario D: Final step fails -> Earlier steps passed, final step failed.
- Scenario E: Test interrupted or timed out -> Completed steps preserved, unfinished step failed, remaining skipped.
- Scenario F: JSON report missing or invalid -> Run fails safely with error, no unverified steps passed.
- Scenario G: Multiple steps with identical/similar titles -> Exact stable mapping without ambiguity.
- Scenario H: Zero steps and malformed generated code -> Handled safely without corrupted results.
- Real Playwright execution tests:
  - Real multi-step run with all passing steps.
  - Real multi-step run with middle step failing on missing locator.
"""
import os
import json
import tempfile
import shutil
import subprocess
from pathlib import Path
import pytest

from app.models import StepResult, StepStatus, RunStatus, FailureKind
from app.services.result_mapper import (
    map_playwright_results,
    extract_playwright_test_data,
    parse_step_title,
    classify_failure_kind,
    clean_ansi,
)
from app.services.test_generator import generate_playwright_test
from app.workers.tasks import _resolve_playwright_runner


def _create_mock_step_results(step_defs):
    """Helper to generate StepResult instances from (order, title) tuples."""
    results = []
    for order, title in step_defs:
        results.append(StepResult(
            id=f"step-id-{order}",
            run_id="test-run-123",
            order=order,
            title=title,
            status=StepStatus.PENDING,
        ))
    return results


def test_classify_failure_kind():
    """Verify error classification into FailureKind enums."""
    assert classify_failure_kind("Timeout 10000ms exceeded") == FailureKind.TIMEOUT
    assert classify_failure_kind("waiting for locator('#btn')") == FailureKind.LOCATOR
    assert classify_failure_kind("expect(locator).toBeVisible() failed") == FailureKind.ASSERTION
    assert classify_failure_kind("net::ERR_CONNECTION_REFUSED") == FailureKind.NETWORK
    assert classify_failure_kind("Some random script exception") == FailureKind.APP_ERROR


def test_parse_step_title():
    """Verify order extraction from formatted step titles."""
    order, title = parse_step_title("Step 1: Navigate to home")
    assert order == 1
    assert title == "Navigate to home"

    order, title = parse_step_title("[Step 42] Click button")
    assert order == 42
    assert title == "Click button"

    order, title = parse_step_title("Plain unformatted title")
    assert order is None
    assert title == "Plain unformatted title"


# ---------------------------------------------------------------------------
# Scenario A: All steps pass
# ---------------------------------------------------------------------------
def test_scenario_a_all_steps_pass():
    step_results = _create_mock_step_results([
        (1, "Navigate to login"),
        (2, "Enter credentials"),
        (3, "Click submit"),
    ])

    pw_results = {
        "suites": [{
            "specs": [{
                "tests": [{
                    "results": [{
                        "status": "passed",
                        "duration": 500,
                        "steps": [
                            {"title": "Step 1: Navigate to login", "duration": 150},
                            {"title": "Step 2: Enter credentials", "duration": 200},
                            {"title": "Step 3: Click submit", "duration": 150},
                        ],
                    }]
                }]
            }]
        }]
    }

    summary = map_playwright_results(step_results, pw_results, proc_returncode=0)

    assert summary.run_status == RunStatus.PASSED
    assert summary.passed_count == 3
    assert summary.failed_count == 0
    assert summary.error_message is None

    assert step_results[0].status == StepStatus.PASSED
    assert step_results[0].duration_ms == 150
    assert step_results[0].error_message is None

    assert step_results[1].status == StepStatus.PASSED
    assert step_results[1].duration_ms == 200

    assert step_results[2].status == StepStatus.PASSED
    assert step_results[2].duration_ms == 150


# ---------------------------------------------------------------------------
# Scenario B: First step fails
# ---------------------------------------------------------------------------
def test_scenario_b_first_step_fails():
    step_results = _create_mock_step_results([
        (1, "Navigate to target"),
        (2, "Click button"),
        (3, "Assert text"),
    ])

    pw_results = {
        "suites": [{
            "specs": [{
                "tests": [{
                    "results": [{
                        "status": "failed",
                        "duration": 120,
                        "steps": [
                            {
                                "title": "Step 1: Navigate to target",
                                "duration": 120,
                                "error": {
                                    "message": "\u001b[31mnet::ERR_CONNECTION_REFUSED\u001b[39m",
                                    "stack": "Error: net::ERR_CONNECTION_REFUSED\n at page.goto",
                                },
                            }
                        ],
                    }]
                }]
            }]
        }]
    }

    summary = map_playwright_results(step_results, pw_results, proc_returncode=1)

    assert summary.run_status == RunStatus.FAILED
    assert summary.passed_count == 0
    assert summary.failed_count == 1

    # First step is FAILED with clean error message
    assert step_results[0].status == StepStatus.FAILED
    assert step_results[0].duration_ms == 120
    assert step_results[0].error_message == "net::ERR_CONNECTION_REFUSED"
    assert step_results[0].failure_kind == FailureKind.NETWORK

    # Subsequent steps are SKIPPED
    assert step_results[1].status == StepStatus.SKIPPED
    assert step_results[1].error_message is None
    assert step_results[2].status == StepStatus.SKIPPED
    assert step_results[2].error_message is None


# ---------------------------------------------------------------------------
# Scenario C: Middle step fails
# ---------------------------------------------------------------------------
def test_scenario_c_middle_step_fails():
    step_results = _create_mock_step_results([
        (1, "Open app"),
        (2, "Click missing item"),
        (3, "Verify confirmation"),
        (4, "Take screenshot"),
    ])

    pw_results = {
        "suites": [{
            "specs": [{
                "tests": [{
                    "results": [{
                        "status": "failed",
                        "duration": 1100,
                        "steps": [
                            {"title": "Step 1: Open app", "duration": 80},
                            {
                                "title": "Step 2: Click missing item",
                                "duration": 1020,
                                "error": {
                                    "message": "Error: locator.click: Timeout 1000ms exceeded waiting for locator('#missing')",
                                    "stack": "Error: locator.click: Timeout 1000ms exceeded\n at click",
                                },
                            },
                        ],
                    }]
                }]
            }]
        }]
    }

    summary = map_playwright_results(step_results, pw_results, proc_returncode=1)

    assert summary.run_status == RunStatus.FAILED
    assert summary.passed_count == 1
    assert summary.failed_count == 1

    # Earlier step is PASSED
    assert step_results[0].status == StepStatus.PASSED
    assert step_results[0].duration_ms == 80
    assert step_results[0].error_message is None

    # Middle failing step is FAILED
    assert step_results[1].status == StepStatus.FAILED
    assert step_results[1].duration_ms == 1020
    assert "Timeout 1000ms exceeded" in step_results[1].error_message
    assert step_results[1].failure_kind in (FailureKind.TIMEOUT, FailureKind.LOCATOR)

    # Subsequent steps are SKIPPED
    assert step_results[2].status == StepStatus.SKIPPED
    assert step_results[2].error_message is None
    assert step_results[3].status == StepStatus.SKIPPED
    assert step_results[3].error_message is None


# ---------------------------------------------------------------------------
# Scenario D: Final step fails
# ---------------------------------------------------------------------------
def test_scenario_d_final_step_fails():
    step_results = _create_mock_step_results([
        (1, "Step One"),
        (2, "Step Two"),
        (3, "Step Three"),
    ])

    pw_results = {
        "suites": [{
            "specs": [{
                "tests": [{
                    "results": [{
                        "status": "failed",
                        "duration": 450,
                        "steps": [
                            {"title": "Step 1: Step One", "duration": 50},
                            {"title": "Step 2: Step Two", "duration": 100},
                            {
                                "title": "Step 3: Step Three",
                                "duration": 300,
                                "error": {
                                    "message": "expect(locator).toHaveText() failed",
                                    "stack": "at expect",
                                },
                            },
                        ],
                    }]
                }]
            }]
        }]
    }

    summary = map_playwright_results(step_results, pw_results, proc_returncode=1)

    assert summary.run_status == RunStatus.FAILED
    assert summary.passed_count == 2
    assert summary.failed_count == 1

    assert step_results[0].status == StepStatus.PASSED
    assert step_results[1].status == StepStatus.PASSED
    assert step_results[2].status == StepStatus.FAILED
    assert step_results[2].failure_kind == FailureKind.ASSERTION


# ---------------------------------------------------------------------------
# Scenario E: Test interrupted or timed out
# ---------------------------------------------------------------------------
def test_scenario_e_test_interrupted():
    step_results = _create_mock_step_results([
        (1, "Step One"),
        (2, "Step Two"),
        (3, "Step Three"),
    ])

    # Playwright timedOut while running step 2, step 3 never reached
    pw_results = {
        "suites": [{
            "specs": [{
                "tests": [{
                    "results": [{
                        "status": "timedOut",
                        "duration": 30000,
                        "error": {
                            "message": "Test timeout of 30000ms exceeded.",
                            "stack": "TimeoutError",
                        },
                        "steps": [
                            {"title": "Step 1: Step One", "duration": 120},
                        ],
                    }]
                }]
            }]
        }]
    }

    summary = map_playwright_results(step_results, pw_results, proc_returncode=1)

    assert summary.run_status == RunStatus.FAILED
    assert summary.passed_count == 1
    assert summary.failed_count == 1

    # Completed step 1 stays PASSED
    assert step_results[0].status == StepStatus.PASSED
    assert step_results[0].duration_ms == 120

    # Interrupted in-progress step 2 marked FAILED
    assert step_results[1].status == StepStatus.FAILED
    assert "timeout" in step_results[1].error_message.lower()
    assert step_results[1].failure_kind == FailureKind.TIMEOUT

    # Subsequent unreached step 3 marked SKIPPED
    assert step_results[2].status == StepStatus.SKIPPED
    assert step_results[2].error_message is None


# ---------------------------------------------------------------------------
# Scenario F: JSON report missing or invalid
# ---------------------------------------------------------------------------
def test_scenario_f_missing_or_invalid_report():
    step_results = _create_mock_step_results([
        (1, "Step 1"),
        (2, "Step 2"),
    ])

    summary = map_playwright_results(
        step_results,
        pw_results=None,
        proc_returncode=1,
        proc_stderr="FATAL: Node v8 memory allocation failed",
    )

    assert summary.run_status == RunStatus.ERROR
    assert summary.passed_count == 0
    assert summary.failed_count == 1
    assert "Node v8 memory allocation failed" in summary.error_message

    # No unverified steps marked passed
    assert step_results[0].status == StepStatus.FAILED
    assert "memory allocation failed" in step_results[0].error_message
    assert step_results[1].status == StepStatus.SKIPPED


# ---------------------------------------------------------------------------
# Scenario G: Similar / identical descriptions
# ---------------------------------------------------------------------------
def test_scenario_g_duplicate_descriptions():
    step_results = _create_mock_step_results([
        (1, "Click button"),
        (2, "Click button"),
        (3, "Click button"),
    ])

    pw_results = {
        "suites": [{
            "specs": [{
                "tests": [{
                    "results": [{
                        "status": "failed",
                        "duration": 500,
                        "steps": [
                            {"title": "Step 1: Click button", "duration": 50},
                            {"title": "Step 2: Click button", "duration": 60},
                            {
                                "title": "Step 3: Click button",
                                "duration": 390,
                                "error": {"message": "Element not visible"},
                            },
                        ],
                    }]
                }]
            }]
        }]
    }

    summary = map_playwright_results(step_results, pw_results, proc_returncode=1)

    assert summary.passed_count == 2
    assert summary.failed_count == 1
    assert step_results[0].status == StepStatus.PASSED
    assert step_results[0].duration_ms == 50
    assert step_results[1].status == StepStatus.PASSED
    assert step_results[1].duration_ms == 60
    assert step_results[2].status == StepStatus.FAILED
    assert step_results[2].duration_ms == 390


# ---------------------------------------------------------------------------
# Scenario H: Zero steps & malformed generated code
# ---------------------------------------------------------------------------
def test_scenario_h_zero_steps():
    step_results = []
    pw_results = {"suites": []}

    summary = map_playwright_results(step_results, pw_results, proc_returncode=0)
    assert summary.run_status == RunStatus.PASSED
    assert summary.passed_count == 0
    assert summary.failed_count == 0


def test_scenario_h_malformed_code():
    step_results = _create_mock_step_results([(1, "Bad code step")])
    summary = map_playwright_results(
        step_results,
        pw_results={},
        proc_returncode=1,
        proc_stderr="SyntaxError: Unexpected token ')'",
    )
    assert summary.run_status == RunStatus.ERROR
    assert "SyntaxError" in summary.error_message
    assert step_results[0].status == StepStatus.FAILED
    assert "SyntaxError" in step_results[0].error_message


# ---------------------------------------------------------------------------
# Failure before any step starts
# ---------------------------------------------------------------------------
def test_failure_before_steps_start():
    step_results = _create_mock_step_results([
        (1, "Step 1"),
        (2, "Step 2"),
    ])

    pw_results = {
        "suites": [{
            "specs": [{
                "tests": [{
                    "results": [{
                        "status": "failed",
                        "duration": 50,
                        "error": {"message": "Error: Browser context crashed before execution"},
                        "steps": [],
                    }]
                }]
            }]
        }]
    }

    summary = map_playwright_results(step_results, pw_results, proc_returncode=1)
    assert summary.run_status == RunStatus.FAILED
    assert summary.passed_count == 0
    assert summary.failed_count == 1
    assert step_results[0].status == StepStatus.FAILED
    assert "Browser context crashed" in step_results[0].error_message
    assert step_results[1].status == StepStatus.SKIPPED


# ---------------------------------------------------------------------------
# Real Controlled Playwright Execution Tests
# ---------------------------------------------------------------------------
def test_real_playwright_execution_all_pass():
    """Execute a real generated Playwright test and verify step mapping when all steps pass."""
    node_exe, cli_path, node_modules_dir = _resolve_playwright_runner()

    steps_def = [
        {"order": 1, "title": "Setup HTML", "action_type": "navigate", "value": "data:text/html,<div id='test'>Hello</div>", "timeout_ms": 5000},
        {"order": 2, "title": "Check heading", "action_type": "assert_text", "selector": "#test", "assertion": "Hello", "timeout_ms": 5000},
    ]

    test_code = generate_playwright_test("Pass Test", steps_def, total_timeout_ms=30000)

    step_results = _create_mock_step_results([
        (1, "Setup HTML"),
        (2, "Check heading"),
    ])

    tmp_dir = tempfile.mkdtemp(prefix="ts_p2_pass_")
    try:
        pw_config = os.path.join(tmp_dir, "playwright.config.js")
        with open(pw_config, "w", encoding="utf-8") as f:
            f.write("""const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 10000,
  use: { headless: true },
  reporter: [['json', { outputFile: 'results.json' }]],
});""")

        test_file = os.path.join(tmp_dir, "test.spec.js")
        with open(test_file, "w", encoding="utf-8") as f:
            f.write(test_code)

        proc_env = {**os.environ, "NODE_PATH": node_modules_dir, "CI": "1"}
        if "PLAYWRIGHT_BROWSERS_PATH" in proc_env and proc_env["PLAYWRIGHT_BROWSERS_PATH"] == "0":
            del proc_env["PLAYWRIGHT_BROWSERS_PATH"]

        proc = subprocess.run(
            [node_exe, cli_path, "test", "--config", "playwright.config.js", "test.spec.js"],
            cwd=tmp_dir, capture_output=True, text=True, env=proc_env
        )

        assert proc.returncode == 0

        with open(os.path.join(tmp_dir, "results.json"), encoding="utf-8") as f:
            pw_results = json.load(f)

        summary = map_playwright_results(step_results, pw_results, proc.returncode, proc.stderr, proc.stdout)

        assert summary.run_status == RunStatus.PASSED
        assert summary.passed_count == 2
        assert summary.failed_count == 0

        assert step_results[0].status == StepStatus.PASSED
        assert step_results[0].duration_ms > 0
        assert step_results[1].status == StepStatus.PASSED
        assert step_results[1].duration_ms > 0

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_real_playwright_execution_middle_step_failure():
    """Execute a real generated Playwright test where step 2 deliberately fails."""
    node_exe, cli_path, node_modules_dir = _resolve_playwright_runner()

    steps_def = [
        {"order": 1, "title": "Load Content", "action_type": "navigate", "value": "data:text/html,<div id='ok'>OK</div>", "timeout_ms": 5000},
        {"order": 2, "title": "Assert Missing", "action_type": "assert_visible", "selector": "#non-existent-selector", "timeout_ms": 1000},
        {"order": 3, "title": "Never Reached", "action_type": "assert_text", "selector": "#ok", "assertion": "OK", "timeout_ms": 5000},
    ]

    test_code = generate_playwright_test("Fail Middle Test", steps_def, total_timeout_ms=30000)

    step_results = _create_mock_step_results([
        (1, "Load Content"),
        (2, "Assert Missing"),
        (3, "Never Reached"),
    ])

    tmp_dir = tempfile.mkdtemp(prefix="ts_p2_fail_")
    try:
        pw_config = os.path.join(tmp_dir, "playwright.config.js")
        with open(pw_config, "w", encoding="utf-8") as f:
            f.write("""const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 10000,
  use: { headless: true },
  reporter: [['json', { outputFile: 'results.json' }]],
});""")

        test_file = os.path.join(tmp_dir, "test.spec.js")
        with open(test_file, "w", encoding="utf-8") as f:
            f.write(test_code)

        proc_env = {**os.environ, "NODE_PATH": node_modules_dir, "CI": "1"}
        if "PLAYWRIGHT_BROWSERS_PATH" in proc_env and proc_env["PLAYWRIGHT_BROWSERS_PATH"] == "0":
            del proc_env["PLAYWRIGHT_BROWSERS_PATH"]

        proc = subprocess.run(
            [node_exe, cli_path, "test", "--config", "playwright.config.js", "test.spec.js"],
            cwd=tmp_dir, capture_output=True, text=True, env=proc_env
        )

        assert proc.returncode != 0

        with open(os.path.join(tmp_dir, "results.json"), encoding="utf-8") as f:
            pw_results = json.load(f)

        summary = map_playwright_results(step_results, pw_results, proc.returncode, proc.stderr, proc.stdout)

        assert summary.run_status == RunStatus.FAILED
        assert summary.passed_count == 1
        assert summary.failed_count == 1

        # Step 1 passed with execution duration
        assert step_results[0].status == StepStatus.PASSED
        assert step_results[0].duration_ms > 0
        assert step_results[0].error_message is None

        # Step 2 failed with locator error
        assert step_results[1].status == StepStatus.FAILED
        assert step_results[1].duration_ms > 0
        assert "non-existent-selector" in step_results[1].error_message
        assert step_results[1].failure_kind in (FailureKind.LOCATOR, FailureKind.TIMEOUT)

        # Step 3 skipped and not assigned step 2's error
        assert step_results[2].status == StepStatus.SKIPPED
        assert step_results[2].error_message is None

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
