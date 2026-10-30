"""
TestSphere — Playwright Test-Step Result Mapper.
Parses Playwright JSON reporter output and maps execution results to TestSphere StepResult records.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
import re
from typing import List, Optional, Dict, Any, Tuple

from app.models import StepResult, StepStatus, RunStatus, FailureKind

ANSI_REGEX = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')
STEP_ORDER_REGEX = re.compile(r'^(?:\[Step\s*(\d+)\]|Step\s+(\d+)[:\s-])\s*(.*)$', re.IGNORECASE)


def clean_ansi(text: Optional[str]) -> Optional[str]:
    """Strip ANSI escape sequences from text."""
    if not text:
        return text
    return ANSI_REGEX.sub('', text).strip()


def classify_failure_kind(error_message: Optional[str]) -> FailureKind:
    """Classify the failure kind based on error message content."""
    if not error_message:
        return FailureKind.APP_ERROR

    msg_lower = error_message.lower()
    if "timeout" in msg_lower or "timedout" in msg_lower or "timed out" in msg_lower:
        return FailureKind.TIMEOUT
    if any(k in msg_lower for k in ("expect(", "expect ", "assertion", "tobevisible", "tohavetext", "tocontaintext", "tohaveurl")):
        return FailureKind.ASSERTION
    if "locator" in msg_lower or "waiting for" in msg_lower or "element" in msg_lower:
        return FailureKind.LOCATOR
    if any(k in msg_lower for k in ("network", "net::", "fetch", "failed to load", "econnrefused")):
        return FailureKind.NETWORK

    return FailureKind.APP_ERROR


def parse_step_title(title: str) -> Tuple[Optional[int], str]:
    """
    Extract step order from title if present (e.g. 'Step 1: Navigate to page').
    Returns (order, clean_title).
    """
    if not title:
        return None, ""
    match = STEP_ORDER_REGEX.match(title)
    if match:
        order_str = match.group(1) or match.group(2)
        order = int(order_str)
        clean_title = match.group(3).strip()
        return order, clean_title
    return None, title.strip()


def extract_playwright_test_data(pw_results: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Traverse Playwright JSON reporter results and extract specs, test results, and steps.
    """
    result_data = {
        "is_valid": False,
        "test_status": None,
        "test_error": None,
        "test_duration_ms": 0,
        "steps": [],
        "errors": [],
    }

    if not pw_results or not isinstance(pw_results, dict):
        return result_data

    # Extract top-level errors if any
    top_errors = pw_results.get("errors", [])
    if isinstance(top_errors, list):
        for err in top_errors:
            if isinstance(err, dict) and "message" in err:
                result_data["errors"].append(clean_ansi(err["message"]))
            elif isinstance(err, str):
                result_data["errors"].append(clean_ansi(err))

    suites = pw_results.get("suites", [])
    if not isinstance(suites, list):
        return result_data

    all_specs = []
    def _collect_specs(suites_list):
        if not isinstance(suites_list, list):
            return
        for s in suites_list:
            if not isinstance(s, dict):
                continue
            for spec in s.get("specs", []):
                all_specs.append(spec)
            _collect_specs(s.get("suites", []))

    _collect_specs(suites)

    if not all_specs:
        return result_data

    result_data["is_valid"] = True

    # Find the primary test result
    for spec in all_specs:
        tests = spec.get("tests", [])
        if not tests:
            continue
        test_obj = tests[0]
        results_list = test_obj.get("results", [])
        if not results_list:
            continue

        # Use the latest execution attempt
        test_run_res = results_list[-1]
        result_data["test_status"] = test_run_res.get("status")
        result_data["test_duration_ms"] = test_run_res.get("duration", 0)

        # Top error in test result
        err_obj = test_run_res.get("error")
        if not err_obj and test_run_res.get("errors"):
            err_obj = test_run_res["errors"][0]
        if err_obj:
            result_data["test_error"] = {
                "message": clean_ansi(err_obj.get("message")),
                "stack": clean_ansi(err_obj.get("stack", "")),
            }

        # Collect user steps (exclude internal hook steps)
        for step in test_run_res.get("steps", []):
            if not isinstance(step, dict):
                continue
            category = step.get("category")
            title = step.get("title", "")
            if category == "hook" or title in ("Before Hooks", "After Hooks"):
                continue

            step_err = step.get("error")
            # If the step itself has no direct error, check child steps
            if not step_err and step.get("steps"):
                for child in step["steps"]:
                    if isinstance(child, dict) and child.get("error"):
                        step_err = child["error"]
                        break

            err_payload = None
            if step_err:
                err_payload = {
                    "message": clean_ansi(step_err.get("message")),
                    "stack": clean_ansi(step_err.get("stack", "")),
                }

            result_data["steps"].append({
                "title": title,
                "duration_ms": step.get("duration", 0),
                "error": err_payload,
            })

        # Break after finding the primary test result
        break

    return result_data


@dataclass
class MappingSummary:
    run_status: RunStatus
    error_message: Optional[str]
    passed_count: int
    failed_count: int
    healed_count: int
    total_duration_ms: Optional[int]


def map_playwright_results(
    step_results: List[StepResult],
    pw_results: Optional[Dict[str, Any]],
    proc_returncode: int,
    proc_stderr: str = "",
    proc_stdout: str = "",
    browser_name: str = "chromium",
) -> MappingSummary:
    """
    Map Playwright execution results to StepResult objects and determine run status.
    """
    now = datetime.now(timezone.utc)
    extracted = extract_playwright_test_data(pw_results)

    # Browser executable missing check
    combined_err = f"{proc_stderr}\n{proc_stdout}"
    if "Executable doesn't exist" in combined_err:
        err_msg = (
            f"Playwright browser binary missing for {browser_name}. "
            f"Please run 'npx playwright install {browser_name}' or 'python -m playwright install {browser_name}'."
        )
        for i, sr in enumerate(step_results):
            if i == 0:
                sr.status = StepStatus.FAILED
                sr.error_message = err_msg
                sr.failure_kind = FailureKind.ENVIRONMENT
            else:
                sr.status = StepStatus.SKIPPED
                sr.error_message = None
            sr.started_at = now
            sr.finished_at = now
            sr.duration_ms = 0

        failed_count = 1 if step_results else 0
        return MappingSummary(
            run_status=RunStatus.ERROR,
            error_message=err_msg,
            passed_count=0,
            failed_count=failed_count,
            healed_count=0,
            total_duration_ms=0,
        )

    # Edge Case F: Missing or invalid JSON report / crash before report
    if not extracted["is_valid"]:
        err_detail = clean_ansi(proc_stderr[:1000] if proc_stderr else proc_stdout[:1000])
        default_err = (
            f"Playwright test execution failed (exit code {proc_returncode}). "
            f"No valid test report was generated: {err_detail}"
            if err_detail else f"Playwright process exited with code {proc_returncode} without generating a test report."
        )
        if proc_returncode == 0 and not step_results:
            # Empty plan completed cleanly
            return MappingSummary(
                run_status=RunStatus.PASSED,
                error_message=None,
                passed_count=0,
                failed_count=0,
                healed_count=0,
                total_duration_ms=0,
            )

        for i, sr in enumerate(step_results):
            if i == 0:
                sr.status = StepStatus.FAILED
                sr.error_message = default_err
                sr.failure_kind = classify_failure_kind(default_err)
            else:
                sr.status = StepStatus.SKIPPED
                sr.error_message = None
            sr.started_at = now
            sr.finished_at = now
            sr.duration_ms = 0

        failed_count = 1 if step_results else 0
        return MappingSummary(
            run_status=RunStatus.ERROR if proc_returncode != 0 else RunStatus.FAILED,
            error_message=default_err,
            passed_count=0,
            failed_count=failed_count,
            healed_count=0,
            total_duration_ms=0,
        )

    pw_steps = extracted["steps"]
    test_status = extracted["test_status"]
    top_test_error = extracted["test_error"]

    # Pre-step failure check: test failed but no steps executed
    if not pw_steps and test_status in ("failed", "timedOut", "unexpected", "interrupted") or (not pw_steps and proc_returncode != 0 and step_results):
        err_msg = (
            top_test_error.get("message")
            if top_test_error
            else (extracted["errors"][0] if extracted["errors"] else clean_ansi(proc_stderr[:1000] or "Test failed before any steps executed."))
        )
        stack = top_test_error.get("stack", "") if top_test_error else ""
        for i, sr in enumerate(step_results):
            if i == 0:
                sr.status = StepStatus.FAILED
                sr.error_message = err_msg
                sr.stack_trace = stack
                sr.failure_kind = classify_failure_kind(err_msg)
            else:
                sr.status = StepStatus.SKIPPED
                sr.error_message = None
            sr.started_at = now
            sr.finished_at = now
            sr.duration_ms = 0

        return MappingSummary(
            run_status=RunStatus.FAILED,
            error_message=err_msg,
            passed_count=0,
            failed_count=1 if step_results else 0,
            healed_count=0,
            total_duration_ms=extracted.get("test_duration_ms", 0),
        )

    # Map Playwright steps to TestSphere StepResults
    order_to_sr = {sr.order: sr for sr in step_results}
    mapped_sr_set = set()
    first_failing_step_index = None

    # Step-level mapping:
    # 1. Match by extracted order if title starts with 'Step <order>:'
    # 2. Sequential fallback for steps without order prefix
    unmapped_pw_steps = []
    for pw_step in pw_steps:
        order, clean_title = parse_step_title(pw_step["title"])
        if order is not None and order in order_to_sr and order_to_sr[order] not in mapped_sr_set:
            target_sr = order_to_sr[order]
            mapped_sr_set.add(target_sr)
            _apply_step_result(target_sr, pw_step, now)
        else:
            unmapped_pw_steps.append(pw_step)

    # Sequential fallback for any remaining pw steps
    if unmapped_pw_steps:
        for sr in step_results:
            if sr not in mapped_sr_set and unmapped_pw_steps:
                pw_step = unmapped_pw_steps.pop(0)
                mapped_sr_set.add(sr)
                _apply_step_result(sr, pw_step, now)

    # Any plan steps that were never executed in Playwright
    # Mark as SKIPPED, unless an interruption/timeout occurred without Playwright recording an error
    has_any_failed_step = any(sr.status == StepStatus.FAILED for sr in mapped_sr_set)
    unmapped_plan_steps = [sr for sr in step_results if sr not in mapped_sr_set]

    if unmapped_plan_steps:
        if has_any_failed_step:
            # Execution halted because of an earlier step failure
            for sr in unmapped_plan_steps:
                sr.status = StepStatus.SKIPPED
                sr.error_message = None
                sr.stack_trace = None
                sr.duration_ms = 0
                sr.started_at = None
                sr.finished_at = None
        elif test_status in ("timedOut", "interrupted") or proc_returncode != 0:
            # Test was interrupted or timed out while executing the next step
            first_unmapped = unmapped_plan_steps[0]
            first_unmapped.status = StepStatus.FAILED
            interruption_msg = (
                top_test_error.get("message")
                if top_test_error
                else f"Test execution was interrupted (status: {test_status}, exit code: {proc_returncode})."
            )
            first_unmapped.error_message = interruption_msg
            first_unmapped.stack_trace = top_test_error.get("stack", "") if top_test_error else ""
            first_unmapped.failure_kind = FailureKind.TIMEOUT if test_status == "timedOut" else FailureKind.APP_ERROR
            first_unmapped.duration_ms = 0
            first_unmapped.started_at = now
            first_unmapped.finished_at = now

            for sr in unmapped_plan_steps[1:]:
                sr.status = StepStatus.SKIPPED
                sr.error_message = None
                sr.stack_trace = None
                sr.duration_ms = 0
                sr.started_at = None
                sr.finished_at = None
        else:
            # Plan step not executed (e.g. unknown action type skipped in code generation)
            for sr in unmapped_plan_steps:
                sr.status = StepStatus.SKIPPED
                sr.error_message = None
                sr.stack_trace = None
                sr.duration_ms = 0
                sr.started_at = None
                sr.finished_at = None

    passed_count = sum(1 for sr in step_results if sr.status == StepStatus.PASSED)
    failed_count = sum(1 for sr in step_results if sr.status == StepStatus.FAILED)
    healed_count = sum(1 for sr in step_results if sr.status == StepStatus.HEALED)

    # Determine final run status
    if proc_returncode not in (0, 1) and not pw_steps:
        run_status = RunStatus.ERROR
        run_error = clean_ansi(proc_stderr[:1000] if proc_stderr else proc_stdout[:1000])
    elif failed_count > 0:
        run_status = RunStatus.FAILED
        failing_step = next((sr for sr in step_results if sr.status == StepStatus.FAILED), None)
        run_error = failing_step.error_message if failing_step else "Test run failed"
    elif test_status not in (None, "passed", "expected"):
        # Teardown failure or unexpected test status even if individual steps passed
        run_status = RunStatus.FAILED
        run_error = top_test_error.get("message") if top_test_error else f"Test run ended with status '{test_status}'"
    else:
        run_status = RunStatus.PASSED
        run_error = None

    return MappingSummary(
        run_status=run_status,
        error_message=run_error,
        passed_count=passed_count,
        failed_count=failed_count,
        healed_count=healed_count,
        total_duration_ms=extracted.get("test_duration_ms", 0),
    )


def _apply_step_result(sr: StepResult, pw_step: Dict[str, Any], timestamp: datetime):
    """Update a StepResult with Playwright step output."""
    sr.started_at = timestamp
    sr.finished_at = timestamp
    sr.duration_ms = int(pw_step.get("duration_ms", 0) or 0)

    pw_err = pw_step.get("error")
    if pw_err:
        sr.status = StepStatus.FAILED
        sr.error_message = pw_err.get("message", "Step failed")
        sr.stack_trace = pw_err.get("stack", "")
        sr.failure_kind = classify_failure_kind(sr.error_message)
    else:
        sr.status = StepStatus.PASSED
        sr.error_message = None
        sr.stack_trace = None
        sr.failure_kind = None
