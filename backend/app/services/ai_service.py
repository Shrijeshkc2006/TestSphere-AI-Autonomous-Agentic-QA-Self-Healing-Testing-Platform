"""
AI service — Gemini-backed test plan generation using LangChain.

Features:
- Structured output via Pydantic models
- Graceful fallback when GOOGLE_API_KEY is absent (demo mode)
- Retries via tenacity
- Jinja2 template-based Playwright test generation
"""
import json
from typing import Optional, List, Dict, Any

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import settings

log = structlog.get_logger()


# ---------------------------------------------------------------------------
# Pydantic output schemas (also used for structured Gemini output)
# ---------------------------------------------------------------------------

from pydantic import BaseModel, Field


class AITestStep(BaseModel):
    order: int
    title: str
    description: Optional[str] = None
    action_type: str  # navigate | click | fill | assert_text | assert_visible | wait | screenshot
    selector: Optional[str] = None
    value: Optional[str] = None
    assertion: Optional[str] = None
    timeout_ms: int = 30000
    retry_count: int = 2
    is_sensitive: bool = False


class AITestPlan(BaseModel):
    name: str
    steps: List[AITestStep]
    assumptions: List[str] = []
    warnings: List[str] = []


# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

_PLAN_SYSTEM_PROMPT = """You are an expert QA engineer specialising in end-to-end web testing with Playwright.
Your job is to generate a structured test plan based on the user's requirements and the target application information provided.

Rules:
1. Produce concrete, executable test steps — not abstract descriptions.
2. Use specific CSS selectors, ARIA roles, or accessible labels when possible.
3. Prefer role/label selectors over brittle CSS paths.
4. Never assume credentials exist — include steps to create or configure them if needed.
5. Flag any assumptions you make in the "assumptions" array.
6. Flag any destructive or sensitive operations (delete, payment, account changes) in the "warnings" array.
7. Limit steps to max 30 for a single test plan.
8. action_type must be one of: navigate, click, fill, assert_text, assert_visible, assert_url, wait, screenshot, hover, select, check, uncheck.
9. Return ONLY valid JSON matching the schema provided. No markdown fences, no commentary."""

_PLAN_USER_TEMPLATE = """Target URL: {target_url}
Framework: {framework}

User requirements:
{requirements}

Additional context:
{context}

Return a JSON object with this exact structure:
{{
  "name": "descriptive plan name",
  "steps": [
    {{
      "order": 1,
      "title": "short step title",
      "description": "what this step does and why",
      "action_type": "navigate|click|fill|assert_text|assert_visible|assert_url|wait|screenshot|hover|select|check|uncheck",
      "selector": "CSS or aria selector or null",
      "value": "value to fill/select or null",
      "assertion": "text or condition to assert or null",
      "timeout_ms": 30000,
      "retry_count": 2,
      "is_sensitive": false
    }}
  ],
  "assumptions": ["list of assumptions made"],
  "warnings": ["list of warnings about sensitive/destructive operations"]
}}"""


# ---------------------------------------------------------------------------
# AI client
# ---------------------------------------------------------------------------

def _get_llm():
    """Return a configured ChatGoogleGenerativeAI or None if unavailable."""
    if not settings.AI_AVAILABLE:
        return None
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0.2,
            max_retries=2,
        )
    except Exception as exc:
        log.warning("ai_service.llm_init_failed", error=str(exc))
        return None


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
async def _call_llm(llm, prompt: str) -> str:
    """Call the LLM with retry logic."""
    from langchain_core.messages import HumanMessage, SystemMessage
    messages = [
        SystemMessage(content=_PLAN_SYSTEM_PROMPT),
        HumanMessage(content=prompt),
    ]
    response = await llm.ainvoke(messages)
    return response.content


def _demo_plan(requirements: str, target_url: str) -> AITestPlan:
    """Return a deterministic demo smoke-test plan when AI is unavailable."""
    url = (target_url or "").strip()
    nav_url = url if url else "http://localhost:3000"
    return AITestPlan(
        name=f"Smoke test for {url or 'application'}",
        steps=[
            AITestStep(
                order=1,
                title="Navigate to application",
                description=f"Navigate to {nav_url}",
                action_type="navigate",
                value=nav_url,
                timeout_ms=30000,
            ),
            AITestStep(
                order=2,
                title="Verify page loaded",
                description="Assert page body element is visible",
                action_type="assert_visible",
                selector="body",
                timeout_ms=30000,
            ),
            AITestStep(
                order=3,
                title="Capture screenshot",
                description="Capture page screenshot",
                action_type="screenshot",
                timeout_ms=30000,
            ),
        ],
        assumptions=[
            "AI service is unavailable — using deterministic demo smoke test plan.",
            f"Target URL is accessible: {nav_url}",
        ],
        warnings=[
            "Configure GOOGLE_API_KEY to generate custom AI-assisted test plans.",
        ],
    )


async def generate_test_plan(
    requirements: str,
    target_url: Optional[str],
    framework: Optional[str] = None,
    context: Optional[str] = None,
    plan_name: Optional[str] = None,
) -> AITestPlan:
    """Generate an AI test plan from natural-language requirements."""
    llm = _get_llm()

    if not llm:
        log.info("ai_service.demo_mode")
        plan = _demo_plan(requirements, target_url or "")
        if plan_name:
            plan.name = plan_name
        return plan

    prompt = _PLAN_USER_TEMPLATE.format(
        target_url=target_url or "unknown",
        framework=framework or "unknown",
        requirements=requirements,
        context=context or "No additional context provided.",
    )

    try:
        raw = await _call_llm(llm, prompt)
        # Strip markdown fences if model wraps in them
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]

        data = json.loads(raw)
        plan = AITestPlan.model_validate(data)
        if plan_name:
            plan.name = plan_name
        log.info("ai_service.plan_generated", steps=len(plan.steps))
        return plan
    except json.JSONDecodeError as exc:
        log.error("ai_service.json_parse_error", error=str(exc), raw=raw[:500])
        raise ValueError(f"AI returned invalid JSON: {exc}") from exc
    except Exception as exc:
        err_str = str(exc)
        log.warning("ai_service.generation_failed_fallback_to_demo", error=err_str)
        plan = _demo_plan(requirements, target_url or "")
        if plan_name:
            plan.name = plan_name
        return plan


async def explain_failure(
    step_title: str,
    error_message: str,
    selector: Optional[str],
    action_type: str,
    console_errors: Optional[List[str]] = None,
) -> str:
    """Generate a human-readable root-cause explanation for a step failure."""
    llm = _get_llm()
    if not llm:
        return f"Step '{step_title}' failed with: {error_message}. Configure GOOGLE_API_KEY for AI-powered root-cause analysis."

    prompt = f"""A Playwright test step failed. Provide a concise (2-3 sentence) root-cause explanation and prioritised fix suggestions.

Step: {step_title}
Action: {action_type}
Selector: {selector or 'N/A'}
Error: {error_message}
Console errors: {json.dumps(console_errors or [])}

Classify the failure as one of: LOCATOR_FAILURE | ASSERTION_FAILURE | NETWORK_ERROR | TIMEOUT | APP_ERROR | ENVIRONMENT_ERROR
Then explain the most likely cause and suggest 1-3 specific fixes."""

    try:
        response = await _call_llm(llm, prompt)
        return response
    except Exception as exc:
        log.warning("ai_service.explain_failure_error", error=str(exc))
        return f"AI explanation unavailable. Original error: {error_message}"


async def suggest_alternative_selectors(
    original_selector: str,
    dom_context: str,
    action_type: str,
) -> List[Dict[str, Any]]:
    """Suggest alternative selectors for self-healing using the DOM context."""
    llm = _get_llm()
    if not llm:
        return []

    prompt = f"""A Playwright test step failed because the selector could not be found.
Suggest up to 5 alternative selectors ranked by confidence.

Failed selector: {original_selector}
Action type: {action_type}
DOM context (snippet):
{dom_context[:3000]}

Return JSON array:
[
  {{"selector": "...", "strategy": "role|label|text|attribute|css", "confidence": 0.9, "reasoning": "..."}}
]
Return ONLY the JSON array."""

    try:
        raw = await _call_llm(llm, prompt)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(raw)
    except Exception as exc:
        log.warning("ai_service.selector_suggestion_error", error=str(exc))
        return []