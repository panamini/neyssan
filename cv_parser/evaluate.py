"""CLI to evaluate a trained spaCy model."""

from __future__ import annotations

import argparse
from pathlib import Path

from spacy.cli.evaluate import evaluate


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate hybrid CV parser model")
    parser.add_argument("model", type=Path, help="Path to model directory (model-best)")
    parser.add_argument("corpus", type=Path, help="Path to evaluation corpus (.spacy)")
    parser.add_argument("--output", type=Path, default=Path("reports"), help="Directory for evaluation reports")
    parser.add_argument("--gpu-id", type=int, default=0, help="GPU device id (-1 for CPU)")
    parser.add_argument("--gold-preproc", action="store_true", help="Assume gold preprocessing")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    evaluate(
        model=str(args.model),
        data_paths=[str(args.corpus)],
        output=str(args.output / "evaluation.json"),
        use_gpu=args.gpu_id,
        gold_preproc=args.gold_preproc,
    )


if __name__ == "__main__":
    main()

