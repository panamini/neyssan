#!/usr/bin/env python3
"""Generate synthetic LANGUAGE annotations and merge into train DocBin.

The script extracts language names from the ESCO language skills collection and
creates synthetic snippets with LANGUAGE entities. Generated docs are merged
with the existing dataset and deduplicated to keep unique (text, spans) pairs.

Example:
    python augment_languages.py \
        --train my-app/testdata/cv_filtered/train.spacy \
        --output my-app/testdata/cv_filtered/train.spacy \
        --language-csv "my-app/testdata/cv/esco/ESCO dataset - v1.2.0 - classification - en - csv/languageSkillsCollection_en.csv" \
        --num-single 120 \
        --num-multi 150
"""

from __future__ import annotations

import argparse
import csv
import random
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence, Set, Tuple

import spacy
from spacy.tokens import Doc, DocBin

LEVELS = ["Native", "Fluent", "Advanced", "Intermediate", "Elementary", "Beginner"]
LANGUAGE_STOPWORDS = {"languages", "mastering languages"}
DEFAULT_NUM_SINGLE = 120
DEFAULT_NUM_MULTI = 150
RANDOM_SEED = 42


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


def load_languages(csv_path: Path) -> List[str]:
    langs: Set[str] = set()
    with csv_path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            label = (row.get("broaderConceptPT") or "").strip()
            if not label:
                continue
            if label.lower() in LANGUAGE_STOPWORDS:
                continue
            # Normalise to title case and strip punctuation
            cleaned = label.replace("\u200b", "").strip()
            if cleaned:
                langs.add(cleaned)
    return sorted(langs)


def doc_signature(doc: Doc) -> Tuple[str, Tuple[Tuple[int, int, str], ...]]:
    spans = tuple((ent.start_char, ent.end_char, ent.label_) for ent in doc.ents)
    return doc.text.strip(), spans


def deduplicate(docs: Sequence[Doc]) -> List[Doc]:
    seen = set()
    unique: List[Doc] = []
    for doc in docs:
        key = doc_signature(doc)
        if key in seen:
            continue
        seen.add(key)
        unique.append(doc)
    return unique


def annotate_doc(nlp, text: str, lang_entities: Sequence[str]) -> Doc:
    doc = nlp.make_doc(text)
    ents = []
    start_search = 0
    for lang in lang_entities:
        idx = doc.text.find(lang, start_search)
        if idx == -1:
            raise ValueError(f"Could not locate language '{lang}' in text '{text}'")
        end = idx + len(lang)
        ents.append(doc.char_span(idx, end, label="LANGUAGE"))
        start_search = end
    if any(ent is None for ent in ents):
        raise ValueError(f"Failed to create spans for text: {text}")
    doc.set_ents([ent for ent in ents if ent is not None])
    return doc


def generate_single_language_docs(nlp, languages: Sequence[str], count: int) -> List[Doc]:
    templates = [
        "Native {lang} speaker.",
        "Fluent in {lang}.",
        "Professional working proficiency in {lang}.",
        "Languages: {lang} ({level}).",
        "{lang}: {level} proficiency.",
    ]
    docs: List[Doc] = []
    rng = random.Random(RANDOM_SEED)
    selected = list(languages)
    rng.shuffle(selected)
    if count < len(selected):
        selected = selected[:count]
    for lang in selected:
        template = rng.choice(templates)
        level = rng.choice(LEVELS)
        text = template.format(lang=lang, level=level)
        doc = annotate_doc(nlp, text, [lang])
        docs.append(doc)
    return docs


def generate_multi_language_docs(nlp, languages: Sequence[str], count: int) -> List[Doc]:
    templates = [
        "Languages: {lang1} ({level1}), {lang2} ({level2}), {lang3} ({level3}).",
        "{lang1} ({level1}) | {lang2} ({level2}) | {lang3} ({level3}).",
        "Fluent in {lang1}, conversational {lang2}, basic {lang3}.",
        "{lang1} - {level1}; {lang2} - {level2}; {lang3} - {level3}.",
    ]
    docs: List[Doc] = []
    rng = random.Random(RANDOM_SEED + 1)
    if len(languages) < 3:
        return docs
    for _ in range(count):
        lang_combo = rng.sample(languages, 3)
        level_combo = rng.choices(LEVELS, k=3)
        template = rng.choice(templates)
        text = template.format(
            lang1=lang_combo[0], level1=level_combo[0],
            lang2=lang_combo[1], level2=level_combo[1],
            lang3=lang_combo[2], level3=level_combo[2],
        )
        doc = annotate_doc(nlp, text, lang_combo)
        docs.append(doc)
    return docs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Augment LANGUAGE entities with synthetic samples")
    parser.add_argument("--train", type=Path, required=True, help="Input train DocBin")
    parser.add_argument("--output", type=Path, required=True, help="Output DocBin path")
    parser.add_argument(
        "--language-csv",
        type=Path,
        required=True,
        help="ESCO language skills collection CSV",
    )
    parser.add_argument("--num-single", type=int, default=DEFAULT_NUM_SINGLE, help="Number of single-language snippets")
    parser.add_argument("--num-multi", type=int, default=DEFAULT_NUM_MULTI, help="Number of multi-language snippets")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    nlp = spacy.blank("en")

    base_docs = load_docs(args.train)
    languages = load_languages(args.language_csv)
    if not languages:
        raise SystemExit("No languages extracted from ESCO dataset")

    single_docs = generate_single_language_docs(nlp, languages, args.num_single)
    multi_docs = generate_multi_language_docs(nlp, languages, args.num_multi)

    combined_docs = base_docs + single_docs + multi_docs
    deduped_docs = deduplicate(combined_docs)

    save_docs(deduped_docs, args.output)

    # Summaries
    label_counts = Counter()
    for doc in deduped_docs:
        label_counts.update(ent.label_ for ent in doc.ents)

    print("=== Augmentation Summary ===")
    print(f"Base docs: {len(base_docs)}")
    print(f"New single-language docs: {len(single_docs)}")
    print(f"New multi-language docs: {len(multi_docs)}")
    print(f"Final docs: {len(deduped_docs)}")
    print("Label counts:")
    for label, count in sorted(label_counts.items()):
        print(f"  {label}: {count}")


if __name__ == "__main__":
    main()
