#!/usr/bin/env python3
"""
Batch audit for current CV name extraction quality.

This script is intentionally lightweight:
- .txt files: run the current Python canonicalizer directly
- .pdf files with extractable text: run the text route equivalent locally
- .pdf files without extractable text: classify as OCR-needed (no true OCR in this audit)

It flags suspicious extracted names heuristically so we can review patterns
before changing parser rules.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from cv_parser.canonicalize import canonicalize_cv, detect_heading


HEADER_LIKE_TERMS = {
    "contact",
    "contacts",
    "coordonnees",
    "coordonnees personnelles",
    "curriculum",
    "curriculum vitae",
    "cv",
    "resume",
    "profil",
    "profile",
    "details",
    "personal details",
    "about",
    "summary",
    "objective",
    "information",
}

MARKDOWN_NOISE_RE = re.compile(r"[#*_`\[\]\|]")
SYMBOL_HEAVY_RE = re.compile(r"[^A-Za-zÀ-ÖØ-öø-ÿ'’.\-\s]")


def normalize_label(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def strip_accents(value: str) -> str:
    return unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")


def compact_preview(text: str, max_len: int = 160) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    return text if len(text) <= max_len else text[: max_len - 1] + "…"


def first_non_empty_lines(text: str, limit: int = 5) -> List[str]:
    return [line.strip() for line in text.splitlines() if line.strip()][:limit]


def analyze_name(name: Optional[str]) -> List[str]:
    if not name:
        return ["missing_name"]

    stripped = name.strip()
    normalized = normalize_label(stripped)
    normalized_words = strip_accents(stripped.lower())
    normalized_words = re.sub(r"[^a-z\s]", " ", normalized_words)
    normalized_words = re.sub(r"\s+", " ", normalized_words).strip()
    flags: List[str] = []

    if len(stripped) < 4:
        flags.append("too_short")
    if len(stripped.split()) < 2:
        flags.append("single_token")
    if normalized in HEADER_LIKE_TERMS:
        flags.append("header_term")
    elif any(
        normalized_words == term or normalized_words.startswith(f"{term} ")
        for term in HEADER_LIKE_TERMS
    ):
        flags.append("header_prefix")
    if detect_heading(stripped):
        flags.append("parser_heading")
    if MARKDOWN_NOISE_RE.search(stripped):
        flags.append("markdown_noise")
    if any(ch.isdigit() for ch in stripped):
        flags.append("contains_digit")
    if SYMBOL_HEAVY_RE.search(stripped):
        flags.append("symbol_noise")
    if stripped.endswith(":"):
        flags.append("ends_with_colon")

    return flags


def analyze_pdf_bytes(pdf_bytes: bytes) -> Dict[str, Any]:
    analysis: Dict[str, Any] = {
        "text": "",
        "text_len": 0,
        "pages": 0,
        "density": 0.0,
        "error": None,
    }
    try:
        import io
        import pdfplumber  # type: ignore

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:  # type: ignore[attr-defined]
            texts: List[str] = []
            page_count = len(pdf.pages)
            for page in pdf.pages:
                try:
                    extracted = page.extract_text() or ""
                except Exception:
                    extracted = ""
                if extracted:
                    texts.append(extracted)
            raw_text = "\n".join(texts).strip()
            normalized = re.sub(r"\s+", " ", raw_text)
            text_len = len(normalized)
            analysis.update(
                {
                    "text": raw_text,
                    "text_len": text_len,
                    "pages": page_count,
                    "density": text_len / max(1, page_count),
                }
            )
    except Exception as exc:
        analysis["error"] = str(exc)
    return analysis


def classify_routing_for_pdf(path: Path) -> Dict[str, Any]:
    pdf_bytes = path.read_bytes()
    analysis = analyze_pdf_bytes(pdf_bytes)
    raw_text = analysis.get("text") or ""
    text_len = int(analysis.get("text_len") or 0)
    density = float(analysis.get("density") or 0.0)
    if raw_text.strip() and (text_len >= 500 or density >= 80):
        return {
            "route_kind": "text_pdf",
            "raw_text": raw_text,
            "analysis": analysis,
        }
    return {
        "route_kind": "ocr_needed",
        "raw_text": "",
        "analysis": analysis,
    }


def evaluate_text(text: str, source_label: str) -> Dict[str, Any]:
    result = canonicalize_cv(text.strip(), mode="text", diagnostics={"sample": source_label})
    normalized = result.get("normalized", {}) if isinstance(result, dict) else {}
    name = normalized.get("name") if isinstance(normalized, dict) else None
    return {
        "name": name,
        "flags": analyze_name(name if isinstance(name, str) else None),
        "first_lines": first_non_empty_lines(text),
        "summary": ((normalized.get("summary") or {}).get("text") if isinstance(normalized, dict) else None),
    }


def iter_fixture_files(roots: Iterable[Path]) -> Iterable[Path]:
    for root in roots:
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            if path.name == ".DS_Store":
                continue
            yield path


def audit_paths(paths: Iterable[Path]) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = []
    by_ext = Counter()
    by_route = Counter()
    flag_counts = Counter()
    unsupported = Counter()

    for path in paths:
        ext = path.suffix.lower()
        by_ext[ext or "<none>"] += 1

        row: Dict[str, Any] = {
            "path": str(path),
            "ext": ext or "<none>",
        }

        if ext == ".txt":
            text = path.read_text(encoding="utf-8", errors="ignore")
            row["route_kind"] = "text"
            row.update(evaluate_text(text, str(path)))
        elif ext == ".pdf":
            pdf_info = classify_routing_for_pdf(path)
            row["route_kind"] = pdf_info["route_kind"]
            row["pdf_analysis"] = {
                "text_len": int(pdf_info["analysis"].get("text_len") or 0),
                "pages": int(pdf_info["analysis"].get("pages") or 0),
                "density": float(pdf_info["analysis"].get("density") or 0.0),
                "error": pdf_info["analysis"].get("error"),
            }
            if pdf_info["route_kind"] == "text_pdf":
                row.update(evaluate_text(pdf_info["raw_text"], str(path)))
            else:
                row["name"] = None
                row["flags"] = ["ocr_needed"]
                row["first_lines"] = []
                row["summary"] = None
        else:
            unsupported[ext or "<none>"] += 1
            row["route_kind"] = "unsupported"
            row["name"] = None
            row["flags"] = ["unsupported_type"]
            row["first_lines"] = []
            row["summary"] = None

        rows.append(row)
        by_route[row["route_kind"]] += 1
        for flag in row["flags"]:
            flag_counts[flag] += 1

    suspicious_rows = [
        row
        for row in rows
        if any(flag not in {"unsupported_type", "ocr_needed"} for flag in row.get("flags", []))
    ]

    return {
        "summary": {
            "total_files": len(rows),
            "by_ext": dict(sorted(by_ext.items())),
            "by_route": dict(sorted(by_route.items())),
            "flag_counts": dict(sorted(flag_counts.items())),
            "unsupported_types": dict(sorted(unsupported.items())),
            "suspicious_count": len(suspicious_rows),
        },
        "rows": rows,
    }


def print_report(report: Dict[str, Any]) -> None:
    summary = report["summary"]
    print("Summary")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print()

    interesting = [
        row for row in report["rows"]
        if row["route_kind"] != "unsupported" and row.get("flags")
    ]
    if not interesting:
        print("No suspicious rows flagged.")
        return

    print("Flagged samples")
    for row in interesting[:40]:
        print(
            json.dumps(
                {
                    "path": row["path"],
                    "route_kind": row["route_kind"],
                    "name": row.get("name"),
                    "flags": row.get("flags"),
                    "first_lines": row.get("first_lines"),
                },
                ensure_ascii=False,
            )
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("roots", nargs="+", help="Fixture folder(s) to audit")
    parser.add_argument("--json-out", help="Optional path to write full JSON report")
    args = parser.parse_args()

    roots = [Path(root).expanduser().resolve() for root in args.roots]
    report = audit_paths(iter_fixture_files(roots))
    print_report(report)

    if args.json_out:
        output_path = Path(args.json_out).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print()
        print(f"Wrote JSON report to {output_path}")


if __name__ == "__main__":
    main()
