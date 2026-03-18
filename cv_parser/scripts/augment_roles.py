#!/usr/bin/env python3
"""Generate synthetic ROLE + DATE experience bullets using ESCO occupations."""

from __future__ import annotations

import argparse
import csv
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

import spacy
from spacy.tokens import Doc, DocBin

OCCUPATIONS_CSV = Path(
    "my-app/testdata/cv/esco/ESCO dataset - v1.2.0 - classification - en - csv/occupations_en.csv"
)
DEFAULT_COUNT = 300
RANDOM_SEED = 1729
COMPANIES = [
    "Horizon Analytics",
    "CloudNet Solutions",
    "Vertex Labs",
    "Blue River Consulting",
    "Northwind Manufacturing",
    "Atlas Finance Group",
    "Silverline Health",
    "Aurora Retail",
    "Summit Logistics",
    "Nova Energy",
]
MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]


@dataclass(frozen=True)
class SyntheticDoc:
    text: str
    spans: Tuple[Tuple[int, int, str], ...]


def load_docs(path: Path) -> List[Doc]:
    if not path.exists():
        raise FileNotFoundError(f"DocBin file not found: {path}")
    nlp = spacy.blank("en")
    docbin = DocBin().from_disk(path)
    return list(docbin.get_docs(nlp.vocab))


def save_docs(docs: Sequence[Doc], path: Path) -> None:
    docbin = DocBin(store_user_data=True)
    for doc in docs:
        docbin.add(doc)
    path.parent.mkdir(parents=True, exist_ok=True)
    docbin.to_disk(path)


def doc_signature(doc: Doc) -> Tuple[str, Tuple[Tuple[int, int, str], ...]]:
    spans = tuple((ent.start_char, ent.end_char, ent.label_) for ent in doc.ents)
    return doc.text.strip(), spans


def merge_docs(base: Sequence[Doc], synthetic: Sequence[SyntheticDoc], nlp) -> List[Doc]:
    seen = {doc_signature(doc) for doc in base}
    combined: List[Doc] = list(base)
    for syn in synthetic:
        doc = nlp.make_doc(syn.text)
        spans = []
        for start, end, label in syn.spans:
            span = doc.char_span(start, end, label=label)
            if span is None:
                spans = []
                break
            spans.append(span)
        if not spans:
            continue
        doc.set_ents(spans)
        sig = doc_signature(doc)
        if sig in seen:
            continue
        seen.add(sig)
        combined.append(doc)
    return combined


def load_occupations(path: Path) -> List[str]:
    roles: List[str] = []
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if (row.get("conceptType") or "").strip() != "Occupation":
                continue
            label = (row.get("preferredLabel") or "").strip()
            if not label:
                continue
            # handle gendered variants separated by "/" or ","
            label = label.split("/")[0]
            label = label.split(",")[0]
            label = label.replace("\u200b", "").strip()
            if len(label.split()) < 2:
                continue
            if len(label) > 64:
                continue
            roles.append(label)
    unique = sorted({role[0].upper() + role[1:] if role else role for role in roles})
    return unique


def generate_date_range(rng: random.Random) -> Tuple[str, str]:
    start_year = rng.randint(2005, 2021)
    end_year = rng.randint(start_year, 2024)
    start_month = rng.randint(0, 11)
    end_month = rng.randint(start_month if end_year == start_year else 0, 11)
    start = f"{MONTHS[start_month]} {start_year}"
    if rng.random() < 0.1:
        end = "Present"
    else:
        end = f"{MONTHS[end_month]} {end_year}"
    return start, end


def annotate_experience(role: str, company: str, start: str, end: str) -> SyntheticDoc:
    text = f"{role}, {company} — {start} – {end}"
    lower = text.lower()
    spans: List[Tuple[int, int, str]] = []

    role_start = lower.find(role.lower())
    if role_start == -1:
        raise ValueError("Role not found in text")
    spans.append((role_start, role_start + len(role), "ROLE"))

    company_start = lower.find(company.lower())
    if company_start != -1:
        spans.append((company_start, company_start + len(company), "COMPANY"))

    start_idx = lower.find(start.lower())
    if start_idx == -1:
        raise ValueError("Start date not found")
    spans.append((start_idx, start_idx + len(start), "START_DATE"))

    end_idx = lower.rfind(end.lower())
    if end_idx == -1:
        raise ValueError("End date not found")
    spans.append((end_idx, end_idx + len(end), "END_DATE"))

    # ensure spans sorted and non-overlapping
    spans = sorted(spans, key=lambda s: s[0])
    return SyntheticDoc(text=text, spans=tuple(spans))


def generate_docs(roles: Sequence[str], count: int, rng: random.Random) -> List[SyntheticDoc]:
    candidates: List[SyntheticDoc] = []
    nlp = spacy.blank("en")
    for _ in range(count * 3):
        role = rng.choice(roles)
        company = rng.choice(COMPANIES)
        start, end = generate_date_range(rng)
        try:
            doc = annotate_experience(role, company, start, end)
            # instantiate once to ensure spans align
            d = nlp.make_doc(doc.text)
            spans = []
            for s, e, label in doc.spans:
                span = d.char_span(s, e, label=label)
                if span is None:
                    raise ValueError("Span alignment failed")
                spans.append(span)
            candidates.append(doc)
        except ValueError:
            continue
        if len(candidates) >= count:
            break
    return candidates


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Augment DocBin with ROLE/date bullets")
    parser.add_argument("--train", type=Path, required=True, help="Input training DocBin")
    parser.add_argument("--output", type=Path, required=True, help="Output DocBin path")
    parser.add_argument(
        "--occupations-csv",
        type=Path,
        default=OCCUPATIONS_CSV,
        help="ESCO occupations CSV (preferredLabel column used)",
    )
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT, help="Approximate number of synthetic docs")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rng = random.Random(RANDOM_SEED)
    nlp = spacy.blank("en")

    roles = load_occupations(args.occupations_csv)
    if len(roles) < 20:
        raise SystemExit("Insufficient occupation titles extracted")

    base_docs = load_docs(args.train)
    synthetic_docs = generate_docs(roles, args.count, rng)
    merged_docs = merge_docs(base_docs, synthetic_docs, nlp)

    save_docs(merged_docs, args.output)

    print("=== Role Augmentation Summary ===")
    print(f"Base docs: {len(base_docs)}")
    print(f"Synthetic docs created: {len(synthetic_docs)}")
    print(f"Final docs: {len(merged_docs)}")


if __name__ == "__main__":
    main()
