#!/usr/bin/env bash
set -euo pipefail

mkdir -p tmp

# Clean slate
docker rm -f cv-parser-service-dev >/dev/null 2>&1 || true
rm -f .docker/last-deps-hash
docker rmi -f cv-parser-deps:3.3.0 cv-parser-service:latest >/dev/null 2>&1 || true

# Rebuild & run (backend only, with logs to file)
export FORCE_REBUILD=true
nohup ./run.sh up --doctr --tail > tmp/run_up.log 2>&1 &
RUN_PID=$!
echo "[exec] run.sh started (PID=${RUN_PID}), logs -> tmp/run_up.log"

# Wait for the container to appear (timeout ~120s)
echo "[exec] waiting for container cv-parser-service-dev to start..."
for i in $(seq 1 120); do
  if [[ -n "$(docker ps -q -f "name=^cv-parser-service-dev$")" ]]; then
    echo "[exec] container is running"
    break
  fi
  sleep 1
done

# Give service a few seconds to initialize
sleep 5

# Quick env + venv sanity
echo "[exec] echo container env of interest…"
docker exec cv-parser-service-dev bash -lc 'echo DOCTR_PY=$DOCTR_PY DOCTR_BACKEND=$DOCTR_BACKEND OCR_ENGINE=$OCR_ENGINE CV_OCR_ENGINE=$CV_OCR_ENGINE || true'
echo "[exec] checking /opt/doctr-venv/python inside container..."
docker exec cv-parser-service-dev bash -lc 'ls -l /opt/doctr-venv/bin/python || true'

# Monitor /ready until doctr is selected & available (timeout 10m)
echo "[monitor] polling /ready for selected=doctr & available=true (timeout 10m)"
timeout=600
interval=3
end=$((SECONDS+timeout))
while (( SECONDS < end )); do
  now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  ready_json="$(curl -sS http://127.0.0.1:8000/ready || true)"
  printf '%s [monitor] /ready -> %s\n' "$now" "$ready_json" | tee -a tmp/run_ready_poll.log
  sel="$(echo "$ready_json" | jq -r '.ocr.selected // ""' 2>/dev/null || echo "")"
  av="$(echo "$ready_json" | jq -r '.ocr.available // "false"' 2>/dev/null || echo "false")"
  if [[ "$sel" == "doctr" && "$av" == "true" ]]; then
    echo "[monitor] readiness indicates doctr selected and available" | tee -a tmp/run_ready_poll.log
    echo "[monitor] verifying TF+doctr imports from /opt/doctr-venv…"
    docker exec cv-parser-service-dev bash -lc '/opt/doctr-venv/bin/python - <<PY
import sys
try:
    import tensorflow as tf, doctr
    print("OK", tf.__version__, getattr(doctr, "__version__", "unknown"))
except Exception as e:
    print("IMPORT_FAILED:", e)
PY' 2>&1 | tee -a tmp/run_ready_poll.log
    echo "[monitor] final /ready snapshot:" | tee -a tmp/run_ready_poll.log
    curl -sS http://127.0.0.1:8000/ready | jq '{ocr: {engine:.ocr.engine,selected:.ocr.selected,available:.ocr.available,reason:.ocr.reason}}' 2>/dev/null | tee -a tmp/run_ready_poll.log
    echo "[monitor] success"
    exit 0
  fi
  sleep $interval
done

echo "[monitor] timed out after ${timeout}s waiting for doctr available" | tee -a tmp/run_ready_poll.log
echo "[monitor] tail of tmp/run_up.log (last 200 lines):" | tee -a tmp/run_ready_poll.log
tail -n 200 tmp/run_up.log 2>/dev/null | tee -a tmp/run_ready_poll.log || true
exit 2
