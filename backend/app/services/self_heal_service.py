"""
Self-healing service: attempts to find a working replacement locator
when a Playwright step fails with a locator error.

Strategy order:
1. ARIA role + name
2. Accessible label / placeholder
3. Visible text
4. data-testid / data-cy / aria-label attributes
5. Semantic similarity via sentence-transformers + FAISS (if available)

Each strategy is validated by checking the element exists in the DOM context
before recording a heal attempt. We never silently convert failures to passes.
"""
import re
from typing import List, Optional, Dict, Any

import structlog

log = structlog.get_logger()


# ---------------------------------------------------------------------------
# Simple heuristic strategies (no ML needed)
# ---------------------------------------------------------------------------

def _strategy_role_name(original: str, dom_context: str) -> List[Dict[str, Any]]:
    """Extract role + accessible name pairs from DOM context."""
    suggestions = []
    # Look for role= and aria-label= patterns
    pattern = re.compile(r'role=["\'](\w+)["\'].*?(?:aria-label|title|id)=["\']([^"\']+)["\']', re.DOTALL)
    for m in pattern.finditer(dom_context[:5000]):
        role, name = m.group(1), m.group(2)
        selector = f'[role="{role}"][aria-label="{name}"], [role="{role}"][title="{name}"]'
        suggestions.append({
            "selector": selector,
            "strategy": "role",
            "confidence": 0.85,
            "reasoning": f"Matched role={role} with name={name!r}",
        })
    return suggestions[:2]


def _strategy_accessible_label(original: str, dom_context: str) -> List[Dict[str, Any]]:
    """Find label/placeholder selectors from DOM context."""
    suggestions = []
    # Look for aria-label, placeholder, for= attributes
    patterns = [
        (r'aria-label=["\']([^"\']{3,60})["\']', "aria-label", 0.88),
        (r'placeholder=["\']([^"\']{3,60})["\']', "placeholder", 0.80),
        (r'<label[^>]*for=["\']([^"\']+)["\']', "label-for", 0.82),
    ]
    for pat, strategy, conf in patterns:
        for m in re.finditer(pat, dom_context[:5000]):
            value = m.group(1)
            if strategy == "aria-label":
                sel = f'[aria-label="{value}"]'
            elif strategy == "placeholder":
                sel = f'[placeholder="{value}"]'
            else:
                sel = f'#{value}'
            suggestions.append({"selector": sel, "strategy": "label", "confidence": conf, "reasoning": f"Found {strategy}={value!r}"})
    return suggestions[:2]


def _strategy_text(original: str, dom_context: str) -> List[Dict[str, Any]]:
    """Suggest text-based selectors."""
    suggestions = []
    # Find button/link texts
    for tag in ["button", "a", "h1", "h2", "h3", "span"]:
        pattern = re.compile(rf'<{tag}[^>]*>([^<]{{3,80}})</{tag}>', re.IGNORECASE)
        for m in pattern.finditer(dom_context[:5000]):
            text = m.group(1).strip()
            if text:
                suggestions.append({
                    "selector": f"{tag}:has-text(\"{text}\")",
                    "strategy": "text",
                    "confidence": 0.75,
                    "reasoning": f"Visible text '{text}' found in {tag} element",
                })
    return suggestions[:2]


def _strategy_data_attributes(original: str, dom_context: str) -> List[Dict[str, Any]]:
    """Suggest data-testid / data-cy attribute selectors."""
    suggestions = []
    patterns = [
        (r'data-testid=["\']([^"\']+)["\']', "data-testid"),
        (r'data-cy=["\']([^"\']+)["\']', "data-cy"),
        (r'data-test=["\']([^"\']+)["\']', "data-test"),
        (r'\bid=["\']([a-zA-Z][\w-]{2,60})["\']', "id"),
    ]
    for pat, attr in patterns:
        for m in re.finditer(pat, dom_context[:5000]):
            value = m.group(1)
            if attr == "id":
                sel = f"#{value}"
            else:
                sel = f'[{attr}="{value}"]'
            suggestions.append({
                "selector": sel,
                "strategy": "attribute",
                "confidence": 0.90 if attr == "data-testid" else 0.82,
                "reasoning": f"Found {attr}={value!r} attribute",
            })
    return suggestions[:2]


# ---------------------------------------------------------------------------
# Semantic similarity (optional — falls back gracefully)
# ---------------------------------------------------------------------------

_encoder = None


def _get_encoder():
    global _encoder
    if _encoder is not None:
        return _encoder
    try:
        # pyrefly: ignore [missing-import]
        from sentence_transformers import SentenceTransformer
        _encoder = SentenceTransformer("all-MiniLM-L6-v2")
        log.info("self_heal.encoder_loaded")
    except Exception as exc:
        log.warning("self_heal.encoder_unavailable", error=str(exc))
        _encoder = False
    return _encoder


def _semantic_suggestions(original_selector: str, candidates: List[str]) -> List[Dict[str, Any]]:
    """Rank candidates by cosine similarity to original selector text."""
    encoder = _get_encoder()
    if not encoder:
        return []
    try:
        # pyrefly: ignore [missing-import]
        import numpy as np
        all_texts = [original_selector] + candidates
        embeddings = encoder.encode(all_texts, convert_to_numpy=True)
        orig_emb = embeddings[0]
        cand_embs = embeddings[1:]
        # Cosine similarity
        norms = np.linalg.norm(cand_embs, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)
        cand_norm = cand_embs / norms
        orig_norm = orig_emb / (np.linalg.norm(orig_emb) or 1)
        sims = cand_norm @ orig_norm
        results = []
        for i, (cand, sim) in enumerate(zip(candidates, sims)):
            if float(sim) >= 0.5:
                results.append({
                    "selector": cand,
                    "strategy": "semantic",
                    "confidence": round(float(sim), 3),
                    "reasoning": f"Semantic similarity {sim:.2f} to original selector",
                })
        return sorted(results, key=lambda x: x["confidence"], reverse=True)[:3]
    except Exception as exc:
        log.warning("self_heal.semantic_error", error=str(exc))
        return []


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def propose_healing(
    original_selector: str,
    action_type: str,
    dom_context: str,
    ai_suggestions: Optional[List[Dict[str, Any]]] = None,
    confidence_threshold: float = 0.75,
) -> List[Dict[str, Any]]:
    """
    Propose alternative selectors, sorted by confidence.
    Only returns candidates above the confidence threshold.
    """
    all_suggestions: List[Dict[str, Any]] = []

    # AI suggestions (from ai_service) — usually highest confidence
    if ai_suggestions:
        all_suggestions.extend(ai_suggestions)

    # Heuristic strategies
    all_suggestions.extend(_strategy_data_attributes(original_selector, dom_context))
    all_suggestions.extend(_strategy_accessible_label(original_selector, dom_context))
    all_suggestions.extend(_strategy_role_name(original_selector, dom_context))
    all_suggestions.extend(_strategy_text(original_selector, dom_context))

    # Deduplicate by selector
    seen = set()
    deduped = []
    for s in all_suggestions:
        sel = s.get("selector", "")
        if sel and sel not in seen:
            seen.add(sel)
            deduped.append(s)

    # Semantic re-ranking if encoder available
    if len(deduped) > 1:
        candidate_selectors = [s["selector"] for s in deduped]
        semantic = _semantic_suggestions(original_selector, candidate_selectors)
        # Merge semantic confidences
        sem_map = {s["selector"]: s["confidence"] for s in semantic}
        for s in deduped:
            if s["selector"] in sem_map:
                s["confidence"] = max(s["confidence"], sem_map[s["selector"]])

    # Filter by threshold and sort
    above_threshold = [s for s in deduped if s.get("confidence", 0) >= confidence_threshold]
    return sorted(above_threshold, key=lambda x: x.get("confidence", 0), reverse=True)[:5]
