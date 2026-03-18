"""Deterministic pattern rules used to seed spans before transformer NER."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional

from .constants import (
    RULE_DATE_LABELS,
    RULE_DEGREE_LABELS,
    RULE_EMAIL_LABEL,
    RULE_PHONE_LABEL,
    RULE_URL_LABEL,
)
from .types import RuleMatch, SectionSpan
from .parsing_shared.locale import MONTHS as LOCALE_MONTHS

EMAIL_RE = re.compile(
    r"(?<![\w.+-])[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63}(?![A-Za-z0-9.-])",
    re.IGNORECASE,
)

PHONE_RE = re.compile(
    r"""
    (
        (?:\+|00)\d{1,3}                    # country code prefix
        (?:[\s.\-/]*\(0\))?                # optional trunk code (0)
        (?:[\s.\-/]*(?:\(\d{1,4}\)|\d{1,4})){2,6}  # number blocks allowing parentheses
        (?:\s*(?:ext\.?|x)\s*\d{1,5})?     # optional extension
    )
    |
    (
        (?:\(\d{3}\)|\d{3})               # US/NA area code
        [\s.\-/]*\d{3}
        [\s.\-/]*\d{4}
        (?:\s*(?:ext\.?|x)\s*\d{1,5})?
    )
    """,
    re.VERBOSE,
)

URL_RE = re.compile(
    r"(?:(?:https?|ftp)://|www\.)[^\s<>()]+|\blinkedin\.com/[^\s<>()]+",
    re.IGNORECASE,
)
ISO_DATE_RE = re.compile(r"\b(\d{4})-(\d{2})(?:-(\d{2}))?\b")
MONTH_YEAR_RE = re.compile(
    r"\b(?P<month>[A-Za-zÀ-ÖØ-öø-ÿ\.]{3,})[\s\-/–—]*?(?:de\s+|del\s+)?(?P<year>(?:19|20)\d{2})\b",
    re.UNICODE,
)
YEAR_RANGE_RE = re.compile(
    r"(?P<start>(?:19|20)\d{2})\s*(?:-|to|–|—|until)\s*(?P<end>(?:19|20)\d{2}|present|current)",
    re.I,
)

_EN_MONTH_ALIASES: Dict[str, str] = {
    "jan": "01",
    "jan.": "01",
    "january": "01",
    "feb": "02",
    "feb.": "02",
    "february": "02",
    "mar": "03",
    "mar.": "03",
    "march": "03",
    "apr": "04",
    "apr.": "04",
    "april": "04",
    "may": "05",
    "jun": "06",
    "jun.": "06",
    "june": "06",
    "jul": "07",
    "jul.": "07",
    "july": "07",
    "aug": "08",
    "aug.": "08",
    "august": "08",
    "sep": "09",
    "sep.": "09",
    "sept": "09",
    "sept.": "09",
    "september": "09",
    "oct": "10",
    "oct.": "10",
    "october": "10",
    "nov": "11",
    "nov.": "11",
    "november": "11",
    "dec": "12",
    "dec.": "12",
    "december": "12",
}

def _normalise_month_token(token: str) -> str:
    stripped = token.strip().lower().rstrip(".")
    normalised = unicodedata.normalize("NFKD", stripped)
    return "".join(ch for ch in normalised if not unicodedata.combining(ch))

_MONTH_LOOKUP: Dict[str, str] = {}
for key, value in _EN_MONTH_ALIASES.items():
    _MONTH_LOOKUP[_normalise_month_token(key)] = value
for mapping in LOCALE_MONTHS.values():
    for key, value in mapping.items():
        _MONTH_LOOKUP[_normalise_month_token(key)] = value

COMPANY_PATTERN = re.compile(
    r"\b([A-Z][A-Za-z&.,'-]*(?:\s+[A-Z][A-Za-z&.,'-]*)*\s+(?:Inc|Inc\.|LLC|Ltd|Ltd\.|GmbH|S\.A\.|Corp|Corporation|Company|Technologies|Systems|Solutions|Group))\b",
)

INSTITUTION_PATTERN = re.compile(
    r"\b([A-Z][A-Za-z&.,'-]*(?:\s+[A-Z][A-Za-z&.,'-]*)*\s+(?:University|College|Institute|Ecole|Polytechnic|Academy|School(?:\s+of)?))\b",
)

DEGREE_TERMS = [
    r"Associate(?:'s)?",
    r"Bachelor(?:'s)?",
    r"B\.?A\.?",
    r"B\.?Sc\.?",
    r"B\.?S\.?",
    r"BSc",
    r"BEng",
    r"B\.?E\.?",
    r"BE",
    r"BTech",
    r"B\.?Tech",
    r"BCom",
    r"B\.?Com",
    r"BBA",
    r"Master(?:'s)?",
    r"M\.?A\.?",
    r"M\.?S\.?",
    r"MSc",
    r"MBA",
    r"MEng",
    r"M\.?E\.?",
    r"MTech",
    r"M\.?Tech",
    r"MCA",
    r"Doctor(?:ate)?",
    r"Ph\.?\s?D\.?",
    r"PhD",
    r"JD",
    r"J\.?D\.?",
    r"LLB",
    r"LL\.\s?B\.?",
    r"LLM",
    r"LL\.\s?M\.?",
    r"MD",
    r"M\.?D\.?",
]

DEGREE_PATTERN = re.compile(
    r"\b(" + "|".join(DEGREE_TERMS) + r")(?:\s+(?:of|in)\s+[A-Za-z&'\/\s]{2,})?\b",
    re.IGNORECASE,
)

GLOBAL_ORGS = ["google", "amazon", "microsoft", "apple", "meta", "ibm", "mit", "stanford", "oxford"]


@dataclass
class RuleConfig:
    normalise_phone: bool = True
    normalise_email: bool = True


class RuleEngine:
    def __init__(self, config: Optional[RuleConfig] = None) -> None:
        self.config = config or RuleConfig()

    def run(self, section: SectionSpan, section_offset: int) -> List[RuleMatch]:
        matches: List[RuleMatch] = []
        text = section.text

        matches.extend(self._email_matches(text, section_offset))
        matches.extend(self._phone_matches(text, section_offset))
        matches.extend(self._url_matches(text, section_offset))
        matches.extend(self._date_matches(text, section_offset))
        if section.label in {"EDUCATION", "CERTIFICATIONS"}:
            matches.extend(self._degree_matches(text, section_offset))
            matches.extend(self._institution_matches(text, section_offset))
        matches.extend(self._company_matches(text, section_offset))
        return matches

    # ------------------------------------------------------------------
    # Individual detectors
    # ------------------------------------------------------------------
    def _email_matches(self, text: str, base: int) -> Iterable[RuleMatch]:
        for match in EMAIL_RE.finditer(text):
            email = match.group(0)
            if self.config.normalise_email:
                local, _, domain = email.partition("@")
                email = f"{local.lower()}@{domain.lower()}"
            yield RuleMatch(RULE_EMAIL_LABEL, base + match.start(), base + match.end(), email, confidence=0.95)

    def _phone_matches(self, text: str, base: int) -> Iterable[RuleMatch]:
        for match in PHONE_RE.finditer(text):
            raw = match.group(0)
            main = re.sub(r"(?i)(?:ext\.?|x)\s*\d{1,5}$", "", raw).strip()
            main = re.sub(r"\(0\)", "", main)
            cleaned = re.sub(r"[\s().\-/]+", "", main)
            phone = cleaned
            digit_count = len(re.sub(r"\D", "", cleaned))
            if digit_count < 7:
                continue
            if self.config.normalise_phone:
                phone = self._to_e164(cleaned)
            yield RuleMatch(RULE_PHONE_LABEL, base + match.start(), base + match.end(), phone, confidence=0.8)

    def _url_matches(self, text: str, base: int) -> Iterable[RuleMatch]:
        for match in URL_RE.finditer(text):
            url = match.group(0).rstrip(".,);")
            yield RuleMatch(RULE_URL_LABEL, base + match.start(), base + match.end(), url, confidence=0.75)

    def _date_matches(self, text: str, base: int) -> Iterable[RuleMatch]:
        for match in YEAR_RANGE_RE.finditer(text):
            start_year = match.group("start")
            end_value = match.group("end")
            start_span = match.span("start")
            end_span = match.span("end")
            yield RuleMatch("START_DATE", base + start_span[0], base + start_span[1], f"{start_year}-01", confidence=0.65)
            normalised_end = end_value.lower()
            if normalised_end in {"present", "current"}:
                end_text = match.group("end")
                yield RuleMatch("END_DATE", base + end_span[0], base + end_span[1], end_text.lower(), confidence=0.6)
            else:
                yield RuleMatch("END_DATE", base + end_span[0], base + end_span[1], f"{end_value}-01", confidence=0.65)
        for match in ISO_DATE_RE.finditer(text):
            iso = match.group(0)
            label = "START_DATE" if "start" in text[max(0, match.start()-15):match.start()].lower() else "END_DATE"
            yield RuleMatch(label if label in RULE_DATE_LABELS else "START_DATE", base + match.start(), base + match.end(), iso, confidence=0.7)
        for match in MONTH_YEAR_RE.finditer(text):
            normalised = _normalise_month_from_match(match)
            if not normalised:
                continue
            label = "START_DATE" if "start" in text[max(0, match.start()-15):match.start()].lower() else "END_DATE"
            yield RuleMatch(label if label in RULE_DATE_LABELS else "START_DATE", base + match.start(), base + match.end(), normalised, confidence=0.65)

    def _degree_matches(self, text: str, base: int) -> Iterable[RuleMatch]:
        for match in DEGREE_PATTERN.finditer(text):
            yield RuleMatch("DEGREE", base + match.start(), base + match.end(), match.group(0), confidence=0.7)

    def _institution_matches(self, text: str, base: int) -> Iterable[RuleMatch]:
        for match in INSTITUTION_PATTERN.finditer(text):
            yield RuleMatch("INSTITUTION", base + match.start(), base + match.end(), match.group(0), confidence=0.65)

    def _company_matches(self, text: str, base: int) -> Iterable[RuleMatch]:
        for match in COMPANY_PATTERN.finditer(text):
            yield RuleMatch("COMPANY", base + match.start(), base + match.end(), match.group(0), confidence=0.6)
        lower = text.lower()
        for org in GLOBAL_ORGS:
            start = 0
            while True:
                idx = lower.find(org, start)
                if idx == -1:
                    break
                end = idx + len(org)
                yield RuleMatch("COMPANY", base + idx, base + end, text[idx:end], confidence=0.6)
                start = end

    @staticmethod
    def _to_e164(number: str) -> str:
        cleaned = number.strip()
        cleaned = re.sub(r"\(0\)", "", cleaned)
        cleaned = re.sub(r"(?i)(?:ext\.?|x)\s*\d{1,5}$", "", cleaned)
        if cleaned.startswith("+"):
            digits = "+" + re.sub(r"\D", "", cleaned[1:])
            return digits
        digits = re.sub(r"\D", "", cleaned)
        if digits.startswith("00"):
            digits = digits[2:]
        if len(digits) == 0:
            return cleaned
        if len(digits) == 10:
            return "+1" + digits
        return "+" + digits


def _normalise_month_from_match(match: re.Match[str]) -> Optional[str]:
    month_key = _normalise_month_token(match.group("month"))
    month = _MONTH_LOOKUP.get(month_key)
    if not month:
        return None
    year = match.group("year")
    return f"{year}-{month}"


def apply_rules(section: SectionSpan, offset: int = 0) -> List[RuleMatch]:
    return RuleEngine().run(section, offset)
