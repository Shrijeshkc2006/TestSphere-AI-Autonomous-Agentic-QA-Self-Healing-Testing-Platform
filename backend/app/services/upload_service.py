"""
ZIP upload processing service.

Security measures:
- Path-traversal protection: reject any member whose resolved path escapes the extract root.
- File-size limit: refuse archives larger than MAX_UPLOAD_SIZE_MB.
- Content validation: only allow safe file extensions inside the archive.
- SHA-256 content hash for deduplication and integrity.
- Archive bomb protection: limit total uncompressed size.
"""
import hashlib
import json
import os
import re
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Dict, Any, Optional, List

import aiofiles
import structlog

from app.config import settings

log = structlog.get_logger()

# Max total uncompressed size allowed (5× the zip size or 500 MB)
_MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024

# Extensions allowed inside uploaded archives
_SAFE_EXTENSIONS = {
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".json", ".jsonc",
    ".html", ".htm", ".css", ".scss", ".sass", ".less",
    ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
    ".md", ".mdx", ".txt", ".yaml", ".yml", ".toml", ".env.example",
    ".gitignore", ".eslintrc", ".prettierrc", ".babelrc",
    ".nvmrc", ".node-version",
    ".wasm",
    # lock files
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
}

# Framework detection patterns
_FRAMEWORK_PATTERNS = [
    (r'"react"', "React"),
    (r'"react-dom"', "React"),
    (r'"next"', "Next.js"),
    (r'"nuxt"', "Nuxt"),
    (r'"vue"', "Vue"),
    (r'"@angular/core"', "Angular"),
    (r'"svelte"', "Svelte"),
    (r'"astro"', "Astro"),
    (r'"remix"', "Remix"),
    (r'"gatsby"', "Gatsby"),
    (r'"vite"', "Vite"),
]


def _safe_extract_path(member_name: str, extract_root: Path) -> Optional[Path]:
    """Return the safe extraction path or None if it would escape extract_root."""
    # Normalise to posix (zipfile uses /)
    safe_name = member_name.replace("\\", "/")
    # Reject absolute paths
    if safe_name.startswith("/"):
        return None
    target = (extract_root / safe_name).resolve()
    try:
        target.relative_to(extract_root.resolve())
    except ValueError:
        return None
    return target


def _compute_sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _is_safe_extension(name: str) -> bool:
    suffix = Path(name).suffix.lower()
    return suffix in _SAFE_EXTENSIONS or name.lower() in _SAFE_EXTENSIONS


def _detect_framework(pkg_json_content: str) -> Optional[str]:
    for pattern, framework in _FRAMEWORK_PATTERNS:
        if re.search(pattern, pkg_json_content):
            return framework
    return None


def _detect_package_manager(file_list: List[str]) -> str:
    names = {Path(f).name for f in file_list}
    if "pnpm-lock.yaml" in names:
        return "pnpm"
    if "yarn.lock" in names:
        return "yarn"
    return "npm"


def _extract_scripts(pkg_json_content: str) -> Dict[str, str]:
    try:
        data = json.loads(pkg_json_content)
        scripts = data.get("scripts", {})
        return {k: v for k, v in scripts.items() if isinstance(v, str)}
    except (json.JSONDecodeError, AttributeError):
        return {}


def _build_file_tree_summary(extract_root: Path, max_depth: int = 4) -> Dict[str, Any]:
    """Return a compact nested dict of the file tree, depth-limited."""
    def _walk(path: Path, depth: int) -> Any:
        if depth == 0:
            return "..."
        if path.is_file():
            return path.stat().st_size
        result = {}
        try:
            for child in sorted(path.iterdir()):
                if child.name.startswith(".") and child.name not in (".env.example", ".gitignore"):
                    continue
                if child.name in ("node_modules", ".git", "dist", "build", ".next", ".nuxt"):
                    result[child.name] = "[skipped]"
                    continue
                result[child.name] = _walk(child, depth - 1)
        except PermissionError:
            pass
        return result

    return _walk(extract_root, max_depth)


async def process_upload(
    file_path: str,
    original_filename: str,
    file_size: int,
) -> Dict[str, Any]:
    """
    Validate and analyse a ZIP archive.

    Returns a dict with:
        content_hash, framework, package_manager, detected_scripts,
        file_tree_summary, validation_status ("valid" | "invalid"),
        validation_errors (list of strings), stored_path
    """
    errors: List[str] = []

    # 1. Size check
    if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
        return {
            "validation_status": "invalid",
            "validation_errors": [f"File exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit"],
            "content_hash": "",
            "framework": None,
            "package_manager": None,
            "detected_scripts": None,
            "file_tree_summary": None,
            "stored_path": file_path,
        }

    # 2. Compute hash
    content_hash = _compute_sha256(file_path)

    # 3. Validate zip structure
    if not zipfile.is_zipfile(file_path):
        return {
            "validation_status": "invalid",
            "validation_errors": ["File is not a valid ZIP archive"],
            "content_hash": content_hash,
            "framework": None,
            "package_manager": None,
            "detected_scripts": None,
            "file_tree_summary": None,
            "stored_path": file_path,
        }

    extract_root = Path(tempfile.mkdtemp(prefix="ts_upload_"))
    framework: Optional[str] = None
    package_manager: str = "npm"
    detected_scripts: Dict[str, str] = {}
    file_tree_summary: Dict = {}
    all_members: List[str] = []

    try:
        with zipfile.ZipFile(file_path, "r") as zf:
            members = zf.infolist()

            # Archive bomb guard
            total_uncompressed = sum(m.file_size for m in members)
            if total_uncompressed > _MAX_UNCOMPRESSED_BYTES:
                errors.append(f"Archive uncompressed content exceeds 500 MB limit ({total_uncompressed // (1024*1024)} MB)")
                return {
                    "validation_status": "invalid",
                    "validation_errors": errors,
                    "content_hash": content_hash,
                    "framework": None,
                    "package_manager": None,
                    "detected_scripts": None,
                    "file_tree_summary": None,
                    "stored_path": file_path,
                }

            for member in members:
                if member.is_dir():
                    continue

                name = member.filename
                all_members.append(name)

                # Path traversal check
                safe_path = _safe_extract_path(name, extract_root)
                if safe_path is None:
                    errors.append(f"Rejected member with unsafe path: {name!r}")
                    continue

                # Extension whitelist
                if not _is_safe_extension(name):
                    log.debug("upload.skipped_extension", name=name)
                    continue

                # Extract
                safe_path.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(member) as src, open(safe_path, "wb") as dst:
                    shutil.copyfileobj(src, dst)

            # Detect framework from package.json
            pkg_paths = list(extract_root.rglob("package.json"))
            # Prefer root-level package.json
            pkg_paths.sort(key=lambda p: len(p.parts))
            if pkg_paths:
                pkg_content = pkg_paths[0].read_text(encoding="utf-8", errors="replace")
                framework = _detect_framework(pkg_content)
                detected_scripts = _extract_scripts(pkg_content)

            package_manager = _detect_package_manager(all_members)
            file_tree_summary = _build_file_tree_summary(extract_root)

    except (zipfile.BadZipFile, Exception) as exc:
        log.exception("upload.processing_error", error=str(exc))
        errors.append(f"Archive processing error: {exc}")
    finally:
        shutil.rmtree(extract_root, ignore_errors=True)

    validation_status = "valid" if not errors else "invalid"
    return {
        "validation_status": validation_status,
        "validation_errors": errors if errors else None,
        "content_hash": content_hash,
        "framework": framework,
        "package_manager": package_manager,
        "detected_scripts": detected_scripts or None,
        "file_tree_summary": file_tree_summary or None,
        "stored_path": file_path,
    }
