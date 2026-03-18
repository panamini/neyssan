"""Run hybrid CV parser inference on resumes."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .hybrid_pipeline import HybridCVParser


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Hybrid CV parser inference CLI")
    parser.add_argument("model", type=Path, help="spaCy model directory (trained)")
    parser.add_argument("--input", type=Path, required=True, help="Resume file or directory")
    parser.add_argument("--output", type=Path, required=True, help="Output directory for JSON predictions")
    parser.add_argument("--esco", type=Path, help="Optional ESCO CSV for skill gazetteer")
    parser.add_argument("--prefer-docling", action="store_true", help="Use Docling ingestion when available")
    return parser.parse_args()


def iter_paths(path: Path) -> Path:
    if path.is_dir():
        for child in path.rglob("*"):
            if child.suffix.lower() in {".pdf", ".docx", ".txt", ".md"}:
                yield child
    else:
        yield path


def main() -> None:
    args = parse_args()
    parser = HybridCVParser(str(args.model), esco_csv=args.esco, prefer_docling=args.prefer_docling)
    args.output.mkdir(parents=True, exist_ok=True)
    for resume_path in iter_paths(args.input):
        result = parser.parse_path(resume_path)
        out_path = args.output / (resume_path.stem + ".json")
        out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()

