from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ExtractionBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ExtractionIdentity(ExtractionBaseModel):
    name: Optional[str] = Field(
        default=None,
        description="Candidate name only. Extract only if explicitly present in the document.",
    )
    location: Optional[str] = Field(
        default=None,
        description="Candidate's own top-level location from header/contact/details/personal-info only. Never use employer location or school location. If absent or unclear, return null.",
    )
    desiredPosition: Optional[str] = Field(
        default=None,
        description="Populate only when the document explicitly states a target role, desired position, professional headline, or title intended as the candidate's role. Do not infer from work history alone.",
    )


class ExtractionContact(ExtractionBaseModel):
    email: Optional[str] = Field(
        default=None,
        description="Populate only from an explicit usable email value in the document. If absent, return null.",
    )
    phone: Optional[str] = Field(
        default=None,
        description="Populate only from an explicit usable phone value in the document. If absent, return null.",
    )
    address: Optional[str] = Field(
        default=None,
        description="Populate only from an explicit address or mailing address belonging to the candidate. If absent, return null.",
    )
    linkedin: Optional[str] = Field(
        default=None,
        description="Populate only when the document contains an explicit LinkedIn URL or handle. Ignore a bare label like LinkedIn without a usable value. If absent, return null.",
    )
    website: Optional[str] = Field(
        default=None,
        description="Populate only from an explicit personal website or portfolio URL. Do not infer from labels, organizations, employers, or schools. If absent, return null.",
    )
    github: Optional[str] = Field(
        default=None,
        description="Populate only from an explicit GitHub URL or handle. Do not infer from labels or surrounding context. If absent, return null.",
    )
    portfolio: Optional[str] = Field(
        default=None,
        description="Populate only from an explicit portfolio URL or handle. Do not infer from labels or surrounding context. If absent, return null.",
    )


class ExtractionSummary(ExtractionBaseModel):
    text: Optional[str] = Field(
        default=None,
        description="Populate only from an explicit summary/profile/objective/about/professional-profile section, or a clearly intended opening profile paragraph. Do not synthesize summary text from experience bullets or responsibilities. Otherwise return null.",
    )


class ExtractionSkill(ExtractionBaseModel):
    name: str = Field(
        description="Atomic skill/tool/technology/competency label only. Populate from explicit skills, expertise, areas of expertise, core competencies, or grouped expertise sections when present. Extract explicit skill labels from bullets, inline lists, and grouped expertise content, treating separators such as '/', ',', ';', '—', and parentheses as valid formatting when they clearly separate explicit labels. Flatten grouped expertise into atomic labels while preserving source order where possible. Never include headings, decorative symbols, table syntax, prose fragments, or whole sentences.",
    )


class ExtractionLanguage(ExtractionBaseModel):
    name: str = Field(
        description="Extract only explicitly stated spoken or human languages. Populate from explicit Languages or language proficiency sections and lines such as 'English: Good command', 'French - Intermediate', or 'Spanish (basic)'. Treat bullets, inline lists, and separators such as ':', '-', '/', ',', ';', '—', and parentheses as valid formatting when they clearly describe explicit languages or proficiency. Do not infer from nationality, location, education, employer, or name.",
    )
    levelRaw: Optional[str] = Field(
        default=None,
        description="Preserve the original proficiency wording exactly when present, including non-English wording. Do not normalize, translate, or infer a level when it is absent.",
    )


class ExtractionExperience(ExtractionBaseModel):
    company: Optional[str] = Field(
        default=None,
        description="Company or organization for this role only, taken from the role entry itself.",
    )
    position: Optional[str] = Field(
        default=None,
        description="Role title for this experience entry only, taken from the role entry itself.",
    )
    location: Optional[str] = Field(
        default=None,
        description="Location for this role entry only, if explicitly present. Never copy this into identity.location.",
    )
    startDate: Optional[str] = Field(
        default=None,
        description="Preserve only explicit date evidence from the role entry. Never invent month or day. Keep source granularity faithful.",
    )
    endDate: Optional[str] = Field(
        default=None,
        description="Preserve only explicit date evidence from the role entry. Never invent month or day. Keep source granularity faithful.",
    )
    isCurrent: Optional[bool] = Field(
        default=None,
        description="Set true only when explicitly supported by words like Present, Current, Now, or equivalent. If unclear, return null rather than false.",
    )
    description: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("description", "summary"),
        description="Populate only when explicit non-bullet narrative prose exists for that role and appears before any bullet list. Do not convert prose into bullets.",
    )
    responsibilityBullets: List[str] = Field(
        default_factory=list,
        description="Atomic explicit responsibility/task bullets only. Preserve source order exactly. Do not invent bullets from prose.",
    )
    achievements: List[str] = Field(
        default_factory=list,
        description="Only explicit standout outcomes, measurable results, key achievements, awards, or clearly distinct accomplishments for that role. Do not duplicate all responsibilities here.",
    )


class ExtractionEducation(ExtractionBaseModel):
    institution: Optional[str] = Field(
        default=None,
        description="Institution for this education entry only, kept faithful to the source.",
    )
    degree: Optional[str] = Field(
        default=None,
        description="Degree name only when explicitly present in the education entry.",
    )
    fieldOfStudy: Optional[str] = Field(
        default=None,
        description="Field of study only when explicitly present in the education entry.",
    )
    location: Optional[str] = Field(
        default=None,
        description="Location for this education entry only, if explicitly present.",
    )
    startDate: Optional[str] = Field(
        default=None,
        description="Preserve only explicit date evidence from the education entry. Never invent month or day.",
    )
    endDate: Optional[str] = Field(
        default=None,
        description="Preserve only explicit date evidence from the education entry. Never invent month or day.",
    )
    details: List[str] = Field(
        default_factory=list,
        description="Additional education details that belong to the education entry, such as honors, GPA, coursework, or thesis information, only when explicitly present.",
    )


class ExtractionCertification(ExtractionBaseModel):
    name: Optional[str] = Field(
        default=None,
        description="Certification, license, or credential name as written in the source.",
    )
    issuer: Optional[str] = Field(
        default=None,
        description="Issuing body only when explicitly present.",
    )
    date: Optional[str] = Field(
        default=None,
        description="Preserve only explicit certification date evidence. Never invent missing parts.",
    )
    credentialId: Optional[str] = Field(
        default=None,
        description="Credential identifier only when explicitly present.",
    )
    url: Optional[str] = Field(
        default=None,
        description="Credential URL only when explicitly present.",
    )
    location: Optional[str] = Field(
        default=None,
        description="Certification location only when explicitly present.",
    )


class ExtractionProject(ExtractionBaseModel):
    title: Optional[str] = Field(
        default=None,
        description="Project title only when a project section or clearly project-like entries are explicitly present. Preserve source order.",
    )
    subtitle: Optional[str] = Field(
        default=None,
        description="Short secondary project label only when explicitly present.",
    )
    meta: Optional[str] = Field(
        default=None,
        description="Project metadata such as technologies, dates, or context only when explicitly present.",
    )
    summary: Optional[str] = Field(
        default=None,
        description="Short project description only when explicitly present.",
    )
    bullets: List[str] = Field(
        default_factory=list,
        description="Atomic project bullets only when explicitly present.",
    )


class ExtractionAward(ExtractionBaseModel):
    title: Optional[str] = Field(
        default=None,
        description="Populate only when awards, honors, recognitions, scholarships, or explicit top-level distinctions are present. Preserve source order.",
    )
    issuer: Optional[str] = Field(
        default=None,
        description="Awarding body only when explicitly present.",
    )
    date: Optional[str] = Field(
        default=None,
        description="Award date only when explicitly present.",
    )
    details: List[str] = Field(
        default_factory=list,
        description="Award details only when explicitly present.",
    )


class ExtractionPublication(ExtractionBaseModel):
    title: Optional[str] = Field(
        default=None,
        description="Populate only when publication entries are explicitly present. Preserve source order.",
    )
    venue: Optional[str] = Field(
        default=None,
        description="Publication venue or publisher only when explicitly present.",
    )
    date: Optional[str] = Field(
        default=None,
        description="Publication date only when explicitly present.",
    )
    details: List[str] = Field(
        default_factory=list,
        description="Publication details only when explicitly present.",
    )


class ExtractionVolunteering(ExtractionBaseModel):
    organization: Optional[str] = Field(
        default=None,
        description="Volunteer organization only when volunteering/community/service entries are explicitly present. Preserve source order.",
    )
    role: Optional[str] = Field(
        default=None,
        description="Volunteer role only when explicitly present.",
    )
    location: Optional[str] = Field(
        default=None,
        description="Volunteer location only when explicitly present.",
    )
    startDate: Optional[str] = Field(
        default=None,
        description="Preserve only explicit volunteering date evidence. Never invent missing parts.",
    )
    endDate: Optional[str] = Field(
        default=None,
        description="Preserve only explicit volunteering date evidence. Never invent missing parts.",
    )
    isCurrent: Optional[bool] = Field(
        default=None,
        description="Set true only when current volunteering is explicit.",
    )
    summary: Optional[str] = Field(
        default=None,
        description="Volunteer summary only when explicit non-bullet prose exists.",
    )
    bullets: List[str] = Field(
        default_factory=list,
        description="Volunteer bullets only when explicitly present.",
    )


class ExtractionOtherSection(ExtractionBaseModel):
    title: str = Field(
        description="Use only for meaningful sections not covered by first-class schema families. Preserve the original section title faithfully. When a section clearly matches a first-class family, populate that first-class field instead. Do not use for explicit Languages, Skills, Expertise, Areas of Expertise, Core Competencies, or other headings that clearly fit a first-class family.",
    )
    content: str = Field(
        description="Use only for meaningful sections not covered by first-class schema families. Preserve the original section content faithfully. Do not use as a dumping ground for fields that clearly belong elsewhere, especially explicit Languages or Skills/Expertise content that should populate first-class fields.",
    )


class ExtractionSectionOrderItem(ExtractionBaseModel):
    family: Literal[
        "profile",
        "summary",
        "skills",
        "languages",
        "experience",
        "education",
        "certifications",
        "projects",
        "achievements",
        "hobbies",
        "awards",
        "publications",
        "volunteering",
        "affiliations",
        "additionalInformation",
        "other",
    ] = Field(description="Canonical section family for a visible source section heading.")
    ordinal: int = Field(
        description="Zero-based occurrence index for this family in the source document.",
        ge=0,
    )
    title: Optional[str] = Field(
        default=None,
        description="Original source heading/title for this section when explicitly present.",
    )


class ResumeExtraction(ExtractionBaseModel):
    identity: Optional[ExtractionIdentity] = None
    contact: Optional[ExtractionContact] = None
    summary: Optional[ExtractionSummary] = None
    skills: List[ExtractionSkill] = Field(default_factory=list)
    languages: List[ExtractionLanguage] = Field(default_factory=list)
    experience: List[ExtractionExperience] = Field(default_factory=list)
    education: List[ExtractionEducation] = Field(default_factory=list)
    certifications: List[ExtractionCertification] = Field(default_factory=list)
    projects: List[ExtractionProject] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)
    hobbies: List[str] = Field(default_factory=list)
    awards: List[ExtractionAward] = Field(default_factory=list)
    publications: List[ExtractionPublication] = Field(default_factory=list)
    volunteering: List[ExtractionVolunteering] = Field(default_factory=list)
    affiliations: List[str] = Field(default_factory=list)
    additionalInformation: List[str] = Field(default_factory=list)
    otherSections: List[ExtractionOtherSection] = Field(default_factory=list)
    sectionOrder: List[ExtractionSectionOrderItem] = Field(default_factory=list)


def _strict_json_schema_node(schema_node: Any) -> Any:
    if isinstance(schema_node, (str, int, float, bool)) or schema_node is None:
        return schema_node
    if isinstance(schema_node, dict):
        normalized: Dict[str, Any] = {
            str(key): _strict_json_schema_node(value) for key, value in schema_node.items()
        }
        if normalized.get("type") == "object":
            normalized["additionalProperties"] = False
        return normalized
    if isinstance(schema_node, list):
        return [_strict_json_schema_node(value) for value in schema_node]
    raise TypeError(f"unsupported_json_schema_node:{type(schema_node).__name__}")


def build_document_annotation_format() -> dict:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": ResumeExtraction.__name__,
            "schema": _strict_json_schema_node(ResumeExtraction.model_json_schema()),
            "strict": True,
        },
    }
