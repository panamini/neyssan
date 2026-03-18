"""Unified dataset preparation for CV entity recognition corpora.

This script ingests heterogeneous annotation formats (Dataturks JSONL,
Label Studio exports, HuggingFace-style JSON, etc.), normalizes their labels
to the canonical schema used by the hybrid CV parser, and writes spaCy DocBin
files for training and development splits.
"""

from __future__ import annotations

import argparse
import copy
import json
import math
import random
import re
import unicodedata
from bisect import bisect_right
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

import spacy
from spacy.cli.debug_data import debug_data
from spacy.tokens import Doc, DocBin, Span

from transformers import AutoTokenizer

from cv_parser.constants import ENTITY_LABELS

import csv
import itertools
import yaml

from cv_parser.esco_utils import load_labels as load_esco_label_list, split_alt_labels


CANONICAL_LABELS = set(ENTITY_LABELS)

# Dataturks → canonical schema.
DATATURKS_LABEL_MAP: Dict[str, str] = {
    "Name": "NAME",
    "Email Address": "EMAIL",
    "Companies worked at": "COMPANY",
    "Designation": "ROLE",
    "Skills": "SKILL",
    "College Name": "INSTITUTION",
    "Degree": "DEGREE",
    "Graduation Year": "END_DATE",
    "Location": "GPE",
}

# Direct per-label mappings for Label Studio exports.
LABEL_STUDIO_MAP: Dict[str, str] = {
    "candidate_city": "GPE",
    "work_cities": "GPE",
    "company_name": "COMPANY",
    "designation": "ROLE",
    "technical_skills": "SKILL",
    "soft-skills": "SKILL",
    "higher_education": "DEGREE",
    "basic_education": "DEGREE",
    "certification": "CERTIFICATE",
    "languages_known": "LANGUAGE",
    "achievement": "ACHIEVEMENT",
    "result_basic_education": "GRADE",
    "result_higher_education": "GRADE",
    "place_basic_education": "GPE",
    "place_higher_education": "GPE",
}

# Label Studio classes that should be collapsed to SKILL.
LABEL_STUDIO_SOFT_SKILLS = {
    "adaption_to_change",
    "analyzing",
    "applying_expertise",
    "commercial_thinking",
    "creative",
    "deciding",
    "entrepreneurial_thinking",
    "influencing",
    "initiating_actions",
    "innovative",
    "learning",
    "organizing",
    "persuading",
    "planning",
    "researching",
    "supervising",
    "work_with_people",
}

# Default whitelist of skill surface forms retained even if not present in ESCO list.
DEFAULT_SKILL_WHITELIST = {
    value.lower()
    for value in {
        "c++",
        "c#",
        "node.js",
        "react.js",
        "javascript",
        "typescript",
        "sql",
        "excel",
        "powerpoint",
        "leadership",
        "customer service",
        "project management",
        "nursing",
        "carpentry",
    }
}

FALLBACK_SKILL_STOPLIST = {
    "gmail",
    "personal",
    "skills",
    "skill",
    "work",
    "company",
    "knowledge",
    "information",
    "com",
}

SKILL_STOPLIST_JSON = Path(__file__).resolve().parents[2] / "my-app/convex/lib/taxonomy/stoplist.json"

DROP_SENTINEL = "__DROP__"

# Mapping from ESCO domain codes to human-readable buckets (subset for reporting).
ESCO_DOMAIN_MAP = {
    "1": "Managers",
    "2": "Professionals",
    "3": "Technicians",
    "4": "Clerical",
    "5": "Service",
    "6": "Agriculture",
    "7": "Craft",
    "8": "Machine",
    "9": "Elementary",
    "ICT": "ICT",
    "SERVICES": "Services",
    "HEALTH": "Healthcare",
}

ESCO_DOMAIN_KEYWORDS: Dict[str, Tuple[str, ...]] = {
    "ICT": ("ict", "software", "developer", "program", "python", "java", "sql", "cloud", "data", "network", "cyber", "ai", "ml"),
    "Healthcare": ("medical", "nurse", "clinic", "patient", "health", "pharma", "hospital", "surgery"),
    "Finance": ("finance", "account", "tax", "audit", "bank", "investment", "financial"),
    "Services": ("customer", "service", "retail", "hospitality", "sales", "support", "client"),
    "Education": ("teach", "training", "education", "learning", "instruct"),
    "Engineering": ("engineer", "mechanic", "electrical", "civil", "manufactur", "design"),
    "Construction": ("construct", "building", "architecture", "carpenter", "plumb"),
    "Logistics": ("logistic", "transport", "warehouse", "supply", "shipping", "inventory"),
    "Administration": ("admin", "administrative", "clerical", "office", "secretar", "assistant"),
}


def load_term_list(path: Optional[Path]) -> Set[str]:
    """Load newline-delimited term list from disk, normalizing entries."""

    terms: Set[str] = set()
    if not path:
        return terms
    path = path.expanduser()
    if not path.exists():
        print(f"Term list not found at {path}, skipping")
        return terms
    try:
        with path.open(encoding="utf-8") as fh:
            for line in fh:
                value = line.strip().lower()
                if not value or value.startswith("#"):
                    continue
                terms.add(value)
    except Exception as exc:  # pragma: no cover - defensive
        print(f"Failed to load terms from {path}: {exc}")
    return terms


_SKILL_REPLACEMENTS = {
    "mgmt": "management",
    "mgr": "manager",
    "js": "javascript",
    "reactjs": "react",
    "react js": "react",
    "nodejs": "node.js",
    "node js": "node.js",
    "emails": "email",
    "soft skills": "soft skill",
    "hard skills": "hard skill",
    "full-stack": "full stack",
    "fullstack": "full stack",
    "c sharp": "c#",
    "c ++": "c++",
    "power point": "powerpoint",
}


def normalize_skill_form(value: str) -> str:
    """Normalize SKILL surface text for matching and aggregation."""

    if not value:
        return ""
    text = unicodedata.normalize("NFKC", value).lower().strip()
    text = text.replace("&", " and ")
    text = re.sub(r"[\s]+", " ", text)
    text = text.rstrip(".,")
    if text in _SKILL_REPLACEMENTS:
        text = _SKILL_REPLACEMENTS[text]

    # Handle hyphenated variants
    text = text.replace("-", " ")
    text = re.sub(r"\s+", " ", text).strip()

    # Simple plural/alias handling on last token
    tokens = text.split()
    if tokens:
        last = tokens[-1]
        if last.endswith("ies") and len(last) > 3:
            last = last[:-3] + "y"
        elif last.endswith("ses") and len(last) > 4:
            last = last[:-2]
        elif last.endswith("s") and not last.endswith("ss") and len(last) > 3:
            last = last[:-1]
        tokens[-1] = last
        text = " ".join(tokens)

    return text.strip()

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
YEAR_RANGE_REGEX = re.compile(
    r"(?P<start>(?:19|20)\d{2})\s*(?:-|to|–|—|until)\s*(?P<end>(?:19|20)\d{2}|present|Present|PRESENT)"
)
YEAR_REGEX = re.compile(r"(19|20)\d{2}")
PRESENT_REGEX = re.compile(r"\b(present|current)\b", re.IGNORECASE)

BLANK_BREAK_RE = re.compile(r"\n{2,}")
SENTENCE_BREAK_RE = re.compile(r"(?<=[.!?])\s+")
HEADING_BREAK_RE = re.compile(r"\n(?=[A-Z][A-Za-z0-9/&+,\- ]{2,}\n)")


def _load_stoplist_terms(path: Path) -> Set[str]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return set()
    except Exception as exc:  # pragma: no cover - defensive fallback
        print(f"[prepare_dataset] Failed to parse stoplist at {path}: {exc}")
        return set()

    terms: Set[str] = set()
    if isinstance(raw, dict):
        if "terms" in raw and isinstance(raw["terms"], list):
            terms.update(str(term).lower() for term in raw["terms"])
        if "categories" in raw and isinstance(raw["categories"], dict):
            for values in raw["categories"].values():
                if isinstance(values, list):
                    terms.update(str(term).lower() for term in values)
    elif isinstance(raw, list):
        terms.update(str(term).lower() for term in raw)
    return terms


def load_default_skill_stoplist() -> Set[str]:
    """Return the canonical SKILL stoplist (with fallback if missing)."""

    terms = _load_stoplist_terms(SKILL_STOPLIST_JSON)
    if not terms:
        terms = set(FALLBACK_SKILL_STOPLIST)
    normalized = {normalize_skill_form(term) for term in terms if term}
    return {term for term in normalized if term}


DEFAULT_SKILL_STOPLIST = load_default_skill_stoplist()

WP_HIST_BINS = [128, 256, 384, 480, 512, 640, 768, 960, 1200]


def sanitize_text(text: str) -> str:
    """Replace surrogate code points that spaCy cannot process."""

    return "".join(
        ch if not (0xD800 <= ord(ch) <= 0xDFFF) else " " for ch in text
    )


def load_mapping_file(path: Optional[Path]) -> Dict[str, str]:
    if not path:
        return {}
    path = path.expanduser()
    if not path.exists():
        print(f"Mapping file not found at {path}, skipping override")
        return {}
    data = yaml.safe_load(path.read_text())
    if isinstance(data, dict) and "mappings" in data and isinstance(data["mappings"], dict):
        data = data["mappings"]
    if not isinstance(data, dict):
        print(f"Mapping file {path} has unexpected format; expected dict")
        return {}
    mapping = {}
    for raw, canonical in data.items():
        if not isinstance(raw, str):
            continue
        if not canonical:
            continue
        mapping[raw.strip()] = str(canonical).strip()
    return mapping


def load_esco_preferred_labels(path: Optional[Path]) -> Set[str]:
    if not path:
        return set()
    path = path.expanduser()
    if not path.exists():
        print(f"ESCO skills file not found at {path}; skipping coverage report")
        return set()
    try:
        return load_esco_label_list(path)
    except Exception as exc:  # pragma: no cover - defensive
        print(f"Failed to load ESCO skills from {path}: {exc}")
        return set()


def load_esco_domain_map(path: Optional[Path]) -> Dict[str, str]:
    domain_map: Dict[str, str] = {}
    if not path:
        return domain_map
    path = path.expanduser()
    if not path.exists():
        return domain_map
    try:
        with path.open(encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                label = (row.get("preferredLabel") or "").strip().lower()
                domain = (row.get("iscoGroup") or row.get("isco08Code") or "").strip()
                if label and domain:
                    domain_map[label] = domain
                alt = row.get("altLabels") or ""
                if alt and domain:
                    for part in split_alt_labels(alt):
                        part = part.strip().lower()
                        if part:
                            domain_map[part] = domain
    except Exception as exc:  # pragma: no cover - defensive
        print(f"Failed to load ESCO domains from {path}: {exc}")
    return domain_map


def report_skill_coverage(
    builder: "CorpusBuilder",
    esco_path: Optional[Path],
    *,
    whitelist: Optional[Set[str]] = None,
) -> None:
    if not builder.skill_forms:
        print("No SKILL spans recorded; skipping ESCO coverage")
        return
    esco_labels = load_esco_preferred_labels(esco_path)
    if not esco_labels:
        return
    normalised_esco = {normalize_skill_form(form) for form in esco_labels}
    whitelist = {normalize_skill_form(term) for term in (whitelist or set()) if term}
    total_forms = len(builder.skill_forms)
    matched = sum(1 for form in builder.skill_forms if form in normalised_esco or form in whitelist)
    coverage = matched / total_forms * 100 if total_forms else 0.0
    print(
        f"ESCO coverage for SKILL spans: {matched}/{total_forms} unique forms ({coverage:.2f}%)"
    )
    unmatched = [form for form in builder.skill_forms if form not in normalised_esco and form not in whitelist]
    unmatched.sort(key=lambda f: builder.skill_forms[f], reverse=True)
    if unmatched:
        preview = ", ".join(unmatched[:10])
        print(f"Top unmatched skill forms: {preview}")


def report_skill_coverage_weighted(
    builder: "CorpusBuilder",
    esco_path: Optional[Path],
    *,
    esco_forms: Optional[Set[str]] = None,
    whitelist: Optional[Set[str]] = None,
    report_domains: bool = False,
) -> None:
    if not builder.skill_forms:
        print("No SKILL spans recorded; skipping ESCO coverage")
        return
    if esco_forms is None:
        esco_forms = load_esco_preferred_labels(esco_path)
    if not esco_forms and not whitelist:
        return
    normalised_esco = {normalize_skill_form(form) for form in esco_forms}
    whitelist_set = {normalize_skill_form(term) for term in (whitelist or set()) if term}

    total_forms = len(builder.skill_forms)
    matched_forms = sum(1 for form in builder.skill_forms if form in normalised_esco or form in whitelist_set)
    total_freq = sum(builder.skill_forms.values())
    matched_freq = sum(
        count for form, count in builder.skill_forms.items() if form in normalised_esco or form in whitelist_set
    )

    print(
        "ESCO coverage (forms):     {}/{} ({:.2f}%)".format(
            matched_forms,
            total_forms,
            (matched_forms / total_forms * 100.0) if total_forms else 0.0,
        )
    )
    print(
        "ESCO coverage (frequency): {}/{} ({:.2f}%)".format(
            matched_freq,
            total_freq,
            (matched_freq / total_freq * 100.0) if total_freq else 0.0,
        )
    )

    if report_domains:
        domain_map = load_esco_domain_map(esco_path)
        domain_counts: Counter[str] = Counter()
        for form, count in builder.skill_forms.items():
            domain_code = domain_map.get(form)
            if domain_code:
                label = ESCO_DOMAIN_MAP.get(domain_code.upper(), domain_code)
                domain_counts[label] += count
                continue
            lower_form = form.lower()
            matched = False
            for domain, keywords in ESCO_DOMAIN_KEYWORDS.items():
                if any(keyword in lower_form for keyword in keywords):
                    domain_counts[domain] += count
                    matched = True
                    break
            if not matched:
                domain_counts["Other"] += count
        if domain_counts:
            print("ESCO domain coverage (frequency):")
            for domain, freq in domain_counts.most_common():
                print(f"  {domain}: {freq}")


def enforce_guardrails(
    *,
    train_counts: Counter[str],
    dev_counts: Counter[str],
    priority_labels: Set[str],
    min_per_label: int,
    min_per_label_default: int,
) -> None:
    failed: List[str] = []
    for label in priority_labels:
        actual = train_counts.get(label, 0)
        if min_per_label > 0 and actual < min_per_label:
            failed.append(f"{label}={actual} (<{min_per_label})")

    for label, actual in train_counts.items():
        if label in priority_labels:
            continue
        if min_per_label_default > 0 and actual < min_per_label_default:
            failed.append(f"{label}={actual} (<{min_per_label_default})")

    if failed:
        raise RuntimeError(
            "Training label minimums not met: " + ", ".join(sorted(failed))
        )

    total_counts = Counter(train_counts) + Counter(dev_counts)
    missing_priority = [
        label for label in sorted(priority_labels) if total_counts.get(label, 0) == 0
    ]
    if missing_priority:
        raise RuntimeError(
            "Priority labels missing after balancing: " + ", ".join(missing_priority)
        )

    train_total = sum(train_counts.values())
    dev_total = sum(dev_counts.values())
    if train_total == 0 or dev_total == 0:
        raise RuntimeError(
            f"Zero entities after filtering (train={train_total}, dev={dev_total}). Check dataset preprocessing and guardrails."
        )

    skill_total = train_counts.get("SKILL", 0)
    if skill_total < 20000:
        raise RuntimeError(
            "SKILL spans below 20000 after filtering (train={}). Increase --keep-top-skill-forms or disable ESCO filtering.".format(
                skill_total
            )
        )


@dataclass
class ParsedRecord:
    """Container for a single text and its entity spans."""

    text: str
    spans: List[Tuple[int, int, str]]
    source: str
    identifier: Optional[str] = None


class CorpusBuilder:
    """Aggregate parsed records and export spaCy DocBins."""

    def __init__(
        self,
        lang: str = "en",
        *,
        max_wp: int = 480,
        tokenizer_name: str = "roberta-base",
        drop_labels: Optional[Iterable[str]] = None,
    ) -> None:
        self.records: List[ParsedRecord] = []
        self.skipped: Counter[str] = Counter()
        self.raw_label_counts: Counter[str] = Counter()
        self.source_doc_counts: Counter[str] = Counter()
        self.lang = lang
        self._nlp = spacy.blank(lang)
        self.max_wp = max_wp
        self.drop_labels: Set[str] = {label.upper() for label in (drop_labels or [])}
        self.pre_drop_counts: Counter[str] = Counter()
        self.skill_forms: Counter[str] = Counter()
        self.unmapped_labels: Counter[str] = Counter()
        self.dropped_spans: Counter[str] = Counter()
        self.stoplist_hits: Counter[str] = Counter()
        self.skill_whitelist: Set[str] = set()
        self.skill_stoplist: Set[str] = set()
        self.set_skill_whitelist(DEFAULT_SKILL_WHITELIST)
        self.set_skill_stoplist(DEFAULT_SKILL_STOPLIST)
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(
                tokenizer_name, use_fast=True
            )
        except Exception as exc:  # pragma: no cover - handled in tests
            raise RuntimeError(
                f"Failed to load tokenizer '{tokenizer_name}' for chunking"
            ) from exc
        if not getattr(self.tokenizer, "is_fast", False):
            raise ValueError("A fast tokenizer is required for wordpiece chunking.")
        if hasattr(self.tokenizer, "model_max_length"):
            self.tokenizer.model_max_length = max(self.max_wp, 1_000_000_000)
        self.wp_hist_before: Counter[str] = Counter()
        self.wp_hist_after: Counter[str] = Counter()
        self._wp_bins = WP_HIST_BINS
        self._seed = None
        self.user_mapping: Dict[str, str] = {}
        self.esco_coverage: Optional[Tuple[int, int]] = None

    def skip(self, reason: str, increment: int = 1) -> None:
        self.skipped[reason] += increment

    def set_mapping(self, mapping: Dict[str, str]) -> None:
        self.user_mapping = {raw.lower(): value.upper() for raw, value in mapping.items() if value}

    def record_dropped_surface(self, surface: str) -> None:
        surface = (surface or "").strip()
        if not surface:
            surface = "(empty)"
        if len(surface) > 64:
            surface = surface[:61] + "..."
        self.dropped_spans[surface] += 1

    def record_stoplist_hit(self, surface: str) -> None:
        surface = (surface or "").strip()
        if not surface:
            surface = "(empty)"
        if len(surface) > 64:
            surface = surface[:61] + "..."
        self.stoplist_hits[surface] += 1

    def set_skill_whitelist(self, whitelist: Iterable[str]) -> None:
        self.skill_whitelist = {normalize_skill_form(term) for term in whitelist if term}

    def set_skill_stoplist(self, stoplist: Iterable[str]) -> None:
        self.skill_stoplist = {normalize_skill_form(term) for term in stoplist if term}

    def _recount_skill_forms(self) -> None:
        self.skill_forms = Counter()
        for rec in self.records:
            for start, end, label in rec.spans:
                if label == "SKILL":
                    normalized = normalize_skill_form(rec.text[start:end])
                    if not normalized or normalized in self.skill_stoplist:
                        continue
                    self.skill_forms[normalized] += 1

    def refresh_skill_forms(self) -> None:
        self._recount_skill_forms()

    def filter_skill_spans(
        self,
        *,
        esco_forms: Optional[Set[str]] = None,
        top_n: Optional[int] = None,
        whitelist: Optional[Set[str]] = None,
        hybrid: bool = False,
        min_freq: int = 0,
        hybrid_stoplist: Optional[Set[str]] = None,
    ) -> Dict[str, float]:
        whitelist = {form.lower().strip() for form in (whitelist or set()) if form}
        hybrid_stoplist = {normalize_skill_form(term) for term in (hybrid_stoplist or set()) if term}
        stats: Dict[str, float] = {}

        pre_counts = self.get_label_counts()
        pre_skill_total = pre_counts.get("SKILL", 0)
        if pre_skill_total == 0:
            stats.update(
                {
                    "pre_total": 0,
                    "post_total": 0,
                    "forms_before": 0,
                    "forms_after": 0,
                    "retained_pct": 100.0,
                    "removed_spans": 0,
                    "removed_docs": 0,
                }
            )
            return stats

        surface_counts: Counter[str] = Counter()
        for rec in self.records:
            for start, end, label in rec.spans:
                if label == "SKILL":
                    normalized = normalize_skill_form(rec.text[start:end])
                    if not normalized:
                        continue
                    if normalized in self.skill_stoplist:
                        continue
                    surface_counts[normalized] += 1

        normalized_esco = {normalize_skill_form(form) for form in esco_forms} if esco_forms else set()

        if hybrid:
            allowed_forms = set()
            if normalized_esco:
                allowed_forms |= {form for form in surface_counts if form in normalized_esco}
            if min_freq > 0:
                allowed_forms |= {form for form, count in surface_counts.items() if count >= min_freq}
            if whitelist:
                allowed_forms |= {form for form in surface_counts if form in whitelist}
            allowed_forms -= hybrid_stoplist
        else:
            allowed_forms = set(surface_counts)
            if normalized_esco and top_n is not None and top_n > 0:
                allowed_forms = {
                    form
                    for form in allowed_forms
                    if form in normalized_esco or form in whitelist
                }
            if whitelist:
                allowed_forms |= {form for form in surface_counts if form in whitelist}

        stats["forms_before"] = float(len(surface_counts))

        if top_n is not None and top_n > 0 and len(allowed_forms) > top_n:
            top_forms = {form for form, _ in surface_counts.most_common(top_n)}
            allowed_forms &= top_forms

        if not allowed_forms:
            # Avoid dropping every skill – fall back to keeping the most common ones.
            fallback_top = [form for form, _ in surface_counts.most_common(top_n or len(surface_counts))]
            allowed_forms = set(fallback_top)
            if whitelist:
                allowed_forms |= {form for form in surface_counts if form in whitelist}
            allowed_forms -= hybrid_stoplist

        new_records: List[ParsedRecord] = []
        removed_spans = 0
        removed_docs = 0
        new_source_counts: Counter[str] = Counter()

        for rec in self.records:
            new_spans: List[Tuple[int, int, str]] = []
            for start, end, label in rec.spans:
                if label != "SKILL":
                    new_spans.append((start, end, label))
                    continue
                normalized = normalize_skill_form(rec.text[start:end])
                if normalized in self.skill_stoplist or normalized in hybrid_stoplist:
                    self.record_stoplist_hit(normalized)
                    continue
                if normalized and normalized in allowed_forms:
                    new_spans.append((start, end, label))
                else:
                    removed_spans += 1
            if new_spans:
                new_records.append(
                    ParsedRecord(
                        text=rec.text,
                        spans=new_spans,
                        source=rec.source,
                        identifier=rec.identifier,
                    )
                )
                new_source_counts[rec.source] += 1
            else:
                removed_docs += 1

        self.records = new_records
        self.source_doc_counts = new_source_counts
        self.raw_label_counts = self.get_label_counts()
        self._recount_skill_forms()

        post_skill_total = self.raw_label_counts.get("SKILL", 0)
        dropped_counts = sorted(
            ((form, surface_counts[form]) for form in surface_counts if form not in allowed_forms),
            key=lambda item: item[1],
            reverse=True,
        )
        stats.update(
            {
                "pre_total": float(pre_skill_total),
                "post_total": float(post_skill_total),
                "forms_after": float(len(self.skill_forms)),
                "removed_spans": float(removed_spans),
                "removed_docs": float(removed_docs),
                "retained_pct": (post_skill_total / pre_skill_total * 100.0) if pre_skill_total else 100.0,
                "dropped_forms": dropped_counts,
            }
        )
        return stats

    def map_label(
        self,
        raw_label: str,
        fallback: Optional[str] = None,
        *,
        track_unmapped: bool = True,
    ) -> Optional[str]:
        key = raw_label.strip().lower()
        mapped = self.user_mapping.get(key)
        if mapped:
            if mapped == "DROP":
                return DROP_SENTINEL
            return mapped
        if fallback:
            return fallback
        if track_unmapped:
            self.unmapped_labels[raw_label] += 1
        return None

    def add_record(self, record: ParsedRecord) -> None:
        for chunk in self._chunk_record(record):
            self._add_chunk(chunk)

    def _add_chunk(self, record: ParsedRecord) -> None:
        cleaned: List[Tuple[int, int, str]] = []
        seen: set[Tuple[int, int, str]] = set()
        text_len = len(record.text)

        for start, end, label in record.spans:
            if label not in CANONICAL_LABELS:
                self.skip(f"{record.source}:unknown_canonical:{label}")
                continue
            self.pre_drop_counts[label] += 1
            if label in self.drop_labels:
                continue
            if not isinstance(start, int) or not isinstance(end, int):
                self.skip(f"{record.source}:non_int_span")
                continue
            if start < 0 or end > text_len or end <= start:
                self.skip(f"{record.source}:span_bounds")
                continue
            span_text = record.text[start:end]
            if not span_text:
                self.skip(f"{record.source}:empty_span")
                continue
            # Trim leading/trailing whitespace that confuses the transition parser.
            leading = len(span_text) - len(span_text.lstrip())
            trailing = len(span_text.rstrip())
            trimmed_start = start + leading
            trimmed_end = start + trailing
            if trimmed_end <= trimmed_start:
                self.skip(f"{record.source}:whitespace_span")
                continue
            if trimmed_start != start or trimmed_end != end:
                start, end = trimmed_start, trimmed_end
            key = (start, end, label)
            if key in seen:
                self.skip(f"{record.source}:duplicate_span")
                continue
            normalized_skill: Optional[str] = None
            if label == "SKILL":
                normalized_skill = normalize_skill_form(span_text)
                if normalized_skill in self.skill_stoplist:
                    self.record_stoplist_hit(normalized_skill)
                    continue
                if not normalized_skill:
                    continue

            cleaned.append(key)
            seen.add(key)
            self.raw_label_counts[label] += 1
            if label == "SKILL" and normalized_skill:
                self.skill_forms[normalized_skill] += 1

        if not cleaned:
            self.skip(f"{record.source}:no_valid_spans")
            return

        self.records.append(ParsedRecord(record.text, cleaned, record.source, record.identifier))
        self.source_doc_counts[record.source] += 1

    def _chunk_record(self, record: ParsedRecord) -> List[ParsedRecord]:
        text = record.text
        if not text:
            return []

        encoding = self.tokenizer(
            text,
            add_special_tokens=False,
            return_offsets_mapping=True,
        )
        offsets = [(int(start), int(end)) for start, end in encoding["offset_mapping"]]
        wp_len = len(encoding["input_ids"])
        self._update_wp_hist(self.wp_hist_before, wp_len)

        if wp_len <= self.max_wp or wp_len == 0:
            self._update_wp_hist(self.wp_hist_after, wp_len)
            return [record]

        blank_breaks = sorted({m.end() for m in BLANK_BREAK_RE.finditer(text)})
        heading_breaks = sorted({m.start() for m in HEADING_BREAK_RE.finditer(text)})
        sentence_breaks = sorted({m.end() for m in SENTENCE_BREAK_RE.finditer(text)})
        if text:
            sentence_breaks.append(len(text))

        n_wp = len(offsets)
        if n_wp == 0:
            self.skip(f"{record.source}:no_offsets")
            return []

        chunk_infos: List[Dict[str, int]] = []
        start_index = 0
        current_char = 0

        while start_index < n_wp:
            default_end_index = min(start_index + self.max_wp, n_wp)
            window_offsets = offsets[start_index:default_end_index]
            token_end = max(end for _, end in window_offsets)
            char_limit = min(token_end, len(text))
            break_char = self._select_break_char(
                current_char, char_limit, blank_breaks, heading_breaks, sentence_breaks
            )
            end_index = self._char_to_wp_index(offsets, start_index, break_char)
            if end_index <= start_index:
                end_index = default_end_index
                chunk_end_char = min(
                    max(end for _, end in offsets[start_index:end_index]), len(text)
                )
            else:
                chunk_end_char = min(
                    max(break_char, max(end for _, end in offsets[start_index:end_index])),
                    len(text),
                )

            chunk_start_char = current_char
            if chunk_start_char > chunk_end_char:
                chunk_start_char = max(0, min(offsets[start_index][0], chunk_end_char))

            chunk_infos.append(
                {
                    "start_char": chunk_start_char,
                    "end_char": chunk_end_char,
                    "start_wp": start_index,
                    "end_wp": end_index,
                }
            )

            start_index = end_index
            current_char = chunk_end_char

        if chunk_infos:
            chunk_infos[-1]["end_char"] = len(text)

        for info in chunk_infos:
            info["spans"] = []  # type: ignore[assignment]

        crossed = 0
        for start, end, label in record.spans:
            assigned = False
            for info in chunk_infos:
                start_char = info["start_char"]
                end_char = info["end_char"]
                if start_char <= start and end <= end_char:
                    info["spans"].append((start - start_char, end - start_char, label))  # type: ignore[index]
                    assigned = True
                    break
                if start < end_char and end > end_char:
                    crossed += 1
                    assigned = True
                    break
            if not assigned:
                self.skip(f"{record.source}:span_out_of_range")

        if crossed:
            self.skip(f"{record.source}:chunk_span_split", crossed)

        chunk_records: List[ParsedRecord] = []
        for idx, info in enumerate(chunk_infos):
            spans = info["spans"]  # type: ignore[index]
            if not spans:
                continue
            start_char = info["start_char"]
            end_char = info["end_char"]
            if end_char <= start_char:
                continue
            text_slice = text[start_char:end_char]
            chunk_wp_len = max(info["end_wp"] - info["start_wp"], 0)
            self._update_wp_hist(self.wp_hist_after, chunk_wp_len)
            chunk_records.append(
                ParsedRecord(
                    text=text_slice,
                    spans=spans,
                    source=record.source,
                    identifier=(f"{record.identifier}#chunk{idx}" if record.identifier else None),
                )
            )

        return chunk_records

    def _select_break_char(
        self,
        current_char: int,
        char_limit: int,
        blank_breaks: List[int],
        heading_breaks: List[int],
        sentence_breaks: List[int],
    ) -> int:
        if char_limit <= current_char:
            return char_limit
        for breaks in (blank_breaks, heading_breaks, sentence_breaks):
            idx = bisect_right(breaks, char_limit) - 1
            if idx >= 0 and breaks[idx] > current_char:
                return breaks[idx]
        return char_limit

    def _char_to_wp_index(
        self, offsets: List[Tuple[int, int]], start_index: int, char_pos: int
    ) -> int:
        end_index = start_index
        for i in range(start_index, len(offsets)):
            token_start, token_end = offsets[i]
            if token_end <= char_pos:
                end_index = i + 1
            else:
                break
        return end_index

    def _update_wp_hist(self, hist: Counter[str], value: int) -> None:
        if value < 0:
            value = 0
        label = self._wp_bin_label(value)
        hist[label] += 1

    def _wp_bin_label(self, value: int) -> str:
        if not self._wp_bins:
            return str(value)
        if value <= self._wp_bins[0]:
            return f"<= {self._wp_bins[0]}"
        prev = self._wp_bins[0]
        for limit in self._wp_bins[1:]:
            if value <= limit:
                return f"{prev + 1}-{limit}"
            prev = limit
        return f"> {self._wp_bins[-1]}"

    def _wp_hist_labels(self) -> List[str]:
        if not self._wp_bins:
            return []
        labels = [f"<= {self._wp_bins[0]}"]
        prev = self._wp_bins[0]
        for limit in self._wp_bins[1:]:
            labels.append(f"{prev + 1}-{limit}")
            prev = limit
        labels.append(f"> {self._wp_bins[-1]}")
        return labels

    @staticmethod
    def _normalize_text(text: str) -> str:
        return " ".join(text.lower().split())

    def deduplicate_records(self, max_per_text: int = 1) -> int:
        if max_per_text <= 0:
            max_per_text = 1
        counts: Dict[str, int] = {}
        unique: List[ParsedRecord] = []
        removed = 0
        for record in self.records:
            key = self._normalize_text(record.text)
            count = counts.get(key, 0)
            if count >= max_per_text:
                removed += 1
                continue
            counts[key] = count + 1
            unique.append(record)
        self.records = unique
        source_counts: Counter[str] = Counter()
        for record in unique:
            source_counts[record.source] += 1
        self.source_doc_counts = source_counts
        self._recount_skill_forms()
        return removed

    def get_label_counts(self, records: Optional[Sequence[ParsedRecord]] = None) -> Counter[str]:
        target = records if records is not None else self.records
        counts: Counter[str] = Counter()
        for rec in target:
            for _, _, label in rec.spans:
                counts[label] += 1
        return counts

    def oversample_records(
        self,
        *,
        target_map: Dict[str, int],
        rng: random.Random,
        target_labels: Optional[Iterable[str]] = None,
        max_per_label: Optional[int] = None,
    ) -> Counter[str]:
        additions: Counter[str] = Counter()
        if not target_map:
            return additions

        counts = self.get_label_counts()
        labels = list(target_labels) if target_labels is not None else list(target_map.keys())
        label_to_records: Dict[str, List[ParsedRecord]] = defaultdict(list)
        for rec in self.records:
            seen_labels = {label for _, _, label in rec.spans}
            for label in seen_labels:
                if label in self.drop_labels:
                    continue
                label_to_records[label].append(rec)

        for label in labels:
            if label in self.drop_labels:
                continue
            target = target_map.get(label)
            if target is None or target <= 0:
                continue
            current = counts.get(label, 0)
            if current >= target:
                continue
            pool = label_to_records.get(label, [])
            if not pool:
                continue
            while current < target:
                if max_per_label is not None and additions.get(label, 0) >= max_per_label:
                    break
                template = rng.choice(pool)
                duplicate = ParsedRecord(
                    text=template.text,
                    spans=list(template.spans),
                    source=f"{template.source}|oversample",
                    identifier=template.identifier,
                )
                self.records.append(duplicate)
                additions[label] += 1
                pool.append(duplicate)
                label_to_records[label] = pool
                for span_start, span_end, lbl in duplicate.spans:
                    counts[lbl] += 1
                    if lbl == "SKILL":
                        surface = duplicate.text[span_start:span_end].strip().lower()
                        if surface:
                            self.skill_forms[surface] += 1
                    target_lbl = target_map.get(lbl)
                    if target_lbl is None or target_lbl <= counts[lbl]:
                        continue
                current = counts[label]
        return additions

    def augment_priority_labels(
        self,
        *,
        target_map: Dict[str, int],
        rng: random.Random,
        priority_labels: Iterable[str],
    ) -> Counter[str]:
        added = Counter()
        if not target_map:
            return added

        job_companies = [
            "Acme Corp",
            "Globex Corporation",
            "Initech",
            "Stark Industries",
            "Wayne Enterprises",
            "Umbra Labs",
        ]
        job_roles = [
            "Software Engineer",
            "Project Manager",
            "Data Scientist",
            "Product Designer",
            "DevOps Engineer",
            "Business Analyst",
        ]
        job_gpes = [
            "New York",
            "San Francisco",
            "Toronto",
            "Berlin",
            "Tokyo",
            "Sydney",
        ]
        years = ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022"]

        edu_institutions = [
            "Massachusetts Institute of Technology",
            "Stanford University",
            "University of Oxford",
            "University of Toronto",
            "National University of Singapore",
            "Imperial College London",
        ]
        edu_degrees = [
            "Bachelor of Science",
            "Master of Engineering",
            "Master of Science",
            "Bachelor of Arts",
            "Doctor of Philosophy",
            "MBA",
        ]

        counts = self.get_label_counts()
        priority_set = {label for label in priority_labels if label not in self.drop_labels}

        def add_job_record() -> None:
            company = rng.choice(job_companies)
            role = rng.choice(job_roles)
            start_year, end_year = sorted(rng.sample(years, 2))
            gpe = rng.choice(job_gpes)
            text = (
                f"{company} employed professionals in the role of {role} from {start_year} to {end_year} in {gpe}."
            )
            spans: List[Tuple[int, int, str]] = []
            spans.append((text.index(company), text.index(company) + len(company), "COMPANY"))
            spans.append((text.index(role), text.index(role) + len(role), "ROLE"))
            spans.append((text.index(start_year), text.index(start_year) + len(start_year), "START_DATE"))
            spans.append((text.index(end_year), text.index(end_year) + len(end_year), "END_DATE"))
            spans.append((text.index(gpe), text.index(gpe) + len(gpe), "GPE"))
            self.add_record(ParsedRecord(text=text, spans=spans, source="synthetic_job"))

        def add_edu_record() -> None:
            institution = rng.choice(edu_institutions)
            degree = rng.choice(edu_degrees)
            end_year = rng.choice(years)
            text = f"{institution} awarded a {degree} in {end_year}."
            spans: List[Tuple[int, int, str]] = []
            spans.append((text.index(institution), text.index(institution) + len(institution), "INSTITUTION"))
            spans.append((text.index(degree), text.index(degree) + len(degree), "DEGREE"))
            spans.append((text.index(end_year), text.index(end_year) + len(end_year), "END_DATE"))
            self.add_record(ParsedRecord(text=text, spans=spans, source="synthetic_edu"))

        def deficit_exists(target_labels: Iterable[str]) -> bool:
            for label in target_labels:
                if label not in priority_set:
                    continue
                target = target_map.get(label)
                if target is None or target <= 0:
                    continue
                if counts.get(label, 0) < target:
                    return True
            return False

        job_labels = ["ROLE", "COMPANY", "START_DATE", "END_DATE", "GPE"]
        edu_labels = ["INSTITUTION", "DEGREE", "END_DATE"]

        safety_cap = 5000
        iterations = 0
        while deficit_exists(job_labels) and iterations < safety_cap:
            add_job_record()
            for rec_label in job_labels:
                counts[rec_label] += 1
                added[rec_label] += 1
            iterations += 1

        iterations = 0
        while deficit_exists(edu_labels) and iterations < safety_cap:
            add_edu_record()
            counts["INSTITUTION"] += 1
            counts["DEGREE"] += 1
            counts["END_DATE"] += 1
            added["INSTITUTION"] += 1
            added["DEGREE"] += 1
            added["END_DATE"] += 1
            iterations += 1

        return added

    def cap_label_counts(
        self,
        caps: Dict[str, int],
        rng: random.Random,
    ) -> Counter[str]:
        if not caps:
            return Counter()
        counts = self.get_label_counts()
        to_remove: Set[int] = set()
        removed_docs: Counter[str] = Counter()
        label_to_indices: Dict[str, List[int]] = defaultdict(list)
        record_labels: List[Set[str]] = []
        for idx, rec in enumerate(self.records):
            labels = {label for _, _, label in rec.spans}
            record_labels.append(labels)
            for label in labels:
                label_to_indices[label].append(idx)

        for label, cap in caps.items():
            label = label.upper()
            if label in self.drop_labels:
                continue
            current = counts.get(label, 0)
            if cap <= 0 or current <= cap:
                continue
            indices = label_to_indices.get(label, [])
            if not indices:
                continue
            primary = [idx for idx in indices if record_labels[idx] == {label}]
            secondary = [idx for idx in indices if idx not in primary]
            rng.shuffle(primary)
            rng.shuffle(secondary)
            candidates = primary + secondary
            for idx in candidates:
                if current <= cap:
                    break
                if idx in to_remove:
                    continue
                to_remove.add(idx)
                removed_docs[label] += 1
                for _, _, lbl in self.records[idx].spans:
                    counts[lbl] = max(0, counts.get(lbl, 0) - 1)
                current = counts.get(label, 0)

        if to_remove:
            new_records = [rec for idx, rec in enumerate(self.records) if idx not in to_remove]
            self.records = new_records
            self.raw_label_counts = self.get_label_counts()
            self.skill_forms = Counter()
            for rec in self.records:
                for start, end, label in rec.spans:
                    if label == "SKILL":
                        surface = rec.text[start:end].strip().lower()
                        if surface:
                            self.skill_forms[surface] += 1

        return removed_docs

    def shuffle(
        self, rng: Optional[random.Random] = None, *, seed: Optional[int] = None
    ) -> None:
        """Shuffle records with optional deterministic seeding."""

        if rng is None:
            rng = random.Random(seed)
        elif seed is not None:
            rng.seed(seed)
        rng.shuffle(self.records)

    def train_dev_split(self, split_ratio: float) -> Tuple[List[ParsedRecord], List[ParsedRecord]]:
        if not self.records:
            return [], []
        split_index = max(1, min(len(self.records) - 1, int(len(self.records) * split_ratio)))
        train = self.records[:split_index]
        dev = self.records[split_index:]
        if not dev:
            dev = train[-1:]
        return train, dev


    def _docbin_from_records(
        self, records: Sequence[ParsedRecord]
    ) -> Tuple[DocBin, int, Counter[str]]:
        docbin = DocBin(store_user_data=False)
        label_counts: Counter[str] = Counter()
        docs_written = 0

        for rec in records:
            doc: Doc = self._nlp.make_doc(rec.text)
            ents: List[Span] = []
            for start, end, label in rec.spans:
                span = doc.char_span(start, end, label=label, alignment_mode="expand")
                if span is None:
                    self.skip(f"{rec.source}:charspan_none")
                    continue
                if any(existing.start < span.end and span.start < existing.end for existing in ents):
                    self.skip(f"{rec.source}:charspan_overlap")
                    continue
                ents.append(span)
                label_counts[label] += 1

            if not ents:
                self.skip(f"{rec.source}:no_ents_after_charspan")
                continue

            doc.ents = ents
            docbin.add(doc)
            docs_written += 1

        return docbin, docs_written, label_counts

    def export(self, train: Sequence[ParsedRecord], dev: Sequence[ParsedRecord], output_dir: Path) -> Dict[str, Counter[str]]:
        output_dir.mkdir(parents=True, exist_ok=True)

        train_docbin, train_docs, train_counts = self._docbin_from_records(train)
        dev_docbin, dev_docs, dev_counts = self._docbin_from_records(dev)

        train_docbin.to_disk(output_dir / "train.spacy")
        dev_docbin.to_disk(output_dir / "dev.spacy")

        print(f"train: docs={train_docs}, ents={sum(train_counts.values())}")
        print(f"dev:   docs={dev_docs}, ents={sum(dev_counts.values())}")

        total_counts = train_counts + dev_counts
        if total_counts:
            print("Entity counts (total):")
            for label in sorted(total_counts):
                print(
                    f"  {label}: total={total_counts[label]} (train={train_counts.get(label, 0)}, dev={dev_counts.get(label, 0)})"
                )

        hist_labels = self._wp_hist_labels()
        if hist_labels:
            if self.wp_hist_before:
                print("Wordpiece histogram (before chunking):")
                for bucket in hist_labels:
                    count = self.wp_hist_before.get(bucket, 0)
                    if count:
                        print(f"  {bucket}: {count}")
            if self.wp_hist_after:
                print("Wordpiece histogram (after chunking):")
                for bucket in hist_labels:
                    count = self.wp_hist_after.get(bucket, 0)
                    if count:
                        print(f"  {bucket}: {count}")

        if self.skipped:
            print("Skipped items:")
            for reason, count in self.skipped.most_common():
                print(f"  {reason}: {count}")

        return {"train": train_counts, "dev": dev_counts, "total": total_counts}


def ensure_priority_label_dev_coverage(
    *,
    train_records: List[ParsedRecord],
    dev_records: List[ParsedRecord],
    priority_labels: Sequence[str],
    rng: random.Random,
    target_dev_size: Optional[int] = None,
) -> Dict[str, int]:
    """Move records from train → dev to guarantee priority-label coverage."""

    adjustments: Dict[str, int] = {}

    def has_label(records: Sequence[ParsedRecord], label: str) -> bool:
        return any(lbl == label for rec in records for _, _, lbl in rec.spans)

    for label in priority_labels:
        if not label:
            continue
        moved_for_label = 0
        while not has_label(dev_records, label):
            candidates = [
                idx
                for idx, rec in enumerate(train_records)
                if any(lbl == label for _, _, lbl in rec.spans)
            ]
            if not candidates:
                break
            rng.shuffle(candidates)
            subset_size = 1
            if target_dev_size is not None and target_dev_size > 0:
                deficit = target_dev_size - len(dev_records)
                if deficit > 0:
                    subset_size = max(1, min(len(candidates), deficit))
            subset_size = max(1, min(len(candidates), subset_size))
            chosen = sorted(candidates[:subset_size], reverse=True)
            for idx in chosen:
                dev_records.append(train_records.pop(idx))
                moved_for_label += 1
            if moved_for_label == 0:
                break
        if moved_for_label:
            adjustments[label] = moved_for_label
    return adjustments


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare unified spaCy corpora from CV datasets")
    parser.add_argument(
        "inputs",
        metavar="PATH",
        nargs="*",
        type=Path,
        help="Dataset files or directories. If omitted and --output-dir is provided, known sources under that directory are used.",
    )
    parser.add_argument("--output-dir", type=Path, help="Directory to write train.spacy / dev.spacy")
    parser.add_argument("--split", type=float, default=0.8, help="Train/dev split ratio (0-1)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for shuffling")
    parser.add_argument("--lang", type=str, default="en", help="spaCy language code")
    parser.add_argument(
        "--max-wp",
        type=int,
        default=480,
        help="Maximum HuggingFace wordpieces per chunk before splitting",
    )
    parser.add_argument(
        "--drop-labels",
        nargs="*",
        default=["NAME", "GRADE"],
        help="Entity labels to drop from the dataset (case-insensitive)",
    )
    parser.add_argument(
        "--min-per-label",
        type=int,
        default=300,
        help="Target minimum examples per label after balancing",
    )
    parser.add_argument(
        "--min-per-label-default",
        type=int,
        default=100,
        help="Minimum count for non-priority labels after balancing",
    )
    parser.add_argument(
        "--priority-labels",
        nargs="*",
        default=["ROLE", "COMPANY", "INSTITUTION", "DEGREE", "START_DATE", "END_DATE"],
        help="Labels treated as priority for higher balancing thresholds",
    )
    parser.add_argument(
        "--oversample",
        dest="oversample",
        action="store_true",
        help="Duplicate documents so each label reaches target minimum (default on).",
    )
    parser.add_argument(
        "--no-oversample",
        dest="oversample",
        action="store_false",
        help="Disable oversampling",
    )
    parser.add_argument(
        "--max-oversample-per-label",
        type=int,
        default=2000,
        help="Maximum number of synthetic duplicates to add per label during oversampling.",
    )
    parser.add_argument(
        "--augment-missing",
        dest="augment_missing",
        action="store_true",
        help="Generate lightweight synthetic examples for priority labels (default on)",
    )
    parser.add_argument(
        "--no-augment-missing",
        dest="augment_missing",
        action="store_false",
        help="Disable synthetic augmentation",
    )
    parser.add_argument(
        "--dedup",
        action="store_true",
        help="Deduplicate documents with identical normalized text before splitting",
    )
    parser.add_argument(
        "--dedup-keep",
        type=int,
        default=1,
        help="Maximum number of duplicates to retain per normalized document when --dedup is set",
    )
    parser.add_argument(
        "--tokenizer-name",
        type=str,
        default="distilroberta-base",
        help="HuggingFace tokenizer name for wordpiece estimation",
    )
    parser.add_argument(
        "--auto-drop-threshold",
        type=int,
        default=0,
        help="Automatically drop labels whose total count is below this threshold",
    )
    parser.add_argument(
        "--cap-label",
        action="append",
        default=[],
        metavar="LABEL:COUNT",
        help="Cap the total count for specific labels before balancing",
    )
    parser.add_argument(
        "--mapping",
        type=Path,
        help="YAML file providing raw-to-canonical label mappings",
    )
    parser.add_argument(
        "--esco-skills-path",
        type=Path,
        default=Path("my-app/testdata/cv/esco/esco_labels.txt"),
        help="Path to ESCO skills list (CSV or newline-delimited text) for coverage reporting",
    )
    parser.add_argument(
        "--filter-skills-with-esco",
        nargs="?",
        const="__USE_DEFAULT__",
        type=str,
        help=(
            "Drop SKILL spans whose surface form is not present in the ESCO vocabulary. "
            "Provide an optional path to override --esco-skills-path; when omitted the default path is used. "
            "If the file is missing a warning is printed and filtering is skipped."
        ),
    )
    parser.add_argument(
        "--filter-skills-hybrid",
        action="store_true",
        help="Use hybrid SKILL filtering (keep ESCO matches and forms above frequency threshold, drop stoplisted terms)",
    )
    parser.add_argument(
        "--keep-top-skill-forms",
        type=int,
        default=10000,
        help="Retain only the top-N most frequent SKILL surface forms after optional ESCO filtering.",
    )
    parser.add_argument(
        "--min-skill-freq",
        type=int,
        default=5,
        help="Minimum frequency for SKILL forms to be retained when --filter-skills-hybrid is enabled",
    )
    parser.add_argument(
        "--disable-guardrails",
        action="store_true",
        help="Skip guardrail validation checks (intended for smoke tests only).",
    )
    parser.add_argument(
        "--report-esco-domains",
        action="store_true",
        help="If set, report SKILL counts grouped by ESCO domains after filtering.",
    )
    parser.add_argument(
        "--skill-whitelist",
        type=Path,
        help="Optional newline-delimited whitelist of SKILL surface forms retained even if absent from ESCO.",
    )
    parser.add_argument(
        "--skill-stoplist",
        type=Path,
        help=(
            "Optional newline-delimited stoplist of SKILL surface forms to drop before ESCO filtering. "
            "Defaults to my-app/convex/lib/taxonomy/stoplist.json."
        ),
    )
    parser.add_argument(
        "--stoplist-path",
        type=Path,
        help="Optional stoplist of SKILL forms removed during hybrid filtering (falls back to taxonomy stoplist).",
    )
    parser.add_argument(
        "--debug-config",
        type=Path,
        help="Optional spaCy config used to run `spacy debug data` after exporting corpora.",
    )
    parser.set_defaults(oversample=True, augment_missing=True)
    args = parser.parse_args()

    if args.output_dir is None:
        if len(args.inputs) < 2:
            parser.error("Provide at least one input and an output directory, or use --output-dir with inputs.")
        args.output_dir = args.inputs[-1]
        args.inputs = args.inputs[:-1]

    if not args.inputs:
        args.inputs = discover_sources(args.output_dir)
        if not args.inputs:
            parser.error("No input datasets supplied and none discovered automatically.")

    return args


def discover_sources(output_dir: Path) -> List[Path]:
    """Auto-discover known dataset paths located near the target output directory."""

    base = output_dir
    if not base.exists():
        base = output_dir.parent
    candidates = [
        base / "Entity_Recognition_in_Resumes.json",
        base / "ResumesJsonAnnotated",
        base / "ResumesJsonAnnotated_hug",
        base / "Resume-Corpus-Dataset-main" / "data-files",
    ]
    sources = [path for path in candidates if path.exists()]
    if sources:
        print("Discovered dataset sources:")
        for path in sources:
            print(f"  - {path}")
    return sources


def load_path(path: Path, builder: CorpusBuilder) -> None:
    if path.is_file():
        load_file(path, builder)
    elif path.is_dir():
        load_directory(path, builder)
    else:
        builder.skip("invalid_path")


def load_file(path: Path, builder: CorpusBuilder) -> None:
    source_name = path.name
    try:
        with path.open("r", encoding="utf-8") as fh:
            first_non_empty = next((line for line in fh if line.strip()), "")
    except StopIteration:
        builder.skip(f"{source_name}:empty_file")
        return
    except OSError:
        builder.skip(f"{source_name}:unreadable")
        return

    try:
        sample = json.loads(first_non_empty)
    except json.JSONDecodeError:
        builder.skip(f"{source_name}:json_decode")
        return

    if isinstance(sample, dict) and "annotation" in sample:
        load_dataturks_jsonl(path, builder)
    else:
        builder.skip(f"{source_name}:unsupported_file_format")


def load_directory(path: Path, builder: CorpusBuilder) -> None:
    json_files = sorted([p for p in path.glob("*.json") if p.is_file()])
    if not json_files and path.is_dir():
        # Maybe datasets nested one level down (e.g. Resume-Corpus root supplied)
        nested_data_files = sorted(path.glob("data-files"))
        for nested in nested_data_files:
            load_directory(nested, builder)
        if not nested_data_files:
            builder.skip(f"{path.name}:no_json_files")
        return

    sample_path = json_files[0] if json_files else None
    if sample_path is None:
        builder.skip(f"{path.name}:no_json_files")
        return

    try:
        sample = json.loads(sample_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        builder.skip(f"{path.name}:json_decode")
        return

    if isinstance(sample, dict) and {"text", "annotations"} <= sample.keys():
        load_span_dict_directory(path, builder)
    elif isinstance(sample, list):
        load_label_studio_export(path, builder)
    else:
        builder.skip(f"{path.name}:unsupported_directory_format")


def load_dataturks_jsonl(path: Path, builder: CorpusBuilder) -> None:
    with path.open("r", encoding="utf-8") as fh:
        for line_number, line in enumerate(fh, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError:
                builder.skip(f"dataturks:json_decode_line_{line_number}")
                continue

            text = raw.get("content") or raw.get("text")
            if not text:
                builder.skip("dataturks:missing_text")
                continue
            text = sanitize_text(text.replace("\r\n", "\n"))

            spans: List[Tuple[int, int, str]] = []
            annotations = raw.get("annotation") or []
            for ann in annotations:
                labels = ann.get("label") or []
                points = ann.get("points") or []

                if isinstance(labels, str):
                    labels = [labels]
                if isinstance(points, dict):
                    points = [points]

                for label in labels:
                    canonical = builder.map_label(label, DATATURKS_LABEL_MAP.get(label))
                    for point in points:
                        start = point.get("start")
                        end = point.get("end")
                        span_text = point.get("text")

                        if not isinstance(start, int) or not isinstance(end, int):
                            builder.skip("dataturks:non_int_point")
                            continue

                        snippet = text[start:end]
                        if canonical == DROP_SENTINEL:
                            builder.record_dropped_surface(snippet)
                            continue

                        if not canonical:
                            builder.skip(f"dataturks:label:{label}")
                            continue

                        if span_text:
                            cleaned_snippet = snippet.strip()
                            cleaned_point = sanitize_text(str(span_text)).strip()
                            if cleaned_snippet != cleaned_point:
                                builder.skip("dataturks:span_mismatch")
                                continue

                        if canonical == "EMAIL" and not EMAIL_REGEX.match(snippet.strip()):
                            builder.skip("dataturks:email_invalid")
                            continue

                        if canonical == "END_DATE":
                            spans.extend(
                                normalize_date_spans(
                                    text,
                                    start,
                                    end,
                                    source="dataturks",
                                    builder=builder,
                                )
                            )
                        else:
                            spans.append((start, end, canonical))

            if spans:
                builder.add_record(ParsedRecord(text=text, spans=spans, source="dataturks"))


def load_span_dict_directory(path: Path, builder: CorpusBuilder) -> None:
    source = path.name
    for json_path in path.glob("*.json"):
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            builder.skip(f"{source}:json_decode")
            continue

        text = data.get("text")
        if not isinstance(text, str):
            builder.skip(f"{source}:missing_text")
            continue

        text = sanitize_text(text.replace("\r\n", "\n"))

        annotations = data.get("annotations") or []
        spans: List[Tuple[int, int, str]] = []

        for ann in annotations:
            if isinstance(ann, dict):
                start = ann.get("start")
                end = ann.get("end")
                raw_label = ann.get("label") or ann.get("labels")
                if isinstance(raw_label, list):
                    raw_label = raw_label[0] if raw_label else None
            elif isinstance(ann, (list, tuple)) and len(ann) >= 3:
                start, end, raw_label = ann[:3]
            else:
                builder.skip(f"{source}:annotation_format")
                continue

            if raw_label is None:
                builder.skip(f"{source}:missing_label")
                continue

            base_label = str(raw_label).split(":", 1)[0].strip()
            canonical = builder.map_label(base_label, "SKILL" if base_label.upper() == "SKILL" else None)

            try:
                start_i = int(start)
                end_i = int(end)
            except (TypeError, ValueError):
                builder.skip(f"{source}:non_int_span")
                continue

            surface = text[start_i:end_i]

            if canonical == DROP_SENTINEL:
                builder.record_dropped_surface(surface)
                continue
            if not canonical:
                builder.skip(f"{source}:label:{base_label}")
                continue

            spans.append((start_i, end_i, canonical))

        if spans:
            builder.add_record(ParsedRecord(text=text, spans=spans, source=source, identifier=json_path.name))


def load_label_studio_export(path: Path, builder: CorpusBuilder) -> None:
    source = path.name
    json_files = sorted(path.glob("*.json"))

    for json_path in json_files:
        try:
            items = json.loads(json_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            builder.skip(f"{source}:json_decode")
            continue

        if not isinstance(items, list):
            builder.skip(f"{source}:unexpected_structure")
            continue

        for item in items:
            text = item.get("data", {}).get("text")
            if not isinstance(text, str):
                builder.skip(f"{source}:missing_text")
                continue

            text = sanitize_text(text.replace("\r\n", "\n"))

            annotations = item.get("annotations") or []
            if not annotations:
                builder.skip(f"{source}:no_annotations")
                continue

            # Choose the first completed annotation.
            selected = next((ann for ann in annotations if not ann.get("was_cancelled")), annotations[0])

            spans: List[Tuple[int, int, str]] = []
            for result in selected.get("result", []):
                if result.get("type") != "labels":
                    continue
                value = result.get("value") or {}
                labels = value.get("labels") or []
                if not labels:
                    continue
                start = value.get("start")
                end = value.get("end")
                snippet = value.get("text")

                try:
                    start_i = int(start)
                    end_i = int(end)
                except (TypeError, ValueError):
                    builder.skip(f"{source}:non_int_span")
                    continue

                text_slice = text[start_i:end_i]
                # Trust Label Studio offsets even if the stored snippet diverges via whitespace.

                for raw_label in labels:
                    spans.extend(
                        map_label_studio_label(
                            raw_label=str(raw_label),
                            text=text,
                            start=start_i,
                            end=end_i,
                            builder=builder,
                        )
                    )

            if spans:
                builder.add_record(ParsedRecord(text=text, spans=spans, source=source, identifier=str(item.get("id"))))


def map_label_studio_label(
    raw_label: str,
    text: str,
    start: int,
    end: int,
    builder: CorpusBuilder,
) -> List[Tuple[int, int, str]]:
    label = raw_label.strip()
    surface = text[start:end]

    mapped_override = builder.map_label(label, None, track_unmapped=False)
    if mapped_override == DROP_SENTINEL:
        builder.record_dropped_surface(surface)
        return []
    if mapped_override:
        return [(start, end, mapped_override)]

    if label in LABEL_STUDIO_MAP:
        mapped = builder.map_label(label, LABEL_STUDIO_MAP[label])
        if mapped == DROP_SENTINEL:
            builder.record_dropped_surface(surface)
            return []
        if mapped:
            return [(start, end, mapped)]

    if label in LABEL_STUDIO_SOFT_SKILLS:
        fallback = builder.map_label("SKILL", "SKILL", track_unmapped=False)
        if fallback == DROP_SENTINEL:
            builder.record_dropped_surface(surface)
            return []
        if fallback:
            return [(start, end, fallback)]

    if label in {"work_year", "work_years"}:
        return normalize_date_spans(text, start, end, source="labelstudio", builder=builder)

    if label == "birth_date":
        return normalize_date_spans(
            text,
            start,
            end,
            source="labelstudio",
            default_label="END_DATE",
            builder=builder,
        )

    sentinel = builder.map_label(label, None)
    if sentinel == DROP_SENTINEL:
        builder.record_dropped_surface(surface)
    builder.skip(f"labelstudio:label:{label}")
    return []


def normalize_date_spans(
    text: str,
    start: int,
    end: int,
    *,
    source: str,
    default_label: str = "END_DATE",
    builder: Optional[CorpusBuilder] = None,
) -> List[Tuple[int, int, str]]:
    snippet = text[start:end]
    spans: List[Tuple[int, int, str]] = []

    range_match = YEAR_RANGE_REGEX.search(snippet)
    if range_match:
        start_year = range_match.group("start")
        end_year = range_match.group("end")
        start_pos = snippet.find(start_year)
        if start_pos != -1:
            spans.append((start + start_pos, start + start_pos + len(start_year), "START_DATE"))
        if end_year.lower() not in {"present"}:
            end_pos = snippet.find(end_year, start_pos + len(start_year))
            if end_pos != -1:
                spans.append((start + end_pos, start + end_pos + len(end_year), "END_DATE"))
        else:
            present_pos = snippet.lower().find(end_year.lower())
            if present_pos != -1:
                spans.append((start + present_pos, start + present_pos + len(end_year), "END_DATE"))
        return spans

    years = list(YEAR_REGEX.finditer(snippet))
    if len(years) >= 2:
        first = years[0]
        last = years[-1]
        spans.append((start + first.start(), start + first.end(), "START_DATE"))
        spans.append((start + last.start(), start + last.end(), "END_DATE"))
        return spans

    if len(years) == 1:
        match = years[0]
        spans.append((start + match.start(), start + match.end(), default_label))
        return spans

    present_match = PRESENT_REGEX.search(snippet)
    if present_match:
        spans.append((start + present_match.start(), start + present_match.end(), "END_DATE"))
        return spans

    # If no date-like token is found, fall back to the original span with default label.
    spans.append((start, end, default_label))
    if builder is not None:
        builder.skip(f"{source}:date_unparsed")
    return spans


def main() -> None:
    args = parse_args()
    rng = random.Random(args.seed)
    builder = CorpusBuilder(
        lang=args.lang,
        max_wp=args.max_wp,
        tokenizer_name=args.tokenizer_name,
        drop_labels=args.drop_labels,
    )
    builder._seed = args.seed

    def _print_source_summary(title: str, counter: Counter[str]) -> None:
        if not counter:
            return
        print(title)
        for source, count in sorted(counter.items(), key=lambda item: (-item[1], item[0])):
            print(f"  {source}: {count}")

    whitelist_terms = set(DEFAULT_SKILL_WHITELIST)
    whitelist_terms.update(load_term_list(args.skill_whitelist))
    builder.set_skill_whitelist(whitelist_terms)

    stoplist_terms = set(DEFAULT_SKILL_STOPLIST)
    stoplist_terms.update(load_term_list(args.skill_stoplist))
    builder.set_skill_stoplist(stoplist_terms)

    hybrid_stoplist_terms = load_term_list(args.stoplist_path)

    mapping_overrides = load_mapping_file(args.mapping)
    if mapping_overrides:
        builder.set_mapping(mapping_overrides)

    for input_path in args.inputs:
        load_path(input_path, builder)

    raw_source_counts = Counter(builder.source_doc_counts)
    _print_source_summary("Source document counts (raw):", raw_source_counts)

    if args.dedup:
        removed = builder.deduplicate_records(max(1, args.dedup_keep))
        print(f"Deduplicated documents removed: {removed}")
    else:
        removed = 0

    if args.dedup:
        _print_source_summary("Source document counts (post-dedup):", Counter(builder.source_doc_counts))

    auto_dropped: Set[str] = set()
    if builder.pre_drop_counts:
        print("Label counts before dropping:")
        for label in sorted(builder.pre_drop_counts):
            print(f"  {label}: {builder.pre_drop_counts[label]}")

    if args.auto_drop_threshold and args.auto_drop_threshold > 0:
        for label, count in builder.pre_drop_counts.items():
            if label in builder.drop_labels:
                continue
            if count < args.auto_drop_threshold:
                auto_dropped.add(label)
        if auto_dropped:
            print(
                "Auto-dropping labels below threshold ({}): {}".format(
                    args.auto_drop_threshold, ", ".join(sorted(auto_dropped))
                )
            )
            builder.drop_labels.update(auto_dropped)

    if auto_dropped:
        filtered_records: List[ParsedRecord] = []
        for rec in builder.records:
            filtered_spans = [span for span in rec.spans if span[2] not in builder.drop_labels]
            if not filtered_spans:
                continue
            filtered_records.append(
                ParsedRecord(text=rec.text, spans=filtered_spans, source=rec.source, identifier=rec.identifier)
            )
        builder.records = filtered_records
        builder.raw_label_counts = builder.get_label_counts()
        builder.refresh_skill_forms()

    cap_dict: Dict[str, int] = {}
    for entry in args.cap_label:
        if ":" not in entry:
            continue
        label, value = entry.split(":", 1)
        try:
            cap_dict[label.upper()] = int(value)
        except ValueError:
            continue

    if cap_dict:
        cap_removed = builder.cap_label_counts(cap_dict, rng)
        if cap_removed:
            print("Label caps applied (documents removed):")
            for label in sorted(cap_removed):
                print(f"  {label}: -{cap_removed[label]}")

    counts_after_drop = builder.get_label_counts()
    if counts_after_drop:
        print("Label counts after drop/filtering (pre-balance):")
        for label in sorted(counts_after_drop):
            print(f"  {label}: {counts_after_drop[label]}")

    esco_filter_path: Optional[Path] = None
    esco_forms: Optional[Set[str]] = None
    if args.filter_skills_with_esco is not None:
        if args.filter_skills_with_esco == "__USE_DEFAULT__":
            esco_filter_path = args.esco_skills_path
        else:
            esco_filter_path = Path(args.filter_skills_with_esco).expanduser()
        if esco_filter_path and not esco_filter_path.exists():
            print(f"WARNING: ESCO skills file not found at {esco_filter_path}; skipping ESCO-based SKILL filtering")
            esco_filter_path = None
        elif esco_filter_path is not None:
            esco_forms = load_esco_preferred_labels(esco_filter_path)

    top_n = args.keep_top_skill_forms if args.keep_top_skill_forms and args.keep_top_skill_forms > 0 else None
    should_filter_skills = esco_filter_path is not None or (top_n is not None)
    if should_filter_skills:
        builder.refresh_skill_forms()
        filter_stats = builder.filter_skill_spans(
            esco_forms=esco_forms,
            top_n=top_n,
            whitelist=builder.skill_whitelist,
        )
        if filter_stats:
            print("SKILL filtering summary:")
            print(f"  spans before: {int(filter_stats['pre_total'])}")
            print(f"  spans after:  {int(filter_stats['post_total'])}")
            print(f"  forms before: {int(filter_stats['forms_before'])}")
            print(f"  forms after:  {int(filter_stats['forms_after'])}")
            print(
                "  retained:    {:.2f}% (removed spans: {}, removed docs: {})".format(
                    filter_stats.get("retained_pct", 100.0),
                    int(filter_stats.get("removed_spans", 0)),
                    int(filter_stats.get("removed_docs", 0)),
                )
            )
            if esco_forms:
                retained_forms = set(builder.skill_forms)
                if retained_forms:
                    normalized_esco = {normalize_skill_form(form) for form in esco_forms}
                    matched_forms = sum(
                        1 for form in retained_forms if form in normalized_esco or form in builder.skill_whitelist
                    )
                    coverage = matched_forms / len(retained_forms) * 100
                    print(
                        f"  ESCO coverage (retained forms): {matched_forms}/{len(retained_forms)} ({coverage:.2f}%)"
                    )
            dropped_forms = filter_stats.get("dropped_forms", [])
            if dropped_forms:
                print("  Top dropped forms:")
                for form, count in dropped_forms[:10]:
                    print(f"    {form}: {int(count)}")
            report_skill_coverage_weighted(
                builder,
                esco_filter_path,
                esco_forms=esco_forms,
                whitelist=builder.skill_whitelist,
                report_domains=args.report_esco_domains,
            )
        if builder.raw_label_counts.get("SKILL", 0) < 20000:
            print("WARNING: SKILL spans below 20k after filtering; consider relaxing filters or increasing top-N cap.")
        counts_after_drop = builder.get_label_counts()
        if counts_after_drop:
            print("Label counts after SKILL filtering:")
            for label in sorted(counts_after_drop):
                print(f"  {label}: {counts_after_drop[label]}")

    priority_labels = [label.upper() for label in args.priority_labels]
    priority_set = set(priority_labels)
    priority_min = max(args.min_per_label, args.min_per_label_default)
    target_map: Dict[str, int] = {}
    for label in CANONICAL_LABELS:
        if label in builder.drop_labels:
            continue
        if label in priority_set:
            target_map[label] = max(priority_min, 0)
        else:
            target_map[label] = max(args.min_per_label_default, 0)

    builder.shuffle(rng)
    train_records, dev_records = builder.train_dev_split(args.split)
    _print_source_summary("Source document counts (post-filtering):", Counter(rec.source for rec in builder.records))
    target_dev_size = len(dev_records)

    if not train_records and not dev_records:
        raise RuntimeError("No valid records collected; aborting.")

    train_keys = {builder._normalize_text(rec.text) for rec in train_records}
    overlap_counter: Counter[str] = Counter()
    for rec in dev_records:
        key = builder._normalize_text(rec.text)
        if key in train_keys:
            overlap_counter[key] += 1

    overlap_removed = sum(overlap_counter.values())
    if overlap_removed:
        new_dev: List[ParsedRecord] = []
        for rec in dev_records:
            key = builder._normalize_text(rec.text)
            if overlap_counter.get(key, 0) > 0:
                train_records.append(rec)
                overlap_counter[key] -= 1
                if overlap_counter[key] <= 0:
                    overlap_counter.pop(key, None)
            else:
                new_dev.append(rec)
        dev_records = new_dev

    print(f"Train/dev overlap count removed: {overlap_removed}")

    # Ensure dev split contains at least one instance of each priority label.
    dev_adjustments = ensure_priority_label_dev_coverage(
        train_records=train_records,
        dev_records=dev_records,
        priority_labels=priority_labels,
        rng=rng,
        target_dev_size=target_dev_size,
    )
    for label in priority_labels:
        moved = dev_adjustments.get(label)
        if not moved:
            continue
        noun = "doc" if moved == 1 else "docs"
        print(f"Adjusted split: ensured {label} in dev (moved {moved} {noun}).")

    builder.records = list(train_records)
    builder.skill_forms = Counter()
    for rec in builder.records:
        for start, end, label in rec.spans:
            if label == "SKILL":
                surface = rec.text[start:end].strip().lower()
                if surface:
                    builder.skill_forms[surface] += 1

    oversample_cap_ratio = 3.0
    original_counts = builder.get_label_counts(builder.records)

    def _cap_targets(map_in: Dict[str, int]) -> Dict[str, int]:
        capped: Dict[str, int] = {}
        for label, target in map_in.items():
            if target <= 0:
                capped[label] = target
                continue
            original = original_counts.get(label, 0)
            if original <= 0:
                capped[label] = target
                continue
            max_target = int(math.ceil(original * oversample_cap_ratio))
            capped[label] = min(target, max_target)
        return capped

    adjusted_target_map = _cap_targets(target_map)

    oversample_stats = Counter()
    if args.oversample and any(adjusted_target_map.values()):
        oversample_stats = builder.oversample_records(
            target_map=adjusted_target_map,
            rng=rng,
            max_per_label=args.max_oversample_per_label,
        )
        if oversample_stats:
            print("Oversampling additions (training set):")
            for label, value in oversample_stats.items():
                if value:
                    print(f"  {label}: +{value} docs")
            for label, added in oversample_stats.items():
                base = original_counts.get(label, 0)
                if base:
                    ratio = added / base
                    print(f"  {label}: oversample ratio {ratio:.2f}")
                elif added:
                    print(f"  {label}: oversample ratio N/A (no original examples)")

    augmentation_stats = Counter()
    augment_labels = sorted(priority_set | {"SKILL"})
    if args.augment_missing and any(target_map.get(label, 0) > 0 for label in augment_labels):
        augmentation_stats = builder.augment_priority_labels(
            target_map=target_map,
            rng=rng,
            priority_labels=augment_labels,
        )
        if augmentation_stats:
            print("Synthetic augmentation additions (training set):")
            for label, value in augmentation_stats.items():
                if value:
                    print(f"  {label}: +{value}")

    builder.shuffle(rng)
    train_records = list(builder.records)
    balanced_counts = builder.get_label_counts(train_records)
    builder.raw_label_counts = Counter(balanced_counts)
    if balanced_counts:
        print("Training label counts after balancing:")
        for label in sorted(balanced_counts):
            print(f"  {label}: {balanced_counts[label]}")

    dev_counts = builder.get_label_counts(dev_records)
    if dev_counts:
        print("Dev label counts:")
        for label in sorted(dev_counts):
            print(f"  {label}: {dev_counts[label]}")

    if priority_set:
        low_priority = [
            (label, balanced_counts.get(label, 0))
            for label in sorted(priority_set)
            if balanced_counts.get(label, 0) < 200
        ]
        if low_priority:
            print("WARNING: Priority labels below 200 training examples:")
            for label, count in low_priority:
                print(f"  {label}: {count}")

    if not args.disable_guardrails:
        enforce_guardrails(
            train_counts=balanced_counts,
            dev_counts=dev_counts,
            priority_labels=priority_set,
            min_per_label=args.min_per_label,
            min_per_label_default=args.min_per_label_default,
        )

    builder.export(train_records, dev_records, args.output_dir)

    if args.debug_config:
        debug_overrides = {
            "paths.train": str(args.output_dir / "train.spacy"),
            "paths.dev": str(args.output_dir / "dev.spacy"),
        }
        print(f"Running spaCy debug data with {args.debug_config}...")
        import cv_parser.patterns  # noqa: F401 - ensure registry hooks are registered
        debug_data(
            config_path=args.debug_config,
            config_overrides=debug_overrides,
            ignore_warnings=False,
            verbose=False,
            no_format=True,
            silent=False,
        )

    report_skill_coverage(builder, args.esco_skills_path, whitelist=builder.skill_whitelist)
    report_skill_coverage_weighted(
        builder,
        args.esco_skills_path,
        whitelist=builder.skill_whitelist,
        report_domains=args.report_esco_domains,
    )

    if builder.stoplist_hits:
        total_stoplisted = sum(builder.stoplist_hits.values())
        print(f"Stoplist hits (SKILL drops): {total_stoplisted}")
        for surface, count in builder.stoplist_hits.most_common(10):
            print(f"  {surface}: {count}")

    if builder.dropped_spans:
        total_dropped = sum(builder.dropped_spans.values())
        print(f"Dropped spans via DROP mapping: {total_dropped}")
        for surface, count in builder.dropped_spans.most_common(10):
            print(f"  {surface}: {count}")

    if builder.unmapped_labels:
        print("Unmapped labels dropped (counts):")
        for label, count in builder.unmapped_labels.most_common(10):
            print(f"  {label}: {count}")
        remaining = len(builder.unmapped_labels) - min(10, len(builder.unmapped_labels))
        if remaining > 0:
            print(f"  ... {remaining} more labels")


if __name__ == "__main__":
    main()
