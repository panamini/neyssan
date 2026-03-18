"""Inspect raw labels across resume datasets and suggest canonical mappings."""

from __future__ import annotations

import argparse
import csv
import difflib
import json
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import yaml

from cv_parser.prepare_dataset import sanitize_text

DATASETS = [
    "Entity_Recognition_in_Resumes.json",
    "ResumesJsonAnnotated",
    "Resume-Corpus-Dataset-main/data-files",
    "ResumesJsonAnnotated_hug",
]

CANONICAL_LABELS = {
    "NAME",
    "EMAIL",
    "PHONE",
    "COMPANY",
    "ROLE",
    "START_DATE",
    "END_DATE",
    "DEGREE",
    "CERTIFICATE",
    "GRADE",
    "INSTITUTION",
    "SKILL",
    "LANGUAGE",
    "LOC",
    "GPE",
    "ADDRESS",
    "PROJECT",
    "ACHIEVEMENT",
    "AWARD",
}


class LabelCollector:
    def __init__(self) -> None:
        self.labels: Dict[str, Dict[str, Dict[str, object]]] = defaultdict(lambda: defaultdict(lambda: {"count": 0, "examples": []}))
        self.global_counts: Dict[str, int] = defaultdict(int)

    def add(self, dataset: str, label: str, text: str) -> None:
        entry = self.labels[dataset][label]
        entry["count"] = int(entry["count"]) + 1
        if len(entry["examples"]) < 3 and text:
            entry["examples"].append(text.strip())
        self.global_counts[label] += 1


def iter_dataturks(path: Path, collector: LabelCollector) -> None:
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError:
                continue
            text = raw.get("content") or raw.get("text") or ""
            text = sanitize_text(text.replace("\r\n", "\n"))
            annotations = raw.get("annotation") or []
            for ann in annotations:
                labels = ann.get("label") or []
                points = ann.get("points") or []
                if isinstance(labels, str):
                    labels = [labels]
                if isinstance(points, dict):
                    points = [points]
                for label in labels:
                    for point in points:
                        start = point.get("start")
                        end = point.get("end")
                        if isinstance(start, int) and isinstance(end, int) and start < end:
                            snippet = text[start:end]
                        else:
                            snippet = text[:200]
                        collector.add("Entity_Recognition_in_Resumes.json", label, snippet)


def iter_span_dict_dir(path: Path, collector: LabelCollector, dataset: str) -> None:
    for json_path in path.glob("*.json"):
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        text = sanitize_text((data.get("text") or "").replace("\r\n", "\n"))
        annotations = data.get("annotations") or []
        for ann in annotations:
            if isinstance(ann, dict):
                label = ann.get("label") or ann.get("labels")
            elif isinstance(ann, (list, tuple)) and len(ann) >= 3:
                label = ann[2]
            else:
                continue
            snippet = text[:200]
            collector.add(dataset, str(label), snippet)


def iter_labelstudio(path: Path, collector: LabelCollector, dataset: str) -> None:
    for json_path in path.glob("*.json"):
        try:
            items = json.loads(json_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if not isinstance(items, list):
            continue
        for item in items:
            text = sanitize_text((item.get("data", {}).get("text") or "").replace("\r\n", "\n"))
            annotations = item.get("annotations") or []
            if not annotations:
                continue
            selected = next((ann for ann in annotations if not ann.get("was_cancelled")), annotations[0])
            for result in selected.get("result", []):
                if result.get("type") != "labels":
                    continue
                labels = result.get("value", {}).get("labels") or []
                snippet = result.get("value", {}).get("text") or text[:200]
                for label in labels:
                    collector.add(dataset, str(label), snippet)


def inspect_sources(paths: Iterable[Path], collector: LabelCollector) -> None:
    for path in paths:
        if path.is_file():
            iter_dataturks(path, collector)
        elif path.is_dir():
            name = path.name
            if name.startswith("Resume-Corpus"):
                iter_labelstudio(path, collector, "Resume-Corpus-Dataset-main")
            elif name.startswith("ResumesJsonAnnotated_hug"):
                iter_span_dict_dir(path, collector, "ResumesJsonAnnotated_hug")
            elif name.startswith("ResumesJsonAnnotated"):
                iter_span_dict_dir(path, collector, "ResumesJsonAnnotated")


def guess_mapping(label: str, canonical_labels: Iterable[str]) -> List[str]:
    cleaned = label.strip()
    base = cleaned.split(":", 1)[0]
    normalized = base.upper().replace("-", "_").replace(" ", "_")
    suggestions: List[str] = []
    if normalized in canonical_labels:
        suggestions.append(normalized)
    elif base.upper() in canonical_labels:
        suggestions.append(base.upper())
    else:
        matches = difflib.get_close_matches(normalized, list(canonical_labels), n=3, cutoff=0.6)
        suggestions.extend(matches)
    return suggestions


def write_yaml_suggestions(output_path: Path, global_counts: Dict[str, int], collector: LabelCollector) -> None:
    suggestions = {}
    rare_labels = []
    for label, count in sorted(global_counts.items(), key=lambda kv: kv[0]):
        label_suggestions = guess_mapping(label, CANONICAL_LABELS)
        suggestions[label] = {
            "count": count,
            "suggested": label_suggestions,
        }
        if count < 10:
            rare_labels.append(label)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    yaml.safe_dump({"suggestions": suggestions, "rare_labels": rare_labels}, output_path.open("w"))


def print_report(collector: LabelCollector, max_labels: int = 25) -> None:
    for dataset, labels in collector.labels.items():
        print(f"Dataset: {dataset}")
        sorted_labels = sorted(labels.items(), key=lambda kv: (-int(kv[1]["count"]), kv[0]))
        for idx, (label, info) in enumerate(sorted_labels):
            if idx >= max_labels:
                print(f"  ... ({len(sorted_labels) - max_labels} more labels omitted)")
                break
            print(f"  {label}: {info['count']}")
            for example in info["examples"]:
                snippet = example.replace("\n", " ")[:120]
                print(f"    - {snippet}")
    print("\nGlobal label counts:")
    for label, count in sorted(collector.global_counts.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"  {label}: {count}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect raw labels across resume datasets")
    parser.add_argument("paths", nargs="*", type=Path, default=[Path(p) for p in DATASETS])
    parser.add_argument("--output", type=Path, default=Path("data/label_map_suggestions.yaml"))
    args = parser.parse_args()

    collector = LabelCollector()
    inspect_sources(args.paths, collector)
    print_report(collector)
    write_yaml_suggestions(args.output, collector.global_counts, collector)
    print(f"\nSuggested mappings written to {args.output}")


if __name__ == "__main__":
    main()
