#!/usr/bin/env python3
"""Bucket parser errors by category for quick QA triage.

Usage example:
    python cv_parser/scripts/error_buckets.py \
        --gold my-app/testdata/cv_filtered/golden_sample.spacy \
        --out diagnostics/error_buckets.json \
        --limit 50 \
        --ner
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Set, Tuple

import spacy
from spacy.tokens import Doc, DocBin

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from cv_parser.rules import RuleConfig, RuleEngine  # noqa: E402
from cv_parser.types import SectionSpan  # noqa: E402

TARGET_LABELS = (
    "EMAIL",
    "PHONE",
    "URL",
    "DEGREE",
    "START_DATE",
    "END_DATE",
)

DEFAULT_NER_MODEL = ROOT / "training" / "output" / "model-best"
DEFAULT_FAILURE_DIR = Path("my-app/testdata/cv/failures")
DEFAULT_TOP_N = 5
EMAIL_PATTERN = re.compile(
    r"(?<![\w.+-])[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,63}(?![A-Za-z0-9.-])",
    re.IGNORECASE,
)


def load_docs(paths: Sequence[Path]) -> Iterable[Tuple[Path, Doc]]:
    nlp = spacy.blank("en")
    for path in paths:
        if not path.exists():
            raise FileNotFoundError(f"DocBin not found: {path}")
        docbin = DocBin().from_disk(path)
        for doc in docbin.get_docs(nlp.vocab):
            yield path, doc


def collect_entity_counts(paths: Sequence[Path]) -> Dict[str, int]:
    counts: Counter[str] = Counter()
    for _, doc in load_docs(paths):
        for ent in doc.ents:
            counts[ent.label_] += 1
    return dict(counts)


def ensure_category(store: Dict[str, Dict[str, object]], name: str) -> Dict[str, object]:
    return store.setdefault(name, {"count": 0, "doc_ids": []})


def _serialize_spans(spans: Iterable[Tuple[int, int, str]], text: str) -> List[Dict[str, object]]:
    serialized: List[Dict[str, object]] = []
    for start, end, label in sorted(spans, key=lambda item: (item[0], item[1], item[2])):
        snippet = text[start:end]
        serialized.append({
            "start": start,
            "end": end,
            "label": label,
            "text": snippet,
        })
    return serialized


def sanitize_text(text: str, limit: int = 2000) -> str:
    masked = EMAIL_PATTERN.sub(lambda m: "*" * len(m.group(0)), text)
    masked = re.sub(r"\d", "0", masked)
    if len(masked) > limit:
        return masked[:limit] + "…"
    return masked


def sanitize_spans(entries: List[Dict[str, object]]) -> List[Dict[str, object]]:
    sanitized: List[Dict[str, object]] = []
    for entry in entries:
        cloned = dict(entry)
        text_value = cloned.get("text")
        if isinstance(text_value, str):
            cloned["text"] = sanitize_text(text_value, limit=256)
        sanitized.append(cloned)
    return sanitized


def build_failure_payload(
    categories: Dict[str, Dict[str, object]],
    debug: Dict[str, Dict[str, object]],
    top_n: int,
) -> Dict[str, List[Dict[str, object]]]:
    samples: Dict[str, List[Dict[str, object]]] = {}
    for name, meta in categories.items():
        doc_ids = meta.get("doc_ids", [])
        bucket: List[Dict[str, object]] = []
        seen: Set[str] = set()
        for doc_id in doc_ids:
            if doc_id in seen:
                continue
            seen.add(doc_id)
            info = debug.get(doc_id)
            entry: Dict[str, object] = {"doc_id": doc_id}
            if info is None:
                entry["error"] = "missing_debug"
            else:
                entry["dataset"] = info.get("dataset")
                raw_text = info.get("text", "")
                entry["text"] = sanitize_text(raw_text)
                entry["gold"] = sanitize_spans(info.get("gold", []))
                entry["predictions"] = sanitize_spans(info.get("predictions", []))
                entry["missing"] = {
                    label: sanitize_spans(spans)
                    for label, spans in info.get("missing", {}).items()
                }
                entry["false_positives"] = {
                    label: sanitize_spans(spans)
                    for label, spans in info.get("false_positives", {}).items()
                }
                if "error" in info:
                    entry["error"] = info["error"]
            bucket.append(entry)
            if len(bucket) >= top_n:
                break
        if bucket:
            samples[name] = bucket
    return samples


def evaluate(
    doc_paths: Sequence[Path],
    limit: int | None,
    use_ner: bool,
    ner_model: Path | None,
) -> Dict[str, object]:
    engine = RuleEngine(RuleConfig())
    nlp = None
    if use_ner:
        model_path = ner_model or DEFAULT_NER_MODEL
        if not model_path.exists():
            raise FileNotFoundError(f"NER model not found: {model_path}")
        nlp = spacy.load(model_path)

    categories: Dict[str, Dict[str, object]] = {}
    for label in TARGET_LABELS:
        ensure_category(categories, f"missing_{label.lower()}")
        ensure_category(categories, f"{label.lower()}_fp")
    ensure_category(categories, "no_gold_entities")
    ensure_category(categories, "document_parse_error")

    seen_docs = 0
    doc_debug: Dict[str, Dict[str, object]] = {}

    for path, doc in load_docs(doc_paths):
        doc_id = f"{path.name}:{seen_docs}"
        seen_docs += 1
        if limit is not None and seen_docs > limit:
            break

        gold_spans = {
            (ent.start_char, ent.end_char, ent.label_)
            for ent in doc.ents
            if ent.label_ in TARGET_LABELS
        }

        predictions: Set[Tuple[int, int, str]] = set()
        full_span = SectionSpan(label="CONTACT", text=doc.text, start_block=0, end_block=0)
        edu_span = SectionSpan(label="EDUCATION", text=doc.text, start_block=0, end_block=0)
        for match in engine.run(full_span, 0):
            if match.label in TARGET_LABELS:
                predictions.add((match.start, match.end, match.label))
        for match in engine.run(edu_span, 0):
            if match.label in TARGET_LABELS:
                predictions.add((match.start, match.end, match.label))

        ner_failed = False
        if use_ner and nlp is not None:
            try:
                ner_doc = nlp(doc.text)
                for span in ner_doc.ents:
                    if span.label_ in TARGET_LABELS:
                        predictions.add((span.start_char, span.end_char, span.label_))
            except Exception:
                cat = ensure_category(categories, "document_parse_error")
                cat["count"] += 1
                cat["doc_ids"].append(doc_id)
                ner_failed = True

        if ner_failed and not gold_spans:
            doc_debug[doc_id] = {
                "dataset": str(path),
                "text": doc.text,
                "gold": [],
                "predictions": [],
                "missing": {},
                "false_positives": {},
                "error": "ner_runtime_error",
            }
            continue

        if not gold_spans:
            cat = ensure_category(categories, "no_gold_entities")
            cat["count"] += 1
            cat["doc_ids"].append(doc_id)
            doc_debug[doc_id] = {
                "dataset": str(path),
                "text": doc.text,
                "gold": [],
                "predictions": _serialize_spans(predictions, doc.text),
                "missing": {},
                "false_positives": {},
            }
            continue

        missing_map: Dict[str, List[Tuple[int, int, str]]] = defaultdict(list)
        fp_map: Dict[str, List[Tuple[int, int, str]]] = defaultdict(list)

        for start, end, label in gold_spans:
            if (start, end, label) not in predictions:
                cat = ensure_category(categories, f"missing_{label.lower()}")
                cat["count"] += 1
                cat["doc_ids"].append(doc_id)
                missing_map[label].append((start, end, label))

        for start, end, label in predictions:
            if (start, end, label) not in gold_spans:
                cat = ensure_category(categories, f"{label.lower()}_fp")
                cat["count"] += 1
                cat["doc_ids"].append(doc_id)
                fp_map[label].append((start, end, label))

        doc_debug[doc_id] = {
            "dataset": str(path),
            "text": doc.text,
            "gold": _serialize_spans(gold_spans, doc.text),
            "predictions": _serialize_spans(predictions, doc.text),
            "missing": {
                label: _serialize_spans(spans, doc.text)
                for label, spans in missing_map.items()
            },
            "false_positives": {
                label: _serialize_spans(spans, doc.text)
                for label, spans in fp_map.items()
            },
        }

    return {
        "categories": categories,
        "total_docs": min(seen_docs, limit or seen_docs),
        "debug": doc_debug,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bucket parser errors for CV contact fields")
    parser.add_argument("--gold", type=Path, nargs="+", required=True, help="spaCy DocBin file(s) with gold annotations")
    parser.add_argument("--out", type=Path, required=True, help="Destination JSON path")
    parser.add_argument("--limit", type=int, default=None, help="Limit the number of documents evaluated")
    parser.add_argument("--ner", action="store_true", help="Enable spaCy NER model alongside rules")
    parser.add_argument("--ner-model", type=Path, default=None, help="Override path to spaCy NER model")
    parser.add_argument("--top-n", type=int, default=DEFAULT_TOP_N, help="Number of failure samples per category")
    parser.add_argument(
        "--failure-dir",
        type=Path,
        default=DEFAULT_FAILURE_DIR,
        help="Directory where anonymised failure fixtures are written",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    counts = collect_entity_counts(args.gold)
    if not counts:
        print("[error-buckets] Warning: dataset has no entity annotations.")
    else:
        top_counts = ", ".join(f"{label}={count}" for label, count in sorted(counts.items(), key=lambda x: x[0]))
        print(f"[error-buckets] Loaded {sum(counts.values())} entities | {top_counts}")

    result = evaluate(args.gold, args.limit, args.ner, args.ner_model)
    debug_info = result.pop("debug", {})

    if len(result["categories"]) < 5:
        print("[error-buckets] Warning: fewer than 5 categories produced; consider richer annotations.")

    failure_dir = args.failure_dir
    failure_dir.mkdir(parents=True, exist_ok=True)
    failure_payload = build_failure_payload(result["categories"], debug_info, max(1, args.top_n))
    failure_path = None
    if failure_payload:
        failure_path = failure_dir / f"{args.out.stem}_failures.json"
        failure_meta = {
            "datasets": [str(path) for path in args.gold],
            "top_n": args.top_n,
            "generated_from": str(args.out),
            "samples": failure_payload,
        }
        with failure_path.open("w", encoding="utf-8") as f:
            json.dump(failure_meta, f, indent=2, sort_keys=True)
        print(f"[error-buckets] Wrote failure fixtures to {failure_path}")

    payload = {
        "datasets": [str(path) for path in args.gold],
        "options": {
            "limit": args.limit,
            "ner": args.ner,
            "ner_model": str(args.ner_model or DEFAULT_NER_MODEL),
        },
        "entity_counts": counts,
        "categories": result["categories"],
        "total_docs": result["total_docs"],
    }
    if failure_path is not None:
        payload["failure_fixture"] = str(failure_path)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
    print(f"[error-buckets] Wrote {args.out}")


if __name__ == "__main__":
    main()
