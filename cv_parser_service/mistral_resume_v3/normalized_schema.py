from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


ParserStatus = Literal["success", "partial", "failed", "unavailable"]
FailureStage = Literal[
    "upload",
    "ocr_request",
    "annotation_missing",
    "annotation_parse",
    "validation",
    "mapping",
]


class NormalizedBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ParserWarning(NormalizedBaseModel):
    code: str
    message: str
    field: Optional[str] = None


class RawSectionRecord(NormalizedBaseModel):
    label: str
    fieldKey: Optional[str] = None
    title: Optional[str] = None
    content: str


class NormalizedIdentity(NormalizedBaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    desiredPosition: Optional[str] = None


class NormalizedContact(NormalizedBaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    addressNormalized: Optional[str] = None
    linkedin: Optional[str] = None
    website: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None
    location: Optional[str] = None


class NormalizedSummary(NormalizedBaseModel):
    text: Optional[str] = None


class NormalizedSkill(NormalizedBaseModel):
    name: str


class NormalizedLanguage(NormalizedBaseModel):
    name: str
    levelRaw: Optional[str] = None
    level: Optional[str] = None


class NormalizedExperience(NormalizedBaseModel):
    company: Optional[str] = None
    position: Optional[str] = None
    location: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    isCurrent: Optional[bool] = None
    description: Optional[str] = None
    responsibilityBullets: List[str] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)


class NormalizedEducation(NormalizedBaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    fieldOfStudy: Optional[str] = None
    location: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    isCurrent: Optional[bool] = None
    details: List[str] = Field(default_factory=list)


class NormalizedCertification(NormalizedBaseModel):
    name: str
    issuer: Optional[str] = None
    date: Optional[str] = None
    credentialId: Optional[str] = None
    url: Optional[str] = None
    location: Optional[str] = None


class NormalizedProject(NormalizedBaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    meta: Optional[str] = None
    summary: Optional[str] = None
    bullets: List[str] = Field(default_factory=list)


class NormalizedAward(NormalizedBaseModel):
    title: str
    issuer: Optional[str] = None
    date: Optional[str] = None
    details: List[str] = Field(default_factory=list)


class NormalizedPublication(NormalizedBaseModel):
    title: str
    venue: Optional[str] = None
    date: Optional[str] = None
    details: List[str] = Field(default_factory=list)


class NormalizedVolunteering(NormalizedBaseModel):
    organization: str
    role: Optional[str] = None
    location: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    isCurrent: Optional[bool] = None
    description: Optional[str] = None
    bullets: List[str] = Field(default_factory=list)


SectionFamily = Literal[
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
]


class NormalizedSectionOrderItem(NormalizedBaseModel):
    family: SectionFamily
    ordinal: int = 0
    title: Optional[str] = None


class NormalizedTextSection(NormalizedBaseModel):
    title: str
    content: str
    family: Optional[str] = None
    order: Optional[int] = None


class NormalizedResume(NormalizedBaseModel):
    status: ParserStatus = "success"
    failureStage: Optional[FailureStage] = None
    errorType: Optional[str] = None
    errorMessage: Optional[str] = None
    warnings: List[ParserWarning] = Field(default_factory=list)
    pageCount: int = 0
    documentName: Optional[str] = None
    rawText: str = ""
    identity: NormalizedIdentity = Field(default_factory=NormalizedIdentity)
    contact: NormalizedContact = Field(default_factory=NormalizedContact)
    summary: NormalizedSummary = Field(default_factory=NormalizedSummary)
    skills: List[NormalizedSkill] = Field(default_factory=list)
    languages: List[NormalizedLanguage] = Field(default_factory=list)
    experience: List[NormalizedExperience] = Field(default_factory=list)
    education: List[NormalizedEducation] = Field(default_factory=list)
    certifications: List[NormalizedCertification] = Field(default_factory=list)
    projects: List[NormalizedProject] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)
    hobbies: List[str] = Field(default_factory=list)
    awards: List[NormalizedAward] = Field(default_factory=list)
    publications: List[NormalizedPublication] = Field(default_factory=list)
    volunteering: List[NormalizedVolunteering] = Field(default_factory=list)
    affiliations: List[str] = Field(default_factory=list)
    additionalInformation: List[str] = Field(default_factory=list)
    sectionOrder: List[NormalizedSectionOrderItem] = Field(default_factory=list)
    textSections: List[NormalizedTextSection] = Field(default_factory=list)
    rawSections: List[RawSectionRecord] = Field(default_factory=list)
