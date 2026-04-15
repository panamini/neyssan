from __future__ import annotations

import logging
import io
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse

import pdfplumber
import requests

from cv_parser.canonicalize import detect_heading, strip_accents
from cv_parser_service.mistral_resume_v3 import (
    INTERNAL_CANONICAL_PAYLOAD_DIAGNOSTIC_KEY,
    run_resume_pipeline_from_bytes,
    run_resume_pipeline_from_url,
)

LOGGER = logging.getLogger(__name__)

MARKDOWN_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+(.+?)\s*$")
MARKDOWN_TABLE_ROW_RE = re.compile(r"^\s*\|.*\|\s*$")
MARKDOWN_TABLE_SEPARATOR_RE = re.compile(r"^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$")
NON_CANONICAL_HEADING_FAMILIES = {
    "SUMMARY",
    "PROFILE",
    "EXPERIENCE",
    "EDUCATION",
    "SKILLS",
    "LANGUAGES",
    "CERTIFICATIONS",
    "PROJECTS",
    "ACHIEVEMENTS",
    "DETAILS",
    "HOBBIES",
    "LINKS",
    "ADDITIONAL INFORMATION",
}
STRUCTURAL_OCR_SECTION_FAMILIES = {
    "EXPERIENCE",
    "EDUCATION",
    "LANGUAGES",
    "SKILLS",
    "CERTIFICATIONS",
    "PROJECTS",
    "ACHIEVEMENTS",
}
NOISY_OCR_SECTION_FAMILIES = {"BODY", "DETAILS"}


class MistralOCRError(RuntimeError):
    """Raised when a Mistral OCR request fails."""

def _safe_filename(name: Optional[str], fallback: str = "upload.pdf") -> str:
    if name:
        candidate = name.strip()
        if candidate:
            return candidate
    return fallback


def _fallback_pages_from_pdf_bytes(data: bytes, document_name: Optional[str]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    try:
        pdf = pdfplumber.open(io.BytesIO(data))
    except Exception as exc:
        raise MistralOCRError("mistral_ocr_unreadable_pdf") from exc

    pages: List[Dict[str, Any]] = []
    total_chars = 0
    try:
        for index, page in enumerate(pdf.pages or []):
            text = page.extract_text() or ""
            markdown = text.strip()
            total_chars += len(markdown)
            pages.append({"index": index, "markdown": markdown})
    finally:
        pdf.close()

    diagnostics = {
        "model": "mistral-fallback-dev",
        "pages": len(pages),
        "page_count": len(pages),
        "ocr_chars": total_chars,
        "document": _safe_filename(document_name),
        "fallback": True,
    }
    return pages, diagnostics


def _document_name_from_url(url: str) -> Optional[str]:
    try:
        path = urlparse(url).path or ""
    except Exception:
        return None
    candidate = path.rstrip("/").rsplit("/", 1)[-1]
    return candidate or None


def _clean_markdown_heading_text(value: str) -> str:
    cleaned = (value or "").strip()
    cleaned = re.sub(r"[`*_]+", "", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip(" -:")


def _resolve_markdown_heading_to_canonical_label(value: str) -> Optional[str]:
    heading_text = _clean_markdown_heading_text(value)
    if not heading_text:
        return None
    direct = detect_heading(heading_text)
    if direct:
        return direct

    normalized = strip_accents(heading_text).upper()
    normalized = re.sub(r"[^A-Z0-9/&+ ]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()

    fallback_patterns = [
        (r"\b(EXPERIENCE|EMPLOYMENT|EMPLOYMENT HISTORY|WORK HISTORY|WORKING EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EXPERIENCE)\b", "EXPERIENCE"),
        (r"\b(EDUCATION|ACADEMIC|QUALIFICATION|QUALIFICATIONS|FORMATION|TRAINING)\b", "EDUCATION"),
        (r"\b(SKILL|SKILLS|COMPETENC|STRENGTH)\b", "SKILLS"),
        (r"\b(LANGUAGE|LANGUAGES|LANGUES|IDIOMAS)\b", "LANGUAGES"),
        (r"\b(CERTIFICATION|CERTIFICATIONS|CERTIFICATE|CERTIFICATES)\b", "CERTIFICATIONS"),
        (r"\b(PROJECT|PROJECTS)\b", "PROJECTS"),
        (r"\b(ACHIEVEMENT|ACHIEVEMENTS|AWARDS?)\b", "ACHIEVEMENTS"),
        (r"\b(DETAILS|CONTACT|COORDONNEES|PERSONAL DETAILS|PERSONAL DOSSIER|ADDRESS)\b", "DETAILS"),
        (r"\b(HOBBIES|INTERESTS)\b", "HOBBIES"),
        (r"\b(PROFILE|SUMMARY|OBJECTIVE)\b", "SUMMARY"),
    ]
    for pattern, label in fallback_patterns:
        if re.search(pattern, normalized):
            return label
    return None


def derive_raw_sections_from_markdown_pages(
    pages: Iterable[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    raw_sections: List[Dict[str, Any]] = []
    current_label: Optional[str] = None
    current_lines: List[str] = []
    heading_count = 0
    table_row_count = 0
    page_count = 0
    inside_table = False
    seen_table_header_row = False
    canonical_heading_count = 0

    def flush() -> None:
        nonlocal current_label, current_lines
        if not current_lines:
            current_label = None
            return
        content = "\n".join(current_lines).strip()
        if content:
            raw_sections.append({"label": current_label or "BODY", "content": content})
        current_label = None
        current_lines = []

    def has_following_markdown_table(lines: List[str], start_index: int) -> bool:
        cursor = start_index + 1
        while cursor < len(lines) and not lines[cursor].strip():
            cursor += 1
        if cursor + 1 >= len(lines):
            return False
        first = lines[cursor].strip()
        second = lines[cursor + 1].strip()
        return bool(MARKDOWN_TABLE_ROW_RE.match(first) and MARKDOWN_TABLE_SEPARATOR_RE.match(second))

    for page in pages:
        page_count += 1
        markdown = str(page.get("markdown") or "")
        page_lines = markdown.replace("\r", "").split("\n")
        for line_index, raw_line in enumerate(page_lines):
            stripped = raw_line.strip()
            if not stripped:
                inside_table = False
                seen_table_header_row = False
                if current_lines and current_lines[-1] != "":
                    current_lines.append("")
                continue
            if stripped == "---":
                inside_table = False
                seen_table_header_row = False
                continue
            heading_match = MARKDOWN_HEADING_RE.match(raw_line)
            if heading_match:
                heading_text = _clean_markdown_heading_text(heading_match.group(1))
                if heading_text:
                    heading_count += 1
                    canonical_label = _resolve_markdown_heading_to_canonical_label(heading_text)
                    heading_level = len(heading_match.group(0).lstrip().split(maxsplit=1)[0])
                    normalized_heading = strip_accents(heading_text).upper()
                    if (
                        current_label == "EXPERIENCE"
                        and heading_level > 1
                        and canonical_label == "EDUCATION"
                        and normalized_heading not in {"EDUCATION", "FORMATION", "ACADEMIC QUALIFICATION", "ACADEMIC QUALIFICATIONS", "EDUCATIONAL QUALIFICATION", "EDUCATIONAL QUALIFICATIONS"}
                    ):
                        current_lines.append(heading_text)
                        continue
                    if canonical_label and canonical_label in NON_CANONICAL_HEADING_FAMILIES:
                        flush()
                        current_label = canonical_label
                        canonical_heading_count += 1
                    else:
                        if current_label is None:
                            current_label = "BODY"
                        current_lines.append(heading_text)
                continue
            plain_heading_label = _resolve_markdown_heading_to_canonical_label(stripped.rstrip(":"))
            if plain_heading_label in {"EDUCATION", "LANGUAGES"} and has_following_markdown_table(page_lines, line_index):
                flush()
                current_label = plain_heading_label
                canonical_heading_count += 1
                continue
            if current_label is None:
                current_label = "BODY"
            normalized_line = raw_line.strip()
            if MARKDOWN_TABLE_ROW_RE.match(normalized_line):
                if not MARKDOWN_TABLE_SEPARATOR_RE.match(normalized_line):
                    if inside_table and seen_table_header_row:
                        table_row_count += 1
                    else:
                        seen_table_header_row = True
                    inside_table = True
                current_lines.append(normalized_line)
                continue
            inside_table = False
            seen_table_header_row = False
            current_lines.append(stripped)
        flush()
        inside_table = False
        seen_table_header_row = False

    diagnostics = {
        "ocr_markdown_pages": page_count,
        "ocr_markdown_sections": len(raw_sections),
        "ocr_markdown_headings": heading_count,
        "ocr_markdown_canonical_headings": canonical_heading_count,
        "ocr_markdown_table_rows": table_row_count,
        "ocr_markdown_body_only": all(section.get("label") == "BODY" for section in raw_sections) if raw_sections else True,
    }
    return raw_sections, diagnostics


def should_use_ocr_raw_sections(
    raw_sections: Iterable[Dict[str, Any]],
    diagnostics: Optional[Dict[str, Any]] = None,
) -> Tuple[bool, Dict[str, Any]]:
    sections = list(raw_sections or [])
    labels = [str(section.get("label") or "").upper().strip() for section in sections]
    total_sections = len(labels)
    body_only = total_sections == 0 or all(label == "BODY" for label in labels)
    structural_labels = [label for label in labels if label in STRUCTURAL_OCR_SECTION_FAMILIES]
    noisy_labels = [label for label in labels if label in NOISY_OCR_SECTION_FAMILIES]
    distinct_structural = sorted(set(structural_labels))
    has_table_rows = int((diagnostics or {}).get("ocr_markdown_table_rows") or 0) > 0
    noisy_share = (len(noisy_labels) / total_sections) if total_sections else 1.0

    decision = (
        not body_only
        and bool(structural_labels)
        and len(structural_labels) > len(noisy_labels)
        and noisy_share < 0.5
        and (has_table_rows or len(distinct_structural) >= 2)
    )

    decision_diag = {
        "ocr_markdown_body_only": body_only,
        "ocr_markdown_structural_section_count": len(structural_labels),
        "ocr_markdown_noisy_section_count": len(noisy_labels),
        "ocr_markdown_structural_distinct": distinct_structural,
        "ocr_markdown_noisy_share": round(noisy_share, 3),
        "ocr_markdown_has_table_rows": has_table_rows,
        "ocr_markdown_use_raw_sections": decision,
    }
    return decision, decision_diag


def _pages_and_diagnostics_from_pipeline_result(result: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    pages = list(result.get("pages") or [])
    diagnostics = dict(result.get("diagnostics") or {})
    canonical_payload = result.get("canonical_payload")
    if isinstance(canonical_payload, dict) and not result.get("fallback_to_legacy"):
        diagnostics[INTERNAL_CANONICAL_PAYLOAD_DIAGNOSTIC_KEY] = canonical_payload
    return pages, diagnostics


def _safe_log_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        parsed = urlparse(value)
    except Exception:
        return None
    if not parsed.scheme or not parsed.netloc:
        return None
    path = parsed.path or ""
    return f"{parsed.scheme}://{parsed.netloc}{path}"


def _log_pipeline_quality(
    *,
    result: Dict[str, Any],
    source: str,
    document_name: Optional[str] = None,
    source_url: Optional[str] = None,
) -> None:
    diagnostics = result.get("diagnostics") or {}
    if not isinstance(diagnostics, dict):
        diagnostics = {}
    quality = diagnostics.get("parsingQuality") or {}
    if not isinstance(quality, dict):
        quality = {}

    LOGGER.info(
        "[mistral-quality] %s",
        {
            "source": source,
            "document_name": document_name,
            "source_url": _safe_log_url(source_url),
            "status": result.get("status"),
            "page_count": diagnostics.get("page_count"),
            "model": diagnostics.get("model"),
            "has_languages_section": quality.get("has_languages_section"),
            "languages_extracted": quality.get("languages_extracted"),
            "languages_success": quality.get("languages_success"),
            "has_skills_section": quality.get("has_skills_section"),
            "skills_extracted": quality.get("skills_extracted"),
            "skills_success": quality.get("skills_success"),
            "recovery_used": quality.get("recovery_used"),
            "retry_used": quality.get("retry_used"),
            "error_type": quality.get("error_type"),
            "hard_failure": quality.get("hard_failure"),
        },
    )


def run_mistral_ocr_from_bytes(
    *,
    file_name: Optional[str],
    content_type: Optional[str],
    data: bytes,
    api_key: str,
    model_name: Optional[str],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    if not data:
        raise MistralOCRError("empty file payload")

    normalized_name = _safe_filename(file_name)
    try:
        result = run_resume_pipeline_from_bytes(
            file_name=normalized_name,
            content_type=content_type,
            data=data,
            api_key=api_key,
            model_name=model_name,
        )
        _log_pipeline_quality(result=result, source="file", document_name=normalized_name)
        pages, diagnostics = _pages_and_diagnostics_from_pipeline_result(result)
        if pages:
            return pages, diagnostics
        raise MistralOCRError("mistral_ocr_empty")
    except Exception as exc:  # pragma: no cover - network / API failure
        LOGGER.warning("Mistral OCR annotation pipeline (file) failed; falling back to local extraction: %s", exc)
        return _fallback_pages_from_pdf_bytes(data, normalized_name)


def run_mistral_ocr_from_url(
    *,
    url: str,
    api_key: str,
    model_name: Optional[str],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    document_name = _document_name_from_url(url)
    try:
        result = run_resume_pipeline_from_url(
            url=url,
            api_key=api_key,
            model_name=model_name,
        )
        _log_pipeline_quality(result=result, source="url", document_name=document_name, source_url=url)
        pages, diagnostics = _pages_and_diagnostics_from_pipeline_result(result)
        if pages:
            return pages, diagnostics
        raise MistralOCRError("mistral_ocr_empty")
    except Exception as exc:  # pragma: no cover - network / API failure
        LOGGER.warning("Mistral OCR annotation pipeline (url) failed; attempting fallback: %s", exc)
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            return _fallback_pages_from_pdf_bytes(resp.content, document_name)
        except Exception as inner_exc:  # pragma: no cover - network / API failure
            raise MistralOCRError("mistral_ocr_request_failed") from inner_exc


def join_markdown_pages(pages: Iterable[Dict[str, Any]], delimiter: str = "\n\n---\n\n") -> str:
    chunks: List[str] = []
    for page in pages:
        markdown = (page.get("markdown") or "").strip()
        if markdown:
            chunks.append(markdown)
    return delimiter.join(chunks)
