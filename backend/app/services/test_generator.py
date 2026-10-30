"""
Playwright test code generator using Jinja2 templates.
"""
from pathlib import Path
from typing import List, Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape
import structlog

from app.config import settings

log = structlog.get_logger()

# Jinja2 environment
_TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape([]),  # JS — no HTML escaping
    trim_blocks=True,
    lstrip_blocks=True,
)


def generate_playwright_test(
    plan_name: str,
    steps: List[dict],
    total_timeout_ms: int = 120_000,
) -> str:
    """
    Render a Playwright test file from a list of step dicts.

    Each step dict must have at minimum:
        order, title, action_type
    Optional: description, selector, value, assertion, timeout_ms, retry_count, is_sensitive
    """
    template = _env.get_template("playwright_test.js.j2")
    return template.render(
        plan_name=plan_name,
        steps=steps,
        total_timeout_ms=total_timeout_ms,
    )
