#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIX_DIR="${1:-${ROOT_DIR}/fixtures/fixturetest}"
BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
ENDPOINT="${ENDPOINT:-${BASE_URL}/parse-cv}"
VARIANT="${VARIANT:-rules}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${ROOT_DIR}/artifacts/bench/${TS}-${VARIANT}"
STRICT="${BENCH_STRICT:-0}"

CONNECT_TIMEOUT="${BENCH_CONNECT_TIMEOUT:-5}"
MAX_TIME="${BENCH_MAX_TIME:-240}"
MAX_RETRIES="${BENCH_RETRIES:-2}"
RETRY_DELAY="${BENCH_RETRY_DELAY:-1}"
GLOBAL_TIMEOUT="${BENCH_GLOBAL_TIMEOUT:-600}"
GLOBAL_START="$(date +%s)"
timeout_hit=0
LAST_STATUS_CODE="0"
TOTAL_ELAPSED="0.0"
processed_count=0
REQUEST_RC=0

log() {
  printf '[bench] %s\n' "$*"
}

now_seconds() {
  python3 - <<'PY'
import time
print("{:.6f}".format(time.time()))
PY
}

elapsed_seconds() {
  python3 - "$1" <<'PY'
import sys, time
start = float(sys.argv[1])
print("{:.3f}".format(time.time() - start))
PY
}

is_number() {
  case "$1" in
    ''|*[!0-9]*) return 1 ;;
    *) return 0 ;;
  esac
}

wait_for_ready() {
  local attempts=0
  local max_attempts=2
  while [ "${attempts}" -lt "${max_attempts}" ]; do
    if curl -fsS --connect-timeout 2 --max-time 2 "${BASE_URL}/ready" >/dev/null 2>&1; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep "${RETRY_DELAY}"
  done
  return 1
}

perform_request() {
  local method="$1"
  shift
  local file_path="$1"
  shift
  local outfile="$1"
  shift

  local attempt=0
  local rc=0
  local status_code="000"
  local max_attempts=$((MAX_RETRIES + 1))
  LAST_STATUS_CODE="000"
  REQUEST_RC=0

  while [ "${attempt}" -lt "${max_attempts}" ]; do
    attempt=$((attempt + 1))
    status_code="000"
    rc=0

    local stderr_file
    stderr_file="$(mktemp)"
    if [ "${method}" = "text" ]; then
      status_code="$(
        curl --silent --show-error --http1.1 --fail-with-body \
          --connect-timeout "${CONNECT_TIMEOUT}" --max-time "${MAX_TIME}" \
          -H 'Expect:' \
          -w '%{http_code}' \
          -X POST \
          -F "rawText=@${file_path};type=text/plain;filename=raw.txt" \
          "${ENDPOINT}" -o "${outfile}" 2>"${stderr_file}"
      )"
    else
      status_code="$(
        curl --silent --show-error --http1.1 --fail-with-body \
          --connect-timeout "${CONNECT_TIMEOUT}" --max-time "${MAX_TIME}" \
          -H 'Expect:' \
          -w '%{http_code}' \
          -X POST \
          -F "file=@${file_path}" \
          "${ENDPOINT}" -o "${outfile}" 2>"${stderr_file}"
      )"
    fi
    rc=$?
    status_code="$(printf '%s' "${status_code}" | tail -n 1 | tr -d '\r\n')"
    if ! is_number "${status_code}"; then
      status_code="000"
    fi
    LAST_STATUS_CODE="${status_code}"
    if [ -s "${stderr_file}" ]; then
      while IFS= read -r line; do
        log "[curl] ${line}"
      done < "${stderr_file}"
    fi
    rm -f "${stderr_file}"

    if [ "${rc}" -eq 0 ] && [ -n "${status_code}" ] && [ "${status_code}" -ge 200 ] && [ "${status_code}" -lt 500 ]; then
      REQUEST_RC=0
      return 0
    fi

    if [ "${rc}" -eq 0 ] && [ -n "${status_code}" ]; then
      rc="${status_code}"
    fi

    local should_retry=0
    case "${rc}" in
      52|28|7|56)
        should_retry=1
        ;;
      503)
        should_retry=1
        ;;
      22)
        if [ "${status_code}" -ge 500 ] && [ "${status_code}" -lt 600 ]; then
          should_retry=1
        fi
        ;;
      5*)
        should_retry=1
        ;;
      *)
        if [ "${status_code}" -ge 500 ] && [ "${status_code}" -lt 600 ]; then
          should_retry=1
        fi
        ;;
    esac

    if [ "${attempt}" -ge "${max_attempts}" ] || [ "${should_retry}" -eq 0 ]; then
      break
    fi
    sleep "${RETRY_DELAY}"
  done

  REQUEST_RC="${rc}"
  return 1
}

command -v curl >/dev/null 2>&1 || { echo "[bench][ERROR] curl not found"; exit 127; }
command -v python3 >/dev/null 2>&1 || { echo "[bench][ERROR] python3 not found"; exit 127; }

mkdir -p "${OUT_DIR}/json" "${OUT_DIR}/raw"

echo "[bench] folder=${FIX_DIR}"
echo "[bench] endpoint=${ENDPOINT}"
echo "[bench] out=${OUT_DIR}"

if ! wait_for_ready; then
  log "[WARN] Parser not ready at ${BASE_URL}; continuing anyway."
else
  log "Parser ready at ${BASE_URL}"
fi

printf "id,file,ext,status,bytes\n" > "${OUT_DIR}/manifest.csv"

shopt -s nullglob
i=0
fail_count=0
ok_count=0

for f in "${FIX_DIR}"/*; do
  if [ "${GLOBAL_TIMEOUT}" -gt 0 ]; then
    now_secs="$(date +%s)"
    if [ $((now_secs - GLOBAL_START)) -ge "${GLOBAL_TIMEOUT}" ]; then
      log "[WARN] Global timeout (${GLOBAL_TIMEOUT}s) reached; stopping bench loop."
      timeout_hit=1
      break
    fi
  fi

  bn="$(basename "$f")"
  if [[ ! -f "$f" ]]; then
    continue
  fi
  case "${bn}" in
    .* ) continue ;;
  esac

  i=$((i+1))
  id="$(printf "%04d" "${i}")"
  ext="${bn##*.}"
  lc_ext="$(printf '%s' "${ext}" | tr '[:upper:]' '[:lower:]')"
  out_json="${OUT_DIR}/json/${id}_${bn}.json"

  start_ts="$(now_seconds)"
  log "${id} -> ${bn}"

  method="file"
  if [[ "${lc_ext}" = "txt" || "${lc_ext}" = "md" ]]; then
    method="text"
  fi

  set +e
  perform_request "${method}" "${f}" "${out_json}"
  result=$?
  set -e
  actual_rc="0"
  if [ "${result}" -ne 0 ]; then
    actual_rc="${REQUEST_RC}"
    if ! is_number "${actual_rc}"; then
      actual_rc="1"
    fi
  fi
  elapsed="$(elapsed_seconds "${start_ts}")"
  processed_count=$((processed_count + 1))

  TOTAL_ELAPSED=$(python3 - <<PY
print("{:.6f}".format(float("${TOTAL_ELAPSED}") + float("${elapsed}")))
PY
)

  status="ok"
  failed_this=0
  if [ "${actual_rc}" -ne 0 ]; then
    log "[WARN] request failed rc=${actual_rc} file=${bn} elapsed=${elapsed}s"
    printf '{"error":"request failed","rc":"%s","status":"%s","file":"%s","elapsed":%s}\n' "${actual_rc}" "${LAST_STATUS_CODE}" "${bn}" "${elapsed}" > "${out_json}" || true
    status="fail"
    failed_this=1
  fi

  bytes="$(wc -c < "${out_json}" 2>/dev/null || echo 0)"
  if [[ "${bytes}" -eq 0 ]]; then
    status="fail"
    if [ "${failed_this}" -eq 0 ]; then
      printf '{"error":"empty response","file":"%s","elapsed":%s}\n' "${bn}" "${elapsed}" > "${out_json}" || true
      bytes="$(wc -c < "${out_json}" 2>/dev/null || echo 0)"
      failed_this=1
    fi
  fi

  if [ "${failed_this}" -eq 1 ]; then
    fail_count=$((fail_count + 1))
  else
    ok_count=$((ok_count + 1))
  fi

  printf "%s,%s,%s,%s,%s\n" "${id}" "${bn}" "${lc_ext}" "${status}" "${bytes}" >> "${OUT_DIR}/manifest.csv"
  log "${id} [${status}] rc=${actual_rc} status=${LAST_STATUS_CODE} bytes=${bytes} dur=${elapsed}s"
done

python3 "${ROOT_DIR}/scripts/bench_reduce.py" "${OUT_DIR}/json" "${OUT_DIR}" "${VARIANT}"

mkdir -p "${ROOT_DIR}/artifacts/bench"
ln -sfn "${OUT_DIR}" "${ROOT_DIR}/artifacts/bench/latest"

echo
echo "[bench] Done."
echo "[bench] CSV: ${OUT_DIR}/report.csv"
echo "[bench] MD : ${OUT_DIR}/report.md"
echo "[bench] Manifest: ${OUT_DIR}/manifest.csv"
echo "[bench] Latest -> artifacts/bench/latest"
avg_elapsed="0.000"
if [ "${processed_count}" -gt 0 ]; then
  avg_elapsed=$(python3 - <<PY
print("{:.3f}".format(float("${TOTAL_ELAPSED}") / ${processed_count}))
PY
)
fi
echo "[bench] Summary: processed=${processed_count} ok=${ok_count} fail=${fail_count} total_time=${TOTAL_ELAPSED}s avg_per_file=${avg_elapsed}s"

if [ "${timeout_hit}" -eq 1 ]; then
  echo "[bench][WARN] Global timeout triggered after ${GLOBAL_TIMEOUT}s."
  exit 3
fi

if [[ "${STRICT}" = "1" && "${fail_count}" -gt 0 ]]; then
  echo "[bench][STRICT] Failures detected: ${fail_count}"
  exit 2
fi
