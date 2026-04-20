from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from .app_schema import (
    CvBlock,
    CvDocument,
    CvMetadata,
    CvSection,
    IAchievementItem,
    ICertificationItem,
    IEducationItem,
    IExperienceItem,
    ILanguageItem,
    IProfileItem,
    IProjectItem,
    ISkillItem,
    ISummaryItem,
)
from .normalized_schema import (
    NormalizedAward,
    NormalizedCertification,
    NormalizedEducation,
    NormalizedExperience,
    NormalizedLanguage,
    NormalizedPublication,
    NormalizedProject,
    NormalizedResume,
    NormalizedSectionOrderItem,
    RawSectionRecord,
    NormalizedVolunteering,
)


def _uuid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4()}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _remirror_doc(text: str) -> Dict[str, Any]:
    paragraph: Dict[str, Any] = {"type": "paragraph"}
    if text:
        paragraph["content"] = [{"type": "text", "text": text}]
    return {"type": "doc", "content": [paragraph]}


def _text_block(title: Optional[str], text: str, order: int, linked_structured_id: Optional[str] = None) -> CvBlock:
    attributes = {"linkedStructuredId": linked_structured_id} if linked_structured_id else None
    return CvBlock(
        id=_uuid("block"),
        title=title,
        type="text",
        content=_remirror_doc(text),
        plainText=text,
        order=order,
        attributes=attributes,
    )


def _join_nonempty(parts: Iterable[Optional[str]], separator: str = "\n") -> str:
    return separator.join(part for part in parts if part)


def _title_override(resume: NormalizedResume, family: str, default: str) -> str:
    for item in resume.sectionOrder:
        if item.family == family and item.title:
            return item.title
    return default


def _text_section(title: str, text: str) -> CvSection:
    return CvSection(
        id=_uuid("sec-text"),
        title=title,
        type="text",
        blocks=[_text_block(title, text, 0)],
        structuredContent=None,
        collapsed=False,
    )


def _map_experience(items: List[NormalizedExperience]) -> Optional[CvSection]:
    if not items:
        return None
    structured: List[IExperienceItem] = []
    blocks: List[CvBlock] = []
    for index, item in enumerate(items):
        item_id = _uuid("exp")
        bullets = list(item.responsibilityBullets)
        responsibilities_text = _join_nonempty([item.description, *bullets], "\n")
        structured.append(
            IExperienceItem(
                id=item_id,
                company=item.company or "",
                position=item.position or "",
                startDate=item.startDate,
                endDate=None if item.isCurrent else item.endDate,
                isCurrent=item.isCurrent,
                location=item.location,
                responsibilities=responsibilities_text or None,
                responsibilityBullets=bullets or None,
                description=_remirror_doc(item.description or "") if item.description else None,
                achievements=item.achievements or None,
                currentlyWorking=item.isCurrent,
            )
        )
        block_title = " — ".join(part for part in [item.position or None, item.company or None, item.location or None] if part) or "Experience"
        blocks.append(_text_block(block_title, responsibilities_text or "", index, linked_structured_id=item_id))
    return CvSection(
        id=_uuid("sec-experience"),
        title="Experience",
        type="experience",
        blocks=blocks,
        structuredContent=[entry.model_dump(exclude_none=True) for entry in structured],
        collapsed=False,
    )


def _map_education(items: List[NormalizedEducation]) -> Optional[CvSection]:
    if not items:
        return None
    structured: List[IEducationItem] = []
    blocks: List[CvBlock] = []
    for index, item in enumerate(items):
        item_id = _uuid("edu")
        description = _join_nonempty(item.details, "\n")
        structured.append(
            IEducationItem(
                id=item_id,
                institution=item.institution or "",
                degree=item.degree,
                fieldOfStudy=item.fieldOfStudy,
                startDate=item.startDate,
                endDate=None if item.isCurrent else item.endDate,
                isCurrent=item.isCurrent,
                description=_remirror_doc(description) if description else None,
            )
        )
        block_title = " — ".join(part for part in [item.degree or None, item.institution or None] if part) or "Education"
        blocks.append(_text_block(block_title, description, index, linked_structured_id=item_id))
    return CvSection(
        id=_uuid("sec-education"),
        title="Education",
        type="education",
        blocks=blocks,
        structuredContent=[entry.model_dump(exclude_none=True) for entry in structured],
        collapsed=False,
    )


def _map_skills(items: List[str]) -> Optional[CvSection]:
    if not items:
        return None
    structured = [ISkillItem(id=_uuid("skill"), name=item, level="Intermediate", bucket="secondary") for item in items]
    return CvSection(
        id=_uuid("sec-skills"),
        title="Skills",
        type="skills",
        blocks=[],
        structuredContent=[entry.model_dump(exclude_none=True) for entry in structured],
        collapsed=False,
    )


def _map_languages(items: List[NormalizedLanguage]) -> Optional[CvSection]:
    if not items:
        return None
    structured = [ILanguageItem(id=_uuid("lang"), name=item.name, level=item.level or "Intermediate") for item in items]
    return CvSection(
        id=_uuid("sec-languages"),
        title="Languages",
        type="languages",
        blocks=[],
        structuredContent=[entry.model_dump(exclude_none=True) for entry in structured],
        collapsed=False,
    )


def _map_projects(items: List[NormalizedProject]) -> Optional[CvSection]:
    if not items:
        return None
    structured: List[IProjectItem] = []
    blocks: List[CvBlock] = []
    for index, item in enumerate(items):
        item_id = _uuid("project")
        description = _join_nonempty([item.summary, *item.bullets], "\n")
        structured.append(
            IProjectItem(
                id=item_id,
                title=item.title,
                name=item.title,
                meta=item.meta,
                subtitle=item.subtitle,
                description=_remirror_doc(description) if description else None,
                summary=_remirror_doc(item.summary) if item.summary else None,
            )
        )
        blocks.append(_text_block(item.title or f"Project {index + 1}", _join_nonempty([item.meta, description]), index, linked_structured_id=item_id))
    return CvSection(
        id=_uuid("sec-projects"),
        title="Projects",
        type="projects",
        blocks=blocks,
        structuredContent=[entry.model_dump(exclude_none=True) for entry in structured],
        collapsed=False,
    )


def _map_certifications(items: List[NormalizedCertification]) -> Optional[CvSection]:
    if not items:
        return None
    structured: List[ICertificationItem] = []
    blocks: List[CvBlock] = []
    for index, item in enumerate(items):
        item_id = _uuid("cert")
        structured.append(
            ICertificationItem(
                id=item_id,
                certificationName=item.name,
                issuingOrganization=item.issuer,
                issueDate=item.date,
                credentialId=item.credentialId,
            )
        )
        blocks.append(
            _text_block(
                item.name,
                _join_nonempty([item.name, item.issuer, item.date], "\n"),
                index,
                linked_structured_id=item_id,
            )
        )
    return CvSection(
        id=_uuid("sec-certifications"),
        title="Certifications",
        type="certifications",
        blocks=blocks,
        structuredContent=[entry.model_dump(exclude_none=True) for entry in structured],
        collapsed=False,
    )


def _map_achievements(items: List[str]) -> Optional[CvSection]:
    if not items:
        return None
    structured = [IAchievementItem(id=_uuid("achievement"), text=item) for item in items]
    return CvSection(
        id=_uuid("sec-achievements"),
        title="Achievements",
        type="achievements",
        blocks=[],
        structuredContent=[entry.model_dump(exclude_none=True) for entry in structured],
        collapsed=False,
    )


def _map_hobbies(title: str, items: List[str]) -> Optional[CvSection]:
    if not items:
        return None
    return _text_section(title, "\n".join(items))


def _map_affiliations(title: str, items: List[str]) -> Optional[CvSection]:
    if not items:
        return None
    return _text_section(title, "\n".join(items))


def _map_additional_information(title: str, items: List[str]) -> Optional[CvSection]:
    if not items:
        return None
    return _text_section(title, "\n".join(items))


def _map_awards(title: str, items: List[NormalizedAward]) -> Optional[CvSection]:
    if not items:
        return None
    blocks = [
        _join_nonempty(
            [
                item.title,
                " — ".join(part for part in [item.issuer, item.date] if part) or None,
                _join_nonempty(item.details),
            ]
        )
        for item in items
    ]
    content = "\n\n".join(block for block in blocks if block)
    return _text_section(title, content) if content else None


def _map_publications(title: str, items: List[NormalizedPublication]) -> Optional[CvSection]:
    if not items:
        return None
    blocks = [
        _join_nonempty(
            [
                item.title,
                " | ".join(part for part in [item.venue, item.date] if part) or None,
                _join_nonempty(item.details),
            ]
        )
        for item in items
    ]
    content = "\n\n".join(block for block in blocks if block)
    return _text_section(title, content) if content else None


def _map_volunteering(title: str, items: List[NormalizedVolunteering]) -> Optional[CvSection]:
    if not items:
        return None
    blocks = []
    for item in items:
        header = " — ".join(part for part in [item.organization, item.role] if part)
        meta = " | ".join(
            part
            for part in [
                item.location,
                item.startDate,
                "Present" if item.isCurrent else item.endDate,
            ]
            if part
        )
        body = _join_nonempty([item.description, *item.bullets], "\n")
        block = _join_nonempty([header, meta, body], "\n")
        if block:
            blocks.append(block)
    content = "\n\n".join(blocks)
    return _text_section(title, content) if content else None


def _map_profile(resume: NormalizedResume) -> Optional[CvSection]:
    profile = IProfileItem(
        id=_uuid("profile"),
        name=resume.identity.name,
        email=resume.contact.email,
        phone=resume.contact.phone,
        linkedin=resume.contact.linkedin,
        website=resume.contact.portfolio or resume.contact.website,
        desiredPosition=resume.identity.desiredPosition,
        location=resume.identity.location or resume.contact.addressNormalized,
    )
    payload = profile.model_dump(exclude_none=True)
    if len(payload) <= 1:
        return None
    return CvSection(
        id=_uuid("sec-profile"),
        title="Profile",
        type="profile",
        blocks=[],
        structuredContent=[payload],
        collapsed=False,
    )


def _map_summary(text: Optional[str]) -> Optional[CvSection]:
    if not text:
        return None
    item = ISummaryItem(id=_uuid("summary"), summary=_remirror_doc(text))
    return CvSection(
        id=_uuid("sec-summary"),
        title="Summary",
        type="summary",
        blocks=[],
        structuredContent=[item.model_dump(exclude_none=True)],
        collapsed=False,
    )


def _map_text_sections(text_sections: List[tuple[str, str]]) -> List[CvSection]:
    sections: List[CvSection] = []
    for index, (title, content) in enumerate(text_sections):
        sections.append(
            CvSection(
                id=_uuid(f"sec-text-{index}"),
                title=title,
                type="text",
                blocks=[_text_block(title, content, 0)],
                structuredContent=None,
                collapsed=False,
            )
        )
    return sections


DEFAULT_SECTION_FAMILY_ORDER = [
    "profile",
    "summary",
    "experience",
    "projects",
    "achievements",
    "awards",
    "publications",
    "volunteering",
    "education",
    "certifications",
    "skills",
    "languages",
    "hobbies",
    "affiliations",
    "additionalInformation",
    "other",
]


def _ordered_app_sections(
    resume: NormalizedResume,
    family_sections: Dict[str, List[CvSection]],
) -> List[CvSection]:
    ordered_sections: List[CvSection] = []
    consumed: set[tuple[str, int]] = set()

    for item in resume.sectionOrder:
        family = item.family
        index = item.ordinal
        bucket = family_sections.get(family) or []
        if 0 <= index < len(bucket):
            consumed.add((family, index))
            ordered_sections.append(bucket[index])

    for family in DEFAULT_SECTION_FAMILY_ORDER:
        for index, section in enumerate(family_sections.get(family) or []):
            if (family, index) in consumed:
                continue
            ordered_sections.append(section)

    return ordered_sections


def _document_title(resume: NormalizedResume) -> str:
    if resume.identity.name:
        return resume.identity.name
    if resume.documentName:
        return Path(resume.documentName).stem or "Imported CV"
    return "Imported CV"


def map_normalized_to_app_document(resume: NormalizedResume) -> CvDocument:
    family_sections: Dict[str, List[CvSection]] = {
        "profile": [section] if (section := _map_profile(resume)) else [],
        "summary": [section] if (section := _map_summary(resume.summary.text)) else [],
        "experience": [section] if (section := _map_experience(resume.experience)) else [],
        "projects": [section] if (section := _map_projects(resume.projects)) else [],
        "achievements": [section] if (section := _map_achievements(resume.achievements)) else [],
        "awards": [section]
        if (section := _map_awards(_title_override(resume, "awards", "Awards"), resume.awards))
        else [],
        "publications": [section]
        if (section := _map_publications(_title_override(resume, "publications", "Publications"), resume.publications))
        else [],
        "volunteering": [section]
        if (section := _map_volunteering(_title_override(resume, "volunteering", "Volunteering"), resume.volunteering))
        else [],
        "education": [section] if (section := _map_education(resume.education)) else [],
        "certifications": [section] if (section := _map_certifications(resume.certifications)) else [],
        "skills": [section] if (section := _map_skills([item.name for item in resume.skills])) else [],
        "languages": [section] if (section := _map_languages(resume.languages)) else [],
        "hobbies": [section]
        if (section := _map_hobbies(_title_override(resume, "hobbies", "Hobbies"), resume.hobbies))
        else [],
        "affiliations": [section]
        if (section := _map_affiliations(_title_override(resume, "affiliations", "Affiliations"), resume.affiliations))
        else [],
        "additionalInformation": [section]
        if (
            section := _map_additional_information(
                _title_override(resume, "additionalInformation", "Additional Information"),
                resume.additionalInformation,
            )
        )
        else [],
        "other": _map_text_sections([(item.title, item.content) for item in resume.textSections]),
    }
    sections = _ordered_app_sections(resume, family_sections)
    for index, section in enumerate(sections):
        section.order = index
    now = _now_iso()
    return CvDocument(
        id=_uuid("cv"),
        title=_document_title(resume),
        metadata=CvMetadata(createdAt=now, updatedAt=now, version=1),
        sections=[section.model_dump(exclude_none=True) for section in sections],
    )


def _render_profile_raw(resume: NormalizedResume) -> Optional[RawSectionRecord]:
    lines = [
        resume.identity.name,
        resume.identity.desiredPosition,
        resume.contact.email,
        resume.contact.phone,
        resume.identity.location or resume.contact.addressNormalized,
        resume.contact.linkedin,
        resume.contact.github,
        resume.contact.portfolio or resume.contact.website,
    ]
    body = _join_nonempty(lines)
    if not body:
        return None
    return RawSectionRecord(label="Profile", fieldKey="profile", title="Profile", content=body)


def _render_summary_raw(text: Optional[str]) -> Optional[RawSectionRecord]:
    if not text:
        return None
    return RawSectionRecord(label="Summary", fieldKey="summary", title="Summary", content=text)


def _render_experience_raw(items: List[NormalizedExperience]) -> Optional[RawSectionRecord]:
    blocks = []
    for item in items:
        header = " — ".join(part for part in [item.position, item.company, item.location] if part)
        body = _join_nonempty([item.description, *item.responsibilityBullets, *item.achievements])
        block = _join_nonempty([header, body], "\n")
        if block:
            blocks.append(block)
    if not blocks:
        return None
    return RawSectionRecord(label="Experience", fieldKey="experience", title="Experience", content="\n\n".join(blocks))


def _render_education_raw(items: List[NormalizedEducation]) -> Optional[RawSectionRecord]:
    blocks = []
    for item in items:
        header = " — ".join(part for part in [item.degree, item.institution, item.location] if part)
        body = _join_nonempty(item.details)
        block = _join_nonempty([header, body], "\n")
        if block:
            blocks.append(block)
    if not blocks:
        return None
    return RawSectionRecord(label="Education", fieldKey="education", title="Education", content="\n\n".join(blocks))


def _render_skills_raw(items: List[str]) -> Optional[RawSectionRecord]:
    if not items:
        return None
    return RawSectionRecord(label="Skills", fieldKey="skills", title="Skills", content="\n".join(items))


def _render_languages_raw(items: List[NormalizedLanguage]) -> Optional[RawSectionRecord]:
    rows = []
    for item in items:
        rows.append(" — ".join(part for part in [item.name, item.levelRaw or item.level] if part))
    if not rows:
        return None
    return RawSectionRecord(label="Languages", fieldKey="languages", title="Languages", content="\n".join(rows))


def _render_projects_raw(items: List[NormalizedProject]) -> Optional[RawSectionRecord]:
    blocks = []
    for item in items:
        body = _join_nonempty([item.title, item.meta, item.summary, *item.bullets])
        if body:
            blocks.append(body)
    if not blocks:
        return None
    return RawSectionRecord(label="Projects", fieldKey="projects", title="Projects", content="\n\n".join(blocks))


def _render_certifications_raw(items: List[NormalizedCertification]) -> Optional[RawSectionRecord]:
    blocks = []
    for item in items:
        body = _join_nonempty([item.name, item.issuer, item.date])
        if body:
            blocks.append(body)
    if not blocks:
        return None
    return RawSectionRecord(label="Certifications", fieldKey="certifications", title="Certifications", content="\n\n".join(blocks))


def _render_achievements_raw(items: List[str]) -> Optional[RawSectionRecord]:
    if not items:
        return None
    return RawSectionRecord(label="Achievements", fieldKey="achievements", title="Achievements", content="\n".join(items))


def _render_hobbies_raw(items: List[str], title: str = "Hobbies") -> Optional[RawSectionRecord]:
    if not items:
        return None
    return RawSectionRecord(label=title, fieldKey="hobbies", title=title, content="\n".join(items))


def _render_affiliations_raw(items: List[str], title: str = "Affiliations") -> Optional[RawSectionRecord]:
    if not items:
        return None
    return RawSectionRecord(label=title, fieldKey="affiliations", title=title, content="\n".join(items))


def _render_additional_information_raw(
    items: List[str],
    title: str = "Additional Information",
) -> Optional[RawSectionRecord]:
    if not items:
        return None
    return RawSectionRecord(
        label=title,
        fieldKey="additionalInformation",
        title=title,
        content="\n".join(items),
    )


def _render_awards_raw(items: List[NormalizedAward], title: str = "Awards") -> Optional[RawSectionRecord]:
    blocks = []
    for item in items:
        body = _join_nonempty(
            [
                item.title,
                " — ".join(part for part in [item.issuer, item.date] if part) or None,
                _join_nonempty(item.details),
            ]
        )
        if body:
            blocks.append(body)
    if not blocks:
        return None
    return RawSectionRecord(label=title, fieldKey="awards", title=title, content="\n\n".join(blocks))


def _render_publications_raw(
    items: List[NormalizedPublication],
    title: str = "Publications",
) -> Optional[RawSectionRecord]:
    blocks = []
    for item in items:
        body = _join_nonempty(
            [
                item.title,
                " | ".join(part for part in [item.venue, item.date] if part) or None,
                _join_nonempty(item.details),
            ]
        )
        if body:
            blocks.append(body)
    if not blocks:
        return None
    return RawSectionRecord(label=title, fieldKey="publications", title=title, content="\n\n".join(blocks))


def _render_volunteering_raw(
    items: List[NormalizedVolunteering],
    title: str = "Volunteering",
) -> Optional[RawSectionRecord]:
    blocks = []
    for item in items:
        header = " — ".join(part for part in [item.organization, item.role] if part)
        meta = " | ".join(
            part
            for part in [item.location, item.startDate, "Present" if item.isCurrent else item.endDate]
            if part
        )
        body = _join_nonempty([item.description, *item.bullets], "\n")
        block = _join_nonempty([header, meta, body], "\n")
        if block:
            blocks.append(block)
    if not blocks:
        return None
    return RawSectionRecord(label=title, fieldKey="volunteering", title=title, content="\n\n".join(blocks))


def _ordered_raw_sections(
    resume: NormalizedResume,
    family_records: Dict[str, List[RawSectionRecord]],
) -> List[RawSectionRecord]:
    ordered_records: List[RawSectionRecord] = []
    consumed: set[tuple[str, int]] = set()

    for item in resume.sectionOrder:
        family = item.family
        index = item.ordinal
        bucket = family_records.get(family) or []
        if 0 <= index < len(bucket):
            consumed.add((family, index))
            ordered_records.append(bucket[index])

    for family in DEFAULT_SECTION_FAMILY_ORDER:
        for index, record in enumerate(family_records.get(family) or []):
            if (family, index) in consumed:
                continue
            ordered_records.append(record)

    return ordered_records


def build_raw_sections(resume: NormalizedResume) -> List[Dict[str, Any]]:
    text_sections = [
        RawSectionRecord(label=item.title, fieldKey=None, title=item.title, content=item.content)
        for item in resume.textSections
    ]
    family_records: Dict[str, List[RawSectionRecord]] = {
        "profile": [record] if (record := _render_profile_raw(resume)) else [],
        "summary": [record] if (record := _render_summary_raw(resume.summary.text)) else [],
        "experience": [record] if (record := _render_experience_raw(resume.experience)) else [],
        "projects": [record] if (record := _render_projects_raw(resume.projects)) else [],
        "achievements": [record] if (record := _render_achievements_raw(resume.achievements)) else [],
        "awards": [record]
        if (record := _render_awards_raw(resume.awards, _title_override(resume, "awards", "Awards")))
        else [],
        "publications": [record]
        if (
            record := _render_publications_raw(
                resume.publications,
                _title_override(resume, "publications", "Publications"),
            )
        )
        else [],
        "volunteering": [record]
        if (
            record := _render_volunteering_raw(
                resume.volunteering,
                _title_override(resume, "volunteering", "Volunteering"),
            )
        )
        else [],
        "education": [record] if (record := _render_education_raw(resume.education)) else [],
        "certifications": [record] if (record := _render_certifications_raw(resume.certifications)) else [],
        "skills": [record] if (record := _render_skills_raw([item.name for item in resume.skills])) else [],
        "languages": [record] if (record := _render_languages_raw(resume.languages)) else [],
        "hobbies": [record]
        if (record := _render_hobbies_raw(resume.hobbies, _title_override(resume, "hobbies", "Hobbies")))
        else [],
        "affiliations": [record]
        if (
            record := _render_affiliations_raw(
                resume.affiliations,
                _title_override(resume, "affiliations", "Affiliations"),
            )
        )
        else [],
        "additionalInformation": [record]
        if (
            record := _render_additional_information_raw(
                resume.additionalInformation,
                _title_override(resume, "additionalInformation", "Additional Information"),
            )
        )
        else [],
        "other": text_sections,
    }
    records = _ordered_raw_sections(resume, family_records)
    return [record.model_dump(exclude_none=True) for record in records]


def build_compatibility_normalized(resume: NormalizedResume, app_document: CvDocument, raw_sections: List[Dict[str, Any]]) -> Dict[str, Any]:
    summary_text = resume.summary.text or ""
    app_document_payload = app_document.model_dump(exclude_none=True)
    return {
        "name": resume.identity.name,
        "identitySchema": resume.identity.model_dump(exclude_none=True),
        "profile": {
            "name": resume.identity.name,
            "email": resume.contact.email,
            "phone": resume.contact.phone,
            "linkedin": resume.contact.linkedin,
            "website": resume.contact.portfolio or resume.contact.website,
            "desiredPosition": resume.identity.desiredPosition,
            "location": resume.identity.location or resume.contact.addressNormalized,
        },
        "contact": {
            "name": resume.identity.name,
            "email": resume.contact.email,
            "phone": resume.contact.phone,
            "linkedin": resume.contact.linkedin,
            "website": resume.contact.website,
            "github": resume.contact.github,
            "portfolio": resume.contact.portfolio,
            "addressBlock": resume.contact.address,
            "addressNormalized": resume.contact.addressNormalized,
            "location": resume.identity.location or resume.contact.addressNormalized,
        },
        "summary": {"text": summary_text, "confidence": 0.95 if resume.status == "success" else 0.7} if summary_text else {"text": "", "confidence": 0.0},
        "experience": [
            {
                "id": _uuid("expn"),
                "company": item.company or "",
                "position": item.position or "",
                "startDate": item.startDate,
                "endDate": None if item.isCurrent else item.endDate,
                "isCurrent": item.isCurrent,
                "location": item.location,
                "description": item.description,
                "summary": item.description,
                "responsibilities": _join_nonempty([item.description, *item.responsibilityBullets], "\n") or None,
                "responsibilityBullets": item.responsibilityBullets,
                "achievements": item.achievements,
            }
            for item in resume.experience
        ],
        "education": [
            {
                "id": _uuid("edun"),
                "institution": item.institution or "",
                "degree": item.degree,
                "fieldOfStudy": item.fieldOfStudy,
                "startDate": item.startDate,
                "endDate": None if item.isCurrent else item.endDate,
                "isCurrent": item.isCurrent,
                "description": _join_nonempty(item.details) or None,
                "grade": "",
            }
            for item in resume.education
        ],
        "skills": [{"name": item.name} for item in resume.skills],
        "skillsText": ", ".join(item.name for item in resume.skills),
        "languages": [{"name": item.name, "level": item.level or "Intermediate"} for item in resume.languages],
        "languagesRaw": [" — ".join(part for part in [item.name, item.levelRaw] if part) for item in resume.languages],
        "projects": [
            {
                "title": item.title,
                "name": item.title,
                "meta": item.meta,
                "subtitle": item.subtitle,
                "description": _join_nonempty([item.summary, *item.bullets], "\n") or None,
                "summary": item.summary,
            }
            for item in resume.projects
        ],
        "certifications": [
            {
                "certificationName": item.name,
                "issuingOrganization": item.issuer,
                "issueDate": item.date,
                "credentialId": item.credentialId,
            }
            for item in resume.certifications
        ],
        "achievements": [{"text": item} for item in resume.achievements],
        "hobbies": [{"text": item} for item in resume.hobbies],
        "awards": [
            {
                "title": item.title,
                "issuer": item.issuer,
                "date": item.date,
                "details": item.details,
            }
            for item in resume.awards
        ],
        "publications": [
            {
                "title": item.title,
                "venue": item.venue,
                "date": item.date,
                "details": item.details,
            }
            for item in resume.publications
        ],
        "volunteering": [
            {
                "organization": item.organization,
                "role": item.role,
                "location": item.location,
                "startDate": item.startDate,
                "endDate": None if item.isCurrent else item.endDate,
                "isCurrent": item.isCurrent,
                "description": item.description,
                "summary": item.description,
                "bullets": item.bullets,
            }
            for item in resume.volunteering
        ],
        "affiliations": [{"text": item} for item in resume.affiliations],
        "additionalInformation": [{"text": item} for item in resume.additionalInformation],
        "sectionOrder": [item.model_dump(exclude_none=True) for item in resume.sectionOrder],
        "summaryFirstSentence": _join_nonempty([resume.summary.text and resume.summary.text.splitlines()[0]], ""),
        "raw": resume.rawText,
        "rawText": resume.rawText,
        "rawSections": raw_sections,
        "sections": app_document_payload.get("sections", []),
    }


def build_canonical_payload(resume: NormalizedResume) -> Dict[str, Any]:
    app_document = map_normalized_to_app_document(resume)
    raw_sections = build_raw_sections(resume)
    compatibility_normalized = build_compatibility_normalized(resume, app_document, raw_sections)
    warning_payload = [warning.model_dump(exclude_none=True) for warning in resume.warnings]
    summary = compatibility_normalized["summary"]
    summary_first = compatibility_normalized["summaryFirstSentence"]
    return {
        "status": resume.status,
        "errorType": resume.errorType,
        "errorMessage": resume.errorMessage,
        "warnings": warning_payload,
        "rawText": resume.rawText,
        "raw": resume.rawText,
        "normalized": compatibility_normalized,
        "summary": summary,
        "summaryFirstSentence": summary_first,
        "rawSections": raw_sections,
        "diagnostics": {
            "mistral_parser_status": resume.status,
            "mistral_parser_failure_stage": resume.failureStage,
            "mistral_parser_warning_count": len(warning_payload),
        },
        "appDocument": app_document.model_dump(exclude_none=True),
    }
