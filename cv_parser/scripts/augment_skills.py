#!/usr/bin/env python3
"""Augment training DocBins with synthetic SKILL bullets sourced from taxonomy data."""

from __future__ import annotations

import argparse
import json
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple, Set

import spacy
from spacy.tokens import Doc, DocBin

TAXONOMY_PATH = Path("my-app/convex/lib/taxonomy/skills.json")
STOPLIST_PATH = TAXONOMY_PATH.parent / "stoplist.json"
DEFAULT_NUM_DOCS = 250
RANDOM_SEED = 1234
BULLET_PREFIXES = ["•", "-", ""]
VERBS = [
    "delivered",
    "implemented",
    "optimized",
    "engineered",
    "modernized",
    "scaled",
    "automated",
    "integrated",
    "refined",
]
TEMPLATES = [
    "{prefix} {verb} {skill1} solutions alongside {skill2} to accelerate delivery.",
    "{prefix} Leveraged {skill1} with {skill2} and {skill3} for cross-team enablement.",
    "{prefix} Built end-to-end pipelines using {skill1}, {skill2}, and {skill3}.",
    "{prefix} {verb} {skill1} workloads using {skill2} best practices.",
    "{prefix} Combined {skill1} and {skill2} to improve reliability of {skill3} components.",
]
STOPWORDS = {
    "skill",
    "skills",
    "competence",
    "competences",
    "knowledge",
    "ability",
    "abilities",
}


def load_stoplist(path: Path) -> Set[str]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return set()
    except Exception as exc:  # pragma: no cover - defensive
        print(f"[augment_skills] Failed to read stoplist {path}: {exc}")
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
    return {term.strip().lower() for term in terms if term}


SKILL_STOPLIST = load_stoplist(STOPLIST_PATH)


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


def load_taxonomy(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Skills taxonomy missing: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def filter_skills(skills: Iterable[str]) -> List[str]:
    cleaned: List[str] = []
    pattern = re.compile(r"^[a-z0-9][a-z0-9 .+/\-]{1,40}$")
    for skill in skills:
        token = skill.strip().lower()
        if not token or token in STOPWORDS:
            continue
        if not pattern.match(token):
            continue
        if token in SKILL_STOPLIST:
            continue
        cleaned.append(token)
    return cleaned


def pick_skills(candidates: Sequence[str], rng: random.Random) -> Tuple[str, ...]:
    size = rng.choice([2, 3])
    return tuple(rng.sample(candidates, k=size))


def build_bullet(skills: Tuple[str, ...], rng: random.Random) -> str:
    template = rng.choice(TEMPLATES)
    verb = rng.choice(VERBS)
    prefix = rng.choice(BULLET_PREFIXES)
    placeholders = {
        "prefix": prefix,
        "verb": verb,
        "skill1": skills[0],
        "skill2": skills[1] if len(skills) > 1 else skills[0],
        "skill3": skills[2] if len(skills) > 2 else skills[-1],
    }
    return template.format(**placeholders).strip()


def annotate_doc(nlp, text: str, skills: Tuple[str, ...]) -> SyntheticDoc:
    doc = nlp.make_doc(text)
    used: List[Tuple[int, int]] = []
    spans: List[Tuple[int, int, str]] = []
    for skill in skills:
        idx = find_span(doc.text, skill, used)
        if idx == -1:
            raise ValueError(f"Failed to locate skill '{skill}' in '{text}'")
        start = idx
        end = idx + len(skill)
        used.append((start, end))
        spans.append((start, end, "SKILL"))
    doc.set_ents([doc.char_span(start, end, label=label) for start, end, label in spans])
    return SyntheticDoc(text=doc.text, spans=tuple(spans))


def find_span(text: str, needle: str, used: List[Tuple[int, int]]) -> int:
    start = 0
    while True:
        idx = text.lower().find(needle, start)
        if idx == -1:
            return -1
        end = idx + len(needle)
        if all(end <= s or idx >= e for s, e in used):
            return idx
        start = end


def doc_signature(doc: Doc) -> Tuple[str, Tuple[Tuple[int, int, str], ...]]:
    spans = tuple((ent.start_char, ent.end_char, ent.label_) for ent in doc.ents)
    return doc.text.strip(), spans


def merge_docs(base: Sequence[Doc], synthetic: Sequence[SyntheticDoc], nlp) -> List[Doc]:
    seen = {doc_signature(doc) for doc in base}
    combined: List[Doc] = list(base)
    for syn in synthetic:
        if syn.spans:
            doc = nlp.make_doc(syn.text)
            spans = []
        for start, end, label in syn.spans:
            span = doc.char_span(start, end, label=label)
            if span is None:
                break
            spans.append(span)
        else:
            doc.set_ents(spans)
        if not spans or len(spans) != len(syn.spans):
            continue
        else:
            doc = nlp.make_doc(syn.text)
        sig = doc_signature(doc)
        if sig in seen:
            continue
        seen.add(sig)
        combined.append(doc)
    return combined


def generate_synthetic_docs(nlp, candidates: Sequence[str], count: int, rng: random.Random) -> List[SyntheticDoc]:
    docs: List[SyntheticDoc] = []
    for _ in range(count * 2):  # oversample to avoid collisions
        skills = pick_skills(candidates, rng)
        bullet = build_bullet(skills, rng)
        try:
            synthetic = annotate_doc(nlp, bullet, skills)
        except ValueError:
            continue
        docs.append(synthetic)
        if len(docs) >= count:
            break
    return docs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Augment DocBin with synthetic skill bullets")
    parser.add_argument("--train", type=Path, required=True, help="Input training DocBin")
    parser.add_argument("--output", type=Path, required=True, help="Output DocBin path")
    parser.add_argument(
        "--taxonomy",
        type=Path,
        default=TAXONOMY_PATH,
        help="Path to generated skills taxonomy JSON",
    )
    parser.add_argument("--count", type=int, default=DEFAULT_NUM_DOCS, help="Approximate number of synthetic docs")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rng = random.Random(RANDOM_SEED)
    nlp = spacy.blank("en")

    base_docs = load_docs(args.train)
    taxonomy = load_taxonomy(args.taxonomy)
    candidates = filter_skills(taxonomy.get("canonical", []))
    if len(candidates) < 10:
        raise SystemExit("Insufficient skills in taxonomy after filtering")

    synthetic = generate_synthetic_docs(nlp, candidates, args.count, rng)
    merged_docs = merge_docs(base_docs, synthetic, nlp)

    save_docs(merged_docs, args.output)

    print("=== Skill Augmentation Summary ===")
    print(f"Base docs: {len(base_docs)}")
    print(f"Synthetic docs created: {len(synthetic)}")
    print(f"Final docs: {len(merged_docs)}")


if __name__ == "__main__":
    main()
