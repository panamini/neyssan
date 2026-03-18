"""Convert Doccano JSONL exports to spaCy DocBin with section metadata."""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path
from typing import List, Sequence

import spacy
from spacy.tokens import Doc, DocBin, Span

from .constants import ENTITY_LABELS


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert Doccano JSONL into spaCy DocBin")
    parser.add_argument("input", type=Path, help="Doccano JSONL file")
    parser.add_argument("output_dir", type=Path, help="Directory for DocBin files")
    parser.add_argument("--split", type=float, default=0.9, help="Train split fraction")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--lang", type=str, default="en")
    parser.add_argument("--validate", action="store_true", help="Validate spans against schema")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    random.seed(args.seed)
    nlp = spacy.blank(args.lang)
    records = [json.loads(line) for line in args.input.read_text(encoding="utf-8").splitlines() if line.strip()]
    random.shuffle(records)
    split_index = int(len(records) * args.split)
    train_records = records[:split_index]
    dev_records = records[split_index:]

    args.output_dir.mkdir(parents=True, exist_ok=True)
    _write_docbin(train_records, nlp, args.output_dir / "train.spacy", validate=args.validate)
    _write_docbin(dev_records, nlp, args.output_dir / "dev.spacy", validate=args.validate)


def _write_docbin(records: Sequence[dict], nlp, path: Path, validate: bool = False) -> None:
    docbin = DocBin(store_user_data=True)
    for record in records:
        text = record.get("text", "")
        doc = nlp.make_doc(text)
        spans: List[Span] = []
        for start, end, label in record.get("entities", []):
            if validate and label not in ENTITY_LABELS:
                raise ValueError(f"Unexpected label {label}")
            span = doc.char_span(start, end, label=label, alignment_mode="contract")
            if not span:
                continue
            spans.append(span)
        doc.spans["annotations"] = spans
        doc.ents = spans
        if validate:
            _validate_spans(doc)
        doc.user_data["sections"] = record.get("sections")
        doc.user_data["layout"] = record.get("layout")
        docbin.add(doc)
    docbin.to_disk(path)


def _validate_spans(doc: Doc) -> None:
    seen = []
    for span in doc.ents:
        for other in seen:
            if other.start < span.end and span.start < other.end:
                raise ValueError(f"Overlapping spans: {span.text} vs {other.text}")
        seen.append(span)


if __name__ == "__main__":
    main()

