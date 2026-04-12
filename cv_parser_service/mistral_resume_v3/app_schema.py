from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class AppBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class CvMetadata(AppBaseModel):
    createdAt: str
    updatedAt: str
    version: int
    locale: Optional[str] = None
    authorId: Optional[str] = None
    lastEditedBy: Optional[str] = None
    importRecoverySession: Optional[str] = None


class CvBlock(AppBaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    type: Literal["text", "heading", "list-item", "code", "image", "embed", "quote", "divider", "custom"]
    content: Dict[str, Any]
    plainText: Optional[str] = None
    order: Optional[int] = None
    attributes: Optional[Dict[str, Any]] = None


class IProfileItem(AppBaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    photoUrl: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    website: Optional[str] = None
    desiredPosition: Optional[str] = None
    location: Optional[str] = None


class ISummaryItem(AppBaseModel):
    id: Optional[str] = None
    summary: Any = None


class IExperienceItem(AppBaseModel):
    id: Optional[str] = None
    company: str = ""
    position: str = ""
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    isCurrent: Optional[bool] = None
    location: Optional[str] = None
    responsibilities: Optional[Any] = None
    responsibilityBullets: Optional[List[str]] = None
    description: Optional[Any] = None
    achievements: Optional[List[str]] = None
    currentlyWorking: Optional[bool] = None


class IEducationItem(AppBaseModel):
    id: Optional[str] = None
    institution: str = ""
    degree: Optional[str] = None
    fieldOfStudy: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    isCurrent: Optional[bool] = None
    grade: Optional[str] = None
    description: Optional[Any] = None


class ISkillItem(AppBaseModel):
    id: Optional[str] = None
    name: str
    level: Literal["Beginner", "Elementary", "Intermediate", "Advanced", "Fluent"] = "Intermediate"
    bucket: Optional[Literal["core", "secondary", "familiar"]] = None


class ICertificationItem(AppBaseModel):
    id: Optional[str] = None
    certificationName: str
    issuingOrganization: Optional[str] = None
    issueDate: Optional[str] = None
    expirationDate: Optional[str] = None
    credentialId: Optional[str] = None


class IProjectItem(AppBaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    name: Optional[str] = None
    meta: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[Any] = None
    summary: Optional[Any] = None


class ILanguageItem(AppBaseModel):
    id: Optional[str] = None
    name: str
    level: Literal["Beginner", "Elementary", "Intermediate", "Advanced", "Fluent"] = "Intermediate"


class IAchievementItem(AppBaseModel):
    id: Optional[str] = None
    text: str


class CvSection(AppBaseModel):
    id: Optional[str] = None
    title: str
    type: Literal["text", "experience", "education", "skills", "languages", "projects", "certifications", "summary", "achievements", "contact", "profile"]
    blocks: List[CvBlock]
    structuredContent: Any = None
    collapsed: Optional[bool] = None
    order: Optional[int] = None


class CvDocument(AppBaseModel):
    id: str
    title: str
    metadata: CvMetadata
    sections: List[CvSection]
    tags: Optional[List[str]] = None
    summary: Optional[Any] = None
