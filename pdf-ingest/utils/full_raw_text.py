from typing import Any, Dict, List, Optional
import json

def _safe_text(x: Any) -> str:
    if x is None:
        return ""
    if isinstance(x, str):
        return x
    try:
        return json.dumps(x, ensure_ascii=False)
    except Exception:
        return str(x)

def build_full_raw_text(
    profile: Any,
    include_llm_history: bool = False,
    llm_histories: Optional[List[Dict[str, Any]]] = None,
    max_llm_items: int = 3,
) -> Dict[str, Any]:
    """
    Build a deterministic read-only fullRawText for `profile`.
    Returns {"text": "<fullRawText>", "sources": {...}}.

    `profile` is expected to be an ORM object with attributes: raw_text, summary, name, email,
    experience, education, achievements, meta, etc.

    `llm_histories` (optional) is a list of dicts with key full_response when include_llm_history=True.
    """
    parts: List[str] = []
    sources = {
        "raw_text": False,
        "summary": False,
        "experience": 0,
        "education": 0,
        "achievements": False,
        "meta_keys": [],
        "llm_history_count": 0,
    }

    # 1) RAW_TEXT
    raw = getattr(profile, "raw_text", None)
    if raw:
        parts.append("=== RAW_TEXT ===\n" + _safe_text(raw).strip())
        sources["raw_text"] = True

    # 2) SUMMARY / BASIC INFO
    summary_parts = []
    if getattr(profile, "summary", None):
        summary_parts.append("Summary: " + _safe_text(profile.summary).strip())
        sources["summary"] = True
    if getattr(profile, "name", None):
        summary_parts.append("Name: " + _safe_text(profile.name))
    if getattr(profile, "email", None):
        summary_parts.append("Email: " + _safe_text(profile.email))
    if summary_parts:
        parts.append("=== SUMMARY / BASIC INFO ===\n" + "\n".join(summary_parts))

    # 3) EXPERIENCE
    exp = getattr(profile, "experience", None)
    if exp:
        try:
            for i, e in enumerate(exp):
                header = f"=== EXPERIENCE {i+1} ==="
                entry_lines = []
                if isinstance(e, dict):
                    if e.get("title"):
                        entry_lines.append(f"Title: {_safe_text(e.get('title'))}")
                    if e.get("company"):
                        entry_lines.append(f"Company: {_safe_text(e.get('company'))}")
                    if e.get("startDate") or e.get("endDate"):
                        entry_lines.append(
                            f"Period: {e.get('startDate') or ''} - {e.get('endDate') or ''}"
                        )
                    if e.get("description"):
                        entry_lines.append(_safe_text(e.get("description")))
                else:
                    entry_lines.append(_safe_text(e))
                parts.append(header + "\n" + "\n".join([l for l in entry_lines if l]))
            sources["experience"] = len(exp)
        except Exception:
            # Skip on unexpected shape
            pass

    # 4) EDUCATION
    edu = getattr(profile, "education", None)
    if edu:
        try:
            for i, ed in enumerate(edu):
                parts.append(f"=== EDUCATION {i+1} ===\n{_safe_text(ed)}")
            sources["education"] = len(edu)
        except Exception:
            pass

    # 5) ACHIEVEMENTS
    achievements = getattr(profile, "achievements", None) or (
        (getattr(profile, "meta", {}) or {}).get("achievements")
    )
    if achievements:
        parts.append("=== ACHIEVEMENTS ===\n" + _safe_text(achievements))
        sources["achievements"] = True

    # 6) META textual keys (heuristic)
    meta = getattr(profile, "meta", {}) or {}
    if isinstance(meta, dict):
        text_keys: List[str] = []
        for k, v in meta.items():
            if v is None:
                continue
            if isinstance(v, str) and v.strip():
                parts.append(f"=== META:{k} ===\n{_safe_text(v)}")
                text_keys.append(k)
            elif isinstance(v, (list, dict)) and len(json.dumps(v or "")) < 2000:
                parts.append(f"=== META:{k} ===\n{_safe_text(v)}")
                text_keys.append(k)
        sources["meta_keys"] = text_keys

    # 7) Optional LLM history (included only if include_llm_history True and llm_histories provided)
    if include_llm_history and llm_histories:
        limit = max(0, int(max_llm_items))
        for i, h in enumerate(llm_histories[:limit]):
            fr = h.get("full_response") if isinstance(h, dict) else None
            if not fr:
                continue
            parsed = fr.get("parsed") if isinstance(fr, dict) else None
            if parsed:
                if parsed.get("rawText"):
                    parts.append(
                        f"=== LLM_HISTORY_RAWTEXT {i+1} ===\n{_safe_text(parsed.get('rawText'))}"
                    )
                elif parsed.get("raw_text"):
                    parts.append(
                        f"=== LLM_HISTORY_RAW_TEXT {i+1} ===\n{_safe_text(parsed.get('raw_text'))}"
                    )
                else:
                    parts.append(f"=== LLM_HISTORY_PARSED {i+1} ===\n{_safe_text(parsed)}")
            else:
                parts.append(f"=== LLM_HISTORY_FULL_RESPONSE {i+1} ===\n{_safe_text(fr)}")
        sources["llm_history_count"] = len(llm_histories or [])

    full_text = "\n\n".join([p for p in parts if p and str(p).strip()])
    return {"text": full_text, "sources": sources}
