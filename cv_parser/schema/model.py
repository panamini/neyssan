"""Shared dataclasses for the dual-path CV parsing pipeline."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional


@dataclass
class ContactInfo:
    """Lightweight contact details matching frontend expectations."""

    email: Optional[str] = None
    phone: Optional[str] = None
    linkedinUrl: Optional[str] = None
    desiredPosition: Optional[str] = None
    addressBlock: Optional[str] = None
    addressNormalized: Optional[str] = None
    phoneRaw: Optional[str] = None
    phoneE164: Optional[str] = None
    raw: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TextField:
    """Single text field with confidence score."""

    text: str
    confidence: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ArrayItem:
    """Generic array item used for repeatable sections."""

    content: str
    confidence: float = 0.0
    title: Optional[str] = None
    sourceSpan: Optional[Dict[str, int]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class NormalizedCv:
    """Normalized CV payload wired to the frontend `ICVObject` shape."""

    name: Optional[str] = None
    contact: ContactInfo = field(default_factory=ContactInfo)
    summary: Optional[TextField] = None
    experience: List[ArrayItem] = field(default_factory=list)
    education: List[ArrayItem] = field(default_factory=list)
    skills: Optional[TextField] = None
    languages: Optional[TextField] = None
    languagesRaw: Optional[List[str]] = None
    achievements: Optional[TextField] = None
    projects: List[ArrayItem] = field(default_factory=list)
    research: List[ArrayItem] = field(default_factory=list)
    volunteer: List[ArrayItem] = field(default_factory=list)
    references: List[ArrayItem] = field(default_factory=list)
    other: List[ArrayItem] = field(default_factory=list)
    raw: Optional[str] = None
    rawSections: Optional[List[Dict[str, Any]]] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        # Convert nested dataclasses manually to guarantee serialisable output.
        data["contact"] = self.contact.to_dict() if self.contact else None
        data["summary"] = self.summary.to_dict() if self.summary else None
        data["skills"] = self.skills.to_dict() if self.skills else None
        data["languages"] = self.languages.to_dict() if self.languages else None
        data["achievements"] = self.achievements.to_dict() if self.achievements else None
        data["experience"] = [item.to_dict() for item in self.experience]
        data["education"] = [item.to_dict() for item in self.education]
        data["projects"] = [item.to_dict() for item in self.projects]
        data["research"] = [item.to_dict() for item in self.research]
        data["volunteer"] = [item.to_dict() for item in self.volunteer]
        data["references"] = [item.to_dict() for item in self.references]
        data["other"] = [item.to_dict() for item in self.other]
        return data


@dataclass
class StrictContact:
    """Minimal strict contact overlay consumed by the frontend."""

    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    desiredPosition: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class LayoutBlock:
    """Lightweight layout block with normalised bounding box."""

    page: int
    text: str
    bbox: List[int]  # [x0, y0, x1, y1] in 0-1000 space
    block_type: str = "text"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class LayoutResult:
    pages: List[Dict[str, Any]] = field(default_factory=list)
    blocks: List[LayoutBlock] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pages": self.pages,
            "blocks": [block.to_dict() for block in self.blocks],
        }


@dataclass
class PipelineResult:
    """Primary output from the new dual-path pipeline."""

    normalized: NormalizedCv
    strict: Optional[StrictContact] = None
    layout: Optional[LayoutResult] = None
    diagnostics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "normalized": self.normalized.to_dict(),
            "strict": self.strict.to_dict() if self.strict else None,
            "layout": self.layout.to_dict() if self.layout else None,
            "diagnostics": self.diagnostics,
        }
        return payload
