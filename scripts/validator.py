#!/usr/bin/env python3
"""
Offline acceptance validator for canonical structured CV JSON payloads.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from dataclasses import dataclass
from glob import glob
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
LANGUAGE_SOURCE = REPO_ROOT / "shared" / "language_names.json"
SCENARIO_LABELS = {
    "a-multicol": "A",
    "b-orphan": "B",
    "c-edu-noise": "C",
}


def load_canonical_languages() -> set[str]:
    """Load canonical language names from the shared JSON map or fallback set."""
    baseline = {
        "English",
        "French",
        "Spanish",
        "German",
        "Italian",
        "Portuguese",
        "Chinese",
        "Japanese",
        "Korean",
        "Russian",
        "Arabic",
        "Hindi",
    }
    if not LANGUAGE_SOURCE.exists():
        return baseline
    try:
        data = json.loads(LANGUAGE_SOURCE.read_text(encoding="utf-8"))
    except Exception:
        return baseline
    names = set(baseline)
    for canonical_name in data.keys():
        if isinstance(canonical_name, str) and canonical_name.strip():
            names.add(canonical_name.strip())
    return names


CANONICAL_LANGUAGES = load_canonical_languages()
LANGUAGE_BANNED_SNIPPETS = [
    re.compile(r"\bCPOP\b", re.IGNORECASE),
    re.compile(r"\bSOCP\b", re.IGNORECASE),
    re.compile(r"\bLevel\s*(?:I{1,3}|IV|V|VI)\b", re.IGNORECASE),
    re.compile(r"\bCourse\b", re.IGNORECASE),
    re.compile(r"\bCurriculum\b", re.IGNORECASE),
    re.compile(r"\bHawaii\b", re.IGNORECASE),
]
EDU_KEYWORDS = ["CPOP", "SOCP", "Course Curriculum"]


@dataclass
class CheckOutcome:
    state: str  # "pass", "fail", or "blocked"
    message: Optional[str] = None

    def symbol(self) -> str:
        if self.state == "pass":
            return "✅"
        if self.state == "fail":
            return "❌"
        return "BLOCKED"


@dataclass
class ValidationResult:
    cv: str
    mode: str
    path: Path
    preview: str
    checks: Dict[str, CheckOutcome]
    blocked: bool = False

    @property
    def any_failure(self) -> bool:
        return any(outcome.state == "fail" for outcome in self.checks.values())

    @property
    def any_blocked(self) -> bool:
        return self.blocked or any(outcome.state == "blocked" for outcome in self.checks.values())


def expand_inputs(patterns: Sequence[str]) -> List[Path]:
    """Expand glob patterns into unique file paths."""
    paths: List[Path] = []
    seen: set[Path] = set()
    for pattern in patterns:
        matches = (
            glob(pattern, recursive=True)
            if any(ch in pattern for ch in "*?[]")
            else [pattern]
        )
        for entry in matches:
            candidate = Path(entry)
            if candidate.is_file():
                resolved = candidate.resolve()
                if resolved not in seen:
                    seen.add(resolved)
                    paths.append(resolved)
    return sorted(paths)


def coerce_string(value: object) -> str:
    """Normalize value to a single-line trimmed string."""
    if value is None:
        return ""
    if isinstance(value, str):
        text = value
    else:
        text = str(value)
    return re.sub(r"\s+", " ", text).strip()


def extract_summary_text(normalized: Dict[str, object]) -> str:
    summary_first = normalized.get("summaryFirstSentence")
    if isinstance(summary_first, str) and summary_first.strip():
        return coerce_string(summary_first)
    summary = normalized.get("summary")
    if isinstance(summary, str):
        return coerce_string(summary)
    if isinstance(summary, dict):
        text = summary.get("text")
        if isinstance(text, str):
            return coerce_string(text)
    return ""


def extract_preview(normalized: Dict[str, object]) -> str:
    summary = extract_summary_text(normalized)
    if summary:
        return summary
    raw_text = normalized.get("rawText") or normalized.get("raw")
    preview = coerce_string(raw_text)
    return preview[:120].strip()


def resolve_cv_label(path: Path) -> str:
    name = path.name.lower()
    for slug, label in SCENARIO_LABELS.items():
        if name.startswith(slug):
            return label
    return "?"


def resolve_mode(path: Path, diag: Dict[str, object]) -> str:
    if isinstance(diag, dict):
        engine = coerce_string(diag.get("engine")).lower()
        if engine == "text":
            return "text"
        if engine:
            return "ocr"
    stem = path.stem.lower()
    if stem.endswith("_text"):
        return "text"
    if stem.endswith("_ocr"):
        return "ocr"
    return "unknown"


def experience_entries(normalized: Dict[str, object]) -> List[Dict[str, object]]:
    entries = normalized.get("experience")
    if isinstance(entries, list):
        return [item for item in entries if isinstance(item, dict)]
    return []


def education_entries(normalized: Dict[str, object]) -> List[Dict[str, object]]:
    entries = normalized.get("education")
    if isinstance(entries, list):
        return [item for item in entries if isinstance(item, dict)]
    return []


def language_entries(normalized: Dict[str, object]) -> List[Dict[str, object]]:
    entries = normalized.get("languages")
    if isinstance(entries, list):
        return [item for item in entries if isinstance(item, dict)]
    return []


def check_summary(normalized: Dict[str, object]) -> CheckOutcome:
    summary_text = extract_summary_text(normalized)
    if not summary_text:
        return CheckOutcome("fail", "summary missing (firstSentence)")
    if summary_text[0] in {",", ";", ":"}:
        return CheckOutcome("fail", "leading punctuation (stripLeadingSummaryHeading)")
    if not re.search(r"[.!?](?:\s|$)", summary_text):
        return CheckOutcome("fail", "no terminal punctuation (firstSentence)")
    if len(summary_text.split()) < 4:
        return CheckOutcome("fail", "too short for full sentence (firstSentence)")
    return CheckOutcome("pass")


def check_experience(normalized: Dict[str, object]) -> CheckOutcome:
    entries = experience_entries(normalized)
    if not entries:
        return CheckOutcome("fail", "no experience entries (mergeNarrativeIntoExperience)")
    narrative_re = re.compile(r"^responsible for", re.IGNORECASE)
    for entry in entries:
        for key in ("company", "position"):
            value = coerce_string(entry.get(key))
            if value and narrative_re.match(value):
                return CheckOutcome("fail", f"{key} starts with narrative (mergeNarrativeIntoExperience)")
        responsibilities = coerce_string(entry.get("responsibilities"))
        bullets = entry.get("responsibilityBullets")
        if responsibilities and not (isinstance(bullets, list) and bullets):
            if narrative_re.match(responsibilities):
                return CheckOutcome("fail", "narrative not merged as bullets (mergeNarrativeIntoExperience)")
    return CheckOutcome("pass")


def collect_text_fields(entries: Iterable[Dict[str, object]], fields: Sequence[str]) -> str:
    parts: List[str] = []
    for entry in entries:
        for field in fields:
            value = coerce_string(entry.get(field))
            if value:
                parts.append(value)
    return " ".join(parts)


def check_education(normalized: Dict[str, object]) -> CheckOutcome:
    entries = education_entries(normalized)
    if not entries:
        return CheckOutcome("fail", "no education entries (stripLeadingLanguagesPrefix)")
    combined = collect_text_fields(entries, ("institution", "degree", "fieldOfStudy", "summary", "location"))
    combined_lower = combined.lower()
    raw_text = coerce_string(normalized.get("rawText") or normalized.get("raw"))
    missing = []
    for keyword in EDU_KEYWORDS:
        if keyword.lower() in raw_text.lower() and keyword.lower() not in combined_lower:
            missing.append(keyword)
    if missing:
        return CheckOutcome("fail", f"education missing tokens [{', '.join(sorted(missing))}] (stripLeadingLanguagesPrefix)")
    return CheckOutcome("pass")


def check_languages(normalized: Dict[str, object]) -> CheckOutcome:
    entries = language_entries(normalized)
    if not entries:
        return CheckOutcome("pass")
    invalid: List[str] = []
    contaminated: List[str] = []
    for entry in entries:
        name = coerce_string(entry.get("name"))
        if not name:
            invalid.append("<empty>")
            continue
        if name not in CANONICAL_LANGUAGES:
            invalid.append(name)
        if any(pattern.search(name) for pattern in LANGUAGE_BANNED_SNIPPETS):
            contaminated.append(name)
    if contaminated:
        tokens = ", ".join(sorted(set(contaminated)))
        return CheckOutcome("fail", f"contains training tokens [{tokens}] (normalizeLanguageTokenSync)")
    if invalid:
        tokens = ", ".join(sorted(set(invalid)))
        return CheckOutcome("fail", f"non-canonical languages [{tokens}] (normalizeLanguageTokenSync)")
    return CheckOutcome("pass")


def check_diagnostics(diag: Dict[str, object], mode: str) -> CheckOutcome:
    if not diag:
        return CheckOutcome("fail", "diagnostics missing")
    engine = coerce_string(diag.get("engine"))
    if not engine:
        return CheckOutcome("fail", "engine missing in diagnostics")
    engine_lc = engine.lower()
    dpi_used = diag.get("dpi_used")
    if mode == "text" or engine_lc == "text":
        if dpi_used not in (None, "", 0):
            return CheckOutcome("fail", "text mode should omit dpi_used")
        return CheckOutcome("pass")
    if dpi_used is None:
        return CheckOutcome("fail", f"dpi_used missing for engine {engine_lc}")
    try:
        dpi_val = float(dpi_used)
    except (TypeError, ValueError):
        return CheckOutcome("fail", f"dpi_used not numeric ({dpi_used!r})")
    if not math.isfinite(dpi_val) or dpi_val <= 0:
        return CheckOutcome("fail", f"dpi_used invalid ({dpi_used})")
    return CheckOutcome("pass")


def load_json(path: Path) -> Tuple[Optional[Dict[str, object]], Optional[str]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return None, f"failed to load JSON ({exc})"
    if not isinstance(data, dict):
        return None, "root JSON is not an object"
    return data, None


def validate_file(path: Path) -> ValidationResult:
    data, error = load_json(path)
    cv_label = resolve_cv_label(path)
    dummy_checks = {
        "Summary OK": CheckOutcome("blocked"),
        "Experience OK": CheckOutcome("blocked"),
        "Education OK": CheckOutcome("blocked"),
        "Languages OK": CheckOutcome("blocked"),
        "Diagnostics OK": CheckOutcome("blocked"),
    }
    if error or data is None:
        first = CheckOutcome("blocked", error or "unreadable JSON")
        checks = dict(dummy_checks)
        checks["Summary OK"] = first
        return ValidationResult(
            cv=cv_label,
            mode="unknown",
            path=path,
            preview="",
            checks=checks,
            blocked=True,
        )

    if data.get("status") == "BLOCKED":
        checks = dict(dummy_checks)
        checks["Summary OK"] = CheckOutcome("blocked", coerce_string(data.get("reason") or "parser blocked"))
        return ValidationResult(
            cv=cv_label,
            mode=coerce_string(data.get("input", {}).get("mode") or resolve_mode(path, {})) or "unknown",
            path=path,
            preview="",
            checks=checks,
            blocked=True,
        )

    normalized = data.get("normalized")
    diag = data.get("diagnostics")
    if not isinstance(normalized, dict) or not isinstance(diag, dict):
        checks = dict(dummy_checks)
        checks["Summary OK"] = CheckOutcome("blocked", "missing normalized payload")
        return ValidationResult(
            cv=cv_label,
            mode=resolve_mode(path, diag if isinstance(diag, dict) else {}),
            path=path,
            preview="",
            checks=checks,
            blocked=True,
        )

    mode = resolve_mode(path, diag)
    preview = extract_preview(normalized)

    summary_outcome = check_summary(normalized)
    experience_outcome = check_experience(normalized)
    education_outcome = check_education(normalized)
    languages_outcome = check_languages(normalized)
    diagnostics_outcome = check_diagnostics(diag, mode)

    checks = {
        "Summary OK": summary_outcome,
        "Experience OK": experience_outcome,
        "Education OK": education_outcome,
        "Languages OK": languages_outcome,
        "Diagnostics OK": diagnostics_outcome,
    }

    return ValidationResult(
        cv=cv_label,
        mode=mode or "unknown",
        path=path,
        preview=preview,
        checks=checks,
        blocked=False,
    )


def render_table(results: Sequence[ValidationResult]) -> str:
    header = "CV | Mode | Summary OK | Experience OK | Education OK | Languages OK | Diagnostics OK | Preview"
    separator = "-- | ---- | ---------- | ------------- | -------------| -------------| ---------------| -------"
    rows = [header, separator]
    for result in results:
        preview_display = json.dumps(result.preview or "")
        row = [
            result.cv,
            result.mode,
            result.checks["Summary OK"].symbol(),
            result.checks["Experience OK"].symbol(),
            result.checks["Education OK"].symbol(),
            result.checks["Languages OK"].symbol(),
            result.checks["Diagnostics OK"].symbol(),
            preview_display,
        ]
        rows.append(" | ".join(row))
    return "\n".join(rows)


def render_failures(results: Sequence[ValidationResult]) -> List[str]:
    lines: List[str] = []
    for result in results:
        issues: List[str] = []
        for key, outcome in result.checks.items():
            if outcome.state == "blocked" and not outcome.message:
                continue
            if outcome.state in {"fail", "blocked"}:
                label = key.split()[0]
                detail = outcome.message or key
                issues.append(f"{label}: {detail}")
        if issues:
            joined = "; ".join(issues)
            lines.append(f"{result.cv} {result.mode}: {joined}")
    return lines


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate canonical structured CV JSON files.",
    )
    parser.add_argument(
        "paths",
        nargs="+",
        help="JSON files or glob patterns (e.g. /tmp/structured/*.json)",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    paths = expand_inputs(args.paths)
    if not paths:
        print("No JSON files matched.", file=sys.stderr)
        return 2

    results = [validate_file(path) for path in paths]
    table = render_table(results)
    print(table)

    failure_lines = render_failures(results)
    if failure_lines:
        for line in failure_lines:
            print(line)

    any_blocked = any(result.any_blocked for result in results)
    any_fail = any(result.any_failure for result in results)

    if any_fail:
        return 1
    if any_blocked:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
