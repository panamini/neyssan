#!/usr/bin/env bash
set -euo pipefail

PARSER_BASE="${PARSER_BASE:-http://127.0.0.1:8000}"
PARSE_ENDPOINT="${PARSER_URL:-${PARSER_BASE}/parse-cv}"
# Default save inside container tmp; host copy happens in dev.sh
SAVE_PATH="${SAVE:-/tmp/abc_smoke_result.txt}"
OUT_DIR="${OUT_DIR:-/tmp/structured}"
SMOKE_TIMEOUT_VALUE="${SMOKE_TIMEOUT:-180}"
SMOKE_CONCURRENCY_VALUE="${SMOKE_CONCURRENCY:-1}"
WAIT_FOR_WARMUP="${WAIT_FOR_WARMUP:-0}"
WAIT_FOR_WARMUP_MAX="${WAIT_FOR_WARMUP_MAX:-90}"

export SKIP_TS_CANONICALIZE="${SKIP_TS_CANONICALIZE:-1}"

mkdir -p "$(dirname "${SAVE_PATH}")" "${OUT_DIR}"

echo "[smoke] parser=${PARSE_ENDPOINT} timeout=${SMOKE_TIMEOUT_VALUE}s concurrency=${SMOKE_CONCURRENCY_VALUE} save=${SAVE_PATH}"

echo "[smoke] Warming OCR via ${PARSER_BASE}/warmup..."
if ! curl -sf -X POST "${PARSER_BASE}/warmup" >/dev/null; then
  echo "[smoke] WARN: warmup endpoint failed; proceeding without prewarm"
fi

if [[ "${WAIT_FOR_WARMUP}" == "1" ]]; then
  echo "[smoke] Waiting for warmup to finish (max ${WAIT_FOR_WARMUP_MAX}s)..."
  for ((wait_iter=1; wait_iter<=WAIT_FOR_WARMUP_MAX; wait_iter++)); do
    ready_payload="$(curl -sf "${PARSER_BASE}/ready" 2>/dev/null || true)"
    if [[ -z "${ready_payload}" ]]; then
      sleep 1
      continue
    fi
    prewarm_state="$(
      printf '%s' "${ready_payload}" | python - <<'PY'
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    print("unknown")
    raise SystemExit
val = data.get("prewarm")
if isinstance(val, bool):
    print("true" if val else "false")
elif isinstance(val, str):
    print(val.strip().lower())
else:
    print("unknown")
PY
    )"
    if [[ "${prewarm_state}" == "false" || "${prewarm_state}" == "0" ]]; then
      echo "[smoke] Warmup completed after ${wait_iter}s"
      break
    fi
    if (( wait_iter == WAIT_FOR_WARMUP_MAX )); then
      echo "[smoke] WARN: warmup still pending after ${WAIT_FOR_WARMUP_MAX}s; continuing"
    fi
    sleep 1
  done
fi

echo "[smoke] Running ABC smoke..."
set +e
PARSER_URL="${PARSE_ENDPOINT}" SMOKE_TIMEOUT="${SMOKE_TIMEOUT_VALUE}" \
  python /app/scripts/run_abc.py \
    --out-dir "${OUT_DIR}" \
    --save "${SAVE_PATH}" \
    --timeout "${SMOKE_TIMEOUT_VALUE}" \
    --concurrency "${SMOKE_CONCURRENCY_VALUE}"
rc=$?
SMOKE_SAVE_PATH="${SAVE:-/tmp/abc_smoke_result.txt}"
if [[ -f "${SMOKE_SAVE_PATH}" ]]; then
  ls -l "${SMOKE_SAVE_PATH}"
fi
if [[ "${rc}" -ne 0 ]]; then
  echo "[smoke][WARN] run_abc exited with rc=${rc}; writing stub to ${SMOKE_SAVE_PATH}" 1>&2
  printf 'Smoke exited rc=%s at %s\nEndpoint: %s\nTimeout: %ss\n' \
    "${rc}" "$(date -u +%FT%TZ)" "${PARSE_ENDPOINT}" "${SMOKE_TIMEOUT_VALUE}" \
    >"${SMOKE_SAVE_PATH}" || true
fi
if ! test -s "${SMOKE_SAVE_PATH}"; then
  echo "[smoke][WARN] summary missing or empty at ${SMOKE_SAVE_PATH}; writing stub" 1>&2
  printf 'Smoke summary missing or empty (container path: %s)\n' "${SMOKE_SAVE_PATH}" >"${SMOKE_SAVE_PATH}" || true
fi
wc -c "${SMOKE_SAVE_PATH}" 2>/dev/null || true
set -e
