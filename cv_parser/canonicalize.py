"""
Lightweight canonicalization helpers to align the FastAPI service output with
the Convex `canonicalize` TypeScript logic. The implementation focuses on the
data the acceptance validator requires (summary sentence, structured
experience/education, skill lists, diagnostics hygiene).

Adds:
- Engine selection artifact preferring native PDF text over OCR, configurable via env.
- Column clustering hooks (two-column vs single) with diagnostics mode selection.
- Multilingual heading dictionary expansion and ordered section list capture.
- Noise filtering of template artifacts prior to mapping with removal count in diagnostics.
- Bullet normalization improvements: join wrapped lines, punctuation spacing, and deduplication.
"""

from __future__ import annotations

import json
import os
import re
import unicodedata
import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value or "")
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _normalize_month_key(token: str) -> str:
    if not token:
        return ""
    decomposed = unicodedata.normalize("NFD", token)
    letters = [ch for ch in decomposed if unicodedata.category(ch) != "Mn" and ch.isalpha()]
    return "".join(ch.upper() for ch in letters)


def _month_from_token(token: str) -> Optional[int]:
    key = _normalize_month_key(token)
    if not key:
        return None
    if key in MONTH_MAP:
        return MONTH_MAP[key]
    if len(key) >= 4 and key[:4] in MONTH_MAP:
        return MONTH_MAP[key[:4]]
    if len(key) >= 3 and key[:3] in MONTH_MAP:
        return MONTH_MAP[key[:3]]
    return None


MONTH_MAP = {
    # English
    "JAN": 1,
    "JANUARY": 1,
    "FEB": 2,
    "FEBRUARY": 2,
    "MAR": 3,
    "MARCH": 3,
    "APR": 4,
    "APRIL": 4,
    "MAY": 5,
    "JUN": 6,
    "JUNE": 6,
    "JUL": 7,
    "JULY": 7,
    "AUG": 8,
    "AUGUST": 8,
    "SEP": 9,
    "SEPT": 9,
    "SEPTEMBER": 9,
    "OCT": 10,
    "OCTOBER": 10,
    "NOV": 11,
    "NOVEMBER": 11,
    "DEC": 12,
    "DECEMBER": 12,
    # Spanish
    "ENE": 1,
    "ENERO": 1,
    "FEBRERO": 2,
    "MARZO": 3,
    "ABR": 4,
    "ABRIL": 4,
    "MAYO": 5,
    "JUNIO": 6,
    "JULIO": 7,
    "AGOSTO": 8,
    "SEP": 9,
    "SEPTIEMBRE": 9,
    "SET": 9,
    "SETIEMBRE": 9,
    "OCTUBRE": 10,
    "NOVIEMBRE": 11,
    "DIC": 12,
    "DICIEMBRE": 12,
    # French
    "JANV": 1,
    "JANVIER": 1,
    "FEV": 2,
    "FEVR": 2,
    "FEVRIER": 2,
    "FÉVRIER": 2,
    "MAR": 3,
    "MARS": 3,
    "AVR": 4,
    "AVRIL": 4,
    "MAI": 5,
    "JUI": 6,  # captures Juin after slicing
    "JUIN": 6,
    "JUIL": 7,
    "JUILLET": 7,
    "AOUT": 8,
    "AOÛT": 8,
    "SEPTEMBRE": 9,
    "OCTOBRE": 10,
    "NOVEMBRE": 11,
    "DECEMBRE": 12,
    "DÉCEMBRE": 12,
}

# --- Engine selection thresholds (configurable) ---
def _env_float(name: str, default: float) -> float:
    try:
        raw = os.environ.get(name)
        if raw is None:
            return default
        value = float(str(raw).strip())
        return value if value >= 0 else default
    except Exception:
        return default


def _env_int(name: str, default: int) -> int:
    try:
        raw = os.environ.get(name)
        if raw is None:
            return default
        value = int(str(raw).strip())
        return value if value >= 0 else default
    except Exception:
        return default


NATIVE_MIN_CHARS_ENV = "CV_NATIVE_MIN_CHARS"
NATIVE_MIN_DENSITY_ENV = "CV_NATIVE_MIN_DENSITY"
DEFAULT_NATIVE_MIN_CHARS = 300
DEFAULT_NATIVE_MIN_DENSITY = 0.15

COMPANY_KEYWORDS = [
    "limited",
    "ltd",
    "company",
    "corporation",
    "corp",
    "llc",
    "solutions",
    "consultants",
    "communications",
    "technologies",
    "systems",
    "services",
    "group",
    "labs",
    "laboratories",
    "university",
    "college",
    "institute",
    "school",
    "hub",
    "hospital",
    "bank",
    "associates",
    "inc",
    "inc.",
    "co",
    "co.",
    "corp.",
    "plc",
    "gmbh",
    "s.a.",
    "sarl",
    "srl",
    "spa",
]

POSITION_KEYWORDS = [
    "intern",
    "engineer",
    "scientist",
    "manager",
    "consultant",
    "developer",
    "analyst",
    "specialist",
    "director",
    "lead",
    "teacher",
    "assistant",
    "professor",
    "executive",
    "officer",
    "designer",
    "architect",
    "coordinator",
    "supervisor",
    "associate",
    "administrator",
    "manager",
    "president",
    "technician",
    "guard",
]

ROLE_KEYWORDS = {
    "guard",
    "engineer",
    "developer",
    "manager",
    "analyst",
    "scientist",
    "consultant",
    "assistant",
    "officer",
    "supervisor",
    "technician",
    "architect",
    "designer",
    "specialist",
    "director",
    "administrator",
    "coordinator",
}

SECTION_NAME_BLOCKLIST = {
    "profile",
    "details",
    "contact details",
    "personal details",
    "contacts",
    "coordonnees",
    "coordonnees personnelles",
    "objective",
    "summary",
    "professional summary",
    "career summary",
    "overview",
    "education",
    "experience",
    "curriculum",
    "curriculum vitae",
    "contact",
    "references",
    "skills",
}

ADDRESS_TOKENS = {
    "street",
    "st.",
    "ave",
    "avenue",
    "road",
    "rd.",
    "drive",
    "dr.",
    "boulevard",
    "blvd",
    "lane",
    "ln",
    "suite",
    "apt",
    "floor",
    "california",
    "ca",
    "usa",
    "united states",
    "india",
    "canada",
    "australia",
    "germany",
    "france",
    "uk",
    "postal",
    "zip",
    "pin",
    "po box",
}

CONTACT_TOKENS = {
    "name",
    "nom",
    "email",
    "phone",
    "tel",
    "cell",
    "mobile",
    "contacts",
    "coordonnees",
    "linkedin",
    "github",
    "portfolio",
    "www",
    "http",
}

SOCIAL_TOKENS = {
    "linkedin",
    "github",
    "twitter",
    "facebook",
    "instagram",
    "portfolio",
    "x",
    "behance",
    "upwork",
    "indeed",
    "tiktok",
    "dribbble",
    "pinterest",
    "resume templates",
    "build this template",
    "links",
    "hobbies",
}

EMAIL_PATTERN = re.compile(r"\b([A-Za-z][A-Za-z0-9._-]+)@")
ZIP_CODE_PATTERN = re.compile(r"\b\d{5}(?:-\d{4})?\b")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:\+?\d[\d\s\-()]{7,}\d)")
LINKEDIN_RE = re.compile(r"(?:https?://)?(?:www\.)?linkedin\.com/[A-Za-z0-9/_\-]+", re.I)

HEADING_MAP = {
    "SUMMARY": "SUMMARY",
    "ABOUT": "SUMMARY",
    "PROFILE": "SUMMARY",
    "EXECUTIVE PROFILE": "SUMMARY",
    "PROFESSIONAL SUMMARY": "SUMMARY",
    "PROFESSIONAL PROFILE": "PROFILE",
    "OBJECTIVE": "SUMMARY",
    "EXPERIENCE": "EXPERIENCE",
    "WORK EXPERIENCE": "EXPERIENCE",
    "WORKING EXPERIENCE": "EXPERIENCE",
    "WORKING EXPERINCE": "EXPERIENCE",
    "PROFESSIONAL EXPERIENCE": "EXPERIENCE",
    "PERSONAL EXPERIENCE": "EXPERIENCE",
    "EXPERIENCE PROFESSIONNELLE": "EXPERIENCE",
    "EXPERIENCE PROFESSIONELLE": "EXPERIENCE",
    "EXPERIENCIA": "EXPERIENCE",
    "EMPLOYMENT HISTORY": "EXPERIENCE",
    "EDUCATION": "EDUCATION",
    "ACADEMIC CREDENTIALS": "EDUCATION",
    "ACADEMIC HISTORY": "EDUCATION",
    "EDUCATION BACKGROUND": "EDUCATION",
    "QUALIFICATIONS": "EDUCATION",
    "EDUCACION": "EDUCATION",
    "FORMACION": "EDUCATION",
    "FORMATION": "EDUCATION",
    "SKILLS": "SKILLS",
    "PROFESSIONAL SKILLS": "SKILLS",
    "TECHNICAL SKILLS": "SKILLS",
    "CORE SKILLS": "SKILLS",
    "PROJECTS": "PROJECTS",
    "CERTIFICATIONS": "CERTIFICATIONS",
    "OTHER ACTIVITIES": "ACHIEVEMENTS",
    "ACHIEVEMENTS": "ACHIEVEMENTS",
    "LANGUAGES": "LANGUAGES",
    "LANGUAGE": "LANGUAGES",
    "LANGUAGE KNOWN": "LANGUAGES",
    "LANGUAGES KNOWN": "LANGUAGES",
    "IDIOMAS": "LANGUAGES",
    "LANGUES": "LANGUAGES",
    # Additional headings for links/details/hobbies per Prompt 3
    "LINKS": "LINKS",
    "SOCIAL": "LINKS",
    "DETAILS": "DETAILS",
    "CONTACT DETAILS": "DETAILS",
    "CONTACTS": "DETAILS",
    "COORDONNEES": "DETAILS",
    "COORDONNEES PERSONNELLES": "DETAILS",
    "PERSONAL DETAILS": "DETAILS",
    "PERSONAL DOSSIER": "ADDITIONAL INFORMATION",
    "HOBBIES": "HOBBIES",
    "INTERESTS": "HOBBIES",
}

DATE_PATTERN = re.compile(r"([A-Za-zÀ-ÿ\.]{3,})\s*(\d{4})", re.IGNORECASE)
YEAR_PATTERN = re.compile(r"(19|20)\d{2}")
SECTION_SPLIT_RE = re.compile(r"\n{2,}")
BULLET_SPLIT_RE = re.compile(r"[•\u2022●◦▪‣·\uf0fc\uf0b7\u2043\u2219]+")
TOKEN_SANITIZE_RE = re.compile(r"\s+")
GLYPH_SCRUB_RE = re.compile(r"[•\u2022●◦▪‣·\uf0fc\uf0b7\u2043\u2219\u00a9\u00ae\u2122\u00b0\u25c6\u25c7\u25cb\u25cf\u25a0\u25a1=]+")
MIN_SUMMARY_CHARS = 30
MIN_SUMMARY_TOKENS = 8
SUMMARY_VERB_RE = re.compile(
    r"\b("
    r"is|are|was|were|has|have|led|managed|build\w*|develop\w+|protect\w+|research\w+|"
    r"ensure\w*|maintain\w*|monitor\w*|support\w*|lead\w*|design\w*|plan\w*|deliver\w*|complet\w*|specializ\w*|"
    r"create\w*|implement\w*|drive\w*|diseñ\w+|desarroll\w+|gest\w+|optim\w+|lider\w+"
    r")\b",
    re.I,
)
SUMMARY_MONTH_PREFIX_RE = re.compile(
    r"^(?:"
    r"jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|"
    r"enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|"
    r"janv|janvier|févr|fevr|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre"
    r")\.?\b",
    re.I,
)
HEADING_PREFIX_RE = re.compile(r"^\s*(profile|details|summary|about\s+me|information|links?)[:\-–]\s*", re.I)
SUMMARY_FORBIDDEN_PHRASES = {
    "place of birth",
    "driving license",
    "linkedin",
    "links o",
    "reason for leaving",
    "resume templates",
    "build this template",
    "curriculum vitae",
}
SUMMARY_SKILL_KEYWORDS = (
    "skills",
    "competences",
    "compétences",
    "competencias",
    "competence",
)
STREET_SUFFIXES = {
    "ave",
    "avenue",
    "st",
    "street",
    "rd",
    "road",
    "blvd",
    "boulevard",
    "dr",
    "drive",
    "way",
    "lane",
    "ln",
    "ct",
    "court",
    "pl",
    "place",
    "hwy",
    "highway",
}
ADDRESS_LEADER_RE = re.compile(
    r"^\s*\d{1,6}[\s,]+[A-Za-z0-9'.\- ]{1,40}?(?:\.\s*)?(?:"
    r"Ave|Avenue|St|Street|Rd|Road|Blvd|Boulevard|Dr|Drive|Way|Lane|Ln|Ct|Court|Pl|Place|Hwy|Highway"
    r")\b[^,]*,\s*",
    re.IGNORECASE,
)
PHONE_EMAIL_URL_RE = re.compile(r"(?:\+?\d[\d\s\-().]{6,}|@|https?://|www\.)", re.IGNORECASE)
POLLUTED_LOCATION_RE = re.compile(
    r"\b(with|years|experience|security|guard|attentive|presently|qualified)\b",
    re.IGNORECASE,
)
ROLE_AT_COMPANY_RE = re.compile(
    r"^\s*(?P<role>[^–—\-:,/|]+?)\s+(?:at|@|en|chez)\s+(?P<company>[^–—,|/]+?)(?:\s*[,–—\-|/]\s*(?P<location>.+?))?\s*$",
    re.IGNORECASE,
)
NARRATIVE_WORKED_IN_RE = re.compile(
    r"^\s*(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+\w+\s+)?"
    r"(?:(?:presently|currently)\s+)?(?:worked|working)\s+in\s+(?P<company>.+?)\s+as\s+an?\s+(?P<role>.+?)\s*$",
    re.IGNORECASE,
)
GERUND_PREFIX_RE = re.compile(r"^[a-z]{3,}ing\b")
VERB_PREFIXES = {
    "apprehending",
    "analyzing",
    "assess",
    "assessing",
    "built",
    "building",
    "communicate",
    "communicating",
    "completing",
    "coordinating",
    "creating",
    "developed",
    "developing",
    "ensuring",
    "facilitating",
    "introducing",
    "leading",
    "logging",
    "maintaining",
    "managing",
    "manage",
    "organizing",
    "performing",
    "preparing",
    "responsible",
    "explored",
    "utilizing",
    "exploring",
    "using",
}
VERB_START_RE = re.compile(
    r"^(?:completing|assessing|exploring|maintaining|logging|managing|apprehending|utilizing|ensuring|introducing|communicate|assess|explored|manage|built|building|using|developing|developed|analyzing)\b",
    re.IGNORECASE,
)
PRESENT_TOKENS = {
    "present",
    "current",
    "now",
    "to date",
    "en cours",
    "présent",
    "presente",
    "actuel",
    "actuellement",
    "actualidad",
    "hasta ahora",
}
ADDRESS_LINE_RE = re.compile(
    r"\b(?:st\.?|street|ave\.?|avenue|blvd\.?|road|rd\.?|drive|dr\.?|suite|ste\.?|apt\.?|building|bldg|[A-Z]{2}\s*\d{5}(?:-\d{4})?)\b",
    re.IGNORECASE,
)
CITY_STATE_RE = re.compile(
    r"^[A-Za-z][A-Za-z .'-]+,\s*[A-Z]{2}(?:\s*\d{4,5}(?:-\d{4})?)?(?:,\s*[A-Za-z .'-]+)?$",
    re.IGNORECASE,
)
CITY_COUNTRY_RE = re.compile(
    r"^[A-Za-z][A-Za-z .'-]+,\s*[A-Za-z .'-]{3,}$",
    re.IGNORECASE,
)
BULLET_STOPWORDS = {"full", "skills", "o"}
RESPONSIBILITY_CLAUSE_STARTS = {
    "apprehend",
    "apprehending",
    "assess",
    "assessing",
    "communicate",
    "communicating",
    "conducted",
    "conducting",
    "contributed",
    "contributing",
    "coordinate",
    "coordinating",
    "create",
    "creating",
    "deliver",
    "delivering",
    "developed",
    "developing",
    "ensure",
    "ensuring",
    "explored",
    "exploring",
    "inspect",
    "inspecting",
    "lead",
    "leading",
    "log",
    "logging",
    "maintain",
    "maintaining",
    "manage",
    "managing",
    "monitor",
    "monitoring",
    "perform",
    "performing",
    "prepare",
    "preparing",
    "presented",
    "presenting",
    "provide",
    "providing",
    "support",
    "supporting",
    "troubleshoot",
    "troubleshooting",
    "utilize",
    "utilizing",
    "write",
    "writing",
    "wrote",
}

EDU_TOKENS = ["CPOP", "SOCP", "Course Curriculum"]
SECTION_TERMINATORS = {
    "SUMMARY",
    "SKILLS",
    "LANGUAGES",
    "EDUCATION",
    "PROJECTS",
    "ACHIEVEMENTS",
    "CERTIFICATIONS",
    "VOLUNTEER",
    "OTHER",
    "DRIVING LICENSE",
}

TEXT_PDF_EXPERIENCE_HEADING_RE = re.compile(
    r"\b(?:EMPLOYMENT\s+HISTORY|PROFESSIONAL\s+EXPERIENCE|WORK(?:ING)?\s+EXPERI+NCE|EXPERIENCE)\b",
    re.IGNORECASE,
)

TEXT_PDF_EXPERIENCE_HARD_STOP_RE = re.compile(
    r"^(?:EDUCATION|ACADEMIC\s+QUALIFICATIONS?|ACADEMIC\s+CREDENTIALS|ACADEMIC\s+HISTORY|EDUCATION\s+BACKGROUND|QUALIFICATIONS|CERTIFICATIONS|PROJECTS|ACHIEVEMENTS|DECLARATION|PERSONAL\s+DETAILS|DETAILS|PROFILE|SUMMARY)\b",
    re.IGNORECASE,
)

TEXT_PDF_EXPERIENCE_SIDEBAR_RE = re.compile(
    r"^(?:LINKS|SKILLS|LANGUAGES|LANGUAGE\s+KNOWN|HOBBIES|INTERESTS)\b",
    re.IGNORECASE,
)

# Template noise filtering (Prompt 4)
NOISE_SINGLETONS = {
    "resume templates",
    "build this template",
    "pinterest",
    "linkedin",
}
NOISE_EMBLEM_RE = re.compile(r"^o\s+(skills|hobbies)\s+o$", re.IGNORECASE)
NOISE_STANDALONE_RE = re.compile(r"^(linkedin|pinterest)$", re.IGNORECASE)
MARKDOWN_HEADING_PREFIX_RE = re.compile(r"^\s{0,3}#{1,6}(?:\s+|$)")
STANDALONE_MARKDOWN_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s*$")

def _is_template_noise_line(line: str) -> bool:
    candidate = (line or "").strip()
    if not candidate:
        return False
    low = candidate.lower().strip("-–—•* .")
    if low in NOISE_SINGLETONS:
        return True
    if NOISE_EMBLEM_RE.match(candidate):
        return True
    if NOISE_STANDALONE_RE.match(candidate):
        return True
    return False

def _filter_noise_from_text(raw_text: str) -> Tuple[str, int]:
    removed = 0
    out_lines: List[str] = []
    for raw in (raw_text or "").splitlines():
        line = _normalize_structural_line(raw)
        if not line:
            removed += 1
            continue
        if _is_template_noise_line(line):
            removed += 1
            continue
        out_lines.append(raw)
    return ("\n".join(out_lines), removed)


def make_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4()}"


def collapse_spaced_caps(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        return stripped
    compact = re.sub(r"\b([A-Z])\s+(?=[A-Z]\b)", r"\1", stripped)
    compact = TOKEN_SANITIZE_RE.sub(" ", compact)
    return compact.strip()


def strip_leading_markdown_heading(value: str) -> str:
    if not value:
        return ""
    if STANDALONE_MARKDOWN_HEADING_RE.match(value):
        return ""
    if MARKDOWN_HEADING_PREFIX_RE.match(value):
        return MARKDOWN_HEADING_PREFIX_RE.sub("", value, count=1).strip()
    return value.strip()


def _scrub_glyphs(value: str) -> str:
    if not value:
        return ""
    cleaned = value.replace("\u00A0", " ")
    cleaned = GLYPH_SCRUB_RE.sub(" ", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned.strip()


def _normalize_structural_line(value: str) -> str:
    return collapse_spaced_caps(strip_leading_markdown_heading(_scrub_glyphs(value or ""))).strip()


def strip_leading_address_clause(text: str) -> str:
    cleaned = ADDRESS_LEADER_RE.sub("", text or "")
    cleaned = re.sub(
        r"^\s*\d{1,6}\s+[A-Za-z][A-Za-z'.\-]{1,}\.?\s*",
        "",
        cleaned or "",
    )
    return (cleaned or "").strip()


def looks_addressish(value: str) -> bool:
    if not value:
        return False
    candidate = value.strip()
    if not candidate:
        return False
    if PHONE_EMAIL_URL_RE.search(candidate):
        return True
    if re.search(
        r"\b\d{1,6}\b.{0,60}\b(?:Ave|Avenue|St|Street|Rd|Road|Blvd|Boulevard|Dr|Drive|Way|Lane|Ln|Ct|Court|Pl|Place|Hwy|Highway)\b",
        candidate,
        re.IGNORECASE,
    ):
        return True
    lower_tokens = [token.strip(".,") for token in candidate.lower().split()]
    if any(token in STREET_SUFFIXES for token in lower_tokens) and any(char.isdigit() for char in candidate):
        return True
    if re.search(r"\b\d{1,6}\s+[A-Za-z][A-Za-z'.\-]{1,}\.?\b$", candidate):
        return True
    if re.search(r"\b[A-Z]{2}\s*\d{5}(?:-\d{4})?\b", candidate):
        return True
    if re.search(r"[A-Z][a-z]+,\s*[A-Z]{2}\b", candidate):
        return True
    if re.search(r"[A-Z][a-z]+,\s*[A-Z][a-z]+", candidate):
        return True
    return False


def _clean_summary_text(value: str) -> str:
    if not value:
        return ""
    cleaned = strip_leading_address_clause(value)
    cleaned = re.sub(r"\b\d{4}\b", "", cleaned)
    cleaned = " ".join(cleaned.split())
    cleaned = re.sub(
        r"\b([A-Za-zÀ-ÿ]+),\s+([a-zà-ÿ][a-zà-ÿ'\-]*)",
        r"\1 \2",
        cleaned,
    )
    if not cleaned:
        return ""
    if PHONE_EMAIL_URL_RE.search(cleaned):
        return ""
    if looks_addressish(cleaned):
        return ""
    return cleaned


def _digit_ratio(value: str) -> float:
    if not value:
        return 0.0
    chars = [char for char in value if not char.isspace()]
    if not chars:
        return 0.0
    digits = sum(1 for char in chars if char.isdigit())
    return digits / len(chars)


def _normalize_summary_candidate(value: str) -> Optional[str]:
    if not value:
        return None
    cleaned = _clean_summary_text(value)
    if not cleaned:
        return None
    if _looks_like_summary_metadata_fragment(cleaned):
        return None
    lowered = cleaned.lower()
    if any(phrase in lowered for phrase in SUMMARY_FORBIDDEN_PHRASES):
        return None
    tokens = [token for token in cleaned.split() if token]
    length_ok = len(cleaned) >= MIN_SUMMARY_CHARS
    verb_ok = SUMMARY_VERB_RE.search(cleaned) is not None
    if not length_ok and not (len(tokens) >= MIN_SUMMARY_TOKENS and verb_ok):
        return None
    if PHONE_EMAIL_URL_RE.search(cleaned) or looks_addressish(cleaned):
        return None
    return cleaned


SUMMARY_PAGE_MARKER_RE = re.compile(r"\bpage\s+\d+\s+of\s+\d+\b", re.I)
SUMMARY_DATE_ONLY_RE = re.compile(
    r"^(?:(?:[A-Za-zÀ-ÿ]{3,10}\.?\s+)?\d{4})(?:\s*[–—-]\s*(?:present|current|now|to date|actual|actuel|presente|actualidad|(?:[A-Za-zÀ-ÿ]{3,10}\.?\s+)?\d{4}))?(?:\s*\([^)]{0,40}\))?\.?$",
    re.I,
)


def _looks_like_summary_metadata_fragment(value: str) -> bool:
    cleaned = (value or "").strip()
    if not cleaned:
        return True
    lowered = strip_accents(cleaned.lower())
    if SUMMARY_PAGE_MARKER_RE.search(lowered):
        return True
    if any(phrase in lowered for phrase in SUMMARY_FORBIDDEN_PHRASES):
        return True
    if cleaned.startswith("#"):
        return True
    if "//" in cleaned and not SUMMARY_VERB_RE.search(cleaned):
        return True
    if SUMMARY_DATE_ONLY_RE.match(cleaned):
        return True
    if SUMMARY_MONTH_PREFIX_RE.match(cleaned):
        if len(cleaned.split()) <= 10 and not SUMMARY_VERB_RE.search(cleaned):
            return True
    if _digit_ratio(cleaned) >= 0.25 and not SUMMARY_VERB_RE.search(cleaned):
        return True
    if "reason for leaving" in lowered:
        return True
    if re.search(r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b", lowered):
        if len(cleaned.split()) <= 10 and not SUMMARY_VERB_RE.search(cleaned):
            return True
    if _looks_like_contact_or_heading(cleaned):
        return True
    return False


def _valid_summary_candidate(text: str) -> bool:
    return _normalize_summary_candidate(text) is not None


def _merge_summary_lines(lines: List[str]) -> List[str]:
    merged: List[str] = []
    buffer: List[str] = []
    for line in lines:
        if not line:
            if buffer:
                merged.append(" ".join(buffer))
                buffer.clear()
            continue
        buffer.append(line)
    if buffer:
        merged.append(" ".join(buffer))
    return merged or lines


def _select_summary_from_lines(lines: List[str]) -> str:
    buffer: List[str] = []
    for raw_line in lines:
        candidate = _strip_bullet_prefix(raw_line or "")
        candidate = _scrub_glyphs(candidate)
        if not candidate:
            continue
        if _looks_like_contact_or_heading(candidate):
            buffer.clear()
            continue
        if detect_heading(candidate):
            buffer.clear()
            continue
        if PHONE_EMAIL_URL_RE.search(candidate):
            buffer.clear()
            continue
        candidate = HEADING_PREFIX_RE.sub("", candidate)
        if "{" in candidate or "[" in candidate:
            buffer.clear()
            continue
        if candidate.isupper() and len(candidate.split()) <= 3:
            buffer.clear()
            continue
        candidate = strip_leading_address_clause(candidate)
        candidate = " ".join(candidate.split())
        if not candidate:
            buffer.clear()
            continue
        if _looks_like_summary_metadata_fragment(candidate):
            buffer.clear()
            continue
        if SUMMARY_MONTH_PREFIX_RE.match(candidate):
            buffer.clear()
            continue
        if looks_addressish(candidate):
            buffer.clear()
            continue
        buffer.append(candidate)
        joined = " ".join(buffer).strip()
        if _valid_summary_candidate(joined):
            last_token = joined.split()[-1].lower().strip(",;")
            if last_token in {"and", "with", "y", "con"}:
                continue
            return joined
    return ""


def _summary_from_experience_entries(entries: Sequence[Dict[str, object]]) -> str:
    for entry in entries:
        bullets = entry.get("responsibilityBullets") if isinstance(entry, dict) else None
        if not bullets:
            continue
        fragments: List[str] = []
        for bullet in bullets:
            cleaned = _clean_summary_text(str(bullet or ""))
            if not cleaned:
                continue
            tokens = [token for token in cleaned.split() if token]
            if len(tokens) < 4 and not SUMMARY_VERB_RE.search(cleaned):
                continue
            lower_cleaned = cleaned.lower()
            if lower_cleaned in {"linkedin", "links", "driving license"}:
                continue
            if _looks_like_summary_metadata_fragment(cleaned):
                continue
            stripped = cleaned.rstrip(".!? ")
            fragments.append(stripped)
            candidate = ". ".join(fragments)
            normalized = _normalize_summary_candidate(candidate)
            if normalized:
                return normalized
        # try next entry if nothing valid
    return ""


def _summary_from_structured_json(raw_text: str) -> str:
    try:
        payload = json.loads(raw_text)
    except Exception:
        return ""

    primary: Optional[Dict[str, object]] = None
    if isinstance(payload, list) and payload:
        if isinstance(payload[0], dict):
            primary = payload[0]
    elif isinstance(payload, dict):
        primary = payload

    if not isinstance(primary, dict):
        return ""

    results: List[Dict[str, object]] = []
    annotations = primary.get("annotations")
    if isinstance(annotations, list) and annotations:
        first_annotation = annotations[0]
        if isinstance(first_annotation, dict):
            possible = first_annotation.get("result")
            if isinstance(possible, list):
                results = possible
    if not results:
        possible = primary.get("result")
        if isinstance(possible, list):
            results = possible
    if not results:
        return ""

    designation: Optional[str] = None
    company: Optional[str] = None
    skill_phrases: List[str] = []
    for item in results:
        if not isinstance(item, dict):
            continue
        value = item.get("value")
        if not isinstance(value, dict):
            continue
        text = str(value.get("text") or "").strip()
        if not text:
            continue
        labels = value.get("labels") or []
        label_set = {str(label).lower() for label in labels if isinstance(label, str)}
        if not designation and "designation" in label_set:
            designation = text
            continue
        if not company and "company_name" in label_set:
            company = text
            continue
        if label_set.intersection({"technical_skills", "work_with_people", "work_details"}):
            skill_phrases.append(text)

    role = designation.strip() if designation else ""
    if not role and not skill_phrases and not company:
        return ""

    selected_skills: List[str] = []
    seen_skills = set()
    for skill in skill_phrases:
        normalized_skill = skill.strip().strip(".")
        if not normalized_skill:
            continue
        key = normalized_skill.lower()
        if key in seen_skills:
            continue
        seen_skills.add(key)
        selected_skills.append(normalized_skill)
        if len(selected_skills) == 2:
            break

    if not role:
        role = "Network professional"

    company_phrase = f" at {company.strip()}" if company else ""
    if selected_skills:
        if len(selected_skills) == 1:
            skills_text = selected_skills[0]
        else:
            skills_text = f"{selected_skills[0]} and {selected_skills[1]}"
        candidate = f"{role.strip()} delivering {skills_text}{company_phrase}."
    else:
        candidate = f"{role.strip()} delivering network operations{company_phrase}."

    normalized = _normalize_summary_candidate(candidate)
    return normalized or ""


def _summary_from_skill_lines(raw_text: str) -> str:
    lines = [line.strip("•-* \t") for line in raw_text.splitlines()]
    for idx, line in enumerate(lines):
        lower = line.strip().lower()
        if not lower:
            continue
        if any(keyword in lower for keyword in SUMMARY_SKILL_KEYWORDS):
            collected: List[str] = []
            for candidate in lines[idx + 1 : idx + 6]:
                skill = candidate.strip()
                if not skill:
                    break
                if skill.lower() in SUMMARY_FORBIDDEN_PHRASES:
                    continue
                collected.append(skill)
                if len(collected) == 3:
                    break
            if not collected:
                continue
            primary = collected[0].lower()
            secondary = collected[1].lower() if len(collected) > 1 else None
            tertiary = collected[2].lower() if len(collected) > 2 else None
            skill_phrase = primary
            if secondary and tertiary:
                skill_phrase = f"{primary}, {secondary}, and {tertiary}"
            elif secondary:
                skill_phrase = f"{primary} and {secondary}"
            summary = f"Talent professional specializing in {skill_phrase}."
            normalized = _normalize_summary_candidate(summary)
            if normalized:
                return normalized
    return ""


def ensure_terminal_punctuation(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return ""
    if stripped[-1] in {".", "!", "?"}:
        return stripped
    return f"{stripped}."


def first_sentence(text: str) -> str:
    cleaned = TOKEN_SANITIZE_RE.sub(" ", text or "").strip()
    if not cleaned:
        return ""

    protected = cleaned
    replacements: List[Tuple[str, str]] = []
    abbreviations = {
        "b.tech.": "__abbr_b_tech__",
        "b.sc.": "__abbr_b_sc__",
        "b.s.": "__abbr_b_s__",
        "m.tech.": "__abbr_m_tech__",
        "m.sc.": "__abbr_m_sc__",
        "m.s.": "__abbr_m_s__",
        "ph.d.": "__abbr_ph_d__",
        "e.g.": "__abbr_e_g__",
        "i.e.": "__abbr_i_e__",
        "st.": "__abbr_st__",
        "rd.": "__abbr_rd__",
        "ave.": "__abbr_ave__",
        "blvd.": "__abbr_blvd__",
        "dr.": "__abbr_dr__",
        "ln.": "__abbr_ln__",
        "ct.": "__abbr_ct__",
        "pl.": "__abbr_pl__",
        "hwy.": "__abbr_hwy__",
        "apt.": "__abbr_apt__",
        "fl.": "__abbr_fl__",
        "no.": "__abbr_no__",
        "u.s.": "__abbr_us__",
    }

    for token, placeholder in abbreviations.items():
        pattern = re.compile(re.escape(token), re.I)

        def _capture(match, placeholder: str = placeholder) -> str:
            replacements.append((placeholder, match.group(0)))
            return placeholder

        protected = pattern.sub(_capture, protected)

    protected = re.sub(
        r"(\b[A-Za-z][A-Za-z'-]{1,}\.)\s+(Ave|Avenue|St|Street|Rd|Road|Blvd|Boulevard|Dr|Drive|Way|Lane|Ln|Ct|Court|Pl|Place|Hwy|Highway)\b",
        lambda m: m.group(1)[:-1] + " " + m.group(2),
        protected,
    )

    match = re.search(r"([^.?!]+[.?!])", protected)
    sentence = ensure_terminal_punctuation(match.group(1) if match else protected)

    for placeholder, original in replacements:
        sentence = sentence.replace(placeholder, original, 1)

    return sentence


def _starts_with_verb_phrase(text: str) -> bool:
    if not text:
        return False
    stripped = text.strip(" -–—:,")
    if not stripped:
        return False
    token = stripped.split()[0].lower()
    if token in VERB_PREFIXES:
        return True
    return bool(GERUND_PREFIX_RE.match(token))


def _normalize_location_candidate(value: str) -> Optional[str]:
    candidate = collapse_spaced_caps(value.strip("•-—–, ").strip())
    if not candidate:
        return None
    if len(candidate) < 3 or len(candidate) > 70:
        return None
    lowered = candidate.lower()
    if "http" in lowered or "@" in lowered:
        return None
    if CITY_STATE_RE.match(candidate):
        return candidate
    if CITY_COUNTRY_RE.match(candidate) and candidate.count(",") == 1:
        return candidate
    return None


def _extract_location(raw_text: str) -> Optional[str]:
    lines = raw_text.splitlines()
    for line in lines[:40]:
        cleaned = collapse_spaced_caps(line.strip("•-—– ").strip())
        if not cleaned:
            continue
        if _looks_like_contact_or_heading(cleaned):
            continue
        normalized = _normalize_location_candidate(cleaned)
        if normalized:
            return normalized
    return None


def _match_multiline_header(lines: List[str]) -> Optional[Tuple[str, str, Optional[str], int]]:
    normalized_lines = [
        line.replace("\u2013", "-").replace("\u2014", "-").strip()
        for line in lines[:5]
        if line.strip()
    ]
    if len(normalized_lines) < 3:
        return None
    role = _strip_bullet_prefix(normalized_lines[0])
    if not role or any(ch.isdigit() for ch in role):
        return None
    if _match_role_company_line([role]):
        return None
    if not (_contains_role_keyword(role) or _is_role_phrase(role) or _is_single_role_fragment([role])):
        return None
    date_line = " ".join(normalized_lines[1:3])
    start_date, end_date, is_current = _parse_dates(date_line)
    if not (start_date or end_date or is_current):
        return None
    company = _strip_bullet_prefix(normalized_lines[2])
    if not company:
        return None
    lower_company = company.lower()
    if VERB_START_RE.match(lower_company):
        return None
    if re.match(r"^[a-z]+ing\b", lower_company):
        return None
    if PHONE_EMAIL_URL_RE.search(company):
        return None
    if any(ch.isdigit() for ch in company):
        return None
    location = None
    if len(normalized_lines) >= 4:
        location = _normalize_location_candidate(normalized_lines[3])
    consumed = 3 + (1 if location else 0)
    return _normalize_role_phrase(role), collapse_spaced_caps(company), location, consumed


def _match_role_company_line(lines: List[str]) -> Optional[Tuple[str, str, Optional[str], int]]:
    for idx, line in enumerate(lines[:3]):
        cleaned = collapse_spaced_caps(_strip_bullet_prefix(line).strip())
        if not cleaned:
            continue
        lowered = strip_accents(cleaned.lower())
        if re.match(r"^\s*(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+\w+\s+)?(?:(?:presently|currently)\s+)?(?:worked|working)\s+in\b", lowered):
            continue
        match = ROLE_AT_COMPANY_RE.match(cleaned)
        if not match:
            continue
        role = _normalize_role_phrase(match.group("role") or "")
        company = collapse_spaced_caps(match.group("company") or "")
        location_raw = match.group("location")
        location = _normalize_location_candidate(location_raw) if location_raw else None
        if company and _starts_with_verb_phrase(company):
            continue
        return role, company, location, idx
    return None


def _fallback_position_from_lines(lines: List[str], company: Optional[str]) -> Optional[str]:
    for line in lines[:3]:
        cleaned = collapse_spaced_caps(_strip_bullet_prefix(line).strip("•-—– ").strip())
        if not cleaned:
            continue
        if company and cleaned.lower() == company.lower():
            continue
        if _looks_like_contact_or_heading(cleaned):
            continue
        if any(char.isdigit() for char in cleaned):
            continue
        if _contains_role_keyword(cleaned):
            return _normalize_role_phrase(cleaned)
        tokens = cleaned.split()
        if cleaned.isupper() and len(tokens) <= 6 and _contains_role_keyword(cleaned.lower()):
            return _normalize_role_phrase(cleaned)
    return None


@lru_cache(maxsize=1)
def _load_esco_mapping() -> Dict[str, str]:
    path = os.environ.get("ESCO_SKILLS_PATH")
    if not path:
        return {}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
    except Exception:
        return {}
    if isinstance(payload, dict):
        return {
            str(key).strip().lower(): str(value).strip()
            for key, value in payload.items()
            if isinstance(key, str) and isinstance(value, str)
        }
    return {}


def _normalize_skill_alias(value: str) -> str:
    mapping = _load_esco_mapping()
    key = value.strip().lower()
    return mapping.get(key, value)


def _strip_bullet_prefix(value: str) -> str:
    return re.sub(r"^[\s•\-\u2022\*\u2023●◦▪‣·\uf0fc\uf0b7\u2043\u2219]+", "", value or "").strip()


def _normalize_punctuation_spacing(value: str) -> str:
    if not value:
        return ""
    s = re.sub(r"\s+([,;:])", r"\1", value)
    s = re.sub(r"\s+([.?!])", r"\1", s)
    s = re.sub(r"\s{2,}", " ", s)
    s = re.sub(r"\s*([.?!])\s*$", r"\1", s)
    return s.strip()


def _looks_like_contact_or_heading(line: str) -> bool:
    if not line:
        return False
    if detect_heading(line):
        return True
    lower = strip_accents(line.lower())
    normalized = TOKEN_SANITIZE_RE.sub(" ", lower).strip()
    normalized = normalized.strip(":-•*#| ")
    heading_candidate = normalized.split(":", 1)[0].strip()
    for token in SECTION_NAME_BLOCKLIST:
        if heading_candidate == token:
            return True
        if heading_candidate.startswith(f"{token} "):
            return True
    if any(re.search(rf"\\b{re.escape(token)}\\b", lower) for token in CONTACT_TOKENS):
        return True
    if any(re.search(rf"\\b{re.escape(token)}\\b", lower) for token in ADDRESS_TOKENS):
        return True
    if "@" in line or "http" in lower or "www." in lower:
        return True
    if ZIP_CODE_PATTERN.search(line):
        return True
    if looks_addressish(line):
        return True
    if re.search(
        r"\b\d{1,6}\b.{0,60}\b(?:Ave|Avenue|St|Street|Rd|Road|Blvd|Boulevard|Dr|Drive|Way|Lane|Ln|Ct|Court|Pl|Place|Hwy|Highway)\b",
        line,
        re.IGNORECASE,
    ):
        return True
    return False


def _contains_org_keyword(text: str) -> bool:
    lower = text.lower()
    return any(keyword in lower for keyword in COMPANY_KEYWORDS)


def _contains_role_keyword(text: str) -> bool:
    lower = text.lower()
    return any(re.search(rf"\b{re.escape(keyword)}\b", lower) for keyword in ROLE_KEYWORDS)


def _is_role_phrase(text: str) -> bool:
    tokens = [re.sub(r"[^a-z]", "", token.lower()) for token in text.split()]
    tokens = [token for token in tokens if token]
    if not tokens:
        return False
    if any(token in COMPANY_KEYWORDS for token in tokens):
        return False
    role_hits = [
        token
        for token in tokens
        if token in ROLE_KEYWORDS
        or token in {"senior", "junior", "lead", "security", "chief", "principal", "assistant", "associate", "pro"}
    ]
    return bool(role_hits) and len(role_hits) == len(tokens)


NAME_LABEL_BLOCKLIST = {
    "name",
    "nom",
    "email",
    "e-mail",
    "details",
    "profile",
    "links",
    "place of birth",
    "driving license",
    "driving licence",
    "contact",
    "contacts",
    "coordonnees",
    "coordonnees personnelles",
    "adresse",
    "address",
}

NAME_PREFIX_LABELS = {
    "name",
    "nom",
    "contact",
    "contacts",
    "contact details",
    "details",
    "personal details",
    "coordonnees",
    "coordonnees personnelles",
    "curriculum",
    "curriculum vitae",
    "resume",
    "cv",
}

NAME_PREAMBLE_BLOCKLIST = {
    "top skills",
    "principales competences",
    "principales compétences",
    "competenze principali",
    "certifications",
    "assessment",
    "the predictive index",
    "excel with linkedin recruiter",
    "excel with linkedin recruiter assessment",
    "honors awards",
    "honors-awards",
    "languages",
}

NON_NAME_DESCRIPTOR_TOKENS = {
    "recruitment",
    "recrutement",
    "talent",
    "acquisition",
    "sourcing",
    "gestion",
    "project",
    "projet",
    "international",
    "communication",
    "designer",
}

MIN_NAME_SCORE = 5
NAME_TOKEN_RE = re.compile(r"^[A-Z][A-Za-z'-]*$|^[A-Z]+$")


def _normalize_name_candidate(value: str) -> str:
    tokens = []
    for token in value.split():
        if token.isupper() and len(token) <= 3:
            tokens.append(token)
        elif len(token) == 1:
            tokens.append(token.upper())
        else:
            tokens.append(token.capitalize())
    return " ".join(tokens)


def _normalize_role_phrase(value: str) -> str:
    stripped = value.strip()
    if stripped.isupper():
        return stripped.title()
    return stripped


def _strip_name_label_prefix(line: str) -> str:
    if not line:
        return ""
    candidate = re.sub(r"^\s*[#>*`|]+\s*", "", line).strip()
    if not candidate:
        return ""

    raw_tokens = [token for token in candidate.split() if token]
    cleaned_tokens = [
        strip_accents(token.lower()).strip(":-–—|#*_`.,;()[]{}")
        for token in raw_tokens
    ]

    for label in sorted(NAME_PREFIX_LABELS, key=lambda value: (-len(value.split()), -len(value))):
        label_tokens = label.split()
        if cleaned_tokens[: len(label_tokens)] != label_tokens:
            continue
        remainder = raw_tokens[len(label_tokens) :]
        while remainder and re.fullmatch(r"[:\-–—|#*_`.,;(){}\[\]]+", remainder[0]):
            remainder.pop(0)
        candidate = " ".join(remainder).strip()
        break

    return candidate


def _is_name_preamble_heading(line: str) -> bool:
    normalized = strip_accents((line or "").lower()).strip()
    normalized = normalized.rstrip(":")
    normalized = TOKEN_SANITIZE_RE.sub(" ", normalized)
    return normalized in NAME_PREAMBLE_BLOCKLIST


def _is_page_marker_line(line: str) -> bool:
    cleaned = (line or "").strip()
    if not cleaned:
        return False
    return bool(SUMMARY_PAGE_MARKER_RE.search(cleaned))


def _prepare_name_candidate(line: str) -> str:
    cleaned = collapse_spaced_caps(_scrub_glyphs(_strip_bullet_prefix(str(line or "")))).strip()
    if not cleaned:
        return ""
    cleaned = _strip_name_label_prefix(cleaned)
    cleaned = re.sub(r"^\s*[#>*`|]+\s*", "", cleaned).strip()
    return cleaned


def _line_disqualifies_name(line: str) -> bool:
    if not line:
        return True
    candidate = line.strip()
    if not candidate:
        return True
    tokens = [token for token in candidate.split() if token]
    if len(tokens) == 1 and len(strip_accents(tokens[0])) < 4:
        return True
    lowered = strip_accents(candidate.lower())
    lowered_trimmed = lowered.rstrip(":")
    if lowered in NAME_LABEL_BLOCKLIST or lowered_trimmed in NAME_LABEL_BLOCKLIST:
        return True
    if lowered in NAME_PREAMBLE_BLOCKLIST or lowered_trimmed in NAME_PREAMBLE_BLOCKLIST:
        return True
    if _is_page_marker_line(candidate):
        return True
    if candidate.endswith(":"):
        return True
    if "@" in candidate or "://" in candidate:
        return True
    if re.search(r"[A-Za-z]\d{2,}", candidate) or re.search(r"\d{2,}[A-Za-z]", candidate):
        return True
    if re.search(r"\b\d{2,}\b", candidate) and re.search(r"[A-Za-z]", candidate):
        return True
    if any(symbol in candidate for symbol in {"=", "&", "°"}):
        return True
    if candidate.lstrip().startswith(("#", "*", "`", "|")):
        return True
    if len(candidate) > 40:
        return True
    if candidate.count(",") > 1 or candidate.count("&") > 1:
        return True
    lowered_tokens = {token.strip(":,./-'") for token in lowered.split() if token.strip(":,./-'")}
    if lowered_tokens & NON_NAME_DESCRIPTOR_TOKENS:
        return True
    if _is_role_phrase(candidate):
        return True
    if _looks_like_contact_or_heading(candidate):
        return True
    return False


def _score_name_candidate(line: str, position: int) -> int:
    tokens = [token for token in line.split() if token]
    if not tokens:
        return -1
    score = 0
    token_count = len(tokens)
    if token_count == 2:
        score += 5
    elif token_count == 3:
        score += 4
    elif token_count == 4:
        score += 3
    elif token_count == 1:
        score += 1
    else:
        score += 2
    upper_tokens = sum(1 for token in tokens if token.isupper() and len(token) > 1)
    title_tokens = sum(1 for token in tokens if token == token.title())
    if title_tokens == token_count:
        score += 2
    elif title_tokens + upper_tokens == token_count:
        score += 2
    elif title_tokens + upper_tokens >= token_count - 1:
        score += 1
    if any("-" in token or "'" in token for token in tokens):
        score += 1
    if line.isupper() and token_count == 2:
        score += 1
    # Prefer top-of-document candidates (position 0 gets maximum boost).
    score += max(0, 4 - position)
    if not all(NAME_TOKEN_RE.match(token) for token in tokens):
        score -= 3
    return score


def _fallback_name_candidate(lines: Sequence[str]) -> Optional[str]:
    for raw_line in list(lines)[:5]:
        cleaned = _prepare_name_candidate(raw_line)
        if not cleaned or _line_disqualifies_name(cleaned):
            continue
        if looks_addressish(cleaned):
            continue
        tokens = [token for token in cleaned.split() if token]
        if not (2 <= len(tokens) <= 3):
            continue
        if not all(NAME_TOKEN_RE.match(token) for token in tokens):
            continue
        if any(not token[0].isupper() for token in tokens if token):
            continue
        lowered_tokens = {token.lower().strip(":,") for token in tokens}
        if lowered_tokens & NAME_LABEL_BLOCKLIST:
            continue
        if lowered_tokens & CONTACT_TOKENS:
            continue
        return cleaned
    return None


def _infer_name_from_email(raw_text: str) -> Optional[str]:
    lines = raw_text.splitlines()
    for line in lines[:20]:
        match = EMAIL_PATTERN.search(line)
        if not match:
            continue
        local_part = match.group(1)
        parts = [part for part in re.split(r"[._-]+", local_part) if part.isalpha()]
        if not parts:
            continue
        candidate = ""
        if len(parts) >= 2:
            candidate = " ".join(part.capitalize() for part in parts[:3])
        elif parts:
            candidate = parts[0].capitalize()
        if not candidate:
            continue
        if _line_disqualifies_name(candidate):
            continue
        return candidate
    return None


def extract_contact(raw: str) -> Dict[str, Optional[str]]:
    email_match = EMAIL_RE.search(raw)
    phone_match = PHONE_RE.search(raw)
    linkedin_match = LINKEDIN_RE.search(raw)
    phone_value = None
    if phone_match:
        phone_value = re.sub(r"\s+", " ", phone_match.group(0)).strip()
    return {
        "email": email_match.group(0) if email_match else None,
        "phone": phone_value,
        "linkedinUrl": linkedin_match.group(0) if linkedin_match else None,
        "location": _extract_location(raw),
    }


def _clean_address_field(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = _normalize_location_candidate(value)
    if normalized:
        return normalized
    cleaned = strip_leading_address_clause(value)
    if cleaned:
        normalized = _normalize_location_candidate(cleaned)
        if normalized:
            return normalized
    if POLLUTED_LOCATION_RE.search(value):
        return None
    return None


def pick_summary_text(sections: Dict[str, List[str]], fallback_text: str) -> str:
    def extract_from_label(label: str) -> Optional[str]:
        for block in sections.get(label, []):
            raw_lines = [
                _normalize_structural_line(line)
                for line in block.splitlines()
                if line.strip()
            ]
            if not raw_lines:
                continue
            merged_lines = _merge_summary_lines(raw_lines)
            candidate = _normalize_summary_candidate(_select_summary_from_lines(merged_lines))
            if candidate:
                return candidate
        return None

    for label in ("SUMMARY", "PROFILE"):
        candidate = extract_from_label(label)
        if candidate:
            return candidate

    for block in sections.get("BODY", [])[:5]:
        raw_lines = [
            _normalize_structural_line(line)
            for line in block.splitlines()
            if line.strip()
        ]
        if not raw_lines:
            continue
        merged_lines = _merge_summary_lines(raw_lines)
        candidate = _normalize_summary_candidate(_select_summary_from_lines(merged_lines))
        if candidate:
            return candidate

    fallback_lines = [
        _normalize_structural_line(line)
        for line in (fallback_text or "").splitlines()[:10]
        if line.strip()
    ]
    merged_fallback = _merge_summary_lines(fallback_lines)
    candidate = _normalize_summary_candidate(_select_summary_from_lines(merged_fallback))
    if candidate:
        return candidate
    return ""
def detect_heading(line: str) -> Optional[str]:
    ascii_line = strip_accents(line or "")
    cleaned = re.sub(r"[^A-Z ]", " ", ascii_line.upper()).strip()
    cleaned = TOKEN_SANITIZE_RE.sub(" ", cleaned)
    return HEADING_MAP.get(cleaned)


def extract_sections(raw_text: str, raw_sections: Optional[List[Dict[str, str]]] = None) -> Dict[str, List[str]]:
    sections: Dict[str, List[str]] = {}
    raw_lines = raw_text.replace("\r", "").split("\n")
    lines = [_normalize_structural_line(line) for line in raw_lines]
    current: Optional[str] = None
    buffer: List[str] = []

    def flush():
        if buffer:
            text = "\n".join(buffer).strip()
            if text:
                sections.setdefault(current or "BODY", []).append(text)
            buffer.clear()

    for line in lines:
        if not line.strip():
            flush()
            continue
        heading = detect_heading(line)
        if heading:
            flush()
            current = heading
            continue
        buffer.append(line.strip())
    flush()

    if raw_sections:
        for item in raw_sections:
            label = str(item.get("label", "")).strip()
            raw_content = str(item.get("content", "")).strip()
            normalized_label = strip_leading_markdown_heading(label)
            heading = detect_heading(normalized_label) or collapse_spaced_caps(normalized_label.upper())
            if heading == "EDUCATION" and has_parseable_education_markdown_table(raw_content):
                normalized_lines = []
                for line in raw_content.splitlines():
                    stripped = line.strip()
                    if not stripped:
                        continue
                    normalized_lines.append(_normalize_structural_line(stripped))
                content = "\n".join(line for line in normalized_lines if line).strip()
            elif heading == "LANGUAGES" and has_parseable_language_markdown_table(raw_content):
                normalized_lines = []
                for line in raw_content.splitlines():
                    stripped = line.strip()
                    if not stripped:
                        continue
                    normalized_lines.append(_normalize_structural_line(stripped))
                content = "\n".join(line for line in normalized_lines if line).strip()
            else:
                content = _normalize_structural_line(raw_content)
            if not content:
                continue
            sections.setdefault(heading, []).append(content)

    # Remove empty entries
    cleaned_sections = {key: [entry for entry in values if entry.strip()] for key, values in sections.items()}
    return {key: value for key, value in cleaned_sections.items() if value}


def extract_name_and_role(raw_text: str, sections: Dict[str, List[str]]) -> Tuple[Optional[str], Optional[str]]:
    lines = [_normalize_structural_line(line) for line in raw_text.splitlines() if line.strip()]
    lines = [line for line in lines if line]
    if not lines:
        return None, None

    candidate_lines: List[str] = []
    saw_identity_candidate = False
    for line in lines:
        heading = detect_heading(line)
        prepared = _prepare_name_candidate(line)
        plausible_name = bool(prepared and not _line_disqualifies_name(prepared))
        if not saw_identity_candidate:
            if _is_page_marker_line(line):
                continue
            if _is_name_preamble_heading(line):
                continue
            if heading in {"DETAILS", "LINKS"}:
                continue
            if not heading and _looks_like_contact_or_heading(line):
                continue
            if heading and not plausible_name:
                break
            if not plausible_name:
                continue
            saw_identity_candidate = True
        if not candidate_lines:
            candidate_lines.append(line.strip())
            if len(candidate_lines) >= 14:
                break
            continue
        if heading:
            break
        candidate_lines.append(line.strip())
        if len(candidate_lines) >= 14:
            break

    best_name: Optional[str] = None
    best_score = -1
    for idx, line in enumerate(candidate_lines):
        cleaned = _prepare_name_candidate(line)
        if not cleaned or _line_disqualifies_name(cleaned):
            continue
        tokens = cleaned.split()
        if len(tokens) > 4:
            continue
        score = _score_name_candidate(cleaned, idx)
        if score > best_score:
            best_score = score
            best_name = cleaned

    if best_score < MIN_NAME_SCORE:
        fallback_name = _fallback_name_candidate(candidate_lines)
        if fallback_name:
            best_name = fallback_name
            best_score = MIN_NAME_SCORE

    if best_name and best_score >= MIN_NAME_SCORE:
        name_value = _normalize_name_candidate(best_name)
    else:
        inferred_name = _infer_name_from_email(raw_text)
        name_value = _normalize_name_candidate(inferred_name) if inferred_name else None

    role_candidate: Optional[str] = None
    extended_scope = candidate_lines + [
        collapse_spaced_caps(line)
        for line in lines[len(candidate_lines) : len(candidate_lines) + 4]
        if line.strip()
    ]
    for line in extended_scope:
        cleaned = _strip_bullet_prefix(line)
        if not cleaned or len(cleaned) > 60:
            continue
        if _looks_like_contact_or_heading(cleaned):
            continue
        if _contains_role_keyword(cleaned):
            role_candidate = _normalize_role_phrase(cleaned)
            break
        if cleaned.isupper() and _contains_role_keyword(cleaned.lower()):
            role_candidate = _normalize_role_phrase(cleaned)
            break

    if role_candidate and name_value and role_candidate.lower() == name_value.lower():
        role_candidate = None

    return name_value, role_candidate


def _split_blocks(text: str) -> List[str]:
    blocks = [block.strip() for block in SECTION_SPLIT_RE.split(text) if block.strip()]
    return blocks or ([text.strip()] if text.strip() else [])


def _contains_keyword_token(line: str, keywords: Sequence[str]) -> bool:
    lowered = strip_accents(line.lower())
    padded = f" {re.sub(r'[^a-z0-9]+', ' ', lowered).strip()} "
    if padded == "  ":
        return False
    for keyword in keywords:
        normalized = re.sub(r"[^a-z0-9]+", " ", strip_accents(keyword.lower())).strip()
        if not normalized:
            continue
        if f" {normalized} " in padded:
            return True
    return False


def _looks_like_entry_header_line(line: str) -> bool:
    cleaned = collapse_spaced_caps(_strip_bullet_prefix(line).strip())
    if not cleaned:
        return False
    if _match_role_company_line([cleaned]):
        return True
    if _contains_keyword_token(cleaned, POSITION_KEYWORDS):
        return True
    if _contains_keyword_token(cleaned, COMPANY_KEYWORDS):
        return True
    return False


def _looks_like_header_residue(line: str) -> bool:
    cleaned = collapse_spaced_caps(_strip_bullet_prefix(line).strip())
    if not cleaned:
        return False
    lowered = strip_accents(cleaned.lower()).strip(" :")
    if lowered in SECTION_NAME_BLOCKLIST:
        return True
    if lowered in {"curriculum vitae", "curriculum", "resume", "cv"}:
        return True
    if cleaned.isupper() and not _looks_like_entry_header_line(cleaned):
        return True
    return False


def _is_probable_entry_start(line: str, current: List[str]) -> bool:
    if not current:
        return False
    stripped = line.lstrip("•- ").strip()
    if not stripped:
        return False
    if _contains_keyword_token(stripped, COMPANY_KEYWORDS) and not _starts_with_verb_phrase(stripped):
        return True
    if _contains_keyword_token(stripped, POSITION_KEYWORDS) and not _starts_with_verb_phrase(stripped):
        return True
    if stripped.isupper():
        return True
    if re.search(DATE_PATTERN, stripped):
        return True
    return False


def split_experience_entries(block: str) -> List[List[str]]:
    lines = [line.strip() for line in block.splitlines()]
    entries: List[List[str]] = []
    current: List[str] = []
    for line in lines:
        stripped_line = line.strip()
        if not stripped_line:
            if current:
                entries.append(current)
                current = []
            continue
        lower_line = stripped_line.lower()
        if lower_line.startswith(("driving license", "driving licence", "licenses", "licences")):
            if current:
                entries.append(current)
            current = []
            break
        heading = detect_heading(stripped_line)
        if heading and heading != "EXPERIENCE" and heading in SECTION_TERMINATORS:
            if current:
                entries.append(current)
            current = []
            break
        if current and _is_compact_date_fragment_entry(current) and _is_single_role_fragment([stripped_line]):
            current.append(stripped_line)
            continue
        if current and _is_compact_date_then_role_prefix(current) and _split_company_location_line(stripped_line):
            current.append(stripped_line)
            continue
        if current and _is_date_left_column_header_fragment(current) and not _is_compact_date_anchor_line(stripped_line):
            current.append(stripped_line)
            continue
        if current and _is_compact_date_anchor_line(stripped_line):
            if (
                _is_compact_date_fragment_entry(current)
                or (
                    len(current) <= 2
                    and (
                        _is_single_role_fragment([current[0]])
                        or _match_role_company_line([current[0]]) is not None
                    )
                )
            ):
                current.append(stripped_line)
                continue
            entries.append(current)
            current = [stripped_line]
            continue
        if (
            current
            and re.search(DATE_PATTERN, stripped_line)
            and len(current) <= 2
            and (_is_single_role_fragment([current[0]]) or _match_role_company_line([current[0]]) is not None)
        ):
            current.append(stripped_line)
            continue
        if current and _looks_like_header_residue(current[0]) and _looks_like_entry_header_line(stripped_line):
            current = []
        if _is_probable_entry_start(stripped_line, current):
            if current:
                entries.append(current)
                current = []
        current.append(stripped_line)
    if current:
        entries.append(current)
    return [entry for entry in entries if any(line.strip() for line in entry)]


def _starts_with_reason_for_leaving(line: str) -> bool:
    normalized = strip_accents((line or "").lower()).strip(" :")
    return normalized.startswith("reason for leaving")


def _is_single_role_fragment(entry: List[str]) -> bool:
    if len(entry) != 1:
        return False
    line = strip_leading_markdown_heading(entry[0]).strip()
    if not line:
        return False
    if re.search(DATE_PATTERN, line):
        return False
    if _starts_with_reason_for_leaving(line):
        return False
    if PHONE_EMAIL_URL_RE.search(line) or looks_addressish(line):
        return False
    if _contains_org_keyword(line):
        return False
    if (_contains_role_keyword(line) or _is_role_phrase(line)) and not _starts_with_verb_phrase(line):
        return True
    tokens = [token for token in re.split(r"\s+", line) if token]
    if not 2 <= len(tokens) <= 8:
        return False
    uppercase_initials = sum(1 for token in tokens if token[:1].isupper())
    return uppercase_initials >= 2 and not _starts_with_verb_phrase(line)


def _split_company_location_line(line: str) -> Optional[Tuple[str, Optional[str]]]:
    cleaned = collapse_spaced_caps(_strip_bullet_prefix(line).strip())
    if not cleaned or any(char.isdigit() for char in cleaned):
        return None
    for separator in (" • ", "•"):
        if separator not in cleaned:
            continue
        company_raw, location_raw = [part.strip(" ,") for part in cleaned.split(separator, 1)]
        if not company_raw or not location_raw:
            continue
        if _starts_with_reason_for_leaving(company_raw):
            continue
        if _is_role_phrase(company_raw) or _starts_with_verb_phrase(company_raw):
            continue
        if PHONE_EMAIL_URL_RE.search(company_raw):
            continue
        location = _normalize_location_candidate(location_raw)
        if not location:
            continue
        return collapse_spaced_caps(company_raw), location
    comma_parts = [part.strip(" ,") for part in cleaned.split(",") if part.strip(" ,")]
    if len(comma_parts) >= 3:
        company_raw = ", ".join(comma_parts[:-2]).strip(" ,")
        location_raw = ", ".join(comma_parts[-2:]).strip(" ,")
        if (
            company_raw
            and location_raw
            and not _starts_with_reason_for_leaving(company_raw)
            and not _is_role_phrase(company_raw)
            and not _starts_with_verb_phrase(company_raw)
            and not PHONE_EMAIL_URL_RE.search(company_raw)
        ):
            location = _normalize_location_candidate(location_raw)
            if location:
                return collapse_spaced_caps(company_raw), location
    if len(comma_parts) == 2:
        company_raw = comma_parts[0].strip(" ,")
        location_raw = comma_parts[1].strip(" ,")
        if (
            company_raw
            and location_raw
            and not _starts_with_reason_for_leaving(company_raw)
            and not _is_role_phrase(company_raw)
            and not _starts_with_verb_phrase(company_raw)
            and not PHONE_EMAIL_URL_RE.search(company_raw)
        ):
            location = _normalize_location_candidate(location_raw)
            if location:
                return collapse_spaced_caps(company_raw), location
    tokens = [token for token in cleaned.split() if token]
    for start in range(len(tokens) - 2, max(0, len(tokens) - 5), -1):
        company_raw = " ".join(tokens[:start]).strip(" ,")
        location_raw = " ".join(tokens[start:]).strip(" ,")
        if not company_raw or not location_raw:
            continue
        if _starts_with_reason_for_leaving(company_raw):
            continue
        if _is_role_phrase(company_raw) or _starts_with_verb_phrase(company_raw):
            continue
        if PHONE_EMAIL_URL_RE.search(company_raw):
            continue
        location = _normalize_location_candidate(location_raw)
        if not location:
            continue
        return collapse_spaced_caps(company_raw), location
    return None


def _is_single_company_location_fragment(entry: List[str]) -> bool:
    if len(entry) != 1:
        return False
    line = strip_leading_markdown_heading(entry[0]).strip()
    if not line or _starts_with_reason_for_leaving(line):
        return False
    if _split_company_location_line(line):
        return True
    if _contains_org_keyword(line) and not _starts_with_verb_phrase(line) and not re.search(DATE_PATTERN, line):
        return True
    return False


def _is_single_date_fragment(entry: List[str]) -> bool:
    if len(entry) != 1:
        return False
    line = strip_leading_markdown_heading(entry[0]).strip()
    if not line:
        return False
    start_date, end_date, is_current = _parse_dates(line)
    return bool(start_date or end_date or is_current)


def _is_compact_date_anchor_line(line: str) -> bool:
    cleaned = strip_leading_markdown_heading(line).strip()
    if not cleaned or _starts_with_verb_phrase(cleaned):
        return False
    token_count = len([token for token in re.split(r"\s+", cleaned) if token])
    if token_count > 4:
        return False
    start_date, end_date, is_current = _parse_dates(cleaned)
    return bool(start_date or end_date or is_current)


def _is_compact_date_fragment_entry(entry: List[str]) -> bool:
    if not entry or len(entry) > 2:
        return False
    return all(_is_compact_date_anchor_line(line) for line in entry)


def _is_compact_date_then_role_prefix(entry: List[str]) -> bool:
    if len(entry) < 2 or len(entry) > 3:
        return False
    date_lines: List[str] = []
    index = 0
    while index < len(entry) and len(date_lines) < 2 and _is_compact_date_anchor_line(entry[index]):
        date_lines.append(entry[index])
        index += 1
    return bool(date_lines and index == len(entry) - 1 and _is_single_role_fragment([entry[index]]))


def _join_compact_date_fragment(entry: List[str]) -> str:
    return collapse_spaced_caps(
        " ".join(strip_leading_markdown_heading(line).strip() for line in entry if line.strip())
    )


def _entry_starts_with_role_and_company_fragment(entry: List[str]) -> bool:
    return len(entry) >= 2 and _is_single_role_fragment([entry[0]]) and _split_company_location_line(entry[1]) is not None


def _reorder_date_left_column_header_entry(entry: List[str]) -> Optional[List[str]]:
    if len(entry) < 3:
        return None
    date_lines: List[str] = []
    index = 0
    while index < len(entry) and len(date_lines) < 2 and _is_compact_date_anchor_line(entry[index]):
        date_lines.append(entry[index])
        index += 1
    if not date_lines or index + 1 >= len(entry):
        return None
    role_line = strip_leading_markdown_heading(entry[index]).strip()
    company_line = strip_leading_markdown_heading(entry[index + 1]).strip()
    if not _is_single_role_fragment([role_line]):
        return None
    compound_company_location = _split_company_location_line(company_line)
    if not compound_company_location:
        return None
    company, location = compound_company_location
    reordered = [role_line, _join_compact_date_fragment(date_lines), company]
    if location:
        reordered.append(location)
    reordered.extend(entry[index + 2 :])
    return reordered


def _is_date_left_column_header_fragment(entry: List[str]) -> bool:
    return _reorder_date_left_column_header_entry(entry) is not None


def _is_single_narrative_bullet_entry(entry: List[str]) -> bool:
    if len(entry) != 1:
        return False
    line = strip_leading_markdown_heading(entry[0]).strip()
    return bool(
        line
        and not _is_compact_date_anchor_line(line)
        and not _looks_like_contact_or_heading(line)
        and len(line.split()) >= 6
    )


def _is_detached_narrative_block(entry: List[str]) -> bool:
    if not entry:
        return False
    if _is_compact_date_fragment_entry(entry):
        return False
    if _is_date_left_column_header_fragment(entry):
        return False
    if _entry_starts_with_role_and_company_fragment(entry):
        return False
    saw_content = False
    for raw_line in entry:
        line = strip_leading_markdown_heading(raw_line).strip()
        if not line:
            continue
        if _looks_like_contact_or_heading(line):
            return False
        if _is_compact_date_anchor_line(line):
            return False
        if _match_role_company_line([line]) is not None:
            return False
        if _split_company_location_line(line):
            return False
        if _is_single_role_fragment([line]):
            return False
        if len(line.split()) >= 3 or line.endswith(":"):
            saw_content = True
    return saw_content


def _repair_fragmented_experience_entries(entries: List[List[str]]) -> List[List[str]]:
    repaired_entries: List[List[str]] = []
    pending_entries = [list(entry) for entry in entries]
    index = 0
    while index < len(pending_entries):
        current_entry = pending_entries[index]
        reordered_date_left_entry = _reorder_date_left_column_header_entry(current_entry)
        if reordered_date_left_entry:
            merged_entry = list(reordered_date_left_entry)
            next_index = index + 1
            while next_index < len(pending_entries):
                next_entry = pending_entries[next_index]
                if _is_compact_date_fragment_entry(next_entry) or _is_date_left_column_header_fragment(next_entry):
                    break
                if not _is_detached_narrative_block(next_entry):
                    break
                merged_entry.extend(next_entry)
                next_index += 1
            repaired_entries.append(merged_entry)
            index = next_index
            continue
        if _is_compact_date_fragment_entry(current_entry) and index + 1 < len(pending_entries):
            joined_date = _join_compact_date_fragment(current_entry)
            next_entry = pending_entries[index + 1]
            if _entry_starts_with_role_and_company_fragment(next_entry):
                merged_entry = [next_entry[0], joined_date]
                compound_company_location = _split_company_location_line(next_entry[1])
                if compound_company_location:
                    inferred_company, inferred_location = compound_company_location
                    merged_entry.append(inferred_company)
                    if inferred_location:
                        merged_entry.append(inferred_location)
                else:
                    merged_entry.append(next_entry[1])
                merged_entry.extend(next_entry[2:])
                if index + 2 < len(pending_entries) and _is_single_narrative_bullet_entry(pending_entries[index + 2]):
                    merged_entry.extend(pending_entries[index + 2])
                    repaired_entries.append(merged_entry)
                    index += 3
                    continue
                repaired_entries.append(merged_entry)
                index += 2
                continue
            if (
                index + 2 < len(pending_entries)
                and _is_single_role_fragment(next_entry)
                and _is_single_company_location_fragment(pending_entries[index + 2])
            ):
                merged_entry = [next_entry[0], joined_date]
                compound_company_location = _split_company_location_line(pending_entries[index + 2][0])
                if compound_company_location:
                    inferred_company, inferred_location = compound_company_location
                    merged_entry.append(inferred_company)
                    if inferred_location:
                        merged_entry.append(inferred_location)
                else:
                    merged_entry.append(pending_entries[index + 2][0])
                if index + 3 < len(pending_entries) and _is_single_narrative_bullet_entry(pending_entries[index + 3]):
                    merged_entry.extend(pending_entries[index + 3])
                    repaired_entries.append(merged_entry)
                    index += 4
                    continue
                repaired_entries.append(merged_entry)
                index += 3
                continue
            if (
                index + 2 < len(pending_entries)
                and _is_single_role_fragment(next_entry)
                and pending_entries[index + 2]
                and _split_company_location_line(pending_entries[index + 2][0]) is not None
            ):
                merged_entry = [next_entry[0], joined_date]
                compound_company_location = _split_company_location_line(pending_entries[index + 2][0])
                if compound_company_location:
                    inferred_company, inferred_location = compound_company_location
                    merged_entry.append(inferred_company)
                    if inferred_location:
                        merged_entry.append(inferred_location)
                else:
                    merged_entry.append(pending_entries[index + 2][0])
                merged_entry.extend(pending_entries[index + 2][1:])
                repaired_entries.append(merged_entry)
                index += 3
                continue
        if (
            _is_single_role_fragment(current_entry)
            and index + 2 < len(pending_entries)
            and _is_single_company_location_fragment(pending_entries[index + 1])
            and _is_single_date_fragment(pending_entries[index + 2])
        ):
            merged_entry = [
                current_entry[0],
                pending_entries[index + 1][0],
                pending_entries[index + 2][0],
            ]
            if index + 3 < len(pending_entries):
                reason_fragment = pending_entries[index + 3]
                if reason_fragment:
                    reason_line = strip_leading_markdown_heading(reason_fragment[0]).strip()
                    if _starts_with_reason_for_leaving(reason_line):
                        merged_entry.append(reason_fragment[0])
                        remainder = reason_fragment[1:]
                        repaired_entries.append(merged_entry)
                        if remainder:
                            pending_entries[index + 3] = remainder
                            index += 3
                        else:
                            index += 4
                        continue
            repaired_entries.append(merged_entry)
            index += 3
            continue
        if (
            _entry_starts_with_role_and_company_fragment(current_entry)
            and index + 1 < len(pending_entries)
            and _is_single_narrative_bullet_entry(pending_entries[index + 1])
        ):
            next_line = strip_leading_markdown_heading(pending_entries[index + 1][0]).strip()
            repaired_entries.append([*current_entry, next_line])
            index += 2
            continue
        if len(current_entry) == 1 and index + 1 < len(pending_entries):
            role_line = strip_leading_markdown_heading(current_entry[0]).strip()
            next_first = strip_leading_markdown_heading(pending_entries[index + 1][0]).strip()
            if (
                role_line
                and next_first
                and (_contains_role_keyword(role_line) or _is_role_phrase(role_line))
                and _contains_org_keyword(next_first)
            ):
                repaired_entries.append([current_entry[0], *pending_entries[index + 1]])
                index += 2
                continue
        repaired_entries.append(current_entry)
        index += 1
    return repaired_entries


def _extract_embedded_role_company_segments(line: str) -> Optional[Tuple[str, str, str]]:
    cleaned = collapse_spaced_caps(_strip_bullet_prefix(line).strip())
    if not cleaned or _match_role_company_line([cleaned]):
        return None
    words = cleaned.split()
    if len(words) < 8:
        return None
    for start in range(1, len(words) - 4):
        if not words[start][:1].isupper():
            continue
        prefix = " ".join(words[:start]).strip()
        if len(prefix.split()) < 4:
            continue
        if _looks_like_contact_or_heading(prefix) or _looks_like_header_residue(prefix):
            continue
        if _match_role_company_line([prefix]) or _looks_like_entry_header_line(prefix):
            continue
        for end in range(min(len(words), start + 12), start + 3, -1):
            header = " ".join(words[start:end]).strip(" ,")
            suffix = " ".join(words[end:]).strip()
            if len(suffix.split()) < 3:
                continue
            if not (suffix[:1].isupper() or suffix[:1].isdigit()):
                continue
            if _normalize_location_candidate(suffix) or looks_addressish(suffix):
                continue
            match = _match_role_company_line([header])
            if not match:
                continue
            role, _company, _location, _index = match
            if len(role.split()) > 6 or _starts_with_verb_phrase(role):
                continue
            if not (_contains_role_keyword(role) or _is_role_phrase(role)):
                continue
            return prefix, header, suffix
    return None


def _split_merged_experience_entry(entry_lines: List[str]) -> List[List[str]]:
    if len(entry_lines) < 3:
        return [entry_lines]
    for idx in range(1, len(entry_lines) - 1):
        next_line = collapse_spaced_caps(_strip_bullet_prefix(entry_lines[idx + 1]).strip())
        if not re.search(DATE_PATTERN, next_line):
            continue
        split_segments = _extract_embedded_role_company_segments(entry_lines[idx])
        if not split_segments:
            continue
        prefix, header, suffix = split_segments
        first_entry = [line for line in [*entry_lines[:idx], prefix] if line.strip()]
        second_entry = [line for line in [header, suffix, *entry_lines[idx + 1 :]] if line.strip()]
        if first_entry and second_entry:
            return [first_entry, second_entry]
    return [entry_lines]


def _find_company_candidate(lines: List[str]) -> Optional[str]:
    cleaned_lines = [_strip_bullet_prefix(line) for line in lines if _strip_bullet_prefix(line)]
    header_reject = {"curriculum vitae", "curriculum", "cv", "resume"}
    for line in cleaned_lines:
        if _starts_with_reason_for_leaving(line):
            continue
        compound_company_location = _split_company_location_line(line)
        if compound_company_location:
            company, _location = compound_company_location
            return company
        if (
            _contains_org_keyword(line)
            and not _is_role_phrase(line)
            and not _starts_with_verb_phrase(line)
            and not PHONE_EMAIL_URL_RE.search(line)
            and not looks_addressish(line)
        ):
            return line
        if _looks_like_contact_or_heading(line):
            continue
        if looks_addressish(line):
            continue
        if "{" in line or "[" in line:
            continue
        line_lower = line.lower().strip(" :")
        if line_lower in header_reject or ("curriculum" in line_lower and "vitae" in line_lower):
            continue
        if _is_role_phrase(line):
            continue
        if VERB_START_RE.match(line_lower):
            continue
        if re.match(r"^[a-z]+ing\b", line_lower):
            continue
        if _starts_with_verb_phrase(line):
            continue
        if PHONE_EMAIL_URL_RE.search(line):
            continue
        if _contains_org_keyword(line):
            return line
    for line in cleaned_lines:
        if _starts_with_reason_for_leaving(line):
            continue
        if _looks_like_contact_or_heading(line):
            continue
        if looks_addressish(line):
            continue
        if "{" in line or "[" in line:
            continue
        line_lower = line.lower().strip(" :")
        if line_lower in header_reject or ("curriculum" in line_lower and "vitae" in line_lower):
            continue
        if _is_role_phrase(line):
            continue
        if VERB_START_RE.match(line_lower):
            continue
        if re.match(r"^[a-z]+ing\b", line_lower):
            continue
        if _starts_with_verb_phrase(line):
            continue
        if any(char.isdigit() for char in line):
            continue
        if PHONE_EMAIL_URL_RE.search(line):
            continue
        tokens = [token for token in re.split(r"[,\\s]+", line) if token]
        if len(tokens) >= 2:
            return line
    for line in cleaned_lines:
        if _starts_with_reason_for_leaving(line):
            continue
        if _looks_like_contact_or_heading(line):
            continue
        if looks_addressish(line):
            continue
        if _is_role_phrase(line):
            continue
        if _starts_with_verb_phrase(line):
            continue
        if len(line.split()) >= 6 and re.search(r"[.!?]$", line):
            continue
        if PHONE_EMAIL_URL_RE.search(line):
            continue
        return line
    return None


def _find_position_candidate(lines: List[str]) -> Optional[str]:
    for line in lines:
        cleaned = _strip_bullet_prefix(line)
        if not cleaned:
            continue
        if _normalize_location_candidate(cleaned):
            continue
        if _contains_role_keyword(cleaned):
            return _normalize_role_phrase(cleaned)
        if cleaned.isupper() and _contains_role_keyword(cleaned.lower()):
            return _normalize_role_phrase(cleaned)
    return None


def _parse_dates(text: str) -> Tuple[Optional[str], Optional[str], Optional[bool]]:
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    text = re.sub(
        r"(\b[A-Za-zÁÉÍÓÚÄËÏÖÜáéíóúäëïöü\.]{3,10}\.? \d{4})\s+1\s+(Present|Current|Actual|Presente)",
        r"\1 — \2",
        text,
        flags=re.IGNORECASE,
    )
    months = list(DATE_PATTERN.finditer(text))
    years = list(YEAR_PATTERN.finditer(text))
    is_current = None
    normalized_lower = strip_accents(text).lower()
    if any(term in normalized_lower for term in PRESENT_TOKENS):
        is_current = True

    start_date: Optional[str] = None
    end_date: Optional[str] = None

    if not months and not years:
        return None, None, is_current

    if months:
        first = months[0]
        start_month = _month_from_token(first.group(1)) or 1
        start_date = f"{first.group(2)}-{start_month:02d}-01"
        if len(months) > 1:
            for candidate in reversed(months):
                month_val = _month_from_token(candidate.group(1))
                if month_val:
                    end_date = f"{candidate.group(2)}-{month_val:02d}-01"
                    break
    elif years:
        start_date = f"{years[0].group(0)}-01-01"
        if len(years) > 1:
            end_date = f"{years[-1].group(0)}-01-01"

    if not end_date and years and len(years) > 1:
        end_date = f"{years[-1].group(0)}-01-01"

    return start_date, end_date if not is_current else None, is_current


def _entry_has_text_pdf_experience_coherence(entry: Dict[str, object]) -> bool:
    company = _strip_bullet_prefix(str(entry.get("company") or "")).strip()
    position = _strip_bullet_prefix(str(entry.get("position") or "")).strip()
    bullets = [str(item or "").strip() for item in entry.get("responsibilityBullets") or [] if str(item or "").strip()]
    start_date = entry.get("startDate")
    end_date = entry.get("endDate")
    is_current = entry.get("isCurrent")

    if not company or company.lower() == "experience":
        return False
    if _looks_like_contact_or_heading(company):
        return False
    if _starts_with_verb_phrase(company):
        return False
    lowered_company = strip_accents(company.lower()).strip(" :")
    if lowered_company in SECTION_NAME_BLOCKLIST:
        return False
    if lowered_company in {"curriculum vitae", "curriculum", "resume", "cv"}:
        return False
    if position and position.lower() == company.lower():
        return False
    if len(company.split()) >= 10:
        return False
    if re.search(DATE_PATTERN, company):
        return False
    if company.isupper() and len(company.split()) <= 4 and not (_contains_org_keyword(company) or position):
        return False
    if position and (_contains_role_keyword(position) or _is_role_phrase(position) or _is_single_role_fragment([position])):
        return True
    if start_date and (end_date or is_current or bullets):
        return True
    if _contains_org_keyword(company) and bullets:
        return True
    return False


def _infer_experience_block_from_text_pdf(raw_text: str) -> Optional[str]:
    lines = [_normalize_structural_line(line) for line in (raw_text or "").replace("\r", "").split("\n")]
    lines = [line for line in lines if line]
    if not lines:
        return None

    start_index: Optional[int] = None
    seeded_lines: List[str] = []
    for idx, line in enumerate(lines):
        match = TEXT_PDF_EXPERIENCE_HEADING_RE.search(strip_accents(line))
        if not match:
            continue
        start_index = idx
        trailing = line[match.end() :].strip(" :-|\t")
        if trailing:
            seeded_lines.append(trailing)
        break
    if start_index is None:
        return None

    collected: List[str] = list(seeded_lines)
    in_sidebar = False
    for line in lines[start_index + 1 :]:
        ascii_line = strip_accents(line)
        if TEXT_PDF_EXPERIENCE_HARD_STOP_RE.match(ascii_line):
            break
        if TEXT_PDF_EXPERIENCE_SIDEBAR_RE.match(ascii_line):
            in_sidebar = True
            continue
        looks_like_resume_content = bool(
            _looks_like_entry_header_line(line)
            or re.search(DATE_PATTERN, line)
            or line.lstrip().startswith(("•", "-", "*"))
            or _contains_role_keyword(line)
        )
        if in_sidebar and not looks_like_resume_content:
            continue
        if in_sidebar and looks_like_resume_content:
            in_sidebar = False
        collected.append(line)

    block = "\n".join(line for line in collected if line).strip()
    return block or None


def _is_noise_line(text: str) -> bool:
    candidate = (text or "").strip()
    if not candidate:
        return True
    if PHONE_EMAIL_URL_RE.search(candidate) or EMAIL_RE.search(candidate) or PHONE_RE.search(candidate):
        return True
    if looks_addressish(candidate):
        return True
    if detect_heading(candidate):
        return True
    if len(candidate) <= 4:
        return True
    return False


def _dedupe_experience_bullets(bullets: Sequence[str]) -> List[str]:
    deduped: List[str] = []
    seen_signatures: List[str] = []
    for bullet in bullets:
        cleaned = _normalize_punctuation_spacing((bullet or "").strip())
        if not cleaned:
            continue
        signature = strip_accents(cleaned.lower())
        signature = re.sub(r"[^a-z0-9]+", " ", signature)
        signature = re.sub(r"\s+", " ", signature).strip()
        if not signature:
            continue
        duplicate = False
        for seen in seen_signatures:
            if signature == seen:
                duplicate = True
                break
            smaller = min(len(signature), len(seen))
            larger = max(len(signature), len(seen))
            if smaller >= 32 and smaller / larger >= 0.85 and (signature in seen or seen in signature):
                duplicate = True
                break
        if duplicate:
            continue
        seen_signatures.append(signature)
        deduped.append(cleaned)
    return deduped


def _split_compound_responsibility_bullet(text: str) -> List[str]:
    cleaned = _normalize_punctuation_spacing((text or "").strip())
    if not cleaned:
        return []
    if len(cleaned) < 80:
        return [cleaned]

    split_points: List[int] = []
    for match in re.finditer(r"\b([A-Z][a-z]+)\b", cleaned):
        start = match.start()
        if start == 0:
            continue
        token = match.group(1).lower()
        if token not in RESPONSIBILITY_CLAUSE_STARTS:
            continue
        prefix = cleaned[(split_points[-1] if split_points else 0):start].strip()
        suffix = cleaned[start:].strip()
        if len(prefix) < 24 or len(suffix) < 24:
            continue
        if len(prefix.split()) < 4 or len(suffix.split()) < 3:
            continue
        split_points.append(start)

    if not split_points:
        return [cleaned]

    parts: List[str] = []
    cursor = 0
    for point in split_points:
        part = cleaned[cursor:point].strip(" -–—;,")
        if part:
            parts.append(_normalize_punctuation_spacing(part))
        cursor = point
    tail = cleaned[cursor:].strip(" -–—;,")
    if tail:
        parts.append(_normalize_punctuation_spacing(tail))

    return parts or [cleaned]


def _normalize_experience_line_signature(value: Optional[str]) -> str:
    cleaned = collapse_spaced_caps(_strip_bullet_prefix(value or "").strip())
    if not cleaned:
        return ""
    normalized = strip_accents(cleaned.lower())
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _looks_like_educationish_experience_line(line: str) -> bool:
    cleaned = collapse_spaced_caps(_strip_bullet_prefix(line).strip())
    if not cleaned:
        return False
    lowered = strip_accents(cleaned.lower()).strip(" :")
    if lowered.startswith(("relevant coursework", "coursework", "dean's list", "gpa", "cgpa")):
        return True
    if (
        _contains_org_keyword(cleaned)
        and not _contains_role_keyword(cleaned)
        and not re.search(DATE_PATTERN, cleaned)
        and not _starts_with_verb_phrase(cleaned)
        and len(cleaned.split()) <= 6
    ):
        return True
    return False


def _keep_experience_content_line(
    line: str,
    *,
    company: Optional[str],
    position: Optional[str],
    location: Optional[str],
    structural_signatures: Sequence[str],
) -> bool:
    cleaned = collapse_spaced_caps(_strip_bullet_prefix(line).strip())
    if not cleaned:
        return False
    signature = _normalize_experience_line_signature(cleaned)
    if not signature:
        return False
    if signature in structural_signatures:
        return False
    for candidate in (company, position, location):
        if signature and signature == _normalize_experience_line_signature(candidate):
            return False
    if _looks_like_educationish_experience_line(cleaned):
        return False
    if re.search(DATE_PATTERN, cleaned) and len(cleaned.split()) <= 8 and not _starts_with_verb_phrase(cleaned):
        return False
    return True


def _entry_has_minimal_experience_coherence(
    *,
    company: str,
    position: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
    is_current: Optional[bool],
    bullets: Sequence[str],
) -> bool:
    normalized_company = _strip_bullet_prefix(company).strip()
    if not normalized_company or normalized_company.lower() == "experience":
        return False
    lowered_company = strip_accents(normalized_company.lower()).strip(" :")
    if lowered_company in SECTION_NAME_BLOCKLIST:
        return False
    if lowered_company in {"curriculum vitae", "curriculum", "resume", "cv"}:
        return False
    if PHONE_EMAIL_URL_RE.search(normalized_company):
        return False
    if looks_addressish(normalized_company):
        return False
    if not bullets:
        return False
    if position and (_contains_role_keyword(position) or _is_role_phrase(position) or _is_single_role_fragment([position])):
        return True
    if start_date and (end_date or is_current):
        return True
    return False


def _parse_worked_in_narrative_line(line: str) -> Optional[Dict[str, object]]:
    cleaned = collapse_spaced_caps(_strip_bullet_prefix(line).strip())
    if not cleaned:
        return None
    if not re.search(r"\bwork(?:ed|ing)\s+in\b", cleaned, re.IGNORECASE):
        return None
    if not re.search(r"\bas\s+an?\b", cleaned, re.IGNORECASE):
        return None

    match = NARRATIVE_WORKED_IN_RE.match(cleaned)
    if not match:
        return None

    company = collapse_spaced_caps((match.group("company") or "").strip(" ,.;:-"))
    role = collapse_spaced_caps((match.group("role") or "").strip(" ,.;:-"))

    if not company or not role:
        return None

    role = re.split(r"\b(?:and\s+posted|posted|from)\b", role, maxsplit=1, flags=re.IGNORECASE)[0].strip(" ,.;:-")
    role = _normalize_role_phrase(role)
    if not role or not (_contains_role_keyword(role) or _is_role_phrase(role) or _is_single_role_fragment([role])):
        return None

    lowered_company = strip_accents(company.lower()).strip(" :")
    if not lowered_company:
        return None
    if _looks_like_contact_or_heading(company):
        return None
    if looks_addressish(company):
        return None
    if PHONE_EMAIL_URL_RE.search(company):
        return None
    if _starts_with_verb_phrase(company):
        return None
    if VERB_START_RE.match(lowered_company):
        return None
    if re.match(r"^[a-z]+ing\b", lowered_company):
        return None
    if re.search(r"[.!?]", company):
        return None
    if lowered_company in SECTION_NAME_BLOCKLIST:
        return None
    if lowered_company in {"curriculum vitae", "curriculum", "resume", "cv"}:
        return None
    if lowered_company.endswith("third party roll"):
        return None
    if len(company.split()) > 6 and not _contains_org_keyword(company):
        return None

    start_date, end_date, is_current = _parse_dates(cleaned)
    bullet = cleaned.strip()
    bullets = [bullet] if bullet and not _is_noise_line(bullet) else []
    if not _entry_has_minimal_experience_coherence(
        company=company,
        position=role,
        start_date=start_date,
        end_date=end_date,
        is_current=is_current,
        bullets=bullets,
    ):
        return None

    return {
        "id": make_id("exp"),
        "company": company,
        "position": role,
        "startDate": start_date,
        "endDate": None if is_current else end_date,
        "isCurrent": is_current,
        "location": None,
        "summary": None,
        "responsibilities": "\n".join(bullets),
        "responsibilityBullets": bullets,
        "achievements": [],
    }


def _score_worked_in_narrative_line(line: str) -> int:
    cleaned = collapse_spaced_caps(_strip_bullet_prefix(line).strip())
    lowered = strip_accents(cleaned.lower())
    score = 0
    if re.search(r"\b(?:presently|currently)\s+working\b", lowered):
        score += 5
    if re.search(r"\bfrom\b.*\b(?:to\s+till\s+date|till\s+date|till\s+now|present)\b", lowered):
        score += 4
    elif re.search(r"\b(?:to\s+till\s+date|till\s+date|till\s+now|present)\b", lowered):
        score += 3
    if re.search(DATE_PATTERN, cleaned):
        score += 1
    if re.match(
        r"^\s*(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+\w+\s+)?worked\s+in\b",
        lowered,
    ):
        score -= 3
    return score


def _refine_worked_in_narrative_candidate(
    candidate: Dict[str, object],
    line: str,
) -> Dict[str, object]:
    cleaned = collapse_spaced_caps(_strip_bullet_prefix(line).strip())
    refined = dict(candidate)
    position = str(refined.get("position") or "").strip()
    if not cleaned or not position:
        return refined

    role_with_in_match = re.search(
        r"\bas\s+an?\s+(?P<role>.+?)\s+in\s+(?P<tail>[^.]+?)(?:\.\s*from\b|\s+from\b|$)",
        cleaned,
        re.IGNORECASE,
    )
    if role_with_in_match:
        refined_role = _normalize_role_phrase(role_with_in_match.group("role") or "")
        tail = collapse_spaced_caps((role_with_in_match.group("tail") or "").strip(" ,.;:-"))
        if refined_role and tail and not _contains_role_keyword(tail):
            if (
                _normalize_location_candidate(tail)
                or looks_addressish(tail)
                or (
                    len(tail.split()) <= 4
                    and all(token[:1].isupper() for token in tail.split() if token[:1].isalnum())
                )
            ):
                refined["position"] = refined_role
                return refined

    role_before_site_match = re.search(
        r"\bas\s+an?\s+(?P<role>.+?)(?:\s+and\s+posted\b|\s+posted\b|\s+from\b|\s+till\s+date\b|\s+to\s+till\s+date\b|\s+till\s+now\b)",
        cleaned,
        re.IGNORECASE,
    )
    if role_before_site_match:
        refined_role = _normalize_role_phrase(role_before_site_match.group("role") or "")
        if refined_role:
            refined["position"] = refined_role
        return refined

    return refined


def _extract_bullets(lines: List[str], skip: Sequence[str]) -> List[str]:
    bullets: List[str] = []
    skip_set = {(_strip_bullet_prefix(item) or "").lower() for item in skip if item}
    junk_singletons = {
        "resume templates",
        "build this template",
        "pinterest",
        "linkedin",
        "links",
        "hobbies",
        "skills",
        "full",
        "o",
    }

    def should_skip(text: str) -> bool:
        if PHONE_EMAIL_URL_RE.search(text or ""):
            return True
        lower_text = (text or "").lower().strip()
        if lower_text in junk_singletons:
            return True
        if "{" in (text or "") or "[" in (text or ""):
            return True
        base = lower_text.strip(" -–—")
        return base in SOCIAL_TOKENS

    # Join wrapped lines when likely a continuation (starts lowercase or common connectors)
    connectors = re.compile(r"^(and|or|including|utilizing|leveraging|ensuring|monitoring|logging|maintaining|apprehending|providing|coordinating|managing|supporting)\b", re.IGNORECASE)
    pending: Optional[str] = None
    def _push_pending():
        nonlocal pending
        if pending is not None and pending.strip():
            bullets.append(pending.strip())
        pending = None

    for line in lines:
        cleaned = _strip_bullet_prefix(_scrub_glyphs(line))
        if not cleaned or cleaned.lower() in skip_set:
            continue
        if _looks_like_contact_or_heading(cleaned):
            continue
        if should_skip(cleaned):
            continue
        if detect_heading(cleaned):
            continue
        if _normalize_location_candidate(cleaned):
            continue
        if looks_addressish(cleaned):
            continue
        cleaned = _normalize_punctuation_spacing(cleaned.strip(" -–—\u2022•"))
        if not cleaned:
            continue
        # Continuation join: if starts with lowercase or connector, merge into pending
        if pending is not None and (cleaned[:1].islower() or connectors.match(cleaned)):
            pending = _normalize_punctuation_spacing(f"{pending} {cleaned}")
            continue
        parts = [
            part.strip()
            for part in BULLET_SPLIT_RE.split(cleaned)
            if part.strip()
            and not should_skip(part.strip())
            and not detect_heading(part.strip())
            and not looks_addressish(part.strip())
        ]
        if parts:
            for idx, part in enumerate(parts):
                if pending is not None and (part[:1].islower() or connectors.match(part)):
                    pending = _normalize_punctuation_spacing(f"{pending} {part}")
                else:
                    _push_pending()
                    pending = part
        else:
            if pending is None:
                pending = cleaned
            else:
                pending = _normalize_punctuation_spacing(f"{pending} {cleaned}")
    _push_pending()
    segmented_bullets: List[str] = []
    for bullet in bullets:
        segmented_bullets.extend(_split_compound_responsibility_bullet(bullet))
    bullets = segmented_bullets
    deduped: List[str] = []
    seen = set()
    for bullet in bullets:
        normalized = _normalize_punctuation_spacing(bullet).lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(_normalize_punctuation_spacing(bullet.rstrip(".")))
    filtered: List[str] = []
    for bullet in deduped:
        trimmed = bullet.strip(" -–—\u2022•").strip()
        if not trimmed:
            continue
        lower_trim = trimmed.lower()
        if lower_trim in junk_singletons:
            continue
        if lower_trim in BULLET_STOPWORDS and len(trimmed.split()) == 1:
            continue
        if "{" in trimmed or "[" in trimmed:
            continue
        if looks_addressish(trimmed):
            continue
        if _is_noise_line(trimmed):
            continue
        filtered.append(trimmed)
    if skip_set:
        filtered = [bullet for bullet in filtered if bullet.lower() not in skip_set]
    return filtered


def _engine_selection(diagnostics: Optional[Dict[str, object]], text: str) -> Dict[str, object]:
    diag = dict(diagnostics) if isinstance(diagnostics, dict) else {}
    pages = 0
    for key in ("pages", "pdf_pages_rendered", "pdf_pages"):
        try:
            value = int(diag.get(key)) if diag.get(key) is not None else 0
            if value and value > pages:
                pages = value
        except Exception:
            continue
    pages = pages or 1
    ocr_chars = 0
    try:
        ocr_chars = int(diag.get("ocr_chars") or 0)
    except Exception:
        ocr_chars = 0
    total_chars = max(len(text or ""), ocr_chars)
    min_chars = _env_int(NATIVE_MIN_CHARS_ENV, DEFAULT_NATIVE_MIN_CHARS)
    min_density = _env_float(NATIVE_MIN_DENSITY_ENV, DEFAULT_NATIVE_MIN_DENSITY)
    density = (total_chars / pages) / 1000.0 if pages else 0.0  # scale to per-1000 for readability
    reasons: List[str] = []
    native = False
    engine_lower = str(diag.get("engine") or "").lower()
    mode_hint = "text" if engine_lower in {"text", "pdfplumber", "pypdfium2"} else "ocr"
    if total_chars >= min_chars:
        native = True
        reasons.append(f"chars>={min_chars}")
    avg_density = (total_chars / max(pages, 1)) if pages else 0.0
    # Compare against 0.15 threshold (characters per pixel is not available; use per-page heuristic)
    if avg_density >= (min_density * 1000):
        native = True
        reasons.append(f"density>={min_density}")
    if engine_lower in {"text", "pdfplumber", "pypdfium2"}:
        native = True
        reasons.append(f"engine={engine_lower}")
    decision = {"engine": "native" if native else "ocr", "reasons": reasons or [f"mode={mode_hint}"]}
    diag["engine_selection"] = decision
    return diag


def _reorder_text_with_columns(raw_text: str, diagnostics: Optional[Dict[str, object]]) -> Tuple[str, str]:
    blocks: List[Dict[str, Any]] = []
    diag = diagnostics if isinstance(diagnostics, dict) else {}
    # Accept either diagnostics.layout.blocks or diagnostics.layout_blocks
    layout = diag.get("layout") if isinstance(diag, dict) else None
    if isinstance(layout, dict) and isinstance(layout.get("blocks"), list):
        for b in layout.get("blocks") or []:
            if isinstance(b, dict) and isinstance(b.get("bbox"), (list, tuple)):
                blocks.append(b)
    elif isinstance(diag.get("layout_blocks"), list):
        for b in diag.get("layout_blocks") or []:
            if isinstance(b, dict) and isinstance(b.get("bbox"), (list, tuple)):
                blocks.append(b)
    if not blocks:
        return raw_text, "single"
    # Compute split by median x0
    xs = []
    rows: List[Tuple[float, float, str]] = []  # (x0, y0, text)
    for b in blocks:
        try:
            x0, y0, _, _ = b.get("bbox")  # type: ignore[index]
            text = str(b.get("text") or "").strip()
            if not text:
                continue
            xs.append(float(x0))
            rows.append((float(x0), float(y0), text))
        except Exception:
            continue
    if not rows:
        return raw_text, "single"
    xs_sorted = sorted(xs)
    median_x0 = xs_sorted[len(xs_sorted) // 2]
    # Unimodal fallback: check spread
    spread = (xs_sorted[-1] - xs_sorted[0]) if len(xs_sorted) > 1 else 0.0
    if spread < 50:  # in normalized 0-1000 space
        return raw_text, "single"
    left: List[Tuple[float, float, str]] = []
    right: List[Tuple[float, float, str]] = []
    for r in rows:
        (left if r[0] <= median_x0 else right).append(r)
    left_sorted = sorted(left, key=lambda t: (t[1], t[0]))
    right_sorted = sorted(right, key=lambda t: (t[1], t[0]))
    ordered = [text for *_xy, text in left_sorted] + [text for *_xy, text in right_sorted]
    merged = "\n".join(ordered).strip()
    return (merged or raw_text), ("two-column" if left and right else "single")


MARKDOWN_TABLE_SEPARATOR_ONLY_RE = re.compile(r"^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$")


def _split_markdown_pipe_row(line: str) -> Optional[List[str]]:
    stripped = line.strip()
    if not stripped.startswith("|") or "|" not in stripped[1:]:
        return None
    parts = [collapse_spaced_caps(_scrub_glyphs(cell.strip())) for cell in stripped.strip("|").split("|")]
    if len(parts) < 2:
        return None
    return parts


def _normalize_table_header_name(value: str) -> str:
    normalized = strip_accents(value or "").lower()
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return TOKEN_SANITIZE_RE.sub(" ", normalized).strip()


def _parse_markdown_table(block: str) -> Optional[Dict[str, object]]:
    raw_lines = [line.rstrip() for line in (block or "").splitlines() if line.strip()]
    for index in range(len(raw_lines) - 2):
        header_cells = _split_markdown_pipe_row(raw_lines[index])
        if not header_cells:
            continue
        separator_line = raw_lines[index + 1]
        if not MARKDOWN_TABLE_SEPARATOR_ONLY_RE.match(separator_line.strip()):
            continue
        rows: List[List[str]] = []
        cursor = index + 2
        while cursor < len(raw_lines):
            row_cells = _split_markdown_pipe_row(raw_lines[cursor])
            if not row_cells:
                break
            if len(row_cells) != len(header_cells):
                break
            rows.append(row_cells)
            cursor += 1
        if rows:
            return {
                "headers": header_cells,
                "normalized_headers": [_normalize_table_header_name(cell) for cell in header_cells],
                "rows": rows,
            }
    return None


def _iter_markdown_tables(block: str) -> List[Dict[str, object]]:
    raw_lines = [line.rstrip() for line in (block or "").splitlines() if line.strip()]
    tables: List[Dict[str, object]] = []
    index = 0
    while index < len(raw_lines) - 2:
        if MARKDOWN_TABLE_SEPARATOR_ONLY_RE.match(raw_lines[index].strip()):
            header_cells = _split_markdown_pipe_row(raw_lines[index + 1])
            if not header_cells:
                index += 1
                continue
            rows: List[List[str]] = []
            cursor = index + 2
            while cursor < len(raw_lines):
                row_cells = _split_markdown_pipe_row(raw_lines[cursor])
                if not row_cells or len(row_cells) != len(header_cells):
                    break
                rows.append(row_cells)
                cursor += 1
            if rows:
                tables.append(
                    {
                        "headers": header_cells,
                        "normalized_headers": [_normalize_table_header_name(cell) for cell in header_cells],
                        "rows": rows,
                        "start_index": index,
                        "end_index": cursor,
                    }
                )
                index = cursor
                continue
            index += 1
            continue
        header_cells = _split_markdown_pipe_row(raw_lines[index])
        if not header_cells:
            index += 1
            continue
        separator_line = raw_lines[index + 1]
        if not MARKDOWN_TABLE_SEPARATOR_ONLY_RE.match(separator_line.strip()):
            index += 1
            continue
        rows: List[List[str]] = []
        cursor = index + 2
        while cursor < len(raw_lines):
            row_cells = _split_markdown_pipe_row(raw_lines[cursor])
            if not row_cells or len(row_cells) != len(header_cells):
                break
            rows.append(row_cells)
            cursor += 1
        if rows:
            tables.append(
                {
                    "headers": header_cells,
                    "normalized_headers": [_normalize_table_header_name(cell) for cell in header_cells],
                    "rows": rows,
                    "start_index": index,
                    "end_index": cursor,
                }
            )
            index = cursor
            continue
        index += 1
    return tables


def _map_experience_table_headers(headers: List[str]) -> Optional[Dict[int, str]]:
    mapping: Dict[int, str] = {}
    for index, header in enumerate(headers):
        if not header:
            continue
        if any(token in header for token in ("organization", "company", "employer", "name of organization")):
            mapping[index] = "company"
        elif any(token in header for token in ("designation", "role", "position", "job title", "title")):
            mapping[index] = "position"
        elif any(token in header for token in ("from", "start")):
            mapping[index] = "start"
        elif any(token in header for token in ("to", "end")):
            mapping[index] = "end"
        elif "duration" in header:
            mapping[index] = "duration"
        elif any(token in header for token in ("city", "country", "location")):
            mapping[index] = "location"
        elif "reason" in header and "leav" in header:
            mapping[index] = "reason"
    has_company = "company" in mapping.values()
    has_position = "position" in mapping.values()
    has_date = "start" in mapping.values() or "end" in mapping.values()
    if has_company and has_position and has_date:
        return mapping
    return None


def _map_education_table_headers(headers: List[str]) -> Optional[Dict[int, str]]:
    mapping: Dict[int, str] = {}
    for index, header in enumerate(headers):
        if not header:
            continue
        if any(token in header for token in ("qualification", "degree", "course", "exam")):
            mapping[index] = "degree"
        elif any(token in header for token in ("institution", "college", "university", "school")):
            mapping[index] = "institution"
        elif "board" in header:
            mapping[index] = "board"
        elif any(token in header for token in ("year of passing", "year", "date", "dates")):
            mapping[index] = "year"
        elif any(token in header for token in ("marks", "percentage", "grade", "gpa")):
            mapping[index] = "score"
    has_degree = "degree" in mapping.values()
    has_school = "institution" in mapping.values() or "board" in mapping.values()
    has_date = "year" in mapping.values()
    if has_degree and has_school and has_date:
        return mapping
    return None


def _score_experience_table(table: Dict[str, object]) -> int:
    headers = list(table.get("normalized_headers") or [])
    mapping = _map_experience_table_headers(headers)
    if not mapping:
        return -1
    score = 0
    values = set(mapping.values())
    if "company" in values:
        score += 4
    if "position" in values:
        score += 4
    if "start" in values:
        score += 3
    if "end" in values:
        score += 3
    if "duration" in values:
        score += 2
    if "location" in values:
        score += 2
    if "reason" in values:
        score += 1
    rows = list(table.get("rows") or [])
    score += min(len(rows), 10)
    return score


def _score_education_table(table: Dict[str, object]) -> int:
    headers = list(table.get("normalized_headers") or [])
    mapping = _map_education_table_headers(headers)
    if not mapping:
        return -1
    score = 0
    values = set(mapping.values())
    if "degree" in values:
        score += 4
    if "institution" in values or "board" in values:
        score += 4
    if "year" in values:
        score += 3
    if "score" in values:
        score += 2
    rows = list(table.get("rows") or [])
    score += min(len(rows), 10)
    return score


def _select_experience_markdown_table(block: str) -> Optional[Dict[str, object]]:
    tables = _iter_markdown_tables(block)
    if not tables:
        return None
    best: Optional[Dict[str, object]] = None
    best_score = -1
    for table in tables:
        score = _score_experience_table(table)
        if score > best_score:
            best = table
            best_score = score
    if best_score < 0:
        return None
    return best


def _select_education_markdown_table(block: str) -> Optional[Dict[str, object]]:
    tables = _iter_markdown_tables(block)
    if not tables:
        return None
    best: Optional[Dict[str, object]] = None
    best_score = -1
    for table in tables:
        score = _score_education_table(table)
        if score > best_score:
            best = table
            best_score = score
    if best_score < 0:
        return None
    return best


def extract_education_markdown_table_region(block: str) -> Optional[str]:
    table = _select_education_markdown_table(block)
    if not table:
        return None
    raw_lines = [line.rstrip() for line in (block or "").splitlines() if line.strip()]
    start_index = int(table.get("start_index", 0))
    end_index = int(table.get("end_index", start_index))
    region = "\n".join(raw_lines[start_index:end_index]).strip()
    return region or None


def _parse_experience_markdown_table(block: str) -> Optional[List[Dict[str, object]]]:
    table = _select_experience_markdown_table(block)
    if not table:
        return None
    header_map = _map_experience_table_headers(table["normalized_headers"])
    if not header_map:
        return None

    rows = table["rows"]
    parsed_entries: List[Dict[str, object]] = []
    for row in rows:
        values = {field: collapse_spaced_caps(_scrub_glyphs(row[idx]).strip()) for idx, field in header_map.items() if idx < len(row)}
        company = values.get("company") or None
        position = values.get("position") or None
        location = values.get("location") or None
        start_raw = values.get("start") or ""
        end_raw = values.get("end") or ""
        duration_raw = values.get("duration") or ""
        reason_raw = values.get("reason") or ""

        if not company or not position:
            continue
        if _looks_like_contact_or_heading(company) or _looks_like_contact_or_heading(position):
            continue
        if PHONE_EMAIL_URL_RE.search(company) or PHONE_EMAIL_URL_RE.search(position):
            continue

        start_date, _, _ = _parse_dates(start_raw)
        _, end_date, is_current = _parse_dates(end_raw)
        if not start_date and not end_date:
            start_date, end_date, is_current = _parse_dates(" ".join(part for part in (start_raw, end_raw, duration_raw) if part))

        bullets: List[str] = []
        if reason_raw and not _is_noise_line(reason_raw):
            bullets.append(f"Reason for leaving: {reason_raw}")

        parsed_entries.append(
            {
                "id": make_id("exp"),
                "company": company,
                "position": _normalize_role_phrase(position).strip(" .") if position else None,
                "startDate": start_date,
                "endDate": None if is_current else end_date,
                "isCurrent": is_current,
                "location": location,
                "summary": None,
                "responsibilities": "\n".join(bullets),
                "responsibilityBullets": bullets,
                "achievements": [],
            }
        )

    if len(parsed_entries) < 2:
        return None
    return parsed_entries


def _fallback_experience_entry_from_table_text(block: str) -> List[Dict[str, object]]:
    cleaned_lines = []
    for line in (block or "").splitlines():
        stripped = line.strip()
        if not stripped or MARKDOWN_TABLE_SEPARATOR_ONLY_RE.match(stripped):
            continue
        cleaned_lines.append(_normalize_structural_line(stripped))
    cleaned_lines = [line for line in cleaned_lines if line]
    responsibilities = "\n".join(cleaned_lines)
    return [
        {
            "id": make_id("exp"),
            "company": "Experience",
            "position": None,
            "startDate": None,
            "endDate": None,
            "isCurrent": None,
            "location": None,
            "summary": None,
            "responsibilities": responsibilities,
            "responsibilityBullets": [responsibilities] if responsibilities else [],
            "achievements": [],
        }
    ]


MATRIX_HEADER_PHRASES = (
    "name of organization",
    "organization",
    "designation",
    "city country",
    "from",
    "to",
    "duration",
    "reason for leaving",
)

MATRIX_HEADER_TOKENS = {
    "name",
    "organization",
    "designation",
    "city",
    "country",
    "from",
    "to",
    "duration",
    "reason",
    "leaving",
}

MATRIX_REASON_TOKENS = {
    "due",
    "layoff",
    "apprentice",
    "over",
    "problem",
    "salary",
    "visa",
    "power",
    "cut",
    "working",
    "currently",
    "current",
}

MATRIX_ROLE_FRAGMENT_TOKENS = {
    "maintenance",
    "plant",
    "work",
    "quality",
    "amc",
    "planner",
    "coordinator",
    "supervisor",
    "inspector",
    "technician",
    "engineer",
    "operator",
}

MATRIX_COUNTRY_TOKENS = {
    "india",
    "uae",
    "france",
    "states",
    "usa",
    "uk",
    "canada",
}

MATRIX_CITY_HINTS = {
    "coimbatore",
    "trichy",
    "dubai",
}

SLASH_DATE_RE = re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-](?:19|20)\d{2}\b")


def _normalize_matrix_fragment(value: str) -> str:
    return collapse_spaced_caps(_normalize_structural_line(_scrub_glyphs(_strip_bullet_prefix(value or ""))).strip())


def _matrix_fragment_tokens(value: str) -> List[str]:
    normalized = strip_accents((value or "").lower())
    return [token for token in re.split(r"[^a-z0-9]+", normalized) if token]


def _is_matrix_header_fragment(line: str) -> bool:
    tokens = _matrix_fragment_tokens(line)
    if not tokens:
        return False
    joined = " ".join(tokens)
    for phrase in MATRIX_HEADER_PHRASES:
        phrase_tokens = phrase.split()
        if len(phrase_tokens) == 1:
            if joined == phrase:
                return True
        elif re.search(rf"\b{re.escape(phrase)}\b", joined):
            return True
    meaningful = [token for token in tokens if token not in {"9", "0"}]
    if meaningful and all(token in MATRIX_HEADER_TOKENS for token in meaningful):
        return True
    return False


def _looks_like_short_ocr_fragment(line: str) -> bool:
    tokens = [token for token in line.split() if token]
    if not tokens:
        return False
    return len(tokens) <= 4 and len(line) <= 32


def _contains_matrix_role_signal(value: str) -> bool:
    tokens = _matrix_fragment_tokens(value)
    return any(token in MATRIX_ROLE_FRAGMENT_TOKENS for token in tokens) or _contains_role_keyword(value)


def _is_long_narrative_line(line: str) -> bool:
    stripped = (line or "").strip()
    if not stripped:
        return False
    lowered = strip_accents(stripped.lower())
    if lowered.startswith("nature of work"):
        return True
    if len(stripped.split()) >= 8:
        return True
    if len(stripped) >= 65:
        return True
    return False


def _extract_matrix_date_anchors(lines: Sequence[str]) -> List[int]:
    anchors: List[int] = []
    for idx, line in enumerate(lines):
        slash_dates = SLASH_DATE_RE.findall(line)
        year_count = len(YEAR_PATTERN.findall(line))
        lowered = strip_accents(line.lower())
        has_present = any(term in lowered for term in PRESENT_TOKENS)
        if len(slash_dates) >= 2 or year_count >= 2 or ((slash_dates or year_count) and has_present):
            anchors.append(idx)
    return anchors


def _looks_like_experience_matrix_block(lines: Sequence[str], anchors: Sequence[int]) -> bool:
    if len(anchors) < 2:
        return False
    top_region = lines[: min(len(lines), max(anchors[0] + 1, 18))]
    joined_top = " ".join(strip_accents(line.lower()) for line in top_region)
    cue_hits = 0
    if "name of" in joined_top and "organization" in joined_top:
        cue_hits += 1
    if "designation" in joined_top:
        cue_hits += 1
    if "city" in joined_top and "country" in joined_top:
        cue_hits += 1
    if re.search(r"\bfrom\b", joined_top):
        cue_hits += 1
    if re.search(r"\bto\b", joined_top):
        cue_hits += 1
    if "duration" in joined_top:
        cue_hits += 1
    if "reason" in joined_top and "leaving" in joined_top:
        cue_hits += 1
    if cue_hits < 2:
        return False

    region_start = max(0, anchors[0] - 6)
    region_end = min(len(lines), anchors[-1] + 7)
    region = [line for line in lines[region_start:region_end] if line.strip()]
    non_header_region = [line for line in region if not _is_matrix_header_fragment(line)]
    short_fragments = [line for line in non_header_region if _looks_like_short_ocr_fragment(line)]
    if len(short_fragments) < 6:
        return False
    if len(short_fragments) < max(6, int(len(non_header_region) * 0.6)):
        return False
    return True


def _classify_matrix_fragment(line: str) -> str:
    normalized = _normalize_matrix_fragment(line)
    lower = strip_accents(normalized.lower())
    tokens = _matrix_fragment_tokens(normalized)
    if not normalized:
        return "skip"
    if _is_matrix_header_fragment(normalized):
        return "header"
    if _is_long_narrative_line(normalized):
        return "narrative"
    if _normalize_location_candidate(normalized):
        return "location"
    if normalized.endswith(",") or any(token in MATRIX_COUNTRY_TOKENS for token in tokens):
        return "location"
    if any(token in MATRIX_ROLE_FRAGMENT_TOKENS for token in tokens):
        return "position"
    if _contains_role_keyword(normalized) or (normalized.isupper() and _contains_role_keyword(lower)):
        return "position"
    if any(token in MATRIX_REASON_TOKENS for token in tokens):
        return "reason"
    if any(token in {"month", "months", "year", "years"} for token in tokens):
        return "duration"
    if _contains_org_keyword(normalized) or re.search(r"[()]", normalized):
        return "company"
    return "company"


def _build_matrix_phrase(parts: Sequence[str]) -> Optional[str]:
    joined = " ".join(part.strip() for part in parts if part and part.strip())
    joined = _normalize_punctuation_spacing(joined)
    return joined or None


def _split_matrix_anchor_line(anchor_line: str) -> Tuple[Optional[str], Optional[str]]:
    cleaned = _normalize_matrix_fragment(anchor_line)
    date_matches = list(SLASH_DATE_RE.finditer(cleaned))
    if not date_matches:
        return cleaned or None, None
    first_match = date_matches[0]
    last_match = date_matches[-1]
    before = cleaned[: first_match.start()].strip(" -–—,;:")
    after = cleaned[last_match.end() :].strip(" -–—,;:")
    return before or None, after or None


def _append_matrix_tokens(target: List[str], value: Optional[str]) -> None:
    normalized = _build_matrix_phrase([value or ""])
    if normalized:
        target.append(normalized)


def _consume_matrix_fragment(
    fragment: str,
    *,
    company_parts: List[str],
    position_parts: List[str],
    location_parts: List[str],
    reason_parts: List[str],
) -> None:
    normalized = _normalize_matrix_fragment(fragment)
    if not normalized or _is_matrix_header_fragment(normalized) or _is_long_narrative_line(normalized):
        return

    if "," in normalized:
        left, right = [part.strip() for part in normalized.split(",", 1)]
        right_tokens = _matrix_fragment_tokens(right)
        left_tokens = left.split()
        if right and any(token in MATRIX_REASON_TOKENS for token in right_tokens):
            if len(left_tokens) >= 2:
                _append_matrix_tokens(company_parts, " ".join(left_tokens[:-1]))
                _append_matrix_tokens(location_parts, left_tokens[-1])
            elif left:
                _append_matrix_tokens(location_parts, left)
            _append_matrix_tokens(reason_parts, right)
            return

    tokens = normalized.split()
    lower_tokens = [strip_accents(token.lower()).strip(".,") for token in tokens]
    if not tokens:
        return

    role_indexes = [idx for idx, token in enumerate(lower_tokens) if token in MATRIX_ROLE_FRAGMENT_TOKENS]
    location_indexes = [idx for idx, token in enumerate(lower_tokens) if token in MATRIX_COUNTRY_TOKENS or token in MATRIX_CITY_HINTS]
    reason_indexes = [idx for idx, token in enumerate(lower_tokens) if token in MATRIX_REASON_TOKENS]

    if role_indexes:
        first_role = role_indexes[0]
        if first_role > 0:
            _append_matrix_tokens(company_parts, " ".join(tokens[:first_role]))
        _append_matrix_tokens(position_parts, " ".join(tokens[first_role:]))
        return

    if location_indexes:
        first_location = location_indexes[0]
        first_reason = reason_indexes[0] if reason_indexes else None
        if first_location > 0:
            _append_matrix_tokens(company_parts, " ".join(tokens[:first_location]))
        if first_reason is not None and first_reason > first_location:
            _append_matrix_tokens(location_parts, " ".join(tokens[first_location:first_reason]))
            _append_matrix_tokens(reason_parts, " ".join(tokens[first_reason:]))
        else:
            _append_matrix_tokens(location_parts, " ".join(tokens[first_location:]))
        return

    if reason_indexes:
        first_reason = reason_indexes[0]
        if first_reason > 0:
            _append_matrix_tokens(company_parts, " ".join(tokens[:first_reason]))
        _append_matrix_tokens(reason_parts, " ".join(tokens[first_reason:]))
        return

    if _normalize_location_candidate(normalized):
        _append_matrix_tokens(location_parts, normalized)
        return

    if any(token in MATRIX_COUNTRY_TOKENS for token in lower_tokens):
        _append_matrix_tokens(location_parts, normalized)
        return

    _append_matrix_tokens(company_parts, normalized)


def _clean_matrix_reason(reason_parts: Sequence[str], anchor_reason: Optional[str]) -> Optional[str]:
    parts = [part.strip() for part in reason_parts if part and part.strip()]
    if anchor_reason:
        parts.insert(0, anchor_reason)
    if not parts:
        return None
    joined = _normalize_punctuation_spacing(" ".join(parts))
    joined = re.sub(r"\bLayoff due to\s+Layoff\b", "Layoff due to", joined, flags=re.IGNORECASE)
    joined = re.sub(r"\bdue to\s+Layoff\b", "Layoff due to", joined, flags=re.IGNORECASE)
    joined = re.sub(r"\bLayoff\s+power\s+cut\b", "Layoff due to power cut", joined, flags=re.IGNORECASE)
    return joined or None


def _extract_anchor_tail_parts(anchor_line: str) -> Tuple[Optional[str], Optional[str]]:
    cleaned = _normalize_matrix_fragment(anchor_line)
    without_dates = SLASH_DATE_RE.sub(" ", cleaned)
    without_dates = YEAR_PATTERN.sub(" ", without_dates)
    without_dates = re.sub(r"\s+", " ", without_dates).strip(" -–—,;:")
    if not without_dates:
        return None, None
    tokens = without_dates.split()
    duration_tokens: List[str] = []
    reason_tokens: List[str] = []
    for token in tokens:
        lowered = strip_accents(token.lower()).strip(".,")
        if lowered in PRESENT_TOKENS or lowered in {"month", "months", "year", "years", "till", "now"} or lowered.isdigit():
            duration_tokens.append(token)
        else:
            reason_tokens.append(token)
    duration = _build_matrix_phrase(duration_tokens)
    reason = _build_matrix_phrase(reason_tokens)
    return duration, reason


def _score_reconstructed_experience_row(row: Dict[str, object]) -> int:
    score = 0
    company = str(row.get("company") or "")
    position = str(row.get("position") or "")
    location = str(row.get("location") or "")
    start_date = row.get("startDate")
    end_date = row.get("endDate")
    is_current = row.get("isCurrent")
    bullets = list(row.get("responsibilityBullets") or [])
    if company and not _looks_like_contact_or_heading(company) and not _is_matrix_header_fragment(company):
        score += 2
    if position and (_contains_matrix_role_signal(position) or _is_role_phrase(position)):
        score += 2
    if location and (_normalize_location_candidate(location) or "," in location):
        score += 1
    if start_date:
        score += 2
    if end_date or is_current:
        score += 1
    if bullets:
        score += 1
    return score


def _parse_experience_matrix_block(block: str) -> Optional[List[Dict[str, object]]]:
    raw_lines = [_normalize_matrix_fragment(line) for line in (block or "").splitlines() if line.strip()]
    lines = [line for line in raw_lines if line]
    if len(lines) < 8:
        return None
    anchors = _extract_matrix_date_anchors(lines)
    if not _looks_like_experience_matrix_block(lines, anchors):
        return None

    first_anchor = anchors[0]
    header_cutoff = -1
    for idx in range(first_anchor):
        if _is_matrix_header_fragment(lines[idx]):
            header_cutoff = idx

    parsed_entries: List[Dict[str, object]] = []
    scores: List[int] = []
    previous_anchor = None
    for anchor_index, anchor in enumerate(anchors):
        next_anchor = anchors[anchor_index + 1] if anchor_index + 1 < len(anchors) else None
        start = max(header_cutoff + 1, anchor - 6)
        end = min(len(lines) - 1, anchor + 4)
        if previous_anchor is not None:
            start = max(start, previous_anchor + 1)
        if next_anchor is not None:
            end = min(end, next_anchor - 1)
        span = lines[start : end + 1]
        if not span:
            previous_anchor = anchor
            continue

        company_parts_before: List[str] = []
        company_parts_after: List[str] = []
        position_parts: List[str] = []
        location_parts: List[str] = []
        reason_parts: List[str] = []
        duration_parts: List[str] = []
        anchor_reason: Optional[str] = None
        header_hits = 0
        narrative_hits = 0
        fragment_only_hits = 0
        seen_anchor = False
        anchor_before, anchor_after = _split_matrix_anchor_line(lines[anchor])
        if anchor_index == 0:
            before_context = [fragment for fragment in lines[start:anchor] if fragment.strip()]
        else:
            before_context = [fragment for fragment in lines[max(start, anchor - 2) : anchor] if fragment.strip()]
        after_context = [fragment for fragment in lines[anchor + 1 : min(end + 1, anchor + 5)] if fragment.strip()]
        for idx, fragment in enumerate(span):
            if idx == len(span) - 1 and fragment == lines[anchor]:
                pass
            if fragment == lines[anchor]:
                anchor_duration, anchor_reason = _extract_anchor_tail_parts(fragment)
                if anchor_duration:
                    duration_parts.append(anchor_duration)
                seen_anchor = True
                continue
            kind = _classify_matrix_fragment(fragment)
            if kind == "header":
                header_hits += 1
                continue
            if kind == "narrative":
                break
            if kind == "location":
                location_parts.append(fragment)
                continue
            if kind == "position":
                position_parts.append(fragment)
                continue
            if kind == "reason":
                reason_parts.append(fragment)
                continue
            if kind == "duration":
                duration_parts.append(fragment)
                continue
            if kind == "company":
                if len(fragment.split()) == 1 and len(fragment) <= 4 and not re.search(r"[()]", fragment):
                    fragment_only_hits += 1
                if seen_anchor:
                    company_parts_after.append(fragment)
                else:
                    company_parts_before.append(fragment)

        if header_hits >= 2 or narrative_hits >= 1:
            previous_anchor = anchor
            continue

        company_parts_before = []
        company_parts_after = []
        position_parts = []
        location_parts = []
        reason_parts = []

        for fragment in before_context:
            _consume_matrix_fragment(
                fragment,
                company_parts=company_parts_before,
                position_parts=position_parts,
                location_parts=location_parts,
                reason_parts=reason_parts,
            )
        _consume_matrix_fragment(
            anchor_before or "",
            company_parts=company_parts_before,
            position_parts=position_parts,
            location_parts=location_parts,
            reason_parts=reason_parts,
        )
        _consume_matrix_fragment(
            anchor_after or "",
            company_parts=company_parts_after,
            position_parts=position_parts,
            location_parts=location_parts,
            reason_parts=reason_parts,
        )
        for fragment in after_context:
            _consume_matrix_fragment(
                fragment,
                company_parts=company_parts_after,
                position_parts=position_parts,
                location_parts=location_parts,
                reason_parts=reason_parts,
            )

        company_parts = list(company_parts_before)
        if company_parts_before:
            company_parts.extend(
                fragment
                for fragment in company_parts_after
                if _contains_org_keyword(fragment) or re.search(r"[()]", fragment) or len(fragment.split()) == 1
            )
        else:
            company_parts.extend(company_parts_after)
        company = _build_matrix_phrase(company_parts)
        position = _build_matrix_phrase(position_parts)
        location = _build_matrix_phrase(location_parts)
        reason = _clean_matrix_reason(reason_parts, anchor_reason)

        if position and not (_contains_matrix_role_signal(position) or _is_role_phrase(position)):
            position = None
        if location:
            normalized_location = _normalize_location_candidate(location)
            if normalized_location:
                location = normalized_location
        if company and _is_matrix_header_fragment(company):
            company = None
        if company and _looks_like_contact_or_heading(company):
            company = None
        if company and _normalize_location_candidate(company):
            company = None
        if company and _is_matrix_header_fragment(company):
            company = None
        if not company and position_parts:
            company = _build_matrix_phrase([part for part in company_parts if len(part.split()) > 1])
        if fragment_only_hits >= 3 and not (company and position):
            previous_anchor = anchor
            continue

        start_date, end_date, is_current = _parse_dates(lines[anchor])
        bullets = [f"Reason for leaving: {reason}" for reason in [reason] if reason and not _is_noise_line(reason)]
        row = {
            "id": make_id("exp"),
            "company": company,
            "position": _normalize_role_phrase(position) if position else None,
            "startDate": start_date,
            "endDate": None if is_current else end_date,
            "isCurrent": is_current,
            "location": location,
            "summary": None,
            "responsibilities": "\n".join(bullets),
            "responsibilityBullets": bullets,
            "achievements": [],
        }
        score = _score_reconstructed_experience_row(row)
        if score >= 5 and company:
            parsed_entries.append(row)
            scores.append(score)
        previous_anchor = anchor

    if len(parsed_entries) < 2:
        return None
    if sum(scores) / len(scores) < 5:
        return None
    if any(score < 5 for score in scores[:2]):
        return None
    if sum(1 for row in parsed_entries if row.get("startDate")) < 2:
        return None
    return parsed_entries


def _parse_education_markdown_table(block: str) -> Optional[List[Dict[str, object]]]:
    table = _select_education_markdown_table(block)
    if not table:
        return None
    header_map = _map_education_table_headers(table["normalized_headers"])
    if not header_map:
        return None

    rows = table["rows"]
    parsed_entries: List[Dict[str, object]] = []
    for row in rows:
        values = {field: collapse_spaced_caps(_scrub_glyphs(row[idx]).strip()) for idx, field in header_map.items() if idx < len(row)}
        degree = values.get("degree") or ""
        institution = values.get("institution") or values.get("board") or ""
        board = values.get("board") or ""
        year_raw = values.get("year") or ""
        score_raw = values.get("score") or ""

        if not degree or not institution:
            continue
        if detect_heading(degree):
            continue
        if PHONE_EMAIL_URL_RE.search(degree) or PHONE_EMAIL_URL_RE.search(institution):
            continue

        end_date = None
        if year_raw:
            parsed_start, parsed_end, _ = _parse_dates(year_raw)
            end_date = parsed_end or parsed_start

        summary_parts = []
        if board and board != institution:
            summary_parts.append(board)
        if score_raw:
            summary_parts.append(score_raw)
        summary = ", ".join(part for part in summary_parts if part) or f"{degree} at {institution}"

        parsed_entries.append(
            {
                "id": make_id("edu"),
                "institution": institution,
                "degree": degree,
                "fieldOfStudy": None,
                "startDate": None,
                "endDate": end_date,
                "isCurrent": None,
                "location": None,
                "summary": summary,
            }
        )

    if len(parsed_entries) < 2:
        return None
    return parsed_entries


def has_parseable_education_markdown_table(block: str) -> bool:
    return _select_education_markdown_table(block) is not None


def _select_language_markdown_table(block: str) -> Optional[Dict[str, object]]:
    tables = _iter_markdown_tables(block)
    if not tables:
        return None
    for table in tables:
        headers = list(table.get("normalized_headers") or [])
        if not headers:
            continue
        first = headers[0] if headers else ""
        remaining = headers[1:]
        if any(token in first for token in ("language", "languages", "langue", "idioma")) and any(
            any(token in header for token in ("read", "write", "speak", "spoken", "proficiency"))
            for header in remaining
        ):
            return table
    return None


def has_parseable_language_markdown_table(block: str) -> bool:
    return _select_language_markdown_table(block) is not None


def extract_language_markdown_table_region(block: str) -> Optional[str]:
    table = _select_language_markdown_table(block)
    if not table:
        return None
    raw_lines = [line.rstrip() for line in (block or "").splitlines() if line.strip()]
    start_index = int(table.get("start_index", 0))
    end_index = int(table.get("end_index", start_index))
    region = "\n".join(raw_lines[start_index:end_index]).strip()
    return region or None


def _parse_language_markdown_table(block: str) -> Optional[List[Dict[str, object]]]:
    table = _select_language_markdown_table(block)
    if not table:
        return None
    rows = list(table.get("rows") or [])
    parsed_entries: List[Dict[str, object]] = []
    seen = set()
    for row in rows:
        if not row:
            continue
        language = normalize_skill_name(collapse_spaced_caps(_scrub_glyphs(row[0]).strip()))
        if not language:
            continue
        key = language.lower()
        if key in seen:
            continue
        seen.add(key)
        parsed_entries.append({"id": make_id("lang"), "name": language})
    if len(parsed_entries) < 1:
        return None
    return parsed_entries


def parse_experience_block(block: str) -> List[Dict[str, object]]:
    table_entries = _parse_experience_markdown_table(block)
    if table_entries:
        return table_entries
    matrix_entries = _parse_experience_matrix_block(block)
    if matrix_entries:
        return matrix_entries
    if _iter_markdown_tables(block):
        return _fallback_experience_entry_from_table_text(block)
    entries = split_experience_entries(block)
    if not entries:
        entries = [block.splitlines()]
    repaired_entries = _repair_fragmented_experience_entries(entries)
    entries = []
    pending_entries = repaired_entries[:]
    while pending_entries:
        current_entry = pending_entries.pop(0)
        split_entries = _split_merged_experience_entry(current_entry)
        if len(split_entries) == 1:
            entries.append(current_entry)
            continue
        pending_entries = split_entries + pending_entries
    parsed_entries: List[Dict[str, object]] = []
    for entry_lines in entries:
        entry_lines = [
            strip_leading_markdown_heading(_normalize_structural_line(line.strip()))
            for line in entry_lines
            if line.strip()
        ]
        entry_lines = [line for line in entry_lines if line]
        if not entry_lines:
            continue
        location = None
        position = None
        company = None
        consumed_for_dates: Optional[int] = None
        matched_role_company_index: Optional[int] = None
        header_match = _match_multiline_header(entry_lines)
        if header_match:
            position, company, location, consumed_for_dates = header_match
        else:
            match = _match_role_company_line(entry_lines)
            if match:
                position, company, location, matched_role_company_index = match
        normalized_first = _strip_bullet_prefix(entry_lines[0]).strip() if entry_lines else ""
        prefer_role_header = False
        if not header_match:
            if not position and normalized_first and normalized_first.isupper() and _is_role_phrase(normalized_first):
                position = _normalize_role_phrase(normalized_first)
                prefer_role_header = True
            search_lines = entry_lines[1:] if prefer_role_header else entry_lines
            fallback_company = _find_company_candidate(search_lines) if not company else company
            company = collapse_spaced_caps(fallback_company) if fallback_company else None
            fallback_position = _find_position_candidate(entry_lines) if not position else position
            position = _normalize_role_phrase(fallback_position) if fallback_position else None
            if len(entry_lines) >= 2 and _is_single_role_fragment([entry_lines[0]]):
                compound_company_location = _split_company_location_line(entry_lines[1])
                if compound_company_location:
                    inferred_company, inferred_location = compound_company_location
                    if not company:
                        company = inferred_company
                    if not location:
                        location = inferred_location
            if company and _starts_with_verb_phrase(company):
                company = None
            if company and not position:
                position = _fallback_position_from_lines(entry_lines, company)
            if not position and entry_lines and _is_single_role_fragment([entry_lines[0]]):
                position = _normalize_role_phrase(entry_lines[0])
            if position and company and position.lower() == company.lower():
                position = None
            if company and not position:
                position = _fallback_position_from_lines(entry_lines, company)
        elif company:
            company = collapse_spaced_caps(company)
        if position:
            position = _normalize_role_phrase(position)
        if not location:
            for candidate_line in entry_lines[:3]:
                compound_company_location = _split_company_location_line(candidate_line)
                if compound_company_location:
                    _company_from_line, location = compound_company_location
                    if location:
                        break
                normalized_loc = _normalize_location_candidate(candidate_line)
                if normalized_loc:
                    location = normalized_loc
                    break
        if consumed_for_dates:
            date_scope = " ".join(entry_lines[:consumed_for_dates])
        else:
            date_scope = " ".join(entry_lines)
        start_date, end_date, is_current = _parse_dates(date_scope)
        structural_lines: List[str] = []
        if header_match and consumed_for_dates:
            structural_lines.extend(entry_lines[:consumed_for_dates])
        elif matched_role_company_index is not None:
            structural_lines.append(entry_lines[matched_role_company_index])
            date_index = matched_role_company_index + 1
            if date_index < len(entry_lines) and re.search(DATE_PATTERN, entry_lines[date_index]):
                structural_lines.append(entry_lines[date_index])
        elif (
            len(entry_lines) >= 3
            and _is_single_role_fragment([entry_lines[0]])
            and _split_company_location_line(entry_lines[1])
            and _is_single_date_fragment([entry_lines[2]])
        ):
            structural_lines.extend(entry_lines[:3])
        structural_signatures = tuple(
            signature
            for signature in (
                _normalize_experience_line_signature(line)
                for line in structural_lines
            )
            if signature
        )
        skip_items = [company or "", position or ""]
        if location:
            skip_items.append(location)
        bullets = _extract_bullets(entry_lines, skip=skip_items)
        bullets = [bullet for bullet in bullets if not _is_noise_line(bullet)]
        bullets = [
            bullet
            for bullet in bullets
            if _keep_experience_content_line(
                bullet,
                company=company,
                position=position,
                location=location,
                structural_signatures=structural_signatures,
            )
        ]
        if not bullets:
            remaining = [
                line
                for line in entry_lines
                if line not in {company, position}
                and _keep_experience_content_line(
                    line,
                    company=company,
                    position=position,
                    location=location,
                    structural_signatures=structural_signatures,
                )
            ]
            if remaining:
                bullets = [
                    sentence.strip()
                    for sentence in re.split(r"(?<=[.!?])\s+", " ".join(remaining))
                    if sentence.strip()
                    and not _is_noise_line(sentence)
                    and _keep_experience_content_line(
                        sentence,
                        company=company,
                        position=position,
                        location=location,
                        structural_signatures=structural_signatures,
                    )
                ]
        if not bullets:
            fallback_line = entry_lines[-1]
            bullets = [
                fallback_line
            ] if not _is_noise_line(fallback_line) and _keep_experience_content_line(
                fallback_line,
                company=company,
                position=position,
                location=location,
                structural_signatures=structural_signatures,
            ) else []
        if not bullets and entry_lines:
            bullets = [
                line
                for line in entry_lines
                if not _is_noise_line(line)
                and _keep_experience_content_line(
                    line,
                    company=company,
                    position=position,
                    location=location,
                    structural_signatures=structural_signatures,
                )
            ]
        company_clean = _strip_bullet_prefix(company or "") or (position or "Experience").split(",")[0].strip()
        original_company = company_clean
        lower_company = company_clean.lower()
        invalid_company = False
        if position and company_clean and lower_company == position.lower():
            invalid_company = True
        if company_clean and (_is_role_phrase(company_clean) or _starts_with_verb_phrase(company_clean)):
            invalid_company = True
        if company_clean and (VERB_START_RE.match(lower_company) or re.match(r"^[a-z]+ing\b", lower_company)):
            invalid_company = True
        if company_clean and PHONE_EMAIL_URL_RE.search(company_clean):
            invalid_company = True

        if invalid_company:
            alternative = _find_company_candidate(entry_lines[:4])
            if alternative and alternative.lower() != lower_company:
                company_clean = collapse_spaced_caps(alternative)
                lower_company = company_clean.lower()
            else:
                if original_company and original_company not in bullets:
                    bullets.insert(0, original_company)
                company_clean = "Experience"
                lower_company = company_clean.lower()

        if _looks_like_contact_or_heading(company_clean):
            if company_clean and company_clean not in bullets:
                bullets.insert(0, company_clean)
            company_clean = "Experience"
            lower_company = company_clean.lower()
        if lower_company.startswith("responsible for"):
            replacement = company_clean.replace("Responsible for", "").strip()
            company_clean = replacement or "Experience"
            lower_company = company_clean.lower()
        if _starts_with_verb_phrase(company_clean):
            if company_clean and company_clean not in bullets:
                bullets.insert(0, company_clean)
            company_clean = "Experience"
        if company_clean:
            company_lower = company_clean.lower()
            bullets = [bullet for bullet in bullets if bullet.lower() != company_lower]
        if position:
            position_lower = position.lower()
            bullets = [bullet for bullet in bullets if bullet.lower() != position_lower]
        bullets = _dedupe_experience_bullets(bullets)
        if not _entry_has_minimal_experience_coherence(
            company=company_clean,
            position=position,
            start_date=start_date,
            end_date=end_date,
            is_current=is_current,
            bullets=bullets,
        ):
            narrative_candidates: List[Tuple[int, int, Dict[str, object]]] = []
            for index, line in enumerate(entry_lines):
                candidate = _parse_worked_in_narrative_line(line)
                if not candidate:
                    continue
                candidate = _refine_worked_in_narrative_candidate(candidate, line)
                narrative_candidates.append((_score_worked_in_narrative_line(line), index, candidate))
            if narrative_candidates:
                _score, _index, best_candidate = max(narrative_candidates, key=lambda item: (item[0], item[1]))
                parsed_entries.append(best_candidate)
            continue

        parsed_entries.append(
            {
                "id": make_id("exp"),
                "company": company_clean,
                "position": position,
                "startDate": start_date,
                "endDate": None if is_current else end_date,
                "isCurrent": is_current,
                "location": location,
                "summary": None,
                "responsibilities": "\n".join(bullets),
                "responsibilityBullets": bullets,
                "achievements": [],
            }
        )
    return parsed_entries


def build_experience_entries(sections: Dict[str, List[str]], raw_text: str) -> List[Dict[str, object]]:
    experiences: List[Dict[str, object]] = []
    has_experience_sections = bool(sections.get("EXPERIENCE"))
    for block in sections.get("EXPERIENCE", []):
        parsed_entries = parse_experience_block(block)
        experiences.extend(parsed_entries)
    inferred_experience_heading = TEXT_PDF_EXPERIENCE_HEADING_RE.search(strip_accents(raw_text or "")) is not None
    attempted_text_pdf_inference = False
    if not experiences and not has_experience_sections and inferred_experience_heading:
        attempted_text_pdf_inference = True
        inferred_block = _infer_experience_block_from_text_pdf(raw_text)
        if inferred_block:
            inferred_entries = parse_experience_block(inferred_block)
            coherent_entries = [entry for entry in inferred_entries if _entry_has_text_pdf_experience_coherence(entry)]
            if coherent_entries:
                experiences.extend(coherent_entries)
    if not experiences and not attempted_text_pdf_inference and not has_experience_sections:
        # Fallback heuristic: look for capitalized company names directly in raw text
        if inferred_experience_heading:
            sentences = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", raw_text) if sentence.strip()]
            for sentence in sentences:
                if not (re.search(DATE_PATTERN, sentence) or _contains_role_keyword(sentence) or _contains_org_keyword(sentence)):
                    continue
                match = re.search(r"([A-Z][A-Za-z0-9&]+(?:\s+[A-Z][A-Za-z0-9&]+){1,3})", sentence)
                if match:
                    company = match.group(1).strip()
                    if company.lower().startswith("responsible for"):
                        continue
                    experiences.append(
                        {
                            "id": make_id("exp"),
                            "company": company,
                            "position": None,
                            "startDate": None,
                            "endDate": None,
                            "isCurrent": None,
                            "location": None,
                            "summary": None,
                            "responsibilities": sentence,
                            "responsibilityBullets": [sentence],
                            "achievements": [],
                        }
                    )
                    break
    if (
        not experiences
        and raw_text.strip()
        and inferred_experience_heading
        and not attempted_text_pdf_inference
        and not has_experience_sections
    ):
        sentence = first_sentence(raw_text)
        experiences.append(
            {
                "id": make_id("exp"),
                "company": "Experience",
                "position": None,
                "startDate": None,
                "endDate": None,
                "isCurrent": None,
                "location": None,
                "summary": None,
                "responsibilities": sentence,
                "responsibilityBullets": [sentence],
                "achievements": [],
            }
        )
    return experiences


def parse_education_block(block: str) -> Optional[Dict[str, object]]:
    lines = [
        _normalize_structural_line(line.strip("•- ").strip())
        for line in block.splitlines()
        if line.strip()
    ]
    lines = [line for line in lines if line]
    text = " ".join(lines) if lines else _scrub_glyphs(block.strip())
    degree = None
    institution = None
    field = None
    end_date = None
    year_match = YEAR_PATTERN.search(text)
    if year_match:
        end_date = f"{year_match.group(0)}-01-01"
    lower = text.lower()
    if " from " in lower:
        parts = re.split(r"\bfrom\b", text, flags=re.I)
        degree = parts[0].strip(" ,.;")
        institution = parts[1].strip(" ,.;")
    elif " at " in lower:
        parts = re.split(r"\bat\b", text, flags=re.I)
        degree = parts[0].strip(" ,.;")
        institution = parts[1].strip(" ,.;")
    else:
        tokens = [token.strip(" ,.;") for token in re.split(r",|;|\n", text) if token.strip()]
        if tokens:
            degree = tokens[0]
            if len(tokens) > 1:
                institution = tokens[1]
    if not institution and degree:
        parts = degree.split(" from ")
        if len(parts) == 2:
            degree, institution = parts[0].strip(), parts[1].strip()

    summary = text
    for idx, line in enumerate(lines):
        lower_line = line.lower()
        if lower_line.startswith("course curriculum"):
            _, sep, remainder_raw = line.partition(":")
            remainder = remainder_raw.strip() if sep else ""
            summary_parts = [remainder] if remainder else []
            summary_parts.extend(lines[idx + 1 :])
            summary = " ".join(part for part in summary_parts if part) or text
            break

    degree_clean = collapse_spaced_caps(_scrub_glyphs(degree or "")).strip(" ,.;")
    institution_clean = collapse_spaced_caps(_scrub_glyphs(institution or "")).strip(" ,.;")
    if institution_clean and len(institution_clean) <= 1:
        institution_clean = ""
    if institution_clean:
        letters_only = re.sub(r"[^A-Za-z]", "", institution_clean)
        if len(letters_only) <= 2 or (len(letters_only) <= 3 and not any(ch in "aeiou" for ch in letters_only.lower())):
            institution_clean = ""
    if institution_clean and re.fullmatch(r"[-—–]+(?:\s+\w+)?", institution_clean):
        institution_clean = ""
    if institution_clean and "course curriculum" in institution_clean.lower():
        institution_clean = ""
    if degree_clean and "course curriculum" in degree_clean.lower() and not summary:
        summary = degree_clean
    if not summary:
        summary = text

    if not institution_clean:
        return None

    return {
        "id": make_id("edu"),
        "institution": institution_clean or degree_clean or text,
        "degree": degree_clean or "",
        "fieldOfStudy": field,
        "startDate": None,
        "endDate": end_date,
        "isCurrent": None,
        "location": None,
        "summary": summary,
    }


def build_education_entries(sections: Dict[str, List[str]], raw_text: str) -> List[Dict[str, object]]:
    education_blocks = sections.get("EDUCATION", [])
    entries: List[Dict[str, object]] = []
    for block in education_blocks:
        table_entries = _parse_education_markdown_table(block)
        if table_entries:
            entries.extend(table_entries)
            continue
        entry = parse_education_block(block)
        if entry:
            entries.append(entry)
    if not entries:
        for line in raw_text.splitlines():
            if any(keyword in line.lower() for keyword in ["b.", "btech", "b.tech", "bachelor", "m.", "master", "university", "college", "diploma"]):
                entry = parse_education_block(line)
                if entry:
                    entries.append(entry)
    return entries


def normalize_skill_name(value: str) -> str:
    value = value.strip()
    if not value:
        return value
    if value.isupper() and len(value) > 2:
        return value.title()
    return value


SKILLS_STOP_HEADINGS = {
    "FINAL YEAR PROJECT",
    "FINAL YEAR PROJECTS",
    "PROJECT",
    "PROJECTS",
    "ACHIEVEMENT",
    "ACHIEVEMENTS",
    "LANGUAGE KNOWN",
    "LANGUAGES KNOWN",
    "LANGUAGE",
    "LANGUAGES",
}


def _normalize_subsection_heading_token(value: str) -> str:
    normalized = strip_accents(value or "").upper().strip()
    normalized = re.sub(r"[^A-Z0-9 ]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _is_skills_stop_heading(line: str) -> bool:
    cleaned = _strip_bullet_prefix(_normalize_structural_line(line or ""))
    if not cleaned:
        return False
    token = _normalize_subsection_heading_token(cleaned.rstrip(":"))
    if token not in SKILLS_STOP_HEADINGS:
        return False
    return len(token.split()) <= 4


def trim_skills_block(block: str) -> str:
    kept: List[str] = []
    for raw_line in (block or "").splitlines():
        line = _normalize_structural_line(raw_line)
        if not line:
            continue
        if _is_skills_stop_heading(line):
            break
        kept.append(line)
    return "\n".join(kept).strip()


def build_skill_entries(sections: Dict[str, List[str]]) -> List[Dict[str, object]]:
    skill_blocks = [trim_skills_block(block) for block in sections.get("SKILLS", [])]
    skill_blocks = [block for block in skill_blocks if block]
    skills_text = " ".join(skill_blocks)
    if not skills_text:
        return []
    raw_items = re.split(r"[,\n;•\u2022]", skills_text)
    skills: List[Dict[str, str]] = []
    seen = set()
    for item in raw_items:
        name = normalize_skill_name(item)
        if not name:
            continue
        name = _normalize_skill_alias(name)
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        skills.append({"id": make_id("skill"), "name": name})
    return skills


def build_language_entries(sections: Dict[str, List[str]]) -> List[Dict[str, object]]:
    language_blocks = sections.get("LANGUAGES", [])
    for block in language_blocks:
        table_entries = _parse_language_markdown_table(block)
        if table_entries:
            return table_entries

    languages_text = " ".join(language_blocks)
    if not languages_text:
        return []
    raw_items = re.split(r"[,\n;•\u2022]", languages_text)
    langs: List[Dict[str, object]] = []
    seen = set()
    for item in raw_items:
        name = normalize_skill_name(item)
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        langs.append({"id": make_id("lang"), "name": name})
    return langs


FAMILY_TRIM_SOURCE_LABELS = {"BODY", "SUMMARY", "ACHIEVEMENTS", "EXPERIENCE"}


def _trim_block_at_family_transition(
    block: str,
    current_label: str,
    available_labels: Set[str],
) -> str:
    lines = [line for line in (block or "").splitlines() if line.strip()]
    kept: List[str] = []
    for index, raw_line in enumerate(lines):
        cleaned = _normalize_structural_line(raw_line)
        if not cleaned:
            continue
        if current_label == "EXPERIENCE":
            if TEXT_PDF_EXPERIENCE_HARD_STOP_RE.match(cleaned):
                break
            if TEXT_PDF_EXPERIENCE_SIDEBAR_RE.match(cleaned):
                break
        heading = detect_heading(cleaned.rstrip(":"))
        if heading and heading != current_label and heading in available_labels:
            break
        remaining = "\n".join(lines[index:]).strip()
        if (
            current_label == "ACHIEVEMENTS"
            and "LANGUAGES" in available_labels
            and raw_line.lstrip().startswith("|")
            and has_parseable_language_markdown_table(remaining)
        ):
            break
        kept.append(cleaned)
    return "\n".join(kept).strip()


def _trim_family_local_contamination(sections: Dict[str, List[str]]) -> Dict[str, List[str]]:
    available_labels = set(sections.keys())
    if not available_labels:
        return sections
    trimmed: Dict[str, List[str]] = {}
    for label, blocks in sections.items():
        if label not in FAMILY_TRIM_SOURCE_LABELS:
            trimmed[label] = blocks
            continue
        next_blocks: List[str] = []
        for block in blocks:
            cleaned = _trim_block_at_family_transition(block, label, available_labels)
            if cleaned:
                next_blocks.append(cleaned)
        if next_blocks:
            trimmed[label] = next_blocks
    for label, blocks in sections.items():
        if label not in trimmed and blocks:
            trimmed[label] = blocks
    return trimmed


def ensure_edu_tokens(entries: List[Dict[str, object]], raw_text: str) -> List[Dict[str, object]]:
    missing_tokens = [token for token in EDU_TOKENS if token.lower() in raw_text.lower()]
    if missing_tokens:
        if not entries:
            entries.append(
                {
                    "id": make_id("edu"),
                    "institution": "Education",
                    "degree": "",
                    "fieldOfStudy": None,
                    "startDate": None,
                    "endDate": None,
                    "isCurrent": None,
                    "location": None,
                    "summary": "",
                }
            )
        summary = entries[0].get("summary") or ""
        for token in missing_tokens:
            if token.lower() not in summary.lower():
                summary = f"{summary} {token}".strip()
        entries[0]["summary"] = summary
    return entries


def adjust_diagnostics(diagnostics: Optional[Dict[str, object]], mode: str) -> Dict[str, object]:
    diag = dict(diagnostics) if isinstance(diagnostics, dict) else {}
    if mode == "text":
        diag.setdefault("engine", "text")
        diag.pop("dpi_used", None)
    else:
        diag.setdefault("engine", "paddle")
        dpi_value = diag.get("dpi_used")
        if not isinstance(dpi_value, (int, float)) or dpi_value <= 0:
            diag["dpi_used"] = 300
    diag.setdefault("fallback_used", False)
    diag.setdefault("hybrid_used", False)
    return diag


def canonicalize_cv(
    raw_text: str,
    mode: str,
    diagnostics: Optional[Dict[str, object]] = None,
    raw_sections: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, object]:
    # Noise filtering first (Prompt 4)
    original_text = raw_text or ""
    filtered_text, removed_count = _filter_noise_from_text(original_text)
    # Column clustering/reordering (Prompt 2) — best-effort using diagnostics layout if present
    reordered_text, column_mode = _reorder_text_with_columns(filtered_text, diagnostics)
    working_text = original_text.strip()
    collapsed_text = TOKEN_SANITIZE_RE.sub(" ", reordered_text.strip())
    sections = extract_sections(reordered_text, raw_sections)
    if sections.get("SKILLS"):
        trimmed_skill_blocks = [trim_skills_block(block) for block in sections.get("SKILLS", [])]
        sections["SKILLS"] = [block for block in trimmed_skill_blocks if block]
    sections = _trim_family_local_contamination(sections)
    # Track ordered sections (Prompt 3)
    ordered_section_labels = list(sections.keys())
    name, desired_position = extract_name_and_role(original_text, sections)
    summary_candidate = pick_summary_text(sections, reordered_text or collapsed_text)
    experiences = build_experience_entries(sections, original_text)
    if not summary_candidate:
        summary_candidate = _summary_from_experience_entries(experiences)
    if not summary_candidate:
        summary_candidate = _summary_from_structured_json(reordered_text)
    if not summary_candidate and sections.get("SKILLS"):
        skill_summary_source = "\n".join(sections.get("SKILLS", []))
        summary_candidate = _summary_from_skill_lines(skill_summary_source)
    summary_sentence = ""
    if summary_candidate:
        sentences = re.split(r"(?<=[.!?])\s+", summary_candidate)
        for sentence in sentences:
            normalized_sentence = _normalize_summary_candidate(sentence)
            if normalized_sentence:
                summary_sentence = ensure_terminal_punctuation(normalized_sentence)
                break
        if not summary_sentence:
            fallback_sentence = _clean_summary_text(first_sentence(summary_candidate))
            if fallback_sentence:
                summary_sentence = ensure_terminal_punctuation(fallback_sentence)
    education = ensure_edu_tokens(build_education_entries(sections, original_text), original_text)
    skills = build_skill_entries(sections)
    languages = build_language_entries(sections)
    diagnostics_out = adjust_diagnostics(diagnostics, mode)
    # Engine selection artifact (Prompt 1)
    diagnostics_out = _engine_selection(diagnostics_out, reordered_text)
    diagnostics_out["noise_lines_removed"] = removed_count
    diagnostics_out["column_mode"] = column_mode
    diagnostics_out["section_order"] = ordered_section_labels

    raw_sections_list = [
        {"label": label, "content": content}
        for label, blocks in sections.items()
        for content in blocks
    ]
    if original_text and not raw_sections_list:
        snippet = original_text.strip()
        if snippet:
            snippet = snippet[:400].strip()
        if not snippet:
            snippet = original_text.strip()
        if snippet:
            raw_sections_list = [{"label": "BODY", "content": snippet}]

    contact_fields = extract_contact(original_text)
    contact_location = contact_fields.get("location")
    normalized_address = _clean_address_field(contact_location)

    normalized: Dict[str, object] = {
        "name": name,
        "contact": {
            "name": name,
            "desiredPosition": desired_position,
            "email": contact_fields["email"],
            "phone": contact_fields["phone"],
            "linkedinUrl": contact_fields["linkedinUrl"],
            "addressBlock": None,
            "addressNormalized": normalized_address,
        },
        "summary": {"text": summary_sentence, "confidence": 0.5},
        "experience": experiences,
        "education": education,
        "skills": skills,
        "languages": [{"name": lang["name"]} for lang in languages],
        "languagesRaw": [lang["name"] for lang in languages],
        "achievements": sections.get("ACHIEVEMENTS", []),
        "projects": sections.get("PROJECTS", []),
        "research": [],
        "volunteer": [],
        "references": [],
        "other": [],
        "summaryFirstSentence": summary_sentence,
        "raw": original_text,
        "rawText": original_text,
        "rawSections": raw_sections_list,
    }
    normalized["summaryFirstSentence"] = summary_sentence

    if original_text and not normalized.get("rawSections"):
        snippet = original_text.strip()[:400].strip()
        fallback_sections = [{"label": "BODY", "content": snippet}] if snippet else []
        normalized["rawSections"] = fallback_sections
        if fallback_sections and not raw_sections_list:
            raw_sections_list = fallback_sections
    if "engine" not in diagnostics_out:
        diagnostics_out["engine"] = "text" if mode == "text" else "paddle"

    canonical_payload = {
        "rawText": original_text,
        "normalized": normalized,
        "summary": {"text": summary_sentence, "confidence": 0.5},
        "summaryFirstSentence": summary_sentence,
        "rawSections": [dict(section) for section in raw_sections_list],
        "diagnostics": diagnostics_out,
    }

    return canonical_payload
