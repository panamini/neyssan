#!/usr/bin/env python3
"""
run_probe_300.py — flexible long-step precision probe without retries.

Features:
- Runs spaCy train for N steps (default 300)
- Evaluates on dev + golden sets
- Runs error_buckets.py for both splits
- Always writes probe_{N}_summary.json with ents_p/f, fp_counts for CI
- Prints concise CI summary (1-2 lines) with status
- Cleans/moves older training outputs to free space
- Warns if golden precision < 0.05 or dev < 0.30; exits 1 only if dev < 0.10 (catastrophic)
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

ERROR_BUCKETS_SCRIPT = "cv_parser/scripts/error_buckets.py"
HARVEST_SCRIPT = "cv_parser/scripts/harvest_negatives.py"
VIDEO_ARCHIVE = Path("/Volumes/VIDEO/training_archive")
DIAG_DIR = Path("diagnostics")
GATE_PRECISION = 0.30
GOLDEN_WARN = 0.05
CATASTROPHIC_GATE = 0.10


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


def cleanup_old_models(outdir: Path):
    """Delete old training outputs except the one we just created."""
    train_root = Path("training")
    if not train_root.exists():
        return
    for p in train_root.glob("out_*"):
        if p.resolve() != outdir.resolve():
            shutil.rmtree(p, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=CONFIG_DEFAULT)
    parser.add_argument("--max-steps", type=int, default=300)
    parser.add_argument("--gate", type=float, default=GATE_PRECISION)
    args = parser.parse_args()

    DIAG_DIR.mkdir(parents=True, exist_ok=True)
    fix_random_seed(42)

    print(f"\n=== {args.max_steps}-Step Precision Probe ===")
    outdir = Path(f"training/out_probe{args.max_steps}")
    train_model(args.config, outdir, args.max_steps)

    model_last = outdir / "model-last"
    dev_eval = evaluate_model(model_last, DEV_DEFAULT, DIAG_DIR / f"predictions_dev_probe{args.max_steps}.json")
    golden_eval = evaluate_model(model_last, GOLDEN_DEFAULT, DIAG_DIR / f"predictions_golden_probe{args.max_steps}.json")

    dev_precision = dev_eval.get("ents_p", 0.0)
    golden_precision = golden_eval.get("ents_p", 0.0)
    dev_f1 = dev_eval.get("ents_f", 0.0)
    golden_f1 = golden_eval.get("ents_f", 0.0)

    print("=== Precision Probe Summary ===")
    print(f"dev ents_p={dev_precision:.3f} ents_f={dev_f1:.3f}")
    print(f"golden ents_p={golden_precision:.3f} ents_f={golden_f1:.3f}")

    # Run error buckets
    run_error_buckets(model_last, DEV_DEFAULT, DIAG_DIR / f"error_buckets_dev_probe{args.max_steps}.json")
    run_error_buckets(model_last, GOLDEN_DEFAULT, DIAG_DIR / f"error_buckets_golden_probe{args.max_steps}.json")

    # Count FP totals
    dev_fp = compute_fp_counts(DIAG_DIR / f"error_buckets_dev_probe{args.max_steps}.json")
    golden_fp = compute_fp_counts(DIAG_DIR / f"error_buckets_golden_probe{args.max_steps}.json")
    print(f"FP counts -> total dev:{dev_fp} golden:{golden_fp}")

    # Always write summary for CI
    summary_file = DIAG_DIR / f"probe_{args.max_steps}_summary.json"
    summary_file.write_text(json.dumps({
        "max_steps": args.max_steps,
        "dev_precision": dev_precision,
        "dev_f1": dev_f1,
        "golden_precision": golden_precision,
        "golden_f1": golden_f1,
        "fp_count_dev": dev_fp,
        "fp_count_golden": golden_fp,
        "dev_gate_passed": dev_precision >= args.gate,
        "golden_warn": golden_precision < GOLDEN_WARN
    }, indent=2))

    # CI-friendly summary
    status = "✅" if dev_precision >= args.gate else "⚠️" if dev_precision >= CATASTROPHIC_GATE else "❌"
    print(f"[CI SUMMARY] {status} Dev P={dev_precision:.3f} F1={dev_f1:.3f} | "
          f"Golden P={golden_precision:.3f} F1={golden_f1:.3f} | "
          f"Dev FP={dev_fp} Golden FP={golden_fp}")

    if golden_precision < GOLDEN_WARN:
        print(f"[WARNING] Golden precision low ({golden_precision:.3f} < {GOLDEN_WARN:.2f}); monitor generalization.")
    if dev_precision < args.gate:
        print(f"[WARNING] Dev precision below gate ({dev_precision:.3f} < {args.gate:.2f}); consider more negatives.")

    # Exit logic
    if dev_precision < CATASTROPHIC_GATE:
        print(f"[CRITICAL] Catastrophic dev precision ({dev_precision:.3f} < {CATASTROPHIC_GATE:.2f}); major regression.")
        cleanup_old_models(outdir)
        sys.exit(1)
    else:
        print(f"[OK] Probe completed (non-blocking).")
        cleanup_old_models(outdir)
        sys.exit(0)


if __name__ == "__main__":
    main()
