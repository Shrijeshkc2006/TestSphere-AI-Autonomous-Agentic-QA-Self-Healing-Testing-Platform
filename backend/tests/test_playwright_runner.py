import os
import shutil
import tempfile
import subprocess
from pathlib import Path
import pytest

from app.workers.tasks import _resolve_playwright_runner, _check_playwright_browsers


def test_resolve_playwright_runner_success():
    """Verify that Node and @playwright/test can be located."""
    node_exe, cli_path, node_modules_dir = _resolve_playwright_runner()

    assert node_exe is not None
    assert Path(node_exe).exists()
    assert Path(cli_path).exists()
    assert Path(cli_path).name == "cli.js"
    assert Path(node_modules_dir).exists()
    assert (Path(node_modules_dir) / "@playwright" / "test").exists()


def test_resolve_playwright_runner_missing_node(monkeypatch):
    """Verify informative error if Node is not found in PATH."""
    monkeypatch.setattr(shutil, "which", lambda cmd: None if cmd == "node" else "/usr/bin/something")
    with pytest.raises(RuntimeError, match="Node.js executable was not found"):
        _resolve_playwright_runner()


def test_check_playwright_browsers():
    """Verify detection of installed browser binaries."""
    has_chromium = _check_playwright_browsers("chromium")
    # Chromium was confirmed installed in %LOCALAPPDATA%\ms-playwright
    assert has_chromium is True


def test_playwright_runner_execution_and_cleanup():
    """
    Verify that an isolated generated Playwright test runs successfully,
    captures results.json, and cleans up temporary resources.
    """
    node_exe, cli_path, node_modules_dir = _resolve_playwright_runner()

    tmp_dir = tempfile.mkdtemp(prefix="ts_verify_run_")
    artifact_dir = tempfile.mkdtemp(prefix="ts_verify_artifact_")
    screenshot_dir = os.path.join(artifact_dir, "screenshots")
    os.makedirs(screenshot_dir, exist_ok=True)

    try:
        pw_config = os.path.join(tmp_dir, "playwright.config.js")
        with open(pw_config, "w", encoding="utf-8") as f:
            f.write("""
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 30000,
  use: { headless: true },
  reporter: [['json', { outputFile: 'results.json' }]],
});
""")

        test_file = os.path.join(tmp_dir, "test.spec.js")
        with open(test_file, "w", encoding="utf-8") as f:
            f.write("""
const { test, expect } = require('@playwright/test');
test('e2e runner verification', async ({ page }) => {
  await page.setContent('<div id="status">OK</div>');
  await expect(page.locator('#status')).toHaveText('OK');
  await page.screenshot({ path: 'screenshots/step-1.png' });
});
""")

        proc_env = {
            **os.environ,
            "NODE_PATH": node_modules_dir,
            "CI": "1",
            "PLAYWRIGHT_JSON_OUTPUT_NAME": "results.json",
        }
        if "PLAYWRIGHT_BROWSERS_PATH" in proc_env and proc_env["PLAYWRIGHT_BROWSERS_PATH"] == "0":
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
            timeout=30,
            env=proc_env,
        )

        assert proc.returncode == 0, f"Playwright failed (code {proc.returncode}): {proc.stderr}"

        # Verify results.json exists and contains passing test
        results_path = os.path.join(tmp_dir, "results.json")
        assert os.path.exists(results_path)

        import json
        with open(results_path, encoding="utf-8") as rf:
            results_data = json.load(rf)

        assert results_data["stats"]["expected"] == 1
        assert results_data["stats"]["unexpected"] == 0

        # Verify screenshot copy logic
        tmp_screenshots = os.path.join(tmp_dir, "screenshots")
        assert os.path.exists(tmp_screenshots)
        for img_file in os.listdir(tmp_screenshots):
            if img_file.endswith(".png"):
                shutil.copy2(os.path.join(tmp_screenshots, img_file), os.path.join(screenshot_dir, img_file))

        assert os.path.exists(os.path.join(screenshot_dir, "step-1.png"))

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        shutil.rmtree(artifact_dir, ignore_errors=True)

    # Verify temp dir cleanup
    assert not os.path.exists(tmp_dir)
    assert not os.path.exists(artifact_dir)


def test_concurrent_playwright_runs():
    """Verify that multiple concurrent runs execute in isolated directories without collision."""
    from concurrent.futures import ThreadPoolExecutor

    node_exe, cli_path, node_modules_dir = _resolve_playwright_runner()

    def _single_run(name: str):
        tmp_dir = tempfile.mkdtemp(prefix=f"ts_concurrent_{name}_")
        try:
            pw_config = os.path.join(tmp_dir, "playwright.config.js")
            with open(pw_config, "w", encoding="utf-8") as f:
                f.write("""
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 30000,
  use: { headless: true },
  reporter: [['json', { outputFile: 'results.json' }]],
});
""")
            test_file = os.path.join(tmp_dir, "test.spec.js")
            with open(test_file, "w", encoding="utf-8") as f:
                f.write(f"""
const {{ test, expect }} = require('@playwright/test');
test('concurrent {name}', async ({{ page }}) => {{
  await page.setContent('<div>{name}</div>');
  await expect(page.locator('div')).toHaveText('{name}');
}});
""")
            proc_env = {
                **os.environ,
                "NODE_PATH": node_modules_dir,
                "CI": "1",
                "PLAYWRIGHT_JSON_OUTPUT_NAME": "results.json",
            }
            if "PLAYWRIGHT_BROWSERS_PATH" in proc_env and proc_env["PLAYWRIGHT_BROWSERS_PATH"] == "0":
                del proc_env["PLAYWRIGHT_BROWSERS_PATH"]

            proc = subprocess.run(
                [node_exe, cli_path, "test", "--config", "playwright.config.js", "test.spec.js"],
                capture_output=True,
                text=True,
                cwd=tmp_dir,
                timeout=30,
                env=proc_env,
            )
            results_path = os.path.join(tmp_dir, "results.json")
            return proc.returncode, os.path.exists(results_path)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(_single_run, "run_alpha")
        f2 = executor.submit(_single_run, "run_beta")
        code1, has1 = f1.result()
        code2, has2 = f2.result()

    assert code1 == 0 and has1 is True
    assert code2 == 0 and has2 is True

