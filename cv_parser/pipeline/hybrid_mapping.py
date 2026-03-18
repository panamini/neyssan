"""Utilities to map HybridCVParser output to NormalizedCv objects."""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from ..extract.sections import NORMALISED_SECTION_SYNONYMS, normalize_heading_text
from ..schema.model import ArrayItem, ContactInfo, LayoutBlock, NormalizedCv, StrictContact, TextField

log = logging.getLogger(__name__)

_HYBRID_WARNING_EMITTED = False


@lru_cache(maxsize=1)
def _load_hybrid_parser():
    global _HYBRID_WARNING_EMITTED
    try:
        from cv_parser.hybrid_pipeline import HybridCVParser
    except Exception:  # pragma: no cover - dependency missing
        if not _HYBRID_WARNING_EMITTED:
            log.warning("Hybrid parser unavailable (spaCy pipeline missing); using regex heuristics only")
            _HYBRID_WARNING_EMITTED = True
        return None

    try:
        parser = HybridCVParser(model_path="en_core_web_sm", prefer_docling=False)
    except Exception:  # pragma: no cover - model missing
        if not _HYBRID_WARNING_EMITTED:
            log.warning("Hybrid parser failed to load spaCy model 'en_core_web_sm'; using regex heuristics")
            _HYBRID_WARNING_EMITTED = True
        return None
    if not getattr(parser, "available", True):
        if not _HYBRID_WARNING_EMITTED:
            log.warning("Hybrid parser unavailable (spaCy disabled); using regex heuristics only")
            _HYBRID_WARNING_EMITTED = True
        return None
    return parser


def get_hybrid_parser():
    """Return cached HybridCVParser instance or None if spaCy model unavailable."""
    return _load_hybrid_parser()


def _first_entity_value(entities: Dict[str, Iterable[Dict]], label: str) -> Optional[str]:
    values = entities.get(label) or []
    for entity in values:
        value = entity.get("value")
        if value:
            return str(value)
    return None


_SECTION_NORMALISATIONS = {
    key.upper(): {variant for variant in variants}
    for key, variants in NORMALISED_SECTION_SYNONYMS.items()
}


def _normalise_title(text: str) -> str:
    return normalize_heading_text(text)


def _match_section_from_title(text: str) -> Optional[str]:
    candidate = _normalise_title(text)
    for key_upper, variants in _SECTION_NORMALISATIONS.items():
        if candidate in variants:
            return key_upper
        for variant in variants:
            if candidate in variant or variant in candidate:
                return key_upper
    return None


def _group_pp_structure_sections(blocks: Sequence[LayoutBlock]) -> Dict[str, List[str]]:
    grouped: Dict[str, List[str]] = {}
    current_section: Optional[str] = None
    buffer: List[str] = []

    def flush() -> None:
        nonlocal buffer, current_section
        if current_section and buffer:
            text = "\n".join(part.strip() for part in buffer if part.strip())
            if text:
                grouped.setdefault(current_section, []).append(text)
        buffer = []

    for block in blocks:
        block_type = str(getattr(block, "block_type", "") or "").lower()
        text = getattr(block, "text", "") or ""
        if not text.strip():
            continue
        if block_type == "title":
            flush()
            current_section = _match_section_from_title(text)
            continue
        if block_type in {"paragraph", "text"} and current_section:
            buffer.append(text)
    flush()
    return {key: values for key, values in grouped.items() if values}


def _apply_pp_groups(normalized: NormalizedCv, groups: Dict[str, List[str]]) -> bool:
    used = False

    def set_experience(entries: List[str]) -> None:
        nonlocal used
        if entries and not normalized.experience:
            normalized.experience = [ArrayItem(content=entry, confidence=0.7) for entry in entries]
            used = True

    def set_education(entries: List[str]) -> None:
        nonlocal used
        if entries and not normalized.education:
            normalized.education = [ArrayItem(content=entry, confidence=0.7) for entry in entries]
            used = True

    def set_skills(entries: List[str]) -> None:
        nonlocal used
        if entries and not normalized.skills:
            normalized.skills = TextField(text="\n".join(entries), confidence=0.6)
            used = True

    def set_languages(entries: List[str]) -> None:
        nonlocal used
        if entries and not normalized.languages:
            normalized.languages = TextField(text="\n".join(entries), confidence=0.6)
            normalized.languagesRaw = entries
            used = True

    def set_achievements(entries: List[str]) -> None:
        nonlocal used
        if entries and not normalized.achievements:
            normalized.achievements = TextField(text="\n".join(entries), confidence=0.55)
            used = True

    set_experience(groups.get("EXPERIENCE", []))
    set_education(groups.get("EDUCATION", []))
    set_skills(groups.get("SKILLS", []))
    set_languages(groups.get("LANGUAGES", []))
    set_achievements(groups.get("ACHIEVEMENTS", []))

    return used


def apply_hybrid_mapping(
    normalized: NormalizedCv,
    packed: Dict,
    pp_blocks: Optional[Sequence[LayoutBlock]] = None,
) -> Tuple[Optional[StrictContact], bool, Dict[str, int]]:
    """Populate normalized CV fields using the Hybrid pipeline output."""
    pp_groups: Dict[str, List[str]] = {}
    pp_section_counts: Dict[str, int] = {}
    pp_structure_used = False

    if pp_blocks:
        try:
            grouped = _group_pp_structure_sections(pp_blocks)
        except Exception as exc:  # pragma: no cover - defensive
            log.debug("Failed to group PP-Structure blocks: %s", exc)
            grouped = {}
        if grouped:
            pp_groups = {key.upper(): values for key, values in grouped.items()}
            pp_structure_used = _apply_pp_groups(normalized, pp_groups)
            pp_section_counts = {key: len(values) for key, values in pp_groups.items()}

    setattr(normalized, "_pp_structure_used", pp_structure_used)
    setattr(normalized, "_pp_section_counts", pp_section_counts)

    sections = packed.get("sections") or []
    entities = packed.get("entities") or {}

    hybrid_used = bool(sections)
    if not sections:
        log.warning("Hybrid parser produced no sections; falling back to heuristics")

    if sections and not normalized.rawSections:
        normalized.rawSections = sections
    elif not sections and not normalized.rawSections and pp_groups:
        normalized.rawSections = [
            {"label": label, "text": text}
            for label, texts in pp_groups.items()
            for text in texts
        ]

    section_text: Dict[str, list] = {}
    for section in sections:
        label = section.get("label")
        text = section.get("text", "")
        if not label or not text:
            continue
        section_text.setdefault(label.upper(), []).append(text)

    counts: Dict[str, int] = {key: value for key, value in pp_section_counts.items()}

    # Summary
    if not normalized.summary and section_text.get("SUMMARY"):
        normalized.summary = TextField(text=section_text["SUMMARY"][0], confidence=0.7)

    # Experience / Education
    if not normalized.experience and section_text.get("EXPERIENCE"):
        normalized.experience = [ArrayItem(content=entry, confidence=0.65) for entry in section_text["EXPERIENCE"]]

    if not normalized.education and section_text.get("EDUCATION"):
        normalized.education = [ArrayItem(content=entry, confidence=0.65) for entry in section_text["EDUCATION"]]

    # Skills / languages / achievements (text blobs)
    if not normalized.skills and section_text.get("SKILLS"):
        normalized.skills = TextField(text="\n".join(section_text["SKILLS"]), confidence=0.6)

    if not normalized.languages and section_text.get("LANGUAGES"):
        normalized.languages = TextField(text="\n".join(section_text["LANGUAGES"]), confidence=0.6)
        normalized.languagesRaw = section_text["LANGUAGES"]

    if not normalized.achievements and section_text.get("ACHIEVEMENTS"):
        normalized.achievements = TextField(text="\n".join(section_text["ACHIEVEMENTS"]), confidence=0.5)

    # Entities for contact fields
    email_ent = _first_entity_value(entities, "EMAIL")
    phone_ent = _first_entity_value(entities, "PHONE")
    name_ent = _first_entity_value(entities, "NAME")

    if email_ent and not normalized.contact.email:
        normalized.contact.email = email_ent
    if phone_ent and not normalized.contact.phone:
        normalized.contact.phone = phone_ent
    if name_ent and not normalized.name:
        normalized.name = name_ent

    for label, values in section_text.items():
        counts[label] = counts.get(label, 0) + len(values)

    strict = None
    if isinstance(normalized.contact, ContactInfo):
        strict = StrictContact(
            name=normalized.name,
            email=normalized.contact.email,
            phone=normalized.contact.phone,
            location=normalized.contact.addressNormalized,
        )

    return strict, hybrid_used, counts
