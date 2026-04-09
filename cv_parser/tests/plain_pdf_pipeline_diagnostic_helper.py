from __future__ import annotations

import io
import json
import sys
from pathlib import Path
from typing import Any

import pdfplumber

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from cv_parser.canonicalize import canonicalize_cv, collapse_spaced_caps, detect_heading, extract_sections
from cv_parser.extract.sections import classify_heading, parse_sections
from cv_parser.extract.text_pdf import _reconstruct_page_text, extract_text_pdf


def _normalize_pdf_measure_text(text: str) -> str:
    if not text:
        return ""
    return " ".join(text.split()).strip()


def _analyze_pdf_bytes_same_path(pdf_bytes: bytes) -> dict[str, Any]:
    analysis: dict[str, Any] = {
        "text": "",
        "text_len": 0,
        "pages": 0,
        "density": 0.0,
        "error": None,
    }
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            texts: list[str] = []
            page_count = len(pdf.pages)
            for page in pdf.pages:
                try:
                    extracted = page.extract_text() or ""
                except Exception:
                    extracted = ""
                if extracted:
                    texts.append(extracted)
            raw_text = "\n".join(texts).strip()
            normalized = _normalize_pdf_measure_text(raw_text)
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
        analysis["error"] = f"pdf_analysis_failed:{exc}"
    return analysis


def _normalize_newlines(value: str) -> str:
    return value.replace("\r\n", "\n").replace("\r", "\n")


def _read_pdf_bytes(pdf_path: Path) -> bytes:
    return pdf_path.read_bytes()


def _service_pages(pdf_path: Path) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            text = _normalize_newlines((page.extract_text() or "").strip())
            pages.append(
                {
                    "pageNumber": page_number,
                    "width": float(page.width or 0.0),
                    "height": float(page.height or 0.0),
                    "text": text,
                }
            )
    return pages


def _informative_pages(pdf_path: Path) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            text = _normalize_newlines((_reconstruct_page_text(page) or "").strip())
            pages.append(
                {
                    "pageNumber": page_number,
                    "width": float(page.width or 0.0),
                    "height": float(page.height or 0.0),
                    "text": text,
                }
            )
    return pages


def _heading_candidates(lines: list[str]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        active_heading = detect_heading(stripped)
        informative_heading = classify_heading(stripped)
        collapsed = collapse_spaced_caps(stripped)
        if active_heading or informative_heading:
            candidates.append(
                {
                    "line": stripped,
                    "collapsed": collapsed,
                    "activeHeading": active_heading,
                    "informativeHeading": informative_heading,
                }
            )
    return candidates


def _preview_entries(values: list[str], limit: int = 3) -> list[str]:
    previews: list[str] = []
    for value in values[:limit]:
        cleaned = _normalize_newlines(value).strip()
        previews.append(cleaned[:220])
    return previews


def _fixture_payload(pdf_path: Path) -> dict[str, Any]:
    pdf_bytes = _read_pdf_bytes(pdf_path)
    service_pages = _service_pages(pdf_path)
    informative_pages = _informative_pages(pdf_path)
    service_joined_text = "\n\n".join(page["text"] for page in service_pages if page["text"]).strip()
    informative_joined_text = "\n\n".join(page["text"] for page in informative_pages if page["text"]).strip()

    analysis = _analyze_pdf_bytes_same_path(pdf_bytes)
    analysis_text = _normalize_newlines(str(analysis.get("text") or "").strip())
    active_sections = extract_sections(analysis_text)
    informative_extracted = extract_text_pdf(pdf_path)
    informative_parse = parse_sections(str(getattr(informative_extracted.normalized, "raw", "") or ""))
    canonical = canonicalize_cv(analysis_text, mode="text", diagnostics={"route": "pdf_has_text", "pages": len(service_pages)})

    analysis_lines = [line for line in analysis_text.splitlines() if line.strip()]
    active_heading_candidates = _heading_candidates(analysis_lines)

    return {
        "fixture": pdf_path.name,
        "fixturePath": str(pdf_path),
        "pageCount": len(service_pages),
        "extraction": {
            "servicePages": service_pages,
            "informativePages": informative_pages,
            "analysisRawText": analysis_text,
            "serviceJoinedText": service_joined_text,
            "informativeJoinedText": informative_joined_text,
            "activeHeadingCandidates": active_heading_candidates,
            "flatteningSignals": {
                "analysisUsesSingleString": isinstance(analysis.get("text"), str),
                "analysisMatchesServiceJoined": analysis_text == service_joined_text,
                "servicePageCount": len(service_pages),
                "analysisPageCount": int(analysis.get("pages") or 0),
            },
        },
        "sectionCandidates": {
            "activeExtractSectionsKeys": list(active_sections.keys()),
            "activeExtractSections": [
                {
                    "key": key,
                    "count": len(values),
                    "previews": _preview_entries(values),
                }
                for key, values in active_sections.items()
            ],
            "informativeParseSections": [
                {
                    "key": key,
                    "count": len(values),
                    "previews": _preview_entries(values),
                }
                for key, values in informative_parse.items()
            ],
            "informativeRawSections": [
                {
                    "label": str(section.get("label") or ""),
                    "preview": _normalize_newlines(str(section.get("content") or section.get("text") or "").strip())[:220],
                }
                for section in (getattr(informative_extracted.normalized, "rawSections", None) or [])
            ],
        },
        "canonical": {
            "rawSections": canonical.get("rawSections") or [],
            "normalized": canonical.get("normalized") or {},
            "diagnostics": canonical.get("diagnostics") or {},
        },
    }


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        raise SystemExit("usage: plain_pdf_pipeline_diagnostic_helper.py <pdf> [<pdf> ...]")

    payload = [_fixture_payload(Path(arg).resolve()) for arg in argv[1:]]
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
