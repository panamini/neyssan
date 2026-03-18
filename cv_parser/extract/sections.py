"""Utility helpers to extract coarse sections from raw resume text."""
from __future__ import annotations

import re
import unicodedata
from typing import Dict, List

SECTION_SYNONYMS = {
    "experience": {
        "experience",
        "professional experience",
        "experiences",
        "employment history",
        "work experience",
        "work history",
        "career history",
        "career",
        "expérience",
        "expériences professionnelles",
        "parcours professionnel",
    },
    "education": {
        "education",
        "academic background",
        "education & training",
        "qualifications",
        "formation",
        "academic history",
        "education background",
    },
    "skills": {
        "skills",
        "core skills",
        "technical skills",
        "key skills",
        "competencies",
        "competences",
        "compétences",
        "skill set",
    },
    "languages": {
        "languages",
        "language skills",
        "langues",
    },
    "achievements": {
        "achievements",
        "accomplishments",
        "awards",
        "certifications",
        "distinctions",
        "récompenses",
        "projects",
    },
}


def normalize_heading_text(text: str) -> str:
    text = text.strip().strip(":")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    return re.sub(r"\s+", " ", text)


NORMALISED_SECTION_SYNONYMS: Dict[str, set[str]] = {
    key: {normalize_heading_text(value) for value in values}
    for key, values in SECTION_SYNONYMS.items()
}

_ALL_HEADERS = {h for variants in NORMALISED_SECTION_SYNONYMS.values() for h in variants}
_UPPER_RE = re.compile(r"^[A-Z0-9 .,'/-]{3,}$")
_BULLET_RE = re.compile(r"^[\-\u2022\*]")
_DATE_TOKEN_RE = re.compile(
    r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}",
    re.IGNORECASE,
)

_SECTION_RESETS = {
    "links",
    "details",
    "hobbies",
    "interests",
    "contact",
    "profile",
    "resume templates",
    "build this template",
}


def _looks_like_entry_start(line: str, key: str) -> bool:
    if _BULLET_RE.match(line):
        return False
    if key == "experience":
        lowered = line.lower()
        if "projects" in lowered:
            return False
        if _DATE_TOKEN_RE.search(line):
            return True
        if " at " in lowered or " @ " in lowered:
            return True
        return False
    if key == "education":
        lowered = line.lower()
        if any(term in lowered for term in ("university", "college", "school", "academy", "institute")):
            return True
    return False


def classify_heading(line: str) -> str | None:
    candidate = normalize_heading_text(line)
    for key, variants in NORMALISED_SECTION_SYNONYMS.items():
        if candidate in variants:
            return key
        for variant in variants:
            if variant in candidate:
                prefix, suffix = candidate.split(variant, 1)
                if suffix.strip():
                    continue
                prefix_clean = prefix.strip()
                if prefix_clean and len(prefix_clean.split()) > 3:
                        continue
                return key
    if _UPPER_RE.match(line.strip()):
        for key, variants in NORMALISED_SECTION_SYNONYMS.items():
            if candidate in variants:
                return key
    return None


def _is_noise_line(line: str) -> bool:
    lowered = line.lower()
    if lowered in _SECTION_RESETS:
        return True
    if len(line) <= 2:
        return True
    if len(line.split()) <= 3 and line.upper() == line and not any(ch.isdigit() for ch in line):
        return True
    return False


def parse_sections(raw_text: str) -> Dict[str, List[str]]:
    sections: Dict[str, List[str]] = {key: [] for key in SECTION_SYNONYMS}
    current_key: str | None = None
    buffer: List[str] = []

    def flush() -> None:
        nonlocal buffer, current_key
        if current_key and buffer:
            text = "\n".join(part.strip() for part in buffer if part.strip())
            if text:
                sections[current_key].append(text)
        buffer = []

    for raw_line in raw_text.splitlines():
        line = raw_line.strip()
        if not line:
            flush()
            continue
        header = classify_heading(line)
        if header:
            flush()
            current_key = header
            continue
        if current_key in {"experience", "education"}:
            if _is_noise_line(line):
                flush()
                current_key = None
                continue
            if _BULLET_RE.match(line):
                buffer.append(line)
                continue
            if _looks_like_entry_start(line, current_key) and buffer:
                flush()
            buffer.append(line)
            continue
        if current_key:
            if current_key == "achievements" and _BULLET_RE.match(line):
                if buffer:
                    flush()
                buffer.append(line.lstrip("-•*"))
                continue
            if _BULLET_RE.match(line):
                buffer.append(line)
            else:
                buffer.append(line)
    flush()
    return sections


def split_tokens(lines: List[str]) -> List[str]:
    tokens: List[str] = []
    for line in lines:
        fragments = re.split(r"[,;\u2022\n]\s*", line)
        for fragment in fragments:
            frag = fragment.strip()
            if frag:
                tokens.append(frag)
    return tokens
