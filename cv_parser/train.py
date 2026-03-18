"""CLI to train the transformer NER pipeline."""

from __future__ import annotations

import argparse
from pathlib import Path

from spacy.cli.train import train


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the hybrid CV parser spaCy model")
    parser.add_argument("config", type=Path, help="Path to spaCy config.cfg")
    parser.add_argument("--output", type=Path, required=True, help="Output directory for model artifacts")
    parser.add_argument("--train-corpus", type=Path, help="Override train corpus path")
    parser.add_argument("--dev-corpus", type=Path, help="Override dev corpus path")
    parser.add_argument("--gpu-id", type=int, default=0, help="GPU device id (-1 for CPU)")
    parser.add_argument(
        "--enable-spancat",
        action="store_true",
        help="Enable optional spancat component for overlapping span classification",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    overrides = {}
    if args.train_corpus:
        overrides["paths.train"] = str(args.train_corpus)
    if args.dev_corpus:
        overrides["paths.dev"] = str(args.dev_corpus)
    if args.enable_spancat:
        overrides["nlp.pipeline"] = [
            "transformer",
            "pattern_ruler",
            "spancat",
            "span_window_probe",
            "ner",
        ]
    train(
        config_path=str(args.config),
        output_path=args.output,
        overrides=overrides,
        use_gpu=args.gpu_id,
    )


if __name__ == "__main__":
    main()
