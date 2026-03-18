from __future__ import annotations

import argparse
import csv
import random
import unicodedata
from pathlib import Path

DEFAULT_SOURCE = Path("my-app/testdata/cv/esco/ESCO dataset - v1.2.0 - classification - en - csv/skills_en.csv")
DEFAULT_OUTPUT = Path("my-app/testdata/cv/esco/esco_labels.txt")


def detect_delimiter(sample: str) -> str:
    sniff = csv.Sniffer()
    try:
        dialect = sniff.sniff(sample, delimiters=[",", ";", "\t"])
        return dialect.delimiter
    except csv.Error:
        return ";"


def normalize_token(value: str) -> str:
    return unicodedata.normalize("NFKC", value).strip().lower()


def load_labels(path: Path) -> list[str]:
    if not path.exists():
        raise FileNotFoundError(f"ESCO skills file not found: {path}")
    sample = path.read_text(encoding="utf-8", errors="ignore")[:4096]
    delimiter = detect_delimiter(sample)

    labels: set[str] = set()

    with path.open(encoding="utf-8", errors="ignore") as fh:
        reader = csv.reader(fh, delimiter=delimiter)
        header = next(reader, None)
        if header is None:
            return []
        header_lower = [h.strip().lower() for h in header]
        try:
            preferred_idx = header_lower.index("preferredlabel")
        except ValueError:
            preferred_idx = 1  # fallback: most dumps use column order [uri, preferred, alt, ...]
        try:
            alt_idx = header_lower.index("altlabels")
        except ValueError:
            alt_idx = 2 if len(header_lower) > 2 else None

        split_chars = ["|", ";", ","]

        for row in reader:
            if not row:
                continue
            if preferred_idx < len(row):
                token = normalize_token(row[preferred_idx])
                if token and not token.startswith("http://") and not token.startswith("https://"):
                    labels.add(token)
            if alt_idx is not None and alt_idx < len(row):
                raw_alt = row[alt_idx]
                for char in split_chars:
                    raw_alt = raw_alt.replace(char, "|")
                for candidate in raw_alt.split("|"):
                    token = normalize_token(candidate)
                    if token and not token.startswith("http://") and not token.startswith("https://"):
                        labels.add(token)
    sorted_labels = sorted(labels)
    return sorted_labels


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract ESCO preferred/alt labels into plain text list")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Path to ESCO skills CSV")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output path for label list")
    args = parser.parse_args()

    labels = load_labels(args.source)
    if not labels:
        raise SystemExit("No labels extracted from ESCO source; check file format.")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(labels) + "\n", encoding="utf-8")

    print(f"Wrote {len(labels)} labels to {args.output}")
    print("Sample labels:")
    random.seed(0)
    for label in random.sample(labels, min(30, len(labels))):
        print(f"  {label}")


if __name__ == "__main__":
    main()
