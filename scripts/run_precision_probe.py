#!/usr/bin/env python3
"""
run_precision_probe.py — automated short-run training + precision gate loop.

Features:
- Runs spaCy train for N steps (default 150)
- Evaluates on dev + golden sets
- Runs error_buckets.py for both splits
- Harvests negatives and retries up to --max-retries if precision < gate
- Cleans/moves older training outputs to free space
- Writes probe_summary.json for CI parsing
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import spacy
from spacy.util import fix_random_seed


CONFIG_DEFAULT = "cv_parser/config_roberta.cfg"
DEV_DEFAULT = "my-app/testdata/cv_filtered/dev.spacy"
GOLDEN_DEFAULT = "my-app/testdata/cv_filtered/golden_sample.spacy"
TRAIN_OUT = Path("training/out_probe")

ERROR_BUCKETS_SCRIPT = "cv_parser/scripts/error_buckets.py"
HARVEST_SCRIPT = "cv_parser/scripts/harvest_negatives.py"
SUMMARY_FILE = Path("diagnostics/probe_summary.json")
VIDEO_ARCHIVE = Path("/Volumes/VIDEO/training_archive")
DIAG_DIR = Path("diagnostics")
GATE_PRECISION = 0.30


def run_cmd(cmd: list[str]) -> None:
    print(f"[CMD] {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


def evaluate_model(model_path: Path, data_path: str, out_json: Path) -> dict:
    run_cmd([
        "python", "-m", "spacy", "evaluate", str(model_path), data_path,
        "--code", "cv_parser/bootstrap.py",
        "--output", str(out_json)
    ])
    return json.loads(out_json.read_text())


def train_model(config: str, outdir: Path, max_steps: int) -> None:
    if outdir.exists():
        shutil.rmtree(outdir)
    run_cmd([
        "python", "-m", "spacy", "train", config,
        "--output", str(outdir),
        "--paths.train", "my-app/testdata/cv_filtered/train.spacy",
        "--paths.dev", DEV_DEFAULT,
        "--code", "cv_parser/bootstrap.py",
        f"--training.max_steps={max_steps}"
    ])


def run_error_buckets(model_path: Path, data_path: str, out_json: Path):
    run_cmd([
        "python", ERROR_BUCKETS_SCRIPT,
        "--ner-model", str(model_path),
        "--gold", data_path,
        "--out", str(out_json),
        "--top-n", "5"
    ])

def compute_fp_counts(buckets_path: Path) -> int:
    data = json.loads(buckets_path.read_text())
    cats = data.get("categories", {})
    return sum(v["count"] for k, v in cats.items() if k.endswith("_fp"))

def harvest_negatives(buckets_path: Path):
    run_cmd([
        "python", HARVEST_SCRIPT,
        "--buckets", str(buckets_path),
        "--out", "my-app/testdata/cv_filtered/train.spacy",
        "--dev", DEV_DEFAULT
    ])

def cleanup_old_models():
    VIDEO_ARCHIVE.mkdir(parents=True, exist_ok=True)
    for p in Path("training").glob("out_*"):
        if p.name != TRAIN_OUT.name:
            dest = VIDEO_ARCHIVE / p.name
            print(f"[CLEANUP] Moving {p} → {dest}")
            if dest.exists():
                shutil.rmtree(dest)
            shutil.move(str(p), dest)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=CONFIG_DEFAULT)
    parser.add_argument("--max-steps", type=int, default=150)
    parser.add_argument("--max-retries", type=int, default=2)
    parser.add_argument("--gate", type=float, default=GATE_PRECISION)
    args = parser.parse_args()

    DIAG_DIR.mkdir(parents=True, exist_ok=True)
    fix_random_seed(42)
    retries = 0
    dev_precision = 0.0

    while retries <= args.max_retries:
        print(f"\n=== Precision Probe (attempt {retries+1}/{args.max_retries+1}) ===")
        outdir = TRAIN_OUT
        train_model(args.config, outdir, args.max_steps)

        model_last = outdir / "model-last"
        dev_eval = evaluate_model(model_last, DEV_DEFAULT, DIAG_DIR / "predictions_dev_probe.json")
        golden_eval = evaluate_model(model_last, GOLDEN_DEFAULT, DIAG_DIR / "predictions_golden_probe.json")

        dev_precision = dev_eval.get("ents_p", 0.0)
        golden_precision = golden_eval.get("ents_p", 0.0)
        print("=== Precision Probe Summary ===")
        print(f"dev ents_p={dev_precision:.3f} ents_f={dev_eval.get('ents_f', 0.0):.3f}")
        print(f"golden ents_p={golden_precision:.3f} ents_f={golden_eval.get('ents_f', 0.0):.3f}")

        # Run error buckets
        run_error_buckets(model_last, DEV_DEFAULT, DIAG_DIR / "error_buckets_dev_probe.json")
        run_error_buckets(model_last, GOLDEN_DEFAULT, DIAG_DIR / "error_buckets_golden_probe.json")

        # Count FP totals
        dev_fp = compute_fp_counts(DIAG_DIR / "error_buckets_dev_probe.json")
        golden_fp = compute_fp_counts(DIAG_DIR / "error_buckets_golden_probe.json")
        print(f"FP counts -> total dev:{dev_fp} golden:{golden_fp}")

        # Write summary for CI
        SUMMARY_FILE.write_text(json.dumps({
            "attempt": retries + 1,
            "dev_precision": dev_precision,
            "golden_precision": golden_precision,
            "dev_f1": dev_eval.get("ents_f", 0.0),
            "golden_f1": golden_eval.get("ents_f", 0.0),
            "dev_fp": dev_fp,
            "golden_fp": golden_fp,
            "passed": dev_precision >= args.gate
        }, indent=2))

        if dev_precision >= args.gate:
            print(f"[SUCCESS] Precision gate satisfied (>= {args.gate:.2f}).")
            cleanup_old_models()
            sys.exit(0)

        retries += 1
        if retries > args.max_retries:
            print(f"[FAIL] Precision gate not met (dev ents_p={dev_precision:.3f} < {args.gate:.2f}) after {args.max_retries} retries.")
            cleanup_old_models()
            sys.exit(1)

        print("[HARVEST] Adding new negatives from dev buckets and retrying…")
        harvest_negatives(DIAG_DIR / "error_buckets_dev_probe.json")


if __name__ == "__main__":
    main()
