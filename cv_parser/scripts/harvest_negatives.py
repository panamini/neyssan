#!/usr/bin/env python3
"""Harvest false-positive spans from error bucket diagnostics into training negatives.

Usage:
    python cv_parser/scripts/harvest_negatives.py \
        --buckets diagnostics/error_buckets_dev_probe300.json \
        --out my-app/testdata/cv_filtered/train.spacy \
        --dev my-app/testdata/cv_filtered/dev.spacy

The script reads the provided diagnostics JSON, extracts false-positive spans
for END_DATE and START_DATE, creates lightweight documents with those spans
annotated under ``Doc.spans["incorrect"]``, appends them to the training
DocBin, and finally runs the dedupe + audit scripts to keep the dataset clean.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable, List, Tuple

import spacy
from spacy.tokens import Doc, DocBin


TARGET_LABELS = {"END_DATE", "START_DATE", "DEGREE"}
FAILURE_ATTACHMENT_KEY = "failure_fixture"
INCORRECT_KEY = "incorrect"


def _load_failure_samples(buckets_path: Path) -> List[dict]:
    """Load the failure fixture payload referenced by the diagnostics JSON."""

    data = json.loads(buckets_path.read_text())
    fixture_path = data.get(FAILURE_ATTACHMENT_KEY)
    if not fixture_path:
        return []
    path = Path(fixture_path)
    if not path.exists():
        raise FileNotFoundError(f"Failure fixture not found: {path}")
    payload = json.loads(path.read_text())
    samples: List[dict] = []
    for label in TARGET_LABELS:
        for entry in payload.get("samples", {}).get(f"{label.lower()}_fp", []):
            entry = dict(entry)
            entry["label"] = label
            samples.append(entry)
    return samples


def _make_incorrect_doc(nlp, sample: dict) -> Tuple[Doc, int]:
    """Create a Doc with incorrect spans for the sample."""

    text = sample.get("text", "")
    if not text:
        return nlp.make_doc(""), 0
    doc = nlp.make_doc(text)
    doc.ents = ()
    spans = []
    fp_map = sample.get("false_positives", {})
    for label in TARGET_LABELS:
        for span_info in fp_map.get(label, []):
            start = span_info.get("start")
            end = span_info.get("end")
            if start is None or end is None:
                continue
            span = doc.char_span(start, end, alignment_mode="contract")
            if span is not None:
                spans.append(span)
    doc.spans[INCORRECT_KEY] = spans
    return doc, len(spans)


def harvest_negatives(buckets: Path, train_path: Path) -> Tuple[int, int]:
    """Append negatives harvested from diagnostics to the train DocBin."""

    samples = _load_failure_samples(buckets)
    if not samples:
        return 0, 0

    nlp = spacy.blank("en")
    docbin = DocBin().from_disk(train_path)
    docs = list(docbin.get_docs(nlp.vocab))
    existing_texts = {doc.text for doc in docs}

    added = 0
    total_spans = 0
    for sample in samples:
        text = sample.get("text", "")
        if not text or text in existing_texts:
            continue
        doc, span_count = _make_incorrect_doc(nlp, sample)
        if span_count == 0:
            continue
        docs.append(doc)
        existing_texts.add(text)
        added += 1
        total_spans += span_count

    if added == 0:
        return 0, 0

    combined = DocBin(store_user_data=True)
    for doc in docs:
        combined.add(doc)
    combined.to_disk(train_path)
    return added, len(docs)


def run_subprocess(cmd: Iterable[str]) -> None:
    """Run subprocess command, streaming output."""

    import subprocess

    subprocess.run(list(cmd), check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Harvest FP spans into training negatives")
    parser.add_argument("--buckets", type=Path, required=True, help="Path to diagnostics JSON")
    parser.add_argument("--out", type=Path, required=True, help="Path to train.spacy DocBin")
    parser.add_argument("--dev", type=Path, default=Path("my-app/testdata/cv_filtered/dev.spacy"), help="Path to dev DocBin")
    parser.add_argument(
        "--audit-report",
        type=Path,
        default=Path("diagnostics/audit_report_latest.json"),
        help="Where to write the audit JSON report",
    )
    args = parser.parse_args()

    added, total_docs = harvest_negatives(args.buckets, args.out)
    if added == 0:
        print("No new negatives harvested (either none found or already present).")
        return

    print(f"Harvested {added} docs from {args.buckets} (total spans={total_docs}). Running dedupe & audit…")

    run_subprocess([
        sys.executable,
        "cv_parser/scripts/deduplicate_spacy_dataset.py",
        "--input",
        str(args.out),
        "--output",
        str(args.out),
    ])

    run_subprocess([
        sys.executable,
        "cv_parser/scripts/audit_spacy_dataset.py",
        "--train",
        str(args.out),
        "--dev",
        str(args.dev),
        "--report-out",
        str(args.audit_report),
        "--strict",
    ])

    nlp = spacy.blank("en")
    final_count = sum(1 for _ in DocBin().from_disk(args.out).get_docs(nlp.vocab))
    print(f"Added {added} docs. Train DocBin now contains {final_count} documents.")


if __name__ == "__main__":
    main()
