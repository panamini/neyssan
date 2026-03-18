import argparse
import random
from pathlib import Path
from typing import List, Optional, Sequence

from cv_parser.esco_utils import extract_labels, iter_rows, normalize_esco_label


def build_labels(input_path: Path, output_path: Path, delimiter: Optional[str] = None, sample_size: int = 30) -> None:
    rows = list(iter_rows(input_path, delimiter))
    if not rows:
        raise ValueError(f"No rows read from {input_path}")

    raw_labels = extract_labels(rows)
    seen = set()
    cleaned: List[str] = []
    for label in raw_labels:
        normalized = normalize_esco_label(label)
        if not normalized:
            continue
        if normalized.startswith("http://") or normalized.startswith("https://"):
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        cleaned.append(normalized)

    if not cleaned:
        raise ValueError("No labels extracted after normalization")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="ascii", newline="\n") as fh:
        for label in sorted(cleaned):
            fh.write(label)
            fh.write("\n")

    print(f"Wrote {len(cleaned)} labels to {output_path}")
    if len(cleaned) < 10000:
        raise ValueError(f"Expected at least 10k labels, got {len(cleaned)}")

    rng = random.Random(1337)
    examples = rng.sample(cleaned, min(sample_size, len(cleaned)))
    print("Sample labels:")
    for label in examples:
        print(f"  - {label}")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a normalized ESCO label list")
    parser.add_argument("input", type=Path, help="Path to ESCO skills CSV")
    parser.add_argument("output", type=Path, help="Output path for newline-delimited labels")
    parser.add_argument("--delimiter", dest="delimiter", help="Override delimiter detection")
    parser.add_argument("--sample", dest="sample_size", type=int, default=30, help="Number of sample labels to print")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> None:
    args = parse_args(argv)
    build_labels(args.input, args.output, args.delimiter, args.sample_size)


if __name__ == "__main__":
    main()
