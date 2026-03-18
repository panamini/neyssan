#!/usr/bin/env bash
set -euo pipefail

# ===========================
# Precision Loop Trainer
# ===========================
# This script automates:
#  1) Train spaCy model with config_roberta.cfg
#  2) Evaluate on dev + golden sets
#  3) Generate error buckets
#  4) Harvest false negatives (hard positives) back into train.spacy
#  5) Deduplicate & re-train
#  6) Repeat up to MAX_RETRIES
#
# USAGE:
#   bash scripts/run_precision_loop.sh [MAX_RETRIES]
# Example:
#   bash scripts/run_precision_loop.sh 2

MAX_RETRIES="${1:-2}"
CONFIG="cv_parser/config_roberta.cfg"
TRAIN="my-app/testdata/cv_filtered/train.spacy"
DEV="my-app/testdata/cv_filtered/dev.spacy"
GOLD="my-app/testdata/cv_filtered/golden_sample.spacy"
CODE="cv_parser/bootstrap.py"
OUTDIR_BASE="training/out_probe_loop"
DIAG="diagnostics"

mkdir -p "$DIAG"

for ATTEMPT in $(seq 1 $((MAX_RETRIES+1))); do
  echo "=== Precision Loop Attempt $ATTEMPT/$((MAX_RETRIES+1)) ==="

  OUTDIR="${OUTDIR_BASE}_${ATTEMPT}"
  rm -rf "$OUTDIR"

  echo "🔧 Training model..."
  python -m spacy train "$CONFIG" \
    --output "$OUTDIR" \
    --paths.train "$TRAIN" \
    --paths.dev "$DEV" \
    --code "$CODE" \
    --training.max_steps=150 \
    --training.optimizer.learn_rate.initial_rate=0.00007 \
    --training.optimizer.learn_rate.warmup_steps=10

  MODEL="$OUTDIR/model-last"

  echo "🔍 Evaluating on dev..."
  python -m spacy evaluate "$MODEL" "$DEV" --code "$CODE" \
    --output "$DIAG/predictions_dev_probe.json"

  echo "🔍 Evaluating on golden..."
  python -m spacy evaluate "$MODEL" "$GOLD" --code "$CODE" \
    --output "$DIAG/predictions_golden_probe.json"

  echo "📊 Generating error buckets..."
  python cv_parser/scripts/error_buckets.py \
    --ner-model "$MODEL" \
    --gold "$DEV" \
    --out "$DIAG/error_buckets_dev_probe.json" \
    --top-n 5

  echo "📊 Generating golden error buckets..."
  python cv_parser/scripts/error_buckets.py \
    --ner-model "$MODEL" \
    --gold "$GOLD" \
    --out "$DIAG/error_buckets_golden_probe.json" \
    --top-n 5

  echo "🌱 Harvesting new hard positives (if any)..."
  python cv_parser/scripts/harvest_negatives.py \
    --buckets "$DIAG/error_buckets_dev_probe.json" \
    --out "$TRAIN" \
    --dev "$DEV" || echo "⚠️ No new negatives found or already added."

  echo "🧹 Deduplicating..."
  python cv_parser/scripts/deduplicate_spacy_dataset.py \
    --in "$TRAIN" \
    --out "$TRAIN"

  echo "📑 Auditing dataset..."
  python cv_parser/scripts/audit_spacy_dataset.py \
    --train "$TRAIN" \
    --dev "$DEV" \
    --strict

  echo "✅ Attempt $ATTEMPT done."
  echo "-----------------------------------------------------"
done

echo "🎯 Finished all $((MAX_RETRIES+1)) attempts. Check $DIAG for metrics and buckets."
