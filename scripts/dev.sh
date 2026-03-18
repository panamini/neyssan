#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

# local logger to avoid colliding with macOS /usr/bin/log
dev_log() { printf '[dev] %s\n' "$*"; }

printf '[paths] ROOT_DIR=%s\n' "${ROOT_DIR}"
if [[ -f "${ROOT_DIR}/cv_parser_service/main.py" ]]; then
  printf '[paths] cv_parser_service/main.py: OK %s\n' "${ROOT_DIR}/cv_parser_service/main.py"
else
  printf '[paths] cv_parser_service/main.py: MISSING\n'
fi
if [[ -f "${ROOT_DIR}/cv_parser/canonicalize.py" ]]; then
  printf '[paths] cv_parser/canonicalize.py: OK %s\n' "${ROOT_DIR}/cv_parser/canonicalize.py"
else
  printf '[paths] cv_parser/canonicalize.py: MISSING\n'
fi
if [[ -f "${ROOT_DIR}/sitecustomize.py" ]]; then
  printf '[paths] sitecustomize.py: OK %s\n' "${ROOT_DIR}/sitecustomize.py"
else
  printf '[paths] sitecustomize.py: MISSING\n'
fi
printf '[paths] scripts/start-dev.sh: %s %s\n' \
  "$( [[ -f "${ROOT_DIR}/scripts/start-dev.sh" ]] && echo OK || echo MISSING )" \
  "${ROOT_DIR}/scripts/start-dev.sh"
printf '[paths] scripts/dev.sh: OK %s\n' "${ROOT_DIR}/scripts/dev.sh"
printf '[paths] requirements.txt: %s %s\n' \
  "$( [[ -f "${ROOT_DIR}/requirements.txt" ]] && echo OK || echo MISSING )" \
  "${ROOT_DIR}/requirements.txt"
printf '[paths] requirements.lock: %s %s\n' \
  "$( [[ -f "${ROOT_DIR}/requirements.lock" ]] && echo OK || echo MISSING )" \
  "${ROOT_DIR}/requirements.lock"

DOCKER_MODE="true"
RUN_SMOKE="${RUN_SMOKE:-1}"
RUN_PARSE_FIXTURES="${RUN_PARSE_FIXTURES:-1}"
SMOKE_STRICT="${SMOKE_STRICT:-0}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
ARTIFACTS_DIR="${ROOT_DIR}/artifacts"
CONTAINER_NAME="cv-parser-service-dev"

mkdir -p "${ARTIFACTS_DIR}"

usage() {
  cat <<'USAGE'
usage: scripts/dev.sh [--local] [--no-smoke] [--no-fixtures]

  --local        use local .venv (Python) flow instead of Docker
  --no-smoke     skip ABC smoke test
  --no-fixtures  skip parsing fixtures/fixturetest
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) DOCKER_MODE="false"; shift ;;
    --no-smoke) RUN_SMOKE=0; shift ;;
    --no-fixtures) RUN_PARSE_FIXTURES=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1"; usage; exit 2 ;;
  esac
done

ensure_hardened_imports() {
  local future_line future_lineno canon_matches canon_count
  future_line="$(grep -n 'from __future__ import annotations' "${ROOT_DIR}/cv_parser_service/main.py" || true)"
  if [[ -z "${future_line}" ]]; then
    dev_log "ERROR: Missing 'from __future__ import annotations' in cv_parser_service/main.py"
    exit 1
  fi
  future_lineno="${future_line%%:*}"
  if [[ "${future_lineno}" != "1" ]]; then
    dev_log "ERROR: 'from __future__ import annotations' must be on line 1 (found line ${future_lineno})."
    exit 1
  fi

  canon_matches="$(grep -n 'from cv_parser.canonicalize' "${ROOT_DIR}/cv_parser_service/main.py" || true)"
  if [[ -z "${canon_matches}" ]]; then
    dev_log "ERROR: Missing canonicalize import in cv_parser_service/main.py"
    exit 1
  fi
  canon_count="$(printf '%s\n' "${canon_matches}" | sed '/^$/d' | wc -l | tr -d '[:space:]')"
  if (( canon_count > 1 )); then
    dev_log "ERROR: Found ${canon_count} canonicalize imports; expected at most 1."
    exit 1
  fi
}

if [[ "${DOCKER_MODE}" == "true" ]]; then
  ensure_hardened_imports
  STOP_ON_EXIT="${STOP_ON_EXIT:-0}"
  if [[ "${STOP_ON_EXIT}" == "1" ]]; then
    trap 'docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true' EXIT
  fi
  if [[ "${RUN_SMOKE}" == "1" && -z "${RELOAD:-}" ]]; then
    export RELOAD=0
  fi
  dev_log "Docker mode (default) → starting container via start-dev.sh"
  USE_LOCAL_PARSER=false TAIL_LOGS=false "${ROOT_DIR}/scripts/start-dev.sh" --no-tail-logs

  BASE_URL="http://${HOST}:${PORT}"
  PARSER_URL="${BASE_URL}/parse-cv"

  VERIFY_VENV="${ROOT_DIR}/.verify-venv"
  if [[ ! -x "${VERIFY_VENV}/bin/python" ]]; then
    dev_log "Bootstrapping verify venv at ${VERIFY_VENV}"
    python3 -m venv "${VERIFY_VENV}"
    "${VERIFY_VENV}/bin/pip" install --upgrade pip >/dev/null
    "${VERIFY_VENV}/bin/pip" install -r "${ROOT_DIR}/cv_parser_service/requirements.txt" >/dev/null
  fi

  dev_log "Recording local import verification"
  PYTHONPATH="${ROOT_DIR}" "${VERIFY_VENV}/bin/python" "${ROOT_DIR}/scripts/verify_imports.py" >"${ARTIFACTS_DIR}/verify_imports_local.txt"

  dev_log "Recording container import verification"
  docker exec "${CONTAINER_NAME}" python /app/scripts/verify_imports.py >"${ARTIFACTS_DIR}/verify_imports_container.txt"

  dev_log "Capturing sysinfo JSON"
  docker exec -i "${CONTAINER_NAME}" python - <<'PY' | tee "${ARTIFACTS_DIR}/sysinfo.json" >/dev/null
import json, os, sys
payload = {
    "cwd": os.getcwd(),
    "pythonpath_env": os.environ.get("PYTHONPATH"),
    "sys_path_head": sys.path[:20],
}
json.dump(payload, sys.stdout, indent=2)
sys.stdout.write("\n")
PY

  dev_log "Checking readiness endpoint"
  READY_ENDPOINT="${BASE_URL}/ready"
  if ! curl -fsS "${READY_ENDPOINT}" >"${ARTIFACTS_DIR}/health.json" 2>/dev/null; then
    READY_ENDPOINT="${BASE_URL}/health"
    curl -fsS "${READY_ENDPOINT}" >"${ARTIFACTS_DIR}/health.json"
  fi
  printf '\n' >>"${ARTIFACTS_DIR}/health.json"
  dev_log "Readiness response (${READY_ENDPOINT}): $(cat "${ARTIFACTS_DIR}/health.json")"

  if [[ "${RUN_SMOKE}" == "1" ]]; then
    dev_log "Running ABC smoke (in-container)"
    set +e
    SMOKE_TIMEOUT_VALUE="${SMOKE_TIMEOUT:-180}"
    # Save inside container under /tmp; we'll copy out to host artifacts
    SMOKE_SAVE_PATH_CONTAINER="${SMOKE_SAVE_PATH:-/tmp/abc_smoke_result.txt}"
    HOST_SAVE_PATH="${SMOKE_SAVE:-${ARTIFACTS_DIR}/abc_smoke_result.txt}"
    if ! docker exec \
        -e PARSER_BASE="${BASE_URL}" \
        -e SMOKE_TIMEOUT="${SMOKE_TIMEOUT_VALUE}" \
        -e SAVE="${SMOKE_SAVE_PATH_CONTAINER}" \
        -e SMOKE_SAVE="${SMOKE_SAVE_PATH_CONTAINER}" \
        "${CONTAINER_NAME}" bash /app/scripts/smoke.sh; then
      smoke_rc=$?
    else
      smoke_rc=0
    fi
    set -e
    if [[ "${smoke_rc}" -ne 0 ]]; then
      dev_log "[WARN] ABC smoke failed — see /app/artifacts/abc_smoke_result.txt inside container"
      if [[ "${SMOKE_STRICT}" == "1" ]]; then
        dev_log "[STRICT] Failing build due to SMOKE_STRICT=1"
        exit 1
      fi
    fi
    if docker exec "${CONTAINER_NAME}" test -s "${SMOKE_SAVE_PATH_CONTAINER}"; then
      if ! docker cp "${CONTAINER_NAME}:${SMOKE_SAVE_PATH_CONTAINER}" "${HOST_SAVE_PATH}"; then
        dev_log "[WARN] docker cp failed; using exec+cat fallback"
        docker exec "${CONTAINER_NAME}" bash -lc "cat '${SMOKE_SAVE_PATH_CONTAINER}'" > "${HOST_SAVE_PATH}" || true
      fi
    else
      dev_log "[WARN] container summary missing; writing stub on host"
      printf 'Smoke summary missing after smoke. Container path: %s\n' "${SMOKE_SAVE_PATH_CONTAINER}" > "${HOST_SAVE_PATH}" || true
    fi
    if ! test -s "${HOST_SAVE_PATH}"; then
      dev_log "[WARN] Host summary still empty; writing final stub"
      printf 'Smoke summary empty (host path: %s)\n' "${HOST_SAVE_PATH}" > "${HOST_SAVE_PATH}" || true
    fi
  else
    dev_log "Skipping ABC smoke (requested)"
  fi

  dev_log "Saving boot probe output already captured at artifacts/boot_probe.txt"
  dev_log "All checks complete"
  exit 0
fi

VENVSHELL="${ROOT_DIR}/.venv"
PY="${VENVSHELL}/bin/python"
PIP="${VENVSHELL}/bin/pip"

echo "[dev] Local mode → ensuring virtualenv at ${VENVSHELL}"
if [[ ! -x "${PY}" ]]; then
  python3 -m venv "${VENVSHELL}"
fi

echo "[dev] Installing dependencies"
"${PY}" -m pip install --upgrade pip >/dev/null
if [[ -f "${ROOT_DIR}/cv_parser_service/requirements.txt" ]]; then
  "${PIP}" install -r "${ROOT_DIR}/cv_parser_service/requirements.txt"
else
  "${PIP}" install fastapi uvicorn requests
fi

BASE_URL="http://${HOST}:${PORT}"
PARSER_URL="${BASE_URL}/parse-cv"

echo "[dev] Restarting parser via scripts/parser.sh"
PYTHON_BIN="${PY}" HOST="${HOST}" PORT="${PORT}" "${ROOT_DIR}/scripts/parser.sh" restart

echo "[dev] Waiting for ${BASE_URL}/health"
healthy=0
for i in $(seq 1 40); do
  if curl -fsS "${BASE_URL}/health" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  if curl -fsS "${BASE_URL}/docs" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 0.5
done

if [[ "${healthy}" -ne 1 ]]; then
  echo "[dev] Parser failed to become healthy."
  tail -n 50 "${ROOT_DIR}/tmp/parser.log" 2>/dev/null || true
  exit 1
fi

echo "[dev] Parser healthy at ${BASE_URL}"
mkdir -p artifacts

if [[ "${RUN_SMOKE}" == "1" ]]; then
  echo "[dev] Running ABC smoke"
  set +e
  SKIP_TS_CANONICALIZE=1 PARSER_URL="${PARSER_URL}" "${PY}" "${ROOT_DIR}/scripts/run_abc.py" | tee artifacts/abc_smoke_result.txt
  smoke_rc=${PIPESTATUS[0]}
  set -e
  if [[ "${smoke_rc}" -ne 0 ]]; then
    echo "[dev][WARN] ABC smoke failed — see artifacts/abc_smoke_result.txt"
    if [[ "${SMOKE_STRICT}" == "1" ]]; then
      echo "[dev][STRICT] Failing build due to SMOKE_STRICT=1"
      exit 1
    fi
  fi
else
  echo "[dev] Skipping ABC smoke (requested)"
fi
if [[ -f artifacts/abc_smoke_result.txt ]]; then
  cp artifacts/abc_smoke_result.txt artifacts/abc_smoke_table.txt || true
fi

set +e
if [[ "${RUN_PARSE_FIXTURES}" == "1" ]]; then
  echo "[dev] Parsing fixtures in fixtures/fixturetest"
  PARSER_URL="${PARSER_URL}" "${PY}" "${ROOT_DIR}/scripts/parse.py" fixtures/fixturetest | tee artifacts/parse_fixtures_result.txt
  parse_rc=${PIPESTATUS[0]}
  set -e
  if [[ "${parse_rc}" -ne 0 ]]; then
    echo "[dev] Fixture parsing failed — see artifacts/parse_fixtures_result.txt"
    exit 1
  fi
else
  set -e
  echo "[dev] Skipping fixture parsing (requested)"
fi

echo "[dev] Done. Logs → ${ROOT_DIR}/tmp/parser.log"
echo "[dev] Smoke artifacts → artifacts/abc_smoke_result.txt"
echo "[dev] Fixture artifacts → artifacts/samples/"
echo "[dev] Try: curl -sS ${BASE_URL}/health && echo OK"
