#!/usr/bin/env python3
"""Audit spaCy DocBin datasets for resume parser project.

Checks performed:
- Duplicate documents (same text + entity spans).
- Misaligned entity spans (entity text mismatch with slice).
- Entity label counts with low-resource warnings.
- Detection of unexpected entity labels.
- Optional golden sample export for regression testing.

Usage:
    python audit_spacy_dataset.py \
        --train my-app/testdata/cv_filtered/train.spacy \
        --dev my-app/testdata/cv_filtered/dev.spacy \
        --golden-out my-app/testdata/cv_filtered/golden_sample.spacy
"""

from __future__ import annotations

import argparse
import json
import random
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

import spacy
from spacy.tokens import Doc, DocBin

TARGET_LABELS = {
    "COMPANY",
    "ROLE",
    "SKILL",
    "START_DATE",
    "END_DATE",
    "INSTITUTION",
    "DEGREE",
    "CERTIFICATE",
    "LANGUAGE",
    "ACHIEVEMENT",
}

LOW_RESOURCE_THRESHOLD = 50
DEFAULT_SAMPLE_SIZE = 200
DEFAULT_RANDOM_SEED = 13
MAX_SAMPLE_ENTRIES = 50


@dataclass
class DocRecord:
    doc: Doc
    source: str
    index: int


@dataclass
class DatasetStats:
    path: Path
    doc_count: int
    token_count: int
    label_counts: Dict[str, int]
    duplicate_doc_ids: List[Tuple[int, int]]
    misaligned_spans: List[Tuple[int, str, int, int, str, str]]
    unexpected_labels: List[str]


def load_docs(path: Path) -> Iterable[Doc]:
    if not path.exists():
        raise FileNotFoundError(f"DocBin file not found: {path}")
    nlp = spacy.blank("en")
    docbin = DocBin().from_disk(path)
    yield from docbin.get_docs(nlp.vocab)


def hash_doc(doc: Doc) -> Tuple[str, Tuple[Tuple[int, int, str], ...]]:
    spans = tuple((ent.start_char, ent.end_char, ent.label_) for ent in doc.ents)
    return doc.text.strip(), spans


def analyze_dataset(path: Path, source_label: str) -> Tuple[DatasetStats, List[DocRecord]]:
    docs: List[Doc] = list(load_docs(path))
    doc_records = [DocRecord(doc=doc, source=source_label, index=i) for i, doc in enumerate(docs)]

    token_count = sum(len(doc) for doc in docs)
    label_counts: Counter[str] = Counter()
    key_to_indices: Dict[Tuple[str, Tuple[Tuple[int, int, str], ...]], List[int]] = defaultdict(list)
    misaligned_spans: List[Tuple[int, str, int, int, str, str]] = []
    unexpected_labels: Counter[str] = Counter()

    for idx, doc in enumerate(docs):
        key_to_indices[hash_doc(doc)].append(idx)
        for ent in doc.ents:
            label_counts[ent.label_] += 1
            slice_text = doc.text[ent.start_char:ent.end_char]
            if slice_text != ent.text:
                misaligned_spans.append((
                    idx,
                    ent.label_,
                    ent.start_char,
                    ent.end_char,
                    ent.text,
                    slice_text,
                ))
            if ent.label_ not in TARGET_LABELS:
                unexpected_labels[ent.label_] += 1

    duplicate_pairs: List[Tuple[int, int]] = []
    for indices in key_to_indices.values():
        if len(indices) > 1:
            for i in range(len(indices) - 1):
                for j in range(i + 1, len(indices)):
                    duplicate_pairs.append((indices[i], indices[j]))

    stats = DatasetStats(
        path=path,
        doc_count=len(docs),
        token_count=token_count,
        label_counts=dict(label_counts),
        duplicate_doc_ids=duplicate_pairs,
        misaligned_spans=misaligned_spans,
        unexpected_labels=list(unexpected_labels.elements()),
    )

    return stats, doc_records


def export_golden_sample(records: Sequence[DocRecord], output_path: Path, sample_size: int, seed: int) -> List[DocRecord]:
    rng = random.Random(seed)
    if not records:
        raise ValueError("No documents available for golden sample export.")
    take = min(sample_size, len(records))
    selected = rng.sample(list(records), take)
    docbin = DocBin(store_user_data=True)
    for rec in selected:
        docbin.add(rec.doc)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    docbin.to_disk(output_path)
    return selected


def make_summary(stats_list: Sequence[DatasetStats], low_resource_threshold: int) -> Dict[str, object]:
    aggregate_label_counts: Counter[str] = Counter()
    unexpected_labels: Counter[str] = Counter()
    duplicate_summary: List[Dict[str, object]] = []
    misaligned_total = 0
    per_dataset = []

    for stats in stats_list:
        per_dataset.append(
            {
                "path": str(stats.path),
                "docs": stats.doc_count,
                "tokens": stats.token_count,
                "label_counts": stats.label_counts,
                "duplicate_pairs_count": len(stats.duplicate_doc_ids),
                "duplicate_pairs_sample": stats.duplicate_doc_ids[:MAX_SAMPLE_ENTRIES],
                "misaligned_spans_count": len(stats.misaligned_spans),
                "misaligned_spans_sample": stats.misaligned_spans[:MAX_SAMPLE_ENTRIES],
                "unexpected_labels": stats.unexpected_labels,
            }
        )
        aggregate_label_counts.update(stats.label_counts)
        unexpected_labels.update(stats.unexpected_labels)
        misaligned_total += len(stats.misaligned_spans)
        if stats.duplicate_doc_ids:
            duplicate_summary.append(
                {
                    "path": str(stats.path),
                    "count": len(stats.duplicate_doc_ids),
                    "sample": stats.duplicate_doc_ids[:MAX_SAMPLE_ENTRIES],
                }
            )

    low_resource = [
        label
        for label, count in aggregate_label_counts.items()
        if label in TARGET_LABELS and count < low_resource_threshold
    ]

    summary: Dict[str, object] = {
        "datasets": per_dataset,
        "aggregate_label_counts": dict(aggregate_label_counts),
        "low_resource_labels": low_resource,
        "unexpected_labels": dict(unexpected_labels),
        "duplicate_summary": duplicate_summary,
        "misaligned_count": misaligned_total,
    }
    return summary


def write_report(summary: Dict[str, object], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, sort_keys=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit spaCy DocBin datasets")
    parser.add_argument("--train", type=Path, required=True, help="Path to train.spacy DocBin")
    parser.add_argument("--dev", type=Path, required=True, help="Path to dev.spacy DocBin")
    parser.add_argument(
        "--golden-out",
        type=Path,
        help="Destination path for golden sample DocBin (optional)",
        default=None,
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=DEFAULT_SAMPLE_SIZE,
        help=f"Number of docs to include in golden sample (default {DEFAULT_SAMPLE_SIZE})",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_RANDOM_SEED,
        help=f"Random seed for sampling (default {DEFAULT_RANDOM_SEED})",
    )
    parser.add_argument(
        "--report-out",
        type=Path,
        default=Path("./audit_report.json"),
        help="Where to write JSON summary report",
    )
    parser.add_argument(
        "--low-resource-threshold",
        type=int,
        default=LOW_RESOURCE_THRESHOLD,
        help=f"Minimum examples per label before flagging low-resource (default {LOW_RESOURCE_THRESHOLD})",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with non-zero status when duplicates or misaligned spans are detected",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    stats_train, records_train = analyze_dataset(args.train, "train")
    stats_dev, records_dev = analyze_dataset(args.dev, "dev")

    all_records = records_train + records_dev
    summary = make_summary([stats_train, stats_dev], args.low_resource_threshold)

    if args.golden_out:
        selected = export_golden_sample(all_records, args.golden_out, args.sample_size, args.seed)
        summary["golden_sample"] = {
            "path": str(args.golden_out),
            "sample_size": len(selected),
            "source_counts": dict(Counter(rec.source for rec in selected)),
        }
    else:
        summary["golden_sample"] = None

    write_report(summary, args.report_out)

    print("=== Audit Summary ===")
    print(json.dumps(summary, indent=2, sort_keys=True))

    if args.strict:
        dup_total = sum(item["duplicate_pairs_count"] for item in summary["datasets"])
        misaligned_total = summary["misaligned_count"]
        if dup_total > 0 or misaligned_total > 0:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
