"""Shared schema and label constants for the hybrid CV parser."""

from typing import Final, List, Set


SECTION_LABELS: Final[List[str]] = [
    "SUMMARY",
    "EXPERIENCE",
    "EDUCATION",
    "SKILLS",
    "CERTIFICATIONS",
    "CONTACT",
    "LANGUAGES",
    "PROJECTS",
    "ACHIEVEMENTS",
    "AWARDS",
]

ENTITY_LABELS: Final[List[str]] = [
    "NAME",
    "EMAIL",
    "PHONE",
    "URL",
    "COMPANY",
    "ROLE",
    "START_DATE",
    "END_DATE",
    "DEGREE",
    "CERTIFICATE",
    "GRADE",
    "INSTITUTION",
    "SKILL",
    "LANGUAGE",
    "LOC",
    "GPE",
    "ADDRESS",
    "PROJECT",
    "ACHIEVEMENT",
    "AWARD",
]

# Deterministic rule label subsets
RULE_EMAIL_LABEL: Final[str] = "EMAIL"
RULE_PHONE_LABEL: Final[str] = "PHONE"
RULE_DATE_LABELS: Final[Set[str]] = {"START_DATE", "END_DATE"}
RULE_DEGREE_LABELS: Final[Set[str]] = {"DEGREE", "CERTIFICATE"}
RULE_URL_LABEL: Final[str] = "URL"

# Column separation heuristics
MIN_COLUMN_GAP_RATIO: Final[float] = 0.18
