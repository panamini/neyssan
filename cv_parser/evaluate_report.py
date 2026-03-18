"""Utility to summarise spaCy evaluation reports with confusion analysis."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import DefaultDict, Dict, Iterable, List, Sequence, Tuple

import spacy
from spacy.tokens import Doc, DocBin

PRIORITY_LABELS: Tuple[str, ...] = (
    "ROLE",
    "COMPANY",
    "INSTITUTION",
    "DEGREE",
    "START_DATE",
    "END_DATE",
)

CONFUSION_PAIRS: Tuple[Tuple[str, str], ...] = (
    ("ROLE", "SKILL"),
    ("COMPANY", "INSTITUTION"),
    ("DEGREE", "CERTIFICATE"),
)

DEFAULT_REMEDIATION_COUNTS: Dict[str, int] = {
    "ROLE": 250,
    "COMPANY": 250,
    "INSTITUTION": 250,
    "DEGREE": 200,
    "START_DATE": 200,
    "END_DATE": 200,
}


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Summarise spaCy eval metrics and highlight remediation steps")
    parser.add_argument("report", type=Path, help="Path to the spaCy JSON evaluation report")
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=Path("training/output_balanced/model-best"),
        help="Directory containing the trained spaCy pipeline for confusion analysis",
    )
    parser.add_argument(
        "--data-path",
        type=Path,
        default=Path("my-app/testdata/cv/dev.spacy"),
        help="Gold-standard DocBin used for evaluation",
    )
    parser.add_argument(
        "--remediation-threshold",
        type=float,
        default=0.30,
        help="F1 threshold below which remediation advice is emitted",
    )
    parser.add_argument(
        "--priority-label",
        action="append",
        dest="priority_labels",
        default=[],
        help="Priority label to include when evaluating remediation (can be repeated)",
    )
    parser.add_argument(
        "--remediation-output",
        type=Path,
        help="Path to write remediation advice JSON (defaults to <report>.remediation.json)",
    )
    return parser.parse_args(argv)


def load_json_report(path: Path) -> Dict[str, object]:
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        raise ValueError(f"Evaluation report at {path} is not a JSON object")
    return data


def _span_map(doc: Doc) -> Dict[Tuple[int, int], str]:
    mapping: Dict[Tuple[int, int], str] = {}
    for span in doc.ents:
        mapping[(span.start_char, span.end_char)] = span.label_
    return mapping


def compute_confusions(
    model_dir: Path,
    data_path: Path,
    pairs: Iterable[Tuple[str, str]],
) -> DefaultDict[str, Counter[str]]:
    confusions: DefaultDict[str, Counter[str]] = defaultdict(Counter)
    if not model_dir.exists():
        return confusions
    if not data_path.exists():
        return confusions

    nlp = spacy.load(model_dir)
    docbin = DocBin().from_disk(data_path)
    gold_docs = list(docbin.get_docs(nlp.vocab))
    texts = [doc.text for doc in gold_docs]
    pred_docs = list(nlp.pipe(texts))

    pair_set = {tuple(sorted(pair)) for pair in pairs}

    for pred_doc, gold_doc in zip(pred_docs, gold_docs):
        pred_map = _span_map(pred_doc)
        gold_map = _span_map(gold_doc)

        for key in set(pred_map.keys()) & set(gold_map.keys()):
            pred_label = pred_map[key]
            gold_label = gold_map[key]
            if pred_label == gold_label:
                continue
            canonical_pair = tuple(sorted((pred_label, gold_label)))
            if canonical_pair in pair_set:
                confusions[pred_label][gold_label] += 1

    return confusions


def format_confusion_output(confusions: DefaultDict[str, Counter[str]], pairs: Iterable[Tuple[str, str]]) -> List[str]:
    lines: List[str] = []
    for left, right in pairs:
        left_to_right = confusions.get(left, Counter()).get(right, 0)
        right_to_left = confusions.get(right, Counter()).get(left, 0)
        lines.append(f"{left} ↔ {right}: {left}->{right}={left_to_right}, {right}->{left}={right_to_left}")
    return lines


def print_metrics(report: Dict[str, object]) -> None:
    ents_p = report.get("ents_p")
    ents_r = report.get("ents_r")
    ents_f = report.get("ents_f")
    if ents_p is not None:
        print(f"Overall: P={ents_p:.4f}, R={ents_r:.4f}, F={ents_f:.4f}")

    per_type = report.get("ents_per_type", {})
    if isinstance(per_type, dict):
        print("Per-label metrics:")
        for label in sorted(per_type):
            metrics = per_type[label]
            if isinstance(metrics, dict):
                p = metrics.get("p", 0.0)
                r = metrics.get("r", 0.0)
                f = metrics.get("f", 0.0)
                print(f"  {label}: P={p:.4f}, R={r:.4f}, F={f:.4f}")


def remediation_advice(
    report: Dict[str, object],
    threshold: float,
    priority_labels: Sequence[str],
) -> List[str]:
    per_type = report.get("ents_per_type", {})
    if not isinstance(per_type, dict):
        return []

    labels = list(priority_labels) if priority_labels else list(PRIORITY_LABELS)
    advice: List[str] = []
    for label in labels:
        metrics = per_type.get(label)
        if not isinstance(metrics, dict):
            continue
        f1 = metrics.get("f", 0.0)
        if f1 is None:
            continue
        if f1 < threshold:
            count = DEFAULT_REMEDIATION_COUNTS.get(label, 200)
            advice.append(f"{label}:+{count}")
    return advice


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    report = load_json_report(args.report)

    print_metrics(report)

    confusions = compute_confusions(args.model_dir, args.data_path, CONFUSION_PAIRS)
    for line in format_confusion_output(confusions, CONFUSION_PAIRS):
        print(line)

    advice = remediation_advice(report, args.remediation_threshold, args.priority_labels)
    if advice:
        print("Remediation plan:")
        print("  " + ", ".join(advice))

    output_payload = {
        "threshold": args.remediation_threshold,
        "priority_labels": list(args.priority_labels) if args.priority_labels else list(PRIORITY_LABELS),
        "advice": advice,
        "confusions": {label: dict(counter) for label, counter in confusions.items()},
        "overall": {
            "precision": report.get("ents_p"),
            "recall": report.get("ents_r"),
            "f1": report.get("ents_f"),
        },
    }
    remediation_path = args.remediation_output or args.report.with_name(f"{args.report.stem}_extra.json")
    remediation_path.parent.mkdir(parents=True, exist_ok=True)
    remediation_path.write_text(json.dumps(output_payload, indent=2))


if __name__ == "__main__":
    main()
