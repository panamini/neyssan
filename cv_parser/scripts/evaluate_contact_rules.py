#!/usr/bin/env python3
"""Evaluate deterministic contact/degree rules against spaCy annotated data.

Usage:
    python cv_parser/scripts/evaluate_contact_rules.py \
        --docbin my-app/testdata/cv_filtered/golden_sample.spacy

This utility reports precision/recall/F1 for EMAIL, PHONE, URL, and DEGREE
entities using the rule-based detectors in ``cv_parser.rules``.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import spacy
from spacy.tokens import Doc, DocBin

from cv_parser.rules import RuleEngine, RuleConfig, SectionSpan

TARGET_LABELS: Tuple[str, ...] = ("EMAIL", "PHONE", "URL", "DEGREE")


def load_docs(paths: Sequence[Path]) -> Iterable[Doc]:
    if not paths:
        raise ValueError("At least one --docbin path must be provided")
    nlp = spacy.blank("en")
    for path in paths:
        if not path.exists():
            raise FileNotFoundError(f"DocBin file not found: {path}")
        docbin = DocBin().from_disk(path)
        yield from docbin.get_docs(nlp.vocab)


def evaluate(paths: Sequence[Path]) -> Dict[str, Dict[str, float]]:
    engine = RuleEngine(RuleConfig())
    totals = {label: {"tp": 0, "fp": 0, "fn": 0} for label in TARGET_LABELS}

    for doc in load_docs(paths):
        text = doc.text
        contact_span = SectionSpan(label="CONTACT", text=text, start_block=0, end_block=0)
        education_span = SectionSpan(label="EDUCATION", text=text, start_block=0, end_block=0)

        predictions = set()
        for match in engine.run(contact_span, 0):
            if match.label in TARGET_LABELS:
                predictions.add((match.start, match.end, match.label))
        for match in engine.run(education_span, 0):
            if match.label in TARGET_LABELS:
                predictions.add((match.start, match.end, match.label))

        gold = {
            (ent.start_char, ent.end_char, ent.label_)
            for ent in doc.ents
            if ent.label_ in TARGET_LABELS
        }

        for label in TARGET_LABELS:
            pred_spans = {span for span in predictions if span[2] == label}
            gold_spans = {span for span in gold if span[2] == label}
            tp = len(pred_spans & gold_spans)
            fp = len(pred_spans - gold_spans)
            fn = len(gold_spans - pred_spans)
            totals[label]["tp"] += tp
            totals[label]["fp"] += fp
            totals[label]["fn"] += fn

    metrics: Dict[str, Dict[str, float]] = {}
    for label, counts in totals.items():
        tp = counts["tp"]
        fp = counts["fp"]
        fn = counts["fn"]
        precision = tp / (tp + fp) if tp + fp > 0 else 0.0
        recall = tp / (tp + fn) if tp + fn > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall > 0 else 0.0
        metrics[label] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "tp": float(tp),
            "fp": float(fp),
            "fn": float(fn),
        }
    return metrics


def format_metrics(metrics: Dict[str, Dict[str, float]]) -> str:
    lines = ["label      precision   recall      f1       tp   fp   fn"]
    for label in TARGET_LABELS:
        data = metrics[label]
        lines.append(
            f"{label:<8}  {data['precision']*100:7.2f}%  {data['recall']*100:7.2f}%  "
            f"{data['f1']*100:7.2f}%  {int(data['tp']):4d} {int(data['fp']):4d} {int(data['fn']):4d}"
        )
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate rule-based contact extraction")
    parser.add_argument(
        "--docbin",
        type=Path,
        nargs="+",
        required=True,
        help="Path(s) to spaCy DocBin files containing annotated resumes",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    metrics = evaluate(args.docbin)
    print(format_metrics(metrics))


if __name__ == "__main__":
    main()
