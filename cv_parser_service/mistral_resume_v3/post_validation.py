from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Iterable, List, Optional, Sequence, Tuple

from .extraction_schema import (
    ExtractionAward,
    ExtractionOtherSection,
    ExtractionPublication,
    ExtractionVolunteering,
    ResumeExtraction,
)
from .normalized_schema import (
    NormalizedCertification,
    NormalizedContact,
    NormalizedEducation,
    NormalizedExperience,
    NormalizedIdentity,
    NormalizedLanguage,
    NormalizedProject,
    NormalizedResume,
    NormalizedSkill,
    NormalizedSummary,
    NormalizedTextSection,
    ParserWarning,
)


URL_RE = re.compile(r"(https?://|www\.)", re.IGNORECASE)
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
EMAIL_FRAGMENT_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
DOMAINISH_RE = re.compile(r"^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:/[\w./#?=&%-]+)?$")
HANDLE_RE = re.compile(r"^@?[A-Za-z0-9._/-]{2,100}$")
BULLETISH_RE = re.compile(r"^\s*(?:[-*•·●▪◦]|(?:\d+[.)]))\s+")
DEGREE_TOKEN_RE = re.compile(
    r"\b(bachelor|master|msc|bsc|mba|phd|doctorate|diploma|degree|universit|college|school|lyc[ée]e|licence|formation|bts|dut)\b",
    re.IGNORECASE,
)
CERTIFICATION_TOKEN_RE = re.compile(
    r"\b(certif|certificate|certified|credential|licen[sc]e|training program|course completion|bootcamp)\b",
    re.IGNORECASE,
)
ORGISH_RE = re.compile(r"\b(inc|llc|ltd|corp|company|university|college|school|academy|institute)\b", re.IGNORECASE)
HEADER_SCAN_LIMIT = 1200
STRONG_DEGREE_TOKEN_RE = re.compile(
    r"\b(bachelor|master|associate|doctorate|phd|mba|msc|bsc|diploma|degree|major|minor|thesis|coursework)\b",
    re.IGNORECASE,
)
STRONG_CERTIFICATION_TOKEN_RE = re.compile(
    r"\b(certif|certificate|certified|credential|licen[sc]e|training program|course completion|bootcamp|permit|cpo)\b",
    re.IGNORECASE,
)
ACHIEVEMENT_RESULT_RE = re.compile(
    r"\b(increased|reduced|improved|saved|grew|generated|achieved|awarded|won|delivered|launched|led|recognized|recognised|promoted)\b",
    re.IGNORECASE,
)
ACHIEVEMENT_AWARD_RE = re.compile(
    r"\b(award|awarded|honor|honour|recognition|scholarship|certification|certificate|credential|license|licence|medal|winner)\b",
    re.IGNORECASE,
)


def _normalize_lookup(value: str) -> str:
    try:
        ascii_text = unicodedata.normalize("NFD", value)
        ascii_text = "".join(char for char in ascii_text if unicodedata.category(char) != "Mn")
    except Exception:
        ascii_text = value
    return re.sub(r"\s+", " ", ascii_text).strip().lower()


def _load_language_aliases() -> dict[str, str]:
    path = Path(__file__).resolve().parents[2] / "shared" / "language_names.json"
    try:
        payload = json.loads(path.read_text())
    except Exception:
        return {}

    aliases: dict[str, str] = {}
    for canonical, values in payload.items():
        canonical_text = str(canonical).strip()
        if not canonical_text:
            continue
        aliases[_normalize_lookup(canonical_text)] = canonical_text
        if isinstance(values, list):
            for value in values:
                alias = str(value).strip()
                if alias:
                    aliases[_normalize_lookup(alias)] = canonical_text
    return aliases


LANGUAGE_ALIASES = _load_language_aliases()


def _clean_text(value: object) -> Optional[str]:
    if value is None:
        return None
    text = str(value).replace("\xa0", " ").strip()
    if not text:
        return None
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"([,;:!?])\1{1,}", r"\1", text)
    text = re.sub(r"\s+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() or None


def _clean_inline_text(value: object) -> Optional[str]:
    text = _clean_text(value)
    if not text:
        return None
    return re.sub(r"\s+", " ", text).strip() or None


def _clean_list(values: Iterable[object]) -> List[str]:
    seen: set[str] = set()
    output: List[str] = []
    for value in values:
        cleaned = _clean_inline_text(value)
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(cleaned)
    return output


def _first_sentence(value: Optional[str]) -> str:
    if not value:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", value.strip())
    for part in parts:
        candidate = _clean_inline_text(part)
        if candidate:
            return candidate
    return _clean_inline_text(value) or ""


def _warning(warnings: List[ParserWarning], code: str, message: str, field: Optional[str] = None) -> None:
    warnings.append(ParserWarning(code=code, message=message, field=field))


def _looks_like_role_summary_misuse(value: str) -> bool:
    lines = [line.strip() for line in value.splitlines() if line.strip()]
    if not lines:
        return False
    bullet_lines = sum(1 for line in lines if BULLETISH_RE.match(line))
    if bullet_lines >= max(2, len(lines) - 1):
        return True
    if "\n" in value and bullet_lines > 0:
        return True
    return False


def _appears_in_header(raw_text: str, candidate: str) -> bool:
    haystack = (raw_text or "")[:HEADER_SCAN_LIMIT].lower()
    return candidate.lower() in haystack


def _validate_identity_location(
    candidate: Optional[str],
    *,
    raw_text: str,
    experience_locations: Sequence[str],
    education_locations: Sequence[str],
    warnings: List[ParserWarning],
) -> Optional[str]:
    location = _clean_inline_text(candidate)
    if not location:
        return None
    if URL_RE.search(location) or EMAIL_RE.match(location):
        _warning(warnings, "identity_location_dropped", "Dropped invalid identity.location value.", "identity.location")
        return None
    if ORGISH_RE.search(location) and not _appears_in_header(raw_text, location):
        _warning(warnings, "identity_location_dropped", "Dropped employer/school-like identity.location value.", "identity.location")
        return None
    peer_locations = {value.lower() for value in [*experience_locations, *education_locations] if value}
    if location.lower() in peer_locations and not _appears_in_header(raw_text, location):
        _warning(warnings, "identity_location_dropped", "Dropped identity.location that only matched role or school locations.", "identity.location")
        return None
    return location


def _normalize_link(value: Optional[str], kind: str) -> Optional[str]:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return None
    lowered = cleaned.lower().rstrip(":")
    if lowered in {kind, kind.replace("_", " "), "link", "url", "website"}:
        return None

    if kind in {"linkedin", "github"} and HANDLE_RE.match(cleaned) and "." not in cleaned:
        return cleaned

    candidate = cleaned
    if candidate.startswith("www."):
        candidate = f"https://{candidate}"
    elif DOMAINISH_RE.match(candidate):
        candidate = f"https://{candidate}"

    if not URL_RE.search(candidate) and kind not in {"linkedin", "github"}:
        return None

    if kind == "linkedin":
        if "linkedin.com" in candidate.lower() or HANDLE_RE.match(cleaned):
            return candidate
        return None
    if kind == "github":
        if "github.com" in candidate.lower() or HANDLE_RE.match(cleaned):
            return candidate
        return None
    if kind in {"website", "portfolio"}:
        return candidate if URL_RE.search(candidate) else None
    return candidate


def _normalize_phone(value: Optional[str]) -> Optional[str]:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return None
    digits = re.sub(r"\D", "", cleaned)
    if len(digits) < 7:
        return None
    return cleaned


def _normalize_email(value: Optional[str]) -> Optional[str]:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return None
    candidate = cleaned.strip(" \t<>[](){}'\";,.:")
    if EMAIL_RE.match(candidate):
        return candidate
    matches = EMAIL_FRAGMENT_RE.findall(candidate)
    unique_matches = []
    seen: set[str] = set()
    for match in matches:
        lowered = match.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        unique_matches.append(match)
    if len(unique_matches) == 1 and EMAIL_RE.match(unique_matches[0]):
        return unique_matches[0]
    return None


def _normalize_headline_summary(value: Optional[str]) -> Optional[str]:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return None
    if BULLETISH_RE.match(cleaned):
        return None
    if URL_RE.search(cleaned) or EMAIL_RE.search(cleaned):
        return None
    normalized = _normalize_lookup(cleaned)
    if normalized in {
        "linkedin",
        "skills",
        "summary",
        "profile",
        "experience",
        "education",
        "contact",
        "details",
        "website",
        "portfolio",
        "github",
    }:
        return None
    token_count = len(cleaned.split())
    if token_count < 2 or token_count > 8:
        return None
    return cleaned


def _looks_like_school_name(value: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return False
    lowered = _normalize_lookup(cleaned)
    if any(token in lowered for token in ("high school", "school", "academy", "college", "university", "institute")):
        return True
    return False


def _looks_like_location_fragment(value: Optional[str]) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return False
    if URL_RE.search(cleaned) or EMAIL_RE.search(cleaned):
        return False
    lowered = _normalize_lookup(cleaned)
    if any(token in lowered for token in ("school", "academy", "college", "university", "institute", "bachelor", "master", "certified")):
        return False
    tokens = cleaned.split()
    if len(tokens) > 4:
        return False
    return True


def _normalize_education_fields(
    *,
    institution: Optional[str],
    degree: Optional[str],
    location: Optional[str],
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    normalized_institution = _clean_inline_text(institution)
    normalized_degree = _clean_inline_text(degree)
    normalized_location = _clean_inline_text(location)
    if (
        not normalized_location
        and _looks_like_location_fragment(normalized_institution)
        and _looks_like_school_name(normalized_degree)
        and not STRONG_DEGREE_TOKEN_RE.search(normalized_degree or "")
    ):
        return normalized_degree, None, normalized_institution
    return normalized_institution, normalized_degree, normalized_location


def _normalize_language_name(value: Optional[str]) -> Optional[str]:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return None
    alias = LANGUAGE_ALIASES.get(_normalize_lookup(cleaned))
    if alias:
        return alias
    if re.search(r"\d", cleaned):
        return None
    if DEGREE_TOKEN_RE.search(cleaned) or CERTIFICATION_TOKEN_RE.search(cleaned):
        return None
    if len(cleaned.split()) > 3:
        return None
    return cleaned


def _map_level(level_raw: Optional[str]) -> Optional[str]:
    level = _normalize_lookup(level_raw or "")
    if not level:
        return None
    if any(token in level for token in ("native", "bilingual", "fluent", "courant", "natif")):
        return "Fluent"
    if any(token in level for token in ("advanced", "professional", "avanc", "expert")):
        return "Advanced"
    if any(token in level for token in ("intermediate", "conversational", "interm", "working")):
        return "Intermediate"
    if any(token in level for token in ("elementary", "basic", "elementaire", "scolaire")):
        return "Elementary"
    if any(token in level for token in ("beginner", "debut", "debutant")):
        return "Beginner"
    return None


def _stable_key(*parts: object) -> str:
    return "||".join(_normalize_lookup(_clean_inline_text(part) or "") for part in parts)


def _dedupe_preserve_order(items: Iterable[object], *, key_fn) -> List[object]:
    seen: set[str] = set()
    output: List[object] = []
    for item in items:
        key = key_fn(item)
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output


def _looks_like_narrative_achievement(value: str) -> bool:
    cleaned = _clean_inline_text(value)
    if not cleaned:
        return False
    if ACHIEVEMENT_AWARD_RE.search(cleaned):
        return False
    if ACHIEVEMENT_RESULT_RE.search(cleaned):
        return False
    if re.search(r"[$%]|\b\d+(?:\.\d+)?\b", cleaned):
        return False
    token_count = len(cleaned.split())
    if token_count < 8 and len(cleaned) < 60:
        return False
    return True


def _reclassify_experience_achievement_text(
    *,
    summary: Optional[str],
    bullets: List[str],
    achievements: List[str],
) -> Tuple[Optional[str], List[str], List[str]]:
    kept_achievements: List[str] = []
    narrative_items: List[str] = []
    for item in achievements:
        if _looks_like_narrative_achievement(item):
            narrative_items.append(item)
        else:
            kept_achievements.append(item)

    normalized_summary = _clean_text(summary)
    normalized_bullets = list(bullets)
    for index, item in enumerate(narrative_items):
        if not normalized_summary:
            normalized_summary = item
            continue
        if item not in normalized_bullets:
            normalized_bullets.append(item)

    return normalized_summary, normalized_bullets, kept_achievements


def _render_award(entry: ExtractionAward) -> Optional[str]:
    parts = [
        _clean_inline_text(entry.title),
        _clean_inline_text(entry.issuer),
        _clean_inline_text(entry.date),
        "; ".join(_clean_list(entry.details)),
    ]
    rendered = " — ".join(part for part in parts if part)
    return rendered or None


def _render_publication(entry: ExtractionPublication) -> Optional[NormalizedTextSection]:
    title = _clean_inline_text(entry.title)
    if not title:
        return None
    lines = [title]
    meta = " | ".join(part for part in [_clean_inline_text(entry.venue), _clean_inline_text(entry.date)] if part)
    if meta:
        lines.append(meta)
    lines.extend(_clean_list(entry.details))
    return NormalizedTextSection(title="Publications", content="\n".join(lines), family="publications")


def _render_volunteering(entry: ExtractionVolunteering) -> Optional[NormalizedTextSection]:
    title = _clean_inline_text(entry.organization)
    if not title:
        return None
    line_one = " — ".join(part for part in [_clean_inline_text(entry.organization), _clean_inline_text(entry.role)] if part)
    meta = " | ".join(
        part
        for part in [
            _clean_inline_text(entry.location),
            "Present" if entry.isCurrent else None,
            _clean_inline_text(entry.startDate),
            _clean_inline_text(entry.endDate),
        ]
        if part
    )
    lines = [line_one or title]
    if meta:
        lines.append(meta)
    summary = _clean_inline_text(entry.summary)
    if summary:
        lines.append(summary)
    lines.extend(_clean_list(entry.bullets))
    return NormalizedTextSection(title="Volunteering", content="\n".join(lines), family="volunteering")


def _render_other_section(entry: ExtractionOtherSection) -> Optional[NormalizedTextSection]:
    title = _clean_inline_text(entry.title)
    content = _clean_text(entry.content)
    if not title or not content:
        return None
    return NormalizedTextSection(title=title, content=content, family="other")


def _reclassify_education_and_certifications(
    education: List[NormalizedEducation],
    certifications: List[NormalizedCertification],
    warnings: List[ParserWarning],
) -> Tuple[List[NormalizedEducation], List[NormalizedCertification]]:
    kept_education: List[NormalizedEducation] = []
    kept_certifications = list(certifications)

    for item in education:
        degree = _clean_inline_text(item.degree)
        institution = _clean_inline_text(item.institution)
        detail_blob = " ".join(_clean_list(item.details))
        combined_main = " ".join(part for part in [degree, detail_blob] if part)
        if STRONG_CERTIFICATION_TOKEN_RE.search(combined_main) and not STRONG_DEGREE_TOKEN_RE.search(combined_main):
            name = degree or institution
            if name:
                kept_certifications.append(
                    NormalizedCertification(
                        name=name,
                        issuer=institution if institution and institution != name else None,
                        date=item.endDate or item.startDate,
                    )
                )
                _warning(
                    warnings,
                    "education_reclassified_as_certification",
                    "Moved certification-like education entry into certifications.",
                    "education",
                )
                continue
        kept_education.append(item)

    final_education = list(kept_education)
    final_certifications: List[NormalizedCertification] = []
    for item in kept_certifications:
        name_blob = _clean_inline_text(item.name)
        if name_blob and STRONG_DEGREE_TOKEN_RE.search(name_blob) and not STRONG_CERTIFICATION_TOKEN_RE.search(name_blob):
            final_education.append(
                NormalizedEducation(
                    institution=_clean_inline_text(item.issuer),
                    degree=name_blob,
                    startDate=None,
                    endDate=item.date,
                )
            )
            _warning(
                warnings,
                "certification_reclassified_as_education",
                "Moved degree-like certification entry into education.",
                "certifications",
            )
            continue
        final_certifications.append(item)

    deduped_education = _dedupe_preserve_order(
        final_education,
        key_fn=lambda item: _stable_key(
            item.institution,
            item.degree,
            item.fieldOfStudy,
            item.startDate,
            item.endDate,
            *item.details,
        ),
    )
    deduped_certifications = _dedupe_preserve_order(
        final_certifications,
        key_fn=lambda item: _stable_key(
            item.name,
            item.issuer,
            item.credentialId,
        ),
    )

    return deduped_education, deduped_certifications


def _has_meaningful_content(resume: NormalizedResume) -> bool:
    return any(
        [
            bool(resume.identity.name),
            bool(resume.summary.text),
            bool(resume.experience),
            bool(resume.education),
            bool(resume.skills),
            bool(resume.languages),
            bool(resume.projects),
            bool(resume.certifications),
            bool(resume.achievements),
            bool(resume.textSections),
        ]
    )


def normalize_extraction(
    extraction: ResumeExtraction,
    *,
    raw_text: str,
    page_count: int,
    document_name: Optional[str],
) -> NormalizedResume:
    warnings: List[ParserWarning] = []

    experience: List[NormalizedExperience] = []
    experience_locations: List[str] = []
    for entry in extraction.experience:
        bullets = _clean_list(entry.responsibilityBullets)
        achievements = _clean_list(entry.achievements)
        summary = _clean_text(entry.summary)
        summary, bullets, achievements = _reclassify_experience_achievement_text(
            summary=summary,
            bullets=bullets,
            achievements=achievements,
        )
        normalized = NormalizedExperience(
            company=_clean_inline_text(entry.company),
            position=_clean_inline_text(entry.position),
            location=_clean_inline_text(entry.location),
            startDate=_clean_inline_text(entry.startDate),
            endDate=_clean_inline_text(entry.endDate),
            isCurrent=entry.isCurrent,
            summary=summary,
            responsibilityBullets=bullets,
            achievements=achievements,
        )
        if normalized.location:
            experience_locations.append(normalized.location)
        if normalized.company or normalized.position or normalized.responsibilityBullets or normalized.summary:
            experience.append(normalized)

    education: List[NormalizedEducation] = []
    education_locations: List[str] = []
    for entry in extraction.education:
        institution, degree, location = _normalize_education_fields(
            institution=entry.institution,
            degree=entry.degree,
            location=entry.location,
        )
        normalized = NormalizedEducation(
            institution=institution,
            degree=degree,
            fieldOfStudy=_clean_inline_text(entry.fieldOfStudy),
            location=location,
            startDate=_clean_inline_text(entry.startDate),
            endDate=_clean_inline_text(entry.endDate),
            details=_clean_list(entry.details),
        )
        if normalized.location:
            education_locations.append(normalized.location)
        if normalized.institution or normalized.degree or normalized.fieldOfStudy or normalized.details:
            education.append(normalized)

    certifications: List[NormalizedCertification] = []
    for entry in extraction.certifications:
        name = _clean_inline_text(entry.name)
        if not name:
            continue
        certifications.append(
            NormalizedCertification(
                name=name,
                issuer=_clean_inline_text(entry.issuer),
                date=_clean_inline_text(entry.date),
                credentialId=_clean_inline_text(entry.credentialId),
                url=_normalize_link(entry.url, "website"),
                location=_clean_inline_text(entry.location),
            )
        )

    education, certifications = _reclassify_education_and_certifications(education, certifications, warnings)

    languages: List[NormalizedLanguage] = []
    seen_languages: set[str] = set()
    for entry in extraction.languages:
        name = _normalize_language_name(entry.name)
        if not name:
            _warning(warnings, "language_dropped", "Dropped invalid or inferred language entry.", "languages")
            continue
        key = name.lower()
        if key in seen_languages:
            continue
        seen_languages.add(key)
        level_raw = _clean_inline_text(entry.levelRaw)
        languages.append(
            NormalizedLanguage(
                name=name,
                levelRaw=level_raw,
                level=_map_level(level_raw),
            )
        )

    summary_text = _clean_text(extraction.summary.text if extraction.summary else None)
    if summary_text and _looks_like_role_summary_misuse(summary_text):
        _warning(warnings, "summary_dropped", "Dropped summary text that looked like role bullets or responsibilities.", "summary.text")
        summary_text = None
    if not summary_text:
        summary_text = _normalize_headline_summary(extraction.identity.desiredPosition if extraction.identity else None)

    identity_location = _validate_identity_location(
        extraction.identity.location if extraction.identity else None,
        raw_text=raw_text,
        experience_locations=experience_locations,
        education_locations=education_locations,
        warnings=warnings,
    )

    contact = NormalizedContact(
        email=_normalize_email(extraction.contact.email if extraction.contact else None),
        phone=_normalize_phone(extraction.contact.phone if extraction.contact else None),
        address=_clean_text(extraction.contact.address if extraction.contact else None),
        linkedin=_normalize_link(extraction.contact.linkedin if extraction.contact else None, "linkedin"),
        website=_normalize_link(extraction.contact.website if extraction.contact else None, "website"),
        github=_normalize_link(extraction.contact.github if extraction.contact else None, "github"),
        portfolio=_normalize_link(extraction.contact.portfolio if extraction.contact else None, "portfolio"),
        location=identity_location,
        addressNormalized=_clean_inline_text(extraction.contact.address if extraction.contact else None),
    )

    for field_name in ("linkedin", "website", "github", "portfolio"):
        if extraction.contact and getattr(extraction.contact, field_name) and not getattr(contact, field_name):
            _warning(
                warnings,
                "link_dropped",
                f"Dropped invalid {field_name} value because it was not explicit or usable.",
                f"contact.{field_name}",
            )

    if extraction.contact and extraction.contact.email and not contact.email:
        _warning(warnings, "email_dropped", "Dropped invalid email value.", "contact.email")
    if extraction.contact and extraction.contact.phone and not contact.phone:
        _warning(warnings, "phone_dropped", "Dropped invalid phone value.", "contact.phone")

    identity = NormalizedIdentity(
        name=_clean_inline_text(extraction.identity.name if extraction.identity else None),
        location=identity_location,
        desiredPosition=_clean_inline_text(extraction.identity.desiredPosition if extraction.identity else None),
    )

    skills = [NormalizedSkill(name=name) for name in _clean_list(skill.name for skill in extraction.skills)]

    projects: List[NormalizedProject] = []
    for entry in extraction.projects:
        title = _clean_inline_text(entry.title)
        summary = _clean_text(entry.summary)
        bullets = _clean_list(entry.bullets)
        if not any([title, summary, bullets]):
            continue
        projects.append(
            NormalizedProject(
                title=title,
                subtitle=_clean_inline_text(entry.subtitle),
                meta=_clean_inline_text(entry.meta),
                summary=summary,
                bullets=bullets,
            )
        )

    achievements = [value for value in (_render_award(item) for item in extraction.awards) if value]

    text_sections: List[NormalizedTextSection] = []
    for item in extraction.publications:
        rendered = _render_publication(item)
        if rendered:
            text_sections.append(rendered)
    for item in extraction.volunteering:
        rendered = _render_volunteering(item)
        if rendered:
            text_sections.append(rendered)
    for item in extraction.otherSections:
        rendered = _render_other_section(item)
        if rendered:
            text_sections.append(rendered)

    status = "partial" if warnings else "success"
    resume = NormalizedResume(
        status=status,
        pageCount=max(int(page_count or 0), 0),
        documentName=document_name,
        rawText=raw_text or "",
        identity=identity,
        contact=contact,
        summary=NormalizedSummary(text=summary_text),
        skills=skills,
        languages=languages,
        experience=experience,
        education=education,
        certifications=certifications,
        projects=projects,
        achievements=achievements,
        textSections=text_sections,
        warnings=warnings,
    )

    if not _has_meaningful_content(resume):
        resume.status = "failed"
        resume.failureStage = "validation"
        resume.errorType = "empty_annotation_payload"
        resume.errorMessage = "Annotation parsed but did not contain usable resume content."

    return resume
