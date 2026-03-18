#!/usr/bin/env python3
"""
Convert NER entities (doc.ents) to spans for SpanCat training:
writes to doc.spans[spans_key] and clears doc.ents.

Usage:
  python ents_to_spans.py <input.spacy> <output.spacy> [--spans-key sc] [--progress 100]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Dict, Set, Tuple

import spacy
from spacy.tokens import DocBin, Span


def convert(input_path: Path, output_path: Path, spans_key: str = "sc", progress_every: int = 100) -> None:
    """Stream-convert doc.ents → doc.spans[spans_key], clear doc.ents, and write DocBin."""

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")
    if not spans_key or not spans_key.strip():
        raise ValueError("spans_key cannot be empty or whitespace")

    print(f"🔧 Converting {input_path} → {output_path} (spans_key='{spans_key}')")

    nlp = spacy.blank("en")
    db_in = DocBin().from_disk(str(input_path))
    db_out = DocBin(store_user_data=True)  # preserve extension attrs / user_data

    total_docs = 0
    total_spans = 0
    label_counts: Dict[str, int] = {}

    for i, doc in enumerate(db_in.get_docs(nlp.vocab)):
        total_docs += 1

        # Warn if we're overwriting an existing span group
        if spans_key in doc.spans and doc.spans[spans_key]:
            print(f"⚠️  Overwriting existing doc.spans['{spans_key}'] in doc {i}")

        seen: Set[Tuple[int, int, str]] = set()
        spans: list[Span] = []

        # ents → spans with boundary validation + dedupe
        for ent in doc.ents:
            if ent.start < 0 or ent.end > len(doc) or ent.start >= ent.end:
                print(f"⚠️  Skipping invalid entity in doc {i}: ({ent.start}, {ent.end}, {ent.label_})")
                continue
            key = (ent.start, ent.end, ent.label_)
            if key not in seen:
                seen.add(key)
                spans.append(Span(doc, ent.start, ent.end, label=ent.label_))

        # Assign and clear
        doc.spans[spans_key] = spans
        doc.ents = ()

        # Stats
        total_spans += len(spans)
        for s in spans:
            label_counts[s.label_] = label_counts.get(s.label_, 0) + 1

        if progress_every and (i + 1) % progress_every == 0:
            print(f"  Processed {i + 1} documents")

        db_out.add(doc)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    db_out.to_disk(str(output_path))

    # Summary + hard fail on zero spans (prevents SpanCat label-init errors)
    print("✅ Conversion completed:")
    print(f"   Documents processed: {total_docs}")
    print(f"   Total spans: {total_spans}")
    print(f"   Labels: {dict(sorted(label_counts.items()))}")
    if total_spans == 0:
        print("❌ No spans were produced. Check that doc.ents exist in the input and that spans_key matches your config.")
        sys.exit(2)


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Convert doc.ents → doc.spans[spans_key] for SpanCat.")
    ap.add_argument("input", type=Path, help="Input .spacy DocBin with entities")
    ap.add_argument("output", type=Path, help="Output .spacy DocBin with spans")
    ap.add_argument("--spans-key", default="sc", help="Span group key to write (default: sc)")
    ap.add_argument("--progress", type=int, default=100, help="Log every N docs (0 to disable)")
    return ap.parse_args()


def main() -> None:
    args = parse_args()
    try:
        convert(args.input, args.output, spans_key=args.spans_key, progress_every=args.progress)
    except Exception as e:
        print(f"❌ Error during conversion: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
