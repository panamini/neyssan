#!/usr/bin/env bash
set -euo pipefail

# Usage: bash run_steps.sh [STEPS] [LOG_INTERVAL] [CONFIG]
# Example: bash run_steps.sh 5000 50 cv_parser/config_tuned.cfg

STEPS="${1:-500}"             # default 500 steps
LOG_INTERVAL="${2:-10}"       # default log interval 10
CONFIG="${3:-cv_parser/config.cfg}"  # default config

# Make sure Python can import your package
export PYTHONPATH=.

# Prevent thread deadlocks on macOS
export OMP_NUM_THREADS=1
export MKL_NUM_THREADS=1
export TOKENIZERS_PARALLELISM=false
export PYTORCH_ENABLE_MPS_FALLBACK=1

OUTDIR="training/out_${STEPS}"
LOGFILE="$OUTDIR/train.log"

echo "[INFO] Cleaning old outputs in $OUTDIR …"
rm -rf "$OUTDIR"
mkdir -p "$OUTDIR"

echo "[INFO] MPS check (torch):"
python - <<'PY'
import torch, sys
print("python", sys.version.split()[0])
print("torch", getattr(torch,'__version__',None),
      "mps_available", torch.backends.mps.is_available(),
      "mps_built", torch.backends.mps.is_built())
PY

echo "[INFO] Starting run: steps=$STEPS log_interval=$LOG_INTERVAL config=$CONFIG (logs at $LOGFILE)…"
python -u run_20steps.py \
  --steps "$STEPS" \
  --log "$LOGFILE" \
  --log-interval "$LOG_INTERVAL" \
  --config "$CONFIG" \
  --device mps 2>&1 | tee "$LOGFILE"
