#!/usr/bin/env python3
"""
Merge two spaCy DocBin files into one, with optional backup of the output path.
"""

import spacy
from spacy.tokens import DocBin
from pathlib import Path
import argparse
import shutil
import sys


def main():
    parser = argparse.ArgumentParser(description="Merge two spaCy DocBin files safely.")
    parser.add_argument("--a", required=True, help="First DocBin path (usually train.spacy)")
    parser.add_argument("--b", required=True, help="Second DocBin path (new examples)")
    parser.add_argument("--out", required=True, help="Output DocBin path (merged result)")
    parser.add_argument("--backup", action="store_true", help="Backup --out before overwriting")
    args = parser.parse_args()

    out_path = Path(args.out)
    if args.backup and out_path.exists():
        backup_path = out_path.with_suffix(".bak")
        shutil.copy2(out_path, backup_path)
        print(f"📦 Backed up existing {args.out} → {backup_path}", file=sys.stderr)

    nlp = spacy.blank("en")
    a_bin = DocBin().from_disk(args.a)
    b_bin = DocBin().from_disk(args.b)

    a_docs = list(a_bin.get_docs(nlp.vocab))
    b_docs = list(b_bin.get_docs(nlp.vocab))

    print(f"🔄 Merging {len(a_docs)} base docs + {len(b_docs)} new docs...", file=sys.stderr)

    out_bin = DocBin(store_user_data=True)
    for doc in a_docs + b_docs:
        out_bin.add(doc)

    out_bin.to_disk(out_path)
    print(f"✅ Wrote merged DocBin with {len(a_docs) + len(b_docs)} docs → {out_path}")


if __name__ == "__main__":
    main()
