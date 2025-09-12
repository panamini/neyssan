from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class ExperienceItem(BaseModel):
    company: Optional[str] = None
    title: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    description: Optional[str] = None


class EducationItem(BaseModel):
    school: Optional[str] = None
    degree: Optional[str] = None
    fieldOfStudy: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    description: Optional[str] = None


class NormalizedProfile(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    summary: Optional[str] = None
    skills: Optional[List[str]] = None
    experience: Optional[List[ExperienceItem]] = None
    education: Optional[List[EducationItem]] = None
    achievements: Optional[List[str]] = None
    rawText: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=1.0)
    metadata: Optional[Dict[str, Any]] = None
