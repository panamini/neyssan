#!/usr/bin/env python3
"""Deduplicate spaCy DocBin datasets and optionally drop unwanted labels.

Example:
    python deduplicate_spacy_dataset.py \
        --input my-app/testdata/cv_filtered/train.spacy \
        --output my-app/testdata/cv_filtered/train.spacy \
        --drop-label GPE
"""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
from typing import Iterable, List, Sequence, Set, Tuple

import spacy
from spacy.tokens import Doc, DocBin


def load_docs(path: Path) -> Iterable[Doc]:
    if not path.exists():
        raise FileNotFoundError(f"DocBin file not found: {path}")
    nlp = spacy.blank("en")
    docbin = DocBin().from_disk(path)
    yield from docbin.get_docs(nlp.vocab)


def filter_labels(doc: Doc, drop_labels: Set[str], keep_labels: Set[str]) -> Doc:
    if not drop_labels and not keep_labels:
        return doc

    new_ents: List[Doc] = []
    for ent in doc.ents:
        if keep_labels and ent.label_ not in keep_labels:
            continue
        if drop_labels and ent.label_ in drop_labels:
            continue
        new_ents.append(ent)

    if len(new_ents) != len(doc.ents):
        doc.set_ents(new_ents)
    return doc


def doc_signature(doc: Doc) -> Tuple[str, Tuple[Tuple[int, int, str], ...]]:
    spans = tuple((ent.start_char, ent.end_char, ent.label_) for ent in doc.ents)
    return doc.text.strip(), spans


def deduplicate_docs(
    docs: Sequence[Doc], drop_labels: Set[str], keep_labels: Set[str]
) -> Tuple[List[Doc], Counter]:
    seen = set()
    unique_docs: List[Doc] = []
    counters = Counter()

    for doc in docs:
        filter_labels(doc, drop_labels, keep_labels)
        signature = doc_signature(doc)
        if signature in seen:
            counters["duplicates_removed"] += 1
            continue
        seen.add(signature)
        unique_docs.append(doc)

    counters["initial_docs"] = len(docs)
    counters["final_docs"] = len(unique_docs)
    counters["labels_dropped"] = len(docs) - len(unique_docs)
    return unique_docs, counters


def save_docs(docs: Sequence[Doc], output_path: Path) -> None:
    docbin = DocBin(store_user_data=True)
    for doc in docs:
        docbin.add(doc)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    docbin.to_disk(output_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deduplicate spaCy DocBin datasets")
    parser.add_argument("--input", type=Path, required=True, help="Input DocBin path")
    parser.add_argument(
        "--output", type=Path, required=True, help="Output DocBin path (overwrites if same as input)"
    )
    parser.add_argument(
        "--drop-label",
        dest="drop_labels",
        action="append",
        default=[],
        help="Entity label to drop (can be provided multiple times)",
    )
    parser.add_argument(
        "--keep-label",
        dest="keep_labels",
        action="append",
        default=[],
        help="Entity label to keep (others will be discarded)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report counts without writing output",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.keep_labels:
        keep_labels = set(args.keep_labels)
        drop_labels = set()
    else:
        keep_labels = set()
        drop_labels = set(args.drop_labels)

    docs = list(load_docs(args.input))
    deduped_docs, counters = deduplicate_docs(docs, drop_labels, keep_labels)

    label_counter = Counter()
    for doc in deduped_docs:
        label_counter.update(ent.label_ for ent in doc.ents)

    print("=== Deduplication Summary ===")
    print(f"Input docs: {counters['initial_docs']}")
    print(f"Output docs: {counters['final_docs']}")
    print(f"Duplicates removed: {counters['duplicates_removed']}")
    if drop_labels:
        print(f"Dropped labels: {', '.join(sorted(drop_labels))}")
    if keep_labels:
        print(f"Kept labels only: {', '.join(sorted(keep_labels))}")
    print("Label counts after processing:")
    for label, count in sorted(label_counter.items()):
        print(f"  {label}: {count}")

    if args.dry_run:
        print("Dry run enabled; not writing output.")
        return

    save_docs(deduped_docs, args.output)
    print(f"Wrote {len(deduped_docs)} docs to {args.output}")


if __name__ == "__main__":
    main()
