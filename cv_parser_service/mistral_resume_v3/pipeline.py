from __future__ import annotations

import argparse
import json
import mimetypes
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from .annotation_parser import AnnotationParserError, parse_document_annotation
from .app_mapper import build_canonical_payload
from .ocr_client import (
    OCRAnnotationResult,
    run_annotated_ocr_from_bytes,
    run_annotated_ocr_from_url,
    serialize_for_json,
)
from .post_validation import LANGUAGE_ALIASES, normalize_extraction
from .section_headings import RAW_SECTION_HEADING_ALIASES


INTERNAL_CANONICAL_PAYLOAD_DIAGNOSTIC_KEY = "_mistral_resume_v3_canonical_payload"
MARKDOWN_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s+(.+?)\s*$")
LIST_PREFIX_RE = re.compile(r"^\s*(?:[-*•·●▪◦]+|\d+[.)])\s*")
TABLE_DIVIDER_RE = re.compile(r"^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*$")
MULTI_SPACE_RE = re.compile(r"\s+")
HEADING_SEGMENT_SPLIT_RE = re.compile(r"\s*(?:[&/|,]| y | et | und | e )\s*", re.IGNORECASE)
RETRYABLE_SECTION_FAILURE = "section_evidence_contradiction"
EXPERIENCE_DATE_FRAGMENT_RE = re.compile(
    r"\b(?:\d{1,2}/\d{4}|\d{4}|\w{3,9}\s+\d{4}|present|current|now)\b",
    re.IGNORECASE,
)
EXPERIENCE_DATE_RANGE_SEPARATOR_RE = re.compile(r"\s+(?:to|[-–—])\s+", re.IGNORECASE)
EMAIL_FRAGMENT_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
URL_FRAGMENT_RE = re.compile(r"(https?://|www\.)", re.IGNORECASE)
PHONE_FRAGMENT_RE = re.compile(r"(?:\+?\d[\d\s().-]{6,}\d)")
ZIPISH_RE = re.compile(r"\b\d{5}(?:-\d{4})?\b")
ADDRESSISH_STREET_RE = re.compile(
    r"\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,6}\s+"
    r"(?:street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|boulevard|blvd\.?|lane|ln\.?|court|ct\.?|way)\b",
    re.IGNORECASE,
)
ADDRESSISH_STREET_FRAGMENT_RE = re.compile(
    r"\b[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+"
    r"(?:street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|boulevard|blvd\.?|lane|ln\.?|court|ct\.?|way)\b",
    re.IGNORECASE,
)
HEADER_CONTACT_LABEL_RE = re.compile(
    r"\b(?:phone|email|mobile|telephone|tel|contact|linkedin|website|portfolio|github|address|location)\b",
    re.IGNORECASE,
)
HEADER_COMPANY_SUFFIX_RE = re.compile(
    r"\b(?:inc|llc|ltd|limited|corp|corporation|company|gmbh|plc|co)\b",
    re.IGNORECASE,
)
HEADER_INLINE_SEPARATOR_RE = re.compile(r"\s*(?:[|•·●▪◦]+)\s*")
HEADER_NON_TITLE_STATE_RE = re.compile(
    r"\b(?:available|seeking|open\s+to|ready\s+to|willing\s+to\s+relocate)\b",
    re.IGNORECASE,
)
HEADER_LOCATION_TAIL_RE = re.compile(
    r"\b[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*,\s*[A-Z]{2}\b"
)
HEADER_UPPER_LOCATION_TAIL_RE = re.compile(
    r"\b[A-Z]{2,}(?:\s+[A-Z]{2,})*,\s*[A-Z]{2}\b"
)
HEADER_LOCATION_WITH_POSTAL_TAIL_RE = re.compile(
    r"\b[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?(?:,\s*[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*)?\b"
)
HEADER_UPPER_LOCATION_WITH_POSTAL_TAIL_RE = re.compile(
    r"\b[A-Z]{2,}(?:\s+[A-Z]{2,})*,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?(?:,\s*[A-Z]{2,}(?:\s+[A-Z]{2,})*)?\b"
)
HEADER_TRAILING_LOCATION_WITH_POSTAL_RE = re.compile(
    r"\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?(?:,\s*[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*)?\s*$"
)
HEADER_TRAILING_UPPER_LOCATION_WITH_POSTAL_RE = re.compile(
    r"\s+[A-Z]{2,}(?:\s+[A-Z]{2,})*,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?(?:,\s*[A-Z]{2,}(?:\s+[A-Z]{2,})*)?\s*$"
)


def _normalize_lookup(value: str) -> str:
    try:
        ascii_text = unicodedata.normalize("NFD", value)
        ascii_text = "".join(char for char in ascii_text if unicodedata.category(char) != "Mn")
    except Exception:
        ascii_text = value
    return MULTI_SPACE_RE.sub(" ", ascii_text).strip().lower()


SECTION_HEADING_ALIASES: dict[str, set[str]] = {
    family: {_normalize_lookup(alias) for alias in aliases}
    for family, aliases in RAW_SECTION_HEADING_ALIASES.items()
}
ALL_SECTION_HEADING_ALIASES = {alias for aliases in SECTION_HEADING_ALIASES.values() for alias in aliases}
SECTION_HEADING_WORDS = {
    word
    for alias in ALL_SECTION_HEADING_ALIASES
    for word in alias.split()
    if word
}
GROUPED_SKILL_LABEL_ALIASES = {
    _normalize_lookup(alias)
    for alias in {
        "backend",
        "frontend",
        "cloud",
        "cloud & devops",
        "cloud and devops",
        "devops",
        "programming languages",
        "frameworks",
        "databases",
        "database",
        "testing",
        "process",
        "tools",
        "technologies",
        "core competencies",
        "areas of expertise",
        "expertise",
    }
}
SKILL_RECOVERY_HEADING_ALIASES = {
    _normalize_lookup("skills"),
    _normalize_lookup("areas of expertise"),
}
SUMMARY_RECOVERY_HEADING_ALIASES = {
    _normalize_lookup("summary"),
    _normalize_lookup("professional summary"),
    _normalize_lookup("professional profile"),
    _normalize_lookup("about"),
}
SKILLISH_LANGUAGE_MARKERS = (
    "areas of expertise",
    "core competencies",
    "framework",
    "backend",
    "frontend",
    "cloud",
    "devops",
    "python",
    "javascript",
    "typescript",
    "node.js",
    "react",
    ".net",
    "aws",
    "docker",
    "kubernetes",
    "database",
    "rest api",
    "agile",
    "scrum",
)
RECOVERY_FIELD_FAMILIES = ("languages", "skills", "achievements", "experience", "summary")


@dataclass
class OCRMarkdownSection:
    family: str
    heading: str
    lines: list[str]


def _coerce_annotation_for_repair(raw: Any) -> Optional[Dict[str, Any]]:
    if isinstance(raw, dict):
        return raw
    if hasattr(raw, "model_dump"):
        dumped = raw.model_dump(exclude_none=True)
        if isinstance(dumped, dict):
            return dumped
    if hasattr(raw, "dict"):
        dumped = raw.dict(exclude_none=True)
        if isinstance(dumped, dict):
            return dumped
    if isinstance(raw, str):
        candidate = raw.strip()
        if not candidate:
            return None
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            return None
        if isinstance(parsed, dict):
            return parsed
    return None


def _clean_inline_text(value: object) -> Optional[str]:
    if value is None:
        return None
    text = str(value).replace("\xa0", " ").strip()
    if not text:
        return None
    return MULTI_SPACE_RE.sub(" ", text).strip() or None


def _normalize_heading_text(value: str) -> str:
    return _normalize_lookup(re.sub(r"^[#\s]+|[:\-\u2013\u2014\s]+$", "", value or ""))


def _classify_heading_exact(value: str) -> Optional[str]:
    normalized = _normalize_heading_text(value)
    for family, aliases in SECTION_HEADING_ALIASES.items():
        if normalized in aliases:
            return family
    return None


def _classify_heading(value: str) -> Optional[str]:
    direct_match = _classify_heading_exact(value)
    if direct_match:
        return direct_match

    segments = [segment for segment in HEADING_SEGMENT_SPLIT_RE.split(value or "") if _clean_inline_text(segment)]
    if len(segments) < 2:
        return None

    matched_families = [family for family in (_classify_heading_exact(segment) for segment in segments) if family]
    if len(matched_families) < 2:
        return None

    unique_families = []
    for family in matched_families:
        if family not in unique_families:
            unique_families.append(family)
    if len(unique_families) == 1:
        return unique_families[0]
    return None


def _extract_explicit_sections_from_pages(pages: list[dict[str, Any]]) -> dict[str, list[OCRMarkdownSection]]:
    sections: list[OCRMarkdownSection] = []
    current: Optional[OCRMarkdownSection] = None

    def flush_current() -> None:
        nonlocal current
        if current is not None:
            sections.append(current)
        current = None

    for page in pages:
        markdown = str(page.get("markdown") or "")
        for raw_line in markdown.replace("\r", "").split("\n"):
            heading_match = MARKDOWN_HEADING_RE.match(raw_line)
            if heading_match:
                heading_text = heading_match.group(1).strip()
                family = _classify_heading(heading_text)
                if family:
                    flush_current()
                    current = OCRMarkdownSection(family=family, heading=heading_text.rstrip(":").strip(), lines=[])
                elif current is not None and raw_line.strip():
                    current.lines.append(raw_line.strip())
                continue

            stripped = raw_line.strip()
            family = None
            if stripped and stripped[:1] not in {"-", "*", "•", "|"}:
                family = _classify_heading(stripped)
            if family:
                flush_current()
                current = OCRMarkdownSection(family=family, heading=stripped.rstrip(":").strip(), lines=[])
                continue

            if current is not None:
                if not current.lines and not stripped:
                    continue
                current.lines.append(raw_line)

    flush_current()
    grouped: dict[str, list[OCRMarkdownSection]] = {}
    for section in sections:
        grouped.setdefault(section.family, []).append(section)
    return grouped


def _section_heading(sections: list[OCRMarkdownSection]) -> Optional[str]:
    return sections[0].heading if sections else None


def _default_section_recovery_metadata(explicit_sections: dict[str, list[OCRMarkdownSection]]) -> dict[str, dict[str, Any]]:
    metadata: dict[str, dict[str, Any]] = {}
    for family in RECOVERY_FIELD_FAMILIES:
        heading = _section_heading(explicit_sections.get(family, []))
        metadata[family] = {
            "applied": False,
            "source": "ocr_markdown",
            "reason": "no_explicit_section_evidence",
            "heading": heading,
        }
    return metadata


def _build_annotation_retry_metadata(
    *,
    attempted: bool = False,
    count: int = 0,
    reason: Optional[str] = None,
    eligible: bool = False,
    exhausted: bool = False,
) -> dict[str, Any]:
    return {
        "attempted": attempted,
        "count": count,
        "reason": reason,
        "eligible": eligible,
        "exhausted": exhausted,
    }


def _looks_like_identity_header_name(value: Optional[str], identity_name: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    normalized_name = _normalize_lookup(identity_name or "")
    if not cleaned or not normalized_name:
        return False
    return _normalize_lookup(cleaned) == normalized_name


def _contains_identity_name_tokens(value: Optional[str], identity_name: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return False
    candidate_tokens = {token for token in _normalize_lookup(cleaned).split() if token}
    name_tokens = [token for token in _normalize_lookup(identity_name or "").split() if len(token) > 1]
    if not candidate_tokens or not name_tokens:
        return False
    matched = sum(1 for token in name_tokens if token in candidate_tokens)
    return matched >= min(2, len(name_tokens))


def _looks_like_header_desired_position_candidate(value: Optional[str], *, identity_name: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return False
    if _looks_like_identity_header_name(cleaned, identity_name):
        return False
    if _contains_identity_name_tokens(cleaned, identity_name):
        return False
    normalized = _normalize_lookup(cleaned)
    tokens = [token for token in normalized.split() if token]
    if len(tokens) >= 2 and all(token in SECTION_HEADING_WORDS for token in tokens):
        return False
    if _is_heading_value(cleaned) or _classify_heading(cleaned):
        return False
    if HEADER_CONTACT_LABEL_RE.search(cleaned):
        return False
    if HEADER_COMPANY_SUFFIX_RE.search(cleaned):
        return False
    if EMAIL_FRAGMENT_RE.search(cleaned) or URL_FRAGMENT_RE.search(cleaned):
        return False
    if PHONE_FRAGMENT_RE.search(cleaned) or ZIPISH_RE.search(cleaned):
        return False
    if ADDRESSISH_STREET_RE.search(cleaned) or ADDRESSISH_STREET_FRAGMENT_RE.search(cleaned):
        return False
    if (
        HEADER_LOCATION_WITH_POSTAL_TAIL_RE.fullmatch(cleaned)
        or HEADER_UPPER_LOCATION_WITH_POSTAL_TAIL_RE.fullmatch(cleaned)
        or HEADER_LOCATION_TAIL_RE.fullmatch(cleaned)
        or HEADER_UPPER_LOCATION_TAIL_RE.fullmatch(cleaned)
    ):
        return False
    if ":" in cleaned:
        return False
    token_count = len(cleaned.split())
    if token_count < 2 or token_count > 8:
        return False
    return True


def _looks_like_non_title_header_phrase(value: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return True
    if HEADER_NON_TITLE_STATE_RE.search(cleaned):
        return True
    return False


def _strip_identity_name_from_header_line(value: Optional[str], *, identity_name: Optional[str]) -> Optional[str]:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return None
    identity_cleaned = _clean_inline_text(identity_name)
    if not identity_cleaned:
        return cleaned
    pattern = re.compile(re.escape(identity_cleaned), re.IGNORECASE)
    return _clean_inline_text(pattern.sub(" ", cleaned))


def _strip_contact_fragments_from_header_line(value: Optional[str]) -> Optional[str]:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return None
    working = cleaned
    for pattern in (EMAIL_FRAGMENT_RE, URL_FRAGMENT_RE, PHONE_FRAGMENT_RE, HEADER_CONTACT_LABEL_RE):
        working = pattern.sub(" ", working)
    return _clean_inline_text(working.strip(" -|,"))


def _strip_location_fragments_from_header_line(value: Optional[str]) -> Optional[str]:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return None
    tokens = cleaned.split()
    for split_index in range(2, len(tokens)):
        prefix = _clean_inline_text(" ".join(tokens[:split_index]).strip(" -|,"))
        suffix = _clean_inline_text(" ".join(tokens[split_index:]).strip(" -|,"))
        if not prefix or not suffix:
            continue
        if (
            HEADER_LOCATION_WITH_POSTAL_TAIL_RE.fullmatch(suffix)
            or HEADER_UPPER_LOCATION_WITH_POSTAL_TAIL_RE.fullmatch(suffix)
            or HEADER_LOCATION_TAIL_RE.fullmatch(suffix)
            or HEADER_UPPER_LOCATION_TAIL_RE.fullmatch(suffix)
        ):
            return prefix
    working = cleaned
    for pattern in (
        HEADER_TRAILING_LOCATION_WITH_POSTAL_RE,
        HEADER_TRAILING_UPPER_LOCATION_WITH_POSTAL_RE,
    ):
        working = pattern.sub(" ", working)
    return _clean_inline_text(working.strip(" -|,"))


def _extract_desired_position_from_header_line(
    value: Optional[str],
    *,
    identity_name: Optional[str],
) -> Optional[str]:
    cleaned = _clean_inline_text(value)
    if not cleaned or _is_heading_value(cleaned) or _classify_heading(cleaned):
        return None

    fragments = [cleaned]
    if HEADER_INLINE_SEPARATOR_RE.search(cleaned):
        fragments.extend(
            fragment
            for fragment in (
                _clean_inline_text(piece) for piece in HEADER_INLINE_SEPARATOR_RE.split(cleaned)
            )
            if fragment
        )

    for fragment in fragments:
        working = _strip_identity_name_from_header_line(fragment, identity_name=identity_name)
        working = _strip_contact_fragments_from_header_line(working)
        working = _strip_location_fragments_from_header_line(working)
        cleaned_candidate = _clean_inline_text((working or "").strip(" -|,"))
        if _looks_like_header_desired_position_candidate(
            cleaned_candidate,
            identity_name=identity_name,
        ) and not _looks_like_non_title_header_phrase(cleaned_candidate):
            return _normalize_recovered_desired_position(cleaned_candidate)
    return None


def _normalize_recovered_desired_position(value: Optional[str]) -> Optional[str]:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return None
    letters_only = re.sub(r"[^A-Za-z]+", "", cleaned)
    if not letters_only or cleaned != cleaned.upper():
        return cleaned

    tokens: list[str] = []
    for token in cleaned.split():
        bare = re.sub(r"[^A-Za-z]+", "", token)
        if bare.isupper() and len(bare) <= 3:
            tokens.append(token)
            continue
        tokens.append(token[:1].upper() + token[1:].lower())
    return " ".join(tokens)


def _recover_desired_position_from_header(
    raw_text: str,
    *,
    identity_name: Optional[str],
) -> Optional[str]:
    header_lines: list[str] = []
    for raw_line in str(raw_text or "").replace("\r", "").split("\n"):
        cleaned = _clean_inline_text(raw_line)
        if not cleaned:
            continue
        if _is_heading_value(cleaned) or _classify_heading(cleaned):
            break
        header_lines.append(cleaned)
        if len(header_lines) >= 4:
            break

    if not header_lines:
        return None

    for line in header_lines:
        recovered = _extract_desired_position_from_header_line(
            line,
            identity_name=identity_name,
        )
        if recovered:
            return recovered
    return None


def _strip_list_prefix(value: str) -> str:
    return LIST_PREFIX_RE.sub("", value).strip()


def _split_inline_language_candidates(value: str) -> list[str]:
    segments = [value]
    output: list[str] = []
    while segments:
        segment = segments.pop(0)
        if not segment:
            continue
        if re.search(r"\s*(?:;|\|)\s*", segment):
            pieces = [piece.strip() for piece in re.split(r"\s*(?:;|\|)\s*", segment) if piece.strip()]
            output.extend(pieces)
            continue
        if "," in segment and ":" not in segment and "(" not in segment:
            pieces = [piece.strip() for piece in re.split(r"\s*,\s*", segment) if piece.strip()]
            if len(pieces) > 1 and all(_looks_like_language_name(piece) for piece in pieces):
                output.extend(pieces)
                continue
        if re.search(r"\s+/\s+", segment):
            pieces = [piece.strip() for piece in re.split(r"\s+/\s+", segment) if piece.strip()]
            if len(pieces) > 1 and all(_looks_like_language_name(piece) for piece in pieces):
                output.extend(pieces)
                continue
        output.append(segment)
    return output


def _looks_like_language_name(value: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return False
    normalized = _normalize_lookup(cleaned)
    if normalized in LANGUAGE_ALIASES:
        return True
    if normalized in ALL_SECTION_HEADING_ALIASES or normalized in GROUPED_SKILL_LABEL_ALIASES:
        return False
    if any(marker in normalized for marker in SKILLISH_LANGUAGE_MARKERS):
        return False
    if re.search(r"\d", cleaned):
        return False
    if len(cleaned.split()) > 3:
        return False
    return bool(re.fullmatch(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{0,40}", cleaned))


def _parse_language_candidate(value: str) -> Optional[dict[str, Any]]:
    candidate = _clean_inline_text(_strip_list_prefix(value))
    if not candidate or TABLE_DIVIDER_RE.match(candidate):
        return None

    colon_match = re.match(r"^(?P<name>[^:]+):\s*(?P<level>.+)$", candidate)
    if colon_match:
        name = _clean_inline_text(colon_match.group("name"))
        level_raw = _clean_inline_text(colon_match.group("level"))
        if _looks_like_language_name(name) and level_raw and not _looks_like_section_blob(level_raw):
            return {"name": name, "levelRaw": level_raw}

    dash_match = re.match(r"^(?P<name>.+?)\s*[–—-]\s*(?P<level>.+)$", candidate)
    if dash_match:
        name = _clean_inline_text(dash_match.group("name"))
        level_raw = _clean_inline_text(dash_match.group("level"))
        if _looks_like_language_name(name) and level_raw and not _looks_like_section_blob(level_raw):
            return {"name": name, "levelRaw": level_raw}

    paren_match = re.match(r"^(?P<name>.+?)\s*\((?P<level>[^)]+)\)$", candidate)
    if paren_match:
        name = _clean_inline_text(paren_match.group("name"))
        level_raw = _clean_inline_text(paren_match.group("level"))
        if _looks_like_language_name(name) and level_raw and not _looks_like_section_blob(level_raw):
            return {"name": name, "levelRaw": level_raw}

    if _looks_like_language_name(candidate):
        return {"name": candidate}
    return None


def _extract_explicit_languages_from_sections(sections: list[OCRMarkdownSection]) -> list[dict[str, Any]]:
    recovered: list[dict[str, Any]] = []
    seen: set[str] = set()
    for section in sections:
        for raw_line in section.lines:
            cleaned_line = _clean_inline_text(_strip_list_prefix(raw_line.strip().strip("|")))
            if not cleaned_line or TABLE_DIVIDER_RE.match(cleaned_line):
                continue
            for candidate in _split_inline_language_candidates(cleaned_line):
                parsed = _parse_language_candidate(candidate)
                if not parsed:
                    continue
                key = _normalize_lookup(str(parsed.get("name") or ""))
                if not key or key in seen:
                    continue
                seen.add(key)
                recovered.append(parsed)
    return recovered


def _looks_like_grouped_skill_label(value: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return False
    normalized = _normalize_lookup(cleaned)
    if normalized in GROUPED_SKILL_LABEL_ALIASES:
        return True
    return normalized.endswith("skills") or normalized.endswith("competencies") or normalized.endswith("expertise")


def _looks_like_grouped_skill_blob(value: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return False
    for separator in (":", " - ", " – ", " — "):
        if separator not in cleaned:
            continue
        left, right = cleaned.split(separator, 1)
        if _looks_like_grouped_skill_label(left):
            right_cleaned = _clean_inline_text(right)
            if right_cleaned and len(right_cleaned.split()) <= 12:
                return True
    return False


def _split_skill_tokens(value: str) -> list[str]:
    pieces: list[str] = []
    for piece in re.split(r"\s*(?:,|;|\||•|·)\s*", value):
        if not piece:
            continue
        subpieces = re.split(r"\s+/\s+", piece) if re.search(r"\s+/\s+", piece) else [piece]
        for subpiece in subpieces:
            cleaned = _clean_inline_text(subpiece.strip(" -*•·|,:;"))
            if cleaned:
                pieces.append(cleaned)
    return pieces


def _extract_explicit_skills_from_sections(sections: list[OCRMarkdownSection]) -> list[str]:
    recovered: list[str] = []
    seen: set[str] = set()
    for section in sections:
        for raw_line in section.lines:
            cleaned_line = _clean_inline_text(_strip_list_prefix(raw_line.strip().strip("|")))
            if not cleaned_line or TABLE_DIVIDER_RE.match(cleaned_line):
                continue
            content = cleaned_line
            for separator in (":", " - ", " – ", " — "):
                if separator not in content:
                    continue
                label, remainder = content.split(separator, 1)
                remainder_cleaned = _clean_inline_text(remainder)
                if _looks_like_grouped_skill_label(label) and remainder_cleaned:
                    content = remainder_cleaned
                    break
            for skill in _split_skill_tokens(content):
                if _is_heading_value(skill) or _looks_like_section_blob(skill) or _looks_like_grouped_skill_blob(skill):
                    continue
                key = _normalize_lookup(skill)
                if not key or key in seen:
                    continue
                seen.add(key)
                recovered.append(skill)
    return recovered


def _skill_sections_eligible_for_recovery(sections: list[OCRMarkdownSection]) -> list[OCRMarkdownSection]:
    return [section for section in sections if _normalize_heading_text(section.heading) in SKILL_RECOVERY_HEADING_ALIASES]


def _summary_sections_eligible_for_recovery(sections: list[OCRMarkdownSection]) -> list[OCRMarkdownSection]:
    return [section for section in sections if _normalize_heading_text(section.heading) in SUMMARY_RECOVERY_HEADING_ALIASES]


def _extract_explicit_achievements_from_sections(sections: list[OCRMarkdownSection]) -> list[str]:
    items: list[str] = []
    current_item: Optional[str] = None

    def flush_item() -> None:
        nonlocal current_item
        if current_item:
            normalized = " ".join(current_item.split()).strip()
            if normalized:
                items.append(normalized)
        current_item = None

    for section in sections:
        for raw_line in [*section.lines, ""]:
            stripped = raw_line.strip()
            if TABLE_DIVIDER_RE.match(stripped):
                continue
            if not stripped:
                flush_item()
                continue
            bullet_text = _strip_list_prefix(stripped) if stripped[:1] in {"-", "*", "•"} or LIST_PREFIX_RE.match(stripped) else None
            if bullet_text is not None:
                flush_item()
                current_item = bullet_text
                continue
            if current_item:
                current_item = f"{current_item} {stripped}"
            else:
                current_item = stripped

    flush_item()
    return items


def _looks_like_experience_date_range(value: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return False
    return bool(
        EXPERIENCE_DATE_FRAGMENT_RE.search(cleaned)
        and EXPERIENCE_DATE_RANGE_SEPARATOR_RE.search(cleaned)
    )


def _parse_experience_date_range(value: Optional[str]) -> dict[str, Any]:
    cleaned = _clean_inline_text(value)
    if not _looks_like_experience_date_range(cleaned):
        return {}
    parts = EXPERIENCE_DATE_RANGE_SEPARATOR_RE.split(cleaned, maxsplit=1)
    if len(parts) != 2:
        return {}
    start_date = _clean_inline_text(parts[0])
    end_date = _clean_inline_text(parts[1])
    if not start_date or not end_date:
        return {}
    is_current = _normalize_lookup(end_date) in {"present", "current", "now"}
    return {
        "startDate": start_date,
        "endDate": end_date,
        "isCurrent": is_current or None,
    }


def _parse_experience_date_line(value: Optional[str]) -> dict[str, Any]:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return {}
    if " • " in cleaned:
        location_part, date_part = cleaned.split(" • ", 1)
        date_fields = _parse_experience_date_range(date_part)
        if date_fields:
            location = _clean_inline_text(location_part)
            return {
                **({"location": location} if location else {}),
                **date_fields,
            }
    if " | " in cleaned:
        location_part, date_part = cleaned.split(" | ", 1)
        date_fields = _parse_experience_date_range(date_part)
        if date_fields:
            location = _clean_inline_text(location_part)
            return {
                **({"location": location} if location else {}),
                **date_fields,
            }
    return _parse_experience_date_range(cleaned)


def _parse_experience_header_line(value: Optional[str]) -> Optional[dict[str, Any]]:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return None
    heading_match = MARKDOWN_HEADING_RE.match(cleaned)
    if heading_match:
        cleaned = _clean_inline_text(heading_match.group(1))
    if not cleaned or _is_heading_value(cleaned):
        return None
    if _parse_experience_date_line(cleaned):
        return None

    at_match = re.match(r"^(?P<position>.+?)\s+at\s+(?P<company>.+)$", cleaned, flags=re.IGNORECASE)
    if at_match:
        position = _clean_inline_text(at_match.group("position"))
        company = _clean_inline_text(at_match.group("company"))
        if position and company:
            return {"company": company, "position": position}

    if " | " in cleaned:
        parts = [_clean_inline_text(part) for part in cleaned.split("|")]
        parts = [part for part in parts if part]
        if len(parts) >= 2 and not _looks_like_experience_date_range(parts[0]) and not _looks_like_experience_date_range(parts[1]):
            parsed = {"company": parts[0], "position": parts[1]}
            if len(parts) >= 3:
                parsed.update(_parse_experience_date_line(" | ".join(parts[2:])))
            return parsed

    for separator in (" - ", " – ", " — "):
        if separator not in cleaned:
            continue
        left, right = cleaned.split(separator, 1)
        company = _clean_inline_text(left)
        position = _clean_inline_text(right)
        if not company or not position:
            continue
        if _looks_like_experience_date_range(company) or _looks_like_experience_date_range(position):
            continue
        return {"company": company, "position": position}
    return None


def _experience_entry_has_content(entry: Any) -> bool:
    company = _clean_inline_text(getattr(entry, "company", None) if not isinstance(entry, dict) else entry.get("company"))
    position = _clean_inline_text(getattr(entry, "position", None) if not isinstance(entry, dict) else entry.get("position"))
    description = _clean_inline_text(
        getattr(entry, "description", None) if not isinstance(entry, dict) else entry.get("description")
    )
    bullets_raw = getattr(entry, "responsibilityBullets", None) if not isinstance(entry, dict) else entry.get("responsibilityBullets")
    bullets = [_clean_inline_text(item) for item in list(bullets_raw or [])]
    return bool(company or position or description or any(bullets))


def _extract_explicit_experience_from_sections(sections: list[OCRMarkdownSection]) -> list[dict[str, Any]]:
    recovered: list[dict[str, Any]] = []
    current: Optional[dict[str, Any]] = None

    def flush_current() -> None:
        nonlocal current
        if current and _experience_entry_has_content(current):
            recovered.append(current)
        current = None

    for section in sections:
        for raw_line in [*section.lines, ""]:
            stripped = raw_line.strip()
            if not stripped or TABLE_DIVIDER_RE.match(stripped):
                continue

            parsed_header = _parse_experience_header_line(raw_line)
            if parsed_header:
                flush_current()
                current = {
                    **parsed_header,
                    "responsibilityBullets": [],
                    "achievements": [],
                }
                continue

            if current is None:
                continue

            date_fields = _parse_experience_date_line(raw_line)
            if date_fields:
                for field, value in date_fields.items():
                    if value is not None and not current.get(field):
                        current[field] = value
                continue

            if stripped[:1] in {"-", "*", "•"} or LIST_PREFIX_RE.match(stripped):
                bullet = _clean_inline_text(_strip_list_prefix(stripped).strip("|"))
                if bullet and not _is_heading_value(bullet):
                    current["responsibilityBullets"].append(bullet)
                continue

            content = _clean_inline_text(stripped.strip("|"))
            if not content or _is_heading_value(content):
                continue
            if current.get("description"):
                current["description"] = f"{current['description']} {content}"
            else:
                current["description"] = content

        flush_current()

    return recovered


def _extract_explicit_summary_from_sections(sections: list[OCRMarkdownSection]) -> Optional[str]:
    fragments: list[str] = []
    for section in sections:
        section_fragments: list[str] = []
        for raw_line in section.lines:
            stripped = raw_line.strip()
            if not stripped or TABLE_DIVIDER_RE.match(stripped):
                continue
            if _is_heading_value(stripped):
                continue
            cleaned = _clean_inline_text(_strip_list_prefix(stripped).strip("|"))
            if not cleaned:
                continue
            if re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", cleaned):
                continue
            if re.search(r"(https?://|www\.)", cleaned, re.IGNORECASE):
                continue
            if re.search(r"\b(?:phone|email|website|linkedin|github|portfolio)\b\s*:", cleaned, re.IGNORECASE):
                continue
            if re.search(r"(?:\+?\d[\d\s().-]{6,}\d)", cleaned):
                continue
            section_fragments.append(cleaned)
        if section_fragments:
            fragments.append(" ".join(section_fragments))

    summary = _clean_inline_text(" ".join(fragments))
    if not summary:
        return None
    if len(re.findall(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'/-]*", summary)) < 5:
        return None
    return summary


def _is_heading_value(value: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return False
    return _normalize_heading_text(cleaned) in ALL_SECTION_HEADING_ALIASES


def _looks_like_section_blob(value: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return False
    normalized = _normalize_lookup(cleaned)
    if any(alias in normalized for alias in ALL_SECTION_HEADING_ALIASES if alias != normalized) and len(normalized.split()) > 3:
        return True
    if cleaned.count(":") >= 2:
        return True
    return ":" in cleaned and len(cleaned.split()) > 8


def _language_level_is_polluted(*, language_name: Optional[str], level_raw: Optional[str]) -> bool:
    cleaned_level = _clean_inline_text(level_raw)
    if not cleaned_level:
        return False
    if _is_heading_value(cleaned_level) or _looks_like_section_blob(cleaned_level):
        return True

    normalized_name = _normalize_lookup(language_name or "")
    normalized_canonical_name = _normalize_lookup(LANGUAGE_ALIASES.get(normalized_name, language_name or ""))
    normalized_level = _normalize_lookup(cleaned_level)
    for alias, canonical_name in LANGUAGE_ALIASES.items():
        alias_normalized = _normalize_lookup(alias)
        canonical_normalized = _normalize_lookup(canonical_name)
        if canonical_normalized == normalized_canonical_name or alias_normalized == normalized_name:
            continue
        if re.search(rf"\b{re.escape(alias_normalized)}\b", normalized_level):
            return True
    return False


def _language_entry_is_polluted(entry: Any) -> bool:
    name = _clean_inline_text(getattr(entry, "name", None))
    level_raw = _clean_inline_text(getattr(entry, "levelRaw", None))
    combined = _clean_inline_text(" ".join(part for part in [name, level_raw] if part))
    if not name:
        return True
    if _is_heading_value(name) or _looks_like_section_blob(combined):
        return True
    if not _looks_like_language_name(name):
        return True
    if _language_level_is_polluted(language_name=name, level_raw=level_raw):
        return True
    return bool(combined and any(marker in _normalize_lookup(combined) for marker in SKILLISH_LANGUAGE_MARKERS))


def _skill_entry_is_polluted(value: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return True
    return _is_heading_value(cleaned) or _looks_like_grouped_skill_blob(cleaned) or _looks_like_section_blob(cleaned)


def _collect_section_gate_issues(normalized: Any, explicit_sections: dict[str, list[OCRMarkdownSection]]) -> dict[str, str]:
    issues: dict[str, str] = {}

    if explicit_sections.get("languages"):
        languages = list(getattr(normalized, "languages", []) or [])
        if not languages:
            issues["languages"] = "empty_explicit_section_values"
        elif any(_language_entry_is_polluted(entry) for entry in languages):
            issues["languages"] = "polluted_explicit_section_values"

    if explicit_sections.get("skills"):
        skills = [getattr(entry, "name", None) for entry in list(getattr(normalized, "skills", []) or [])]
        if not skills:
            issues["skills"] = "empty_explicit_section_values"
        elif any(_skill_entry_is_polluted(value) for value in skills):
            issues["skills"] = "polluted_explicit_section_values"

    if explicit_sections.get("experience"):
        experience = list(getattr(normalized, "experience", []) or [])
        if not experience:
            issues["experience"] = "empty_explicit_section_values"

    if _summary_sections_eligible_for_recovery(explicit_sections.get("summary", [])):
        summary = _clean_inline_text(getattr(getattr(normalized, "summary", None), "text", None))
        if not summary:
            issues["summary"] = "empty_explicit_section_values"

    return issues


def _validated_recovered_languages(
    recovered_languages: list[dict[str, Any]],
    repaired_normalized: Any,
) -> Optional[str]:
    if not recovered_languages:
        return "empty_explicit_section_values"

    normalized_names = {
        _normalize_lookup(getattr(entry, "name", None) or "")
        for entry in list(getattr(repaired_normalized, "languages", []) or [])
        if _clean_inline_text(getattr(entry, "name", None))
    }
    for entry in recovered_languages:
        name = _clean_inline_text(entry.get("name")) if isinstance(entry, dict) else None
        level_raw = _clean_inline_text(entry.get("levelRaw")) if isinstance(entry, dict) else None
        if not name or not _looks_like_language_name(name):
            return "invalid_recovered_values"
        if _language_level_is_polluted(language_name=name, level_raw=level_raw):
            return "invalid_recovered_values"
        if _normalize_lookup(name) not in normalized_names:
            return "invalid_recovered_values"
    return None


def _validated_recovered_skills(
    recovered_skills: list[str],
    repaired_normalized: Any,
    *,
    explicit_section_exists: bool,
) -> Optional[str]:
    if not explicit_section_exists:
        return None
    if not recovered_skills:
        return "empty_explicit_section_values"

    normalized_names = {
        _normalize_lookup(getattr(entry, "name", None) or "")
        for entry in list(getattr(repaired_normalized, "skills", []) or [])
        if _clean_inline_text(getattr(entry, "name", None))
    }
    for skill in recovered_skills:
        if _skill_entry_is_polluted(skill):
            return "invalid_recovered_values"
        if _normalize_lookup(skill) not in normalized_names:
            return "invalid_recovered_values"
    return None


def _experience_entry_identity(entry: Any) -> Optional[tuple[str, str, str, str]]:
    company = _clean_inline_text(getattr(entry, "company", None) if not isinstance(entry, dict) else entry.get("company")) or ""
    position = _clean_inline_text(getattr(entry, "position", None) if not isinstance(entry, dict) else entry.get("position")) or ""
    start_date = _clean_inline_text(getattr(entry, "startDate", None) if not isinstance(entry, dict) else entry.get("startDate")) or ""
    end_date = _clean_inline_text(getattr(entry, "endDate", None) if not isinstance(entry, dict) else entry.get("endDate")) or ""
    if not any((company, position, start_date, end_date)):
        return None
    return (
        _normalize_lookup(company),
        _normalize_lookup(position),
        _normalize_lookup(start_date),
        _normalize_lookup(end_date),
    )


def _validated_recovered_experience(
    recovered_experience: list[dict[str, Any]],
    repaired_normalized: Any,
    *,
    explicit_section_exists: bool,
) -> Optional[str]:
    if not explicit_section_exists:
        return None
    if not recovered_experience:
        return "empty_explicit_section_values"

    normalized_entries = list(getattr(repaired_normalized, "experience", []) or [])
    if not normalized_entries:
        return "empty_explicit_section_values"

    normalized_identities = {
        identity
        for identity in (_experience_entry_identity(entry) for entry in normalized_entries)
        if identity is not None
    }
    normalized_fallback_identities = {
        identity[:2]
        for identity in normalized_identities
        if identity is not None
    }

    for entry in recovered_experience:
        if not _experience_entry_has_content(entry):
            return "invalid_recovered_values"
        identity = _experience_entry_identity(entry)
        if identity is None:
            return "invalid_recovered_values"
        if identity in normalized_identities:
            continue
        if identity[:2] and identity[:2] in normalized_fallback_identities:
            continue
        return "invalid_recovered_values"
    return None


def _collect_post_recovery_issues(
    *,
    recovered_languages: Optional[list[dict[str, Any]]],
    recovered_skills: Optional[list[str]],
    recovered_experience: Optional[list[dict[str, Any]]],
    recovered_summary: Optional[str],
    repaired_normalized: Any,
    skills_section_exists: bool,
    experience_section_exists: bool,
    summary_section_exists: bool,
) -> dict[str, str]:
    issues: dict[str, str] = {}
    if recovered_languages is not None:
        language_issue = _validated_recovered_languages(recovered_languages, repaired_normalized)
        if language_issue:
            issues["languages"] = language_issue
    if recovered_skills is not None:
        skills_issue = _validated_recovered_skills(
            recovered_skills,
            repaired_normalized,
            explicit_section_exists=skills_section_exists,
        )
        if skills_issue:
            issues["skills"] = skills_issue
    if recovered_experience is not None:
        experience_issue = _validated_recovered_experience(
            recovered_experience,
            repaired_normalized,
            explicit_section_exists=experience_section_exists,
        )
        if experience_issue:
            issues["experience"] = experience_issue
    if recovered_summary is not None:
        summary_text = _clean_inline_text(getattr(getattr(repaired_normalized, "summary", None), "text", None))
        if summary_section_exists and not summary_text:
            issues["summary"] = "empty_explicit_section_values"
    return issues


def _collect_second_validation_issues_after_recovery(
    *,
    repaired_normalized: Any,
    explicit_sections: dict[str, list[OCRMarkdownSection]],
    recovered_languages: Optional[list[dict[str, Any]]],
    recovered_skills: Optional[list[str]],
    recovered_experience: Optional[list[dict[str, Any]]],
    recovered_summary: Optional[str],
) -> dict[str, str]:
    issues = _collect_section_gate_issues(repaired_normalized, explicit_sections)
    issues.update(
        _collect_post_recovery_issues(
            recovered_languages=recovered_languages,
            recovered_skills=recovered_skills,
            recovered_experience=recovered_experience,
            recovered_summary=recovered_summary,
            repaired_normalized=repaired_normalized,
            skills_section_exists=bool(explicit_sections.get("skills")),
            experience_section_exists=bool(explicit_sections.get("experience")),
            summary_section_exists=bool(_summary_sections_eligible_for_recovery(explicit_sections.get("summary", []))),
        )
    )
    return issues


def _join_markdown_pages(pages: list[dict[str, Any]], delimiter: str = "\n\n---\n\n") -> str:
    parts = [(page.get("markdown") or "").strip() for page in pages]
    return delimiter.join(part for part in parts if part)


def _warning_payload(normalized: Any) -> list[dict[str, Any]]:
    return [warning.model_dump(exclude_none=True) for warning in getattr(normalized, "warnings", [])]


def _build_pipeline_diagnostics(
    *,
    ocr_result: OCRAnnotationResult,
    status: str,
    failure_stage: Optional[str],
    error_type: Optional[str],
    error_message: Optional[str],
    error_details: Optional[Dict[str, Any]],
    warning_codes: list[str],
    section_recovery: dict[str, dict[str, Any]],
    annotation_retry: dict[str, Any],
) -> Dict[str, Any]:
    return {
        **ocr_result.diagnostics,
        "mistral_parser_status": status,
        "mistral_parser_failure_stage": failure_stage,
        "mistral_parser_error_type": error_type,
        "mistral_parser_error_message": error_message,
        "mistral_parser_error_details": error_details or None,
        "mistral_parser_warning_count": len(warning_codes),
        "mistral_parser_warning_codes": warning_codes,
        "sectionRecovery": section_recovery,
        "annotationRetry": annotation_retry,
    }


def _collect_parsing_quality_metrics(result: Dict[str, Any]) -> Dict[str, Any]:
    diagnostics = result.get("diagnostics") or {}
    if not isinstance(diagnostics, dict):
        diagnostics = {}

    section_recovery = diagnostics.get("sectionRecovery") or {}
    if not isinstance(section_recovery, dict):
        section_recovery = {}

    annotation_retry = diagnostics.get("annotationRetry") or {}
    if not isinstance(annotation_retry, dict):
        annotation_retry = {}

    canonical_payload = result.get("canonical_payload") or {}
    if not isinstance(canonical_payload, dict):
        canonical_payload = {}
    normalized = canonical_payload.get("normalized") or {}
    if not isinstance(normalized, dict):
        normalized = {}

    has_languages_section = bool((section_recovery.get("languages") or {}).get("heading"))
    has_skills_section = bool((section_recovery.get("skills") or {}).get("heading"))
    languages_extracted = bool(normalized.get("languages")) if has_languages_section else False
    skills_extracted = bool(normalized.get("skills")) if has_skills_section else False
    error_type = result.get("errorType") or diagnostics.get("mistral_parser_error_type")

    return {
        "has_languages_section": has_languages_section,
        "languages_extracted": languages_extracted,
        "languages_success": has_languages_section and languages_extracted,
        "has_skills_section": has_skills_section,
        "skills_extracted": skills_extracted,
        "skills_success": has_skills_section and skills_extracted,
        "recovery_used": any(
            isinstance(entry, dict) and bool(entry.get("applied"))
            for entry in section_recovery.values()
        ),
        "retry_used": bool(annotation_retry.get("attempted")),
        "error_type": error_type,
        "hard_failure": error_type == RETRYABLE_SECTION_FAILURE,
    }


def _attach_parsing_quality_metrics(result: Dict[str, Any]) -> Dict[str, Any]:
    metrics = _collect_parsing_quality_metrics(result)
    diagnostics = dict(result.get("diagnostics") or {})
    diagnostics["parsingQuality"] = metrics
    result["diagnostics"] = diagnostics

    canonical_payload = result.get("canonical_payload")
    if isinstance(canonical_payload, dict):
        canonical_diagnostics = dict(canonical_payload.get("diagnostics") or {})
        canonical_diagnostics["parsingQuality"] = metrics
        canonical_payload["diagnostics"] = canonical_diagnostics

    return result


def _build_failure_payload(
    *,
    status: str,
    stage: str,
    error_type: str,
    error_message: str,
    error_details: Optional[Dict[str, Any]],
    ocr_result: OCRAnnotationResult,
    section_recovery: dict[str, dict[str, Any]],
    annotation_retry: dict[str, Any],
    warnings: Optional[list[dict[str, Any]]] = None,
) -> Dict[str, Any]:
    warning_payload = warnings or []
    diagnostics = _build_pipeline_diagnostics(
        ocr_result=ocr_result,
        status=status,
        failure_stage=stage,
        error_type=error_type,
        error_message=error_message,
        error_details=error_details,
        warning_codes=[warning["code"] for warning in warning_payload if isinstance(warning, dict) and warning.get("code")],
        section_recovery=section_recovery,
        annotation_retry=annotation_retry,
    )
    return _attach_parsing_quality_metrics({
        "status": status,
        "fallback_to_legacy": True,
        "stage": stage,
        "errorType": error_type,
        "errorMessage": error_message,
        "warnings": warning_payload,
        "pages": ocr_result.pages,
        "rawText": _join_markdown_pages(ocr_result.pages),
        "diagnostics": diagnostics,
    })


def _build_success_payload(
    *,
    normalized: Any,
    raw_text: str,
    ocr_result: OCRAnnotationResult,
    section_recovery: dict[str, dict[str, Any]],
    annotation_retry: dict[str, Any],
) -> Dict[str, Any]:
    canonical_payload = build_canonical_payload(normalized)
    warning_codes = [warning["code"] for warning in canonical_payload.get("warnings", []) if isinstance(warning, dict) and warning.get("code")]
    diagnostics = _build_pipeline_diagnostics(
        ocr_result=ocr_result,
        status=normalized.status,
        failure_stage=normalized.failureStage,
        error_type=normalized.errorType,
        error_message=normalized.errorMessage,
        error_details=None,
        warning_codes=warning_codes,
        section_recovery=section_recovery,
        annotation_retry=annotation_retry,
    )
    canonical_diagnostics = dict(canonical_payload.get("diagnostics") or {})
    canonical_diagnostics.update(diagnostics)
    canonical_payload["diagnostics"] = canonical_diagnostics
    return _attach_parsing_quality_metrics({
        "status": normalized.status,
        "fallback_to_legacy": False,
        "pages": ocr_result.pages,
        "canonical_payload": canonical_payload,
        "diagnostics": diagnostics,
        "rawText": raw_text,
    })


def _build_result_from_normalized(
    *,
    normalized: Any,
    raw_text: str,
    ocr_result: OCRAnnotationResult,
    section_recovery: dict[str, dict[str, Any]],
    annotation_retry: dict[str, Any],
) -> Dict[str, Any]:
    if normalized.status in {"failed", "unavailable"}:
        error_type = normalized.errorType or "annotation_invalid"
        error_message = normalized.errorMessage or "Annotation did not contain usable resume content."
        return _build_failure_payload(
            status=normalized.status,
            stage=normalized.failureStage or "validation",
            error_type=error_type,
            error_message=error_message,
            error_details=None,
            ocr_result=ocr_result,
            section_recovery=section_recovery,
            annotation_retry=annotation_retry,
            warnings=_warning_payload(normalized),
        )

    return _build_success_payload(
        normalized=normalized,
        raw_text=raw_text,
        ocr_result=ocr_result,
        section_recovery=section_recovery,
        annotation_retry=annotation_retry,
    )


def _build_section_contradiction_failure(
    *,
    normalized: Any,
    ocr_result: OCRAnnotationResult,
    section_recovery: dict[str, dict[str, Any]],
) -> Dict[str, Any]:
    return _build_failure_payload(
        status="failed",
        stage="section_recovery",
        error_type=RETRYABLE_SECTION_FAILURE,
        error_message="Explicit OCR section evidence contradicted the annotation after deterministic section recovery.",
        error_details={
            "issues": {
                family: entry["reason"]
                for family, entry in section_recovery.items()
                if family in {"languages", "skills"} and entry.get("heading")
            },
            "recoveredFields": sorted(family for family, entry in section_recovery.items() if entry.get("applied")),
        },
        ocr_result=ocr_result,
        section_recovery=section_recovery,
        annotation_retry=_build_annotation_retry_metadata(
            attempted=False,
            count=0,
            reason=RETRYABLE_SECTION_FAILURE,
            eligible=True,
            exhausted=False,
        ),
        warnings=_warning_payload(normalized),
    )


def _apply_annotation_retry_metadata(
    result: Dict[str, Any],
    *,
    attempted: bool,
    count: int,
    reason: Optional[str],
    eligible: bool,
    exhausted: bool,
) -> Dict[str, Any]:
    diagnostics = dict(result.get("diagnostics") or {})
    retry_metadata = dict(diagnostics.get("annotationRetry") or {})
    retry_metadata.update(
        {
            "attempted": attempted,
            "count": count,
            "reason": reason,
            "eligible": eligible,
            "exhausted": exhausted,
        }
    )
    diagnostics["annotationRetry"] = retry_metadata
    result["diagnostics"] = diagnostics

    canonical_payload = result.get("canonical_payload")
    if isinstance(canonical_payload, dict):
        canonical_diagnostics = dict(canonical_payload.get("diagnostics") or {})
        canonical_diagnostics["sectionRecovery"] = diagnostics.get("sectionRecovery", {})
        canonical_diagnostics["annotationRetry"] = retry_metadata
        canonical_payload["diagnostics"] = canonical_diagnostics

    return _attach_parsing_quality_metrics(result)


def _run_resume_pipeline_with_single_retry(fetch_ocr: Callable[[], OCRAnnotationResult]) -> Dict[str, Any]:
    first_result = _run_resume_pipeline_from_ocr_result(fetch_ocr())
    first_retry = dict((first_result.get("diagnostics") or {}).get("annotationRetry") or {})
    if not first_retry.get("eligible"):
        return first_result

    second_result = _run_resume_pipeline_from_ocr_result(fetch_ocr())
    return _apply_annotation_retry_metadata(
        second_result,
        attempted=True,
        count=1,
        reason=first_retry.get("reason") or RETRYABLE_SECTION_FAILURE,
        eligible=False,
        exhausted=second_result.get("errorType") == RETRYABLE_SECTION_FAILURE,
    )


def _run_resume_pipeline_from_ocr_result(ocr_result: OCRAnnotationResult) -> Dict[str, Any]:
    raw_text = _join_markdown_pages(ocr_result.pages)
    explicit_sections = _extract_explicit_sections_from_pages(ocr_result.pages)
    skills_recovery_sections = _skill_sections_eligible_for_recovery(explicit_sections.get("skills", []))
    summary_recovery_sections = _summary_sections_eligible_for_recovery(explicit_sections.get("summary", []))
    section_recovery = _default_section_recovery_metadata(explicit_sections)
    try:
        extraction = parse_document_annotation(ocr_result.annotation_raw)
    except AnnotationParserError as exc:
        for entry in section_recovery.values():
            if entry.get("heading"):
                entry["reason"] = "annotation_parse_failed_before_recovery"
        return _build_failure_payload(
            status="failed",
            stage="annotation_parse",
            error_type="annotation_parse_failed",
            error_message=str(exc),
            error_details=exc.details,
            ocr_result=ocr_result,
            section_recovery=section_recovery,
            annotation_retry=_build_annotation_retry_metadata(),
        )

    if not _clean_inline_text(extraction.identity.desiredPosition if extraction.identity else None):
        recovered_desired_position = _recover_desired_position_from_header(
            raw_text,
            identity_name=_clean_inline_text(extraction.identity.name if extraction.identity else None),
        )
        if recovered_desired_position:
            repaired_payload = _coerce_annotation_for_repair(extraction) or {}
            identity_payload = repaired_payload.setdefault("identity", {})
            if isinstance(identity_payload, dict):
                identity_payload["desiredPosition"] = recovered_desired_position
                try:
                    extraction = parse_document_annotation(repaired_payload)
                except AnnotationParserError:
                    pass

    normalized = normalize_extraction(
        extraction,
        raw_text=raw_text,
        page_count=ocr_result.page_count,
        document_name=ocr_result.diagnostics.get("document_name"),
    )
    section_gate_issues = _collect_section_gate_issues(normalized, explicit_sections)

    for family in ("languages", "skills"):
        if explicit_sections.get(family):
            section_recovery[family]["reason"] = section_gate_issues.get(family, "accepted_annotation_values")

    achievements_recovery_needed = bool(explicit_sections.get("achievements")) and not getattr(normalized, "achievements", [])
    if explicit_sections.get("achievements"):
        section_recovery["achievements"]["reason"] = (
            "empty_explicit_section_values" if achievements_recovery_needed else "accepted_annotation_values"
        )
    experience_recovery_needed = bool(explicit_sections.get("experience")) and not getattr(normalized, "experience", [])
    if explicit_sections.get("experience"):
        section_recovery["experience"]["reason"] = (
            "empty_explicit_section_values" if experience_recovery_needed else "accepted_annotation_values"
        )
    summary_recovery_needed = bool(summary_recovery_sections) and not _clean_inline_text(
        getattr(getattr(normalized, "summary", None), "text", None)
    )
    if explicit_sections.get("summary"):
        section_recovery["summary"]["reason"] = (
            "empty_explicit_section_values"
            if summary_recovery_needed
            else ("explicit_section_not_recovery_eligible" if not summary_recovery_sections else "accepted_annotation_values")
        )

    if not section_gate_issues and not achievements_recovery_needed and not experience_recovery_needed and not summary_recovery_needed:
        return _build_result_from_normalized(
            normalized=normalized,
            raw_text=raw_text,
            ocr_result=ocr_result,
            section_recovery=section_recovery,
            annotation_retry=_build_annotation_retry_metadata(),
        )

    repaired_payload = _coerce_annotation_for_repair(extraction) or {}
    repair_applied = False
    recovered_languages: Optional[list[dict[str, Any]]] = None
    recovered_skills: Optional[list[str]] = None
    recovered_experience: Optional[list[dict[str, Any]]] = None
    recovered_summary: Optional[str] = None

    if achievements_recovery_needed:
        achievements = _extract_explicit_achievements_from_sections(explicit_sections.get("achievements", []))
        if achievements:
            repaired_payload["achievements"] = achievements
            section_recovery["achievements"]["applied"] = True
            repair_applied = True

    if experience_recovery_needed:
        experience = _extract_explicit_experience_from_sections(explicit_sections.get("experience", []))
        if experience:
            repaired_payload["experience"] = experience
            recovered_experience = experience
            section_recovery["experience"]["applied"] = True
            repair_applied = True

    if summary_recovery_needed:
        summary = _extract_explicit_summary_from_sections(summary_recovery_sections)
        if summary:
            repaired_payload["summary"] = {"text": summary}
            recovered_summary = summary
            section_recovery["summary"]["applied"] = True
            repair_applied = True

    if "languages" in section_gate_issues:
        languages = _extract_explicit_languages_from_sections(explicit_sections.get("languages", []))
        if languages:
            repaired_payload["languages"] = languages
            recovered_languages = languages
            section_recovery["languages"]["applied"] = True
            repair_applied = True

    if "skills" in section_gate_issues:
        if not skills_recovery_sections:
            section_recovery["skills"]["reason"] = "explicit_section_not_recovery_eligible"
        skills = _extract_explicit_skills_from_sections(skills_recovery_sections)
        if skills:
            repaired_payload["skills"] = [{"name": item} for item in skills]
            recovered_skills = skills
            section_recovery["skills"]["applied"] = True
            repair_applied = True

    if not repair_applied:
        if section_gate_issues:
            return _build_section_contradiction_failure(
                normalized=normalized,
                ocr_result=ocr_result,
                section_recovery=section_recovery,
            )
        return _build_result_from_normalized(
            normalized=normalized,
            raw_text=raw_text,
            ocr_result=ocr_result,
            section_recovery=section_recovery,
            annotation_retry=_build_annotation_retry_metadata(),
        )

    try:
        repaired_extraction = parse_document_annotation(repaired_payload)
    except AnnotationParserError as exc:
        return _build_failure_payload(
            status="failed",
            stage="section_recovery",
            error_type=RETRYABLE_SECTION_FAILURE,
            error_message="Deterministic OCR section recovery produced an invalid annotation payload.",
            error_details={"recoveryValidationErrors": exc.details},
            ocr_result=ocr_result,
            section_recovery=section_recovery,
            annotation_retry=_build_annotation_retry_metadata(
                attempted=False,
                count=0,
                reason=RETRYABLE_SECTION_FAILURE,
                eligible=True,
                exhausted=False,
            ),
            warnings=_warning_payload(normalized),
        )

    repaired_normalized = normalize_extraction(
        repaired_extraction,
        raw_text=raw_text,
        page_count=ocr_result.page_count,
        document_name=ocr_result.diagnostics.get("document_name"),
    )
    repaired_issues = _collect_second_validation_issues_after_recovery(
        repaired_normalized=repaired_normalized,
        explicit_sections=explicit_sections,
        recovered_languages=recovered_languages,
        recovered_skills=recovered_skills,
        recovered_experience=recovered_experience,
        recovered_summary=recovered_summary,
    )
    for family in ("languages", "skills", "experience", "summary"):
        if explicit_sections.get(family):
            if repaired_issues.get(family):
                section_recovery[family]["reason"] = repaired_issues[family]
            elif not section_recovery[family]["applied"]:
                section_recovery[family]["reason"] = "accepted_annotation_values"

    if repaired_issues:
        return _build_section_contradiction_failure(
            normalized=repaired_normalized,
            ocr_result=ocr_result,
            section_recovery=section_recovery,
        )

    return _build_result_from_normalized(
        normalized=repaired_normalized,
        raw_text=raw_text,
        ocr_result=ocr_result,
        section_recovery=section_recovery,
        annotation_retry=_build_annotation_retry_metadata(),
    )


def run_resume_pipeline_from_bytes(
    *,
    file_name: Optional[str],
    content_type: Optional[str],
    data: bytes,
    api_key: str,
    model_name: Optional[str],
) -> Dict[str, Any]:
    return _run_resume_pipeline_with_single_retry(
        lambda: run_annotated_ocr_from_bytes(
            file_name=file_name,
            content_type=content_type,
            data=data,
            api_key=api_key,
            model_name=model_name,
        )
    )


def run_resume_pipeline_from_url(
    *,
    url: str,
    api_key: str,
    model_name: Optional[str],
) -> Dict[str, Any]:
    return _run_resume_pipeline_with_single_retry(
        lambda: run_annotated_ocr_from_url(
            url=url,
            api_key=api_key,
            model_name=model_name,
        )
    )


def _fixture_path(fixture_name: str) -> Path:
    return Path(__file__).resolve().parents[2] / "fixtures" / fixture_name


def _result_summary(result: Dict[str, Any]) -> Dict[str, Any]:
    canonical_payload = result.get("canonical_payload") or {}
    normalized = canonical_payload.get("normalized") or {}
    app_document = canonical_payload.get("appDocument") or {}
    return {
        "status": result.get("status"),
        "fallback_to_legacy": result.get("fallback_to_legacy"),
        "errorType": result.get("errorType"),
        "errorMessage": result.get("errorMessage"),
        "pages": (result.get("diagnostics") or {}).get("page_count"),
        "warningCount": len(canonical_payload.get("warnings") or result.get("warnings") or []),
        "sectionTypes": [section.get("type") for section in app_document.get("sections", []) if isinstance(section, dict)],
        "rawSectionLabels": [section.get("label") for section in canonical_payload.get("rawSections", []) if isinstance(section, dict)],
        "experienceCount": len(normalized.get("experience") or []),
        "educationCount": len(normalized.get("education") or []),
        "languageCount": len(normalized.get("languages") or []),
        "projectCount": len(normalized.get("projects") or []),
        "certificationCount": len(normalized.get("certifications") or []),
    }


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Run the Mistral resume v3 pipeline on a fixture or local file.")
    parser.add_argument("--file", help="Absolute or relative path to a local file.")
    parser.add_argument("--fixture-name", help="Fixture filename under ./fixtures.")
    parser.add_argument("--stdout-json", action="store_true", help="Print only the final summary JSON to stdout.")
    args = parser.parse_args(argv)

    source_path: Optional[Path] = None
    if args.file:
        source_path = Path(args.file).expanduser().resolve()
    elif args.fixture_name:
        source_path = _fixture_path(args.fixture_name)

    if source_path is None:
        parser.error("Provide --file or --fixture-name.")
    if not source_path.exists():
        parser.error(f"File not found: {source_path}")

    api_key = (sys.modules.get("os") or __import__("os")).environ.get("MISTRAL_API_KEY", "").strip()
    if not api_key:
        parser.error("MISTRAL_API_KEY is required.")
    model_name = (sys.modules.get("os") or __import__("os")).environ.get("MISTRAL_OCR_MODEL", "mistral-ocr-latest").strip() or "mistral-ocr-latest"

    mime_type = mimetypes.guess_type(source_path.name)[0] or "application/octet-stream"
    result = run_resume_pipeline_from_bytes(
        file_name=source_path.name,
        content_type=mime_type,
        data=source_path.read_bytes(),
        api_key=api_key,
        model_name=model_name,
    )
    summary = _result_summary(result)
    if args.stdout_json:
        json.dump(summary, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
    else:
        json.dump(serialize_for_json(result), sys.stdout, indent=2, ensure_ascii=False)
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
