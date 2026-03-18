#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR_DEFAULT="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMMAND="${1:-}"
shift || true

# Defaults (can be overridden by env)
REPO_DIR="${REPO_DIR:-${REPO_DIR_DEFAULT}}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
APP_MODULE="${APP_MODULE:-cv_parser_service.main:app}"
PID_FILE="${PID_FILE:-${REPO_DIR}/tmp/parser.pid}"
LOG_FILE="${LOG_FILE:-${REPO_DIR}/tmp/parser.log}"
PYTHON_BIN="${PYTHON_BIN:-}"
PARSER_URL="${PARSER_URL:-http://${HOST}:${PORT}/parse-cv}"
SMOKE_FLAG="${SMOKE_FLAG:-0}"

mkdir -p "$(dirname "${PID_FILE}")" "$(dirname "${LOG_FILE}")"

function choose_python() {
  if [[ -n "${PYTHON_BIN}" ]]; then
    echo "${PYTHON_BIN}"
    return
  fi
  if [[ -x "${REPO_DIR}/.venv/bin/python" ]]; then
    echo "${REPO_DIR}/.venv/bin/python"
  else
    command -v python3 >/dev/null 2>&1 && echo "python3" && return
    echo "python"
  fi
}

PY="$(choose_python)"

function ensure_deps() {
  "${PY}" - <<'PY' >/dev/null 2>&1 || {
import importlib
import sys
missing = []
for name in ("fastapi", "uvicorn", "requests"):
    if importlib.util.find_spec(name) is None:
        missing.append(name)
if missing:
    sys.exit(1)
PY
    echo "[parser] Installing missing dependencies..." >&2
    if [[ -f "${REPO_DIR}/cv_parser_service/requirements.txt" ]]; then
      "${PY}" -m pip install -r "${REPO_DIR}/cv_parser_service/requirements.txt"
      "${PY}" -m pip install requests
    else
      "${PY}" -m pip install fastapi uvicorn requests
    fi
  }
}

function is_running() {
  [[ -f "${PID_FILE}" ]] || return 1
  local pid
  pid="$(cat "${PID_FILE}")"
  [[ -n "${pid}" ]] || return 1
  if ps -p "${pid}" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

function start() {
  if is_running; then
    echo "[parser] Already running (PID $(cat "${PID_FILE}"))"
    return 0
  fi
  ensure_deps
  local env_file
  env_file="$(mktemp)"
  cat >"${env_file}" <<EOF
PYTHONPATH=${REPO_DIR}
EOF
  echo "[parser] Starting uvicorn (${APP_MODULE}) on ${HOST}:${PORT}"
  nohup env $(cat "${env_file}") "${PY}" -m uvicorn "${APP_MODULE}" \
    --host "${HOST}" --port "${PORT}" \
    > "${LOG_FILE}" 2>&1 &
  rm -f "${env_file}"
  local pid=$!
  echo "${pid}" > "${PID_FILE}"

  local attempts=40
  local sleep_sec=0.5
  local healthy=0
  for ((i=1; i<=attempts; i++)); do
    if curl -fsS "http://${HOST}:${PORT}/health" >/dev/null 2>&1; then
      healthy=1
      break
    fi
    if curl -fsS "http://${HOST}:${PORT}/docs" >/dev/null 2>&1; then
      healthy=1
      break
    fi
    sleep "${sleep_sec}"
  done
  if [[ "${healthy}" -ne 1 ]]; then
    echo "[parser] Failed to confirm health; last log lines:"
    tail -n 50 "${LOG_FILE}" >&2 || true
    stop
    return 1
  fi
  echo "[parser] Started (PID ${pid})"
}

function stop() {
  if ! is_running; then
    echo "[parser] Not running"
    rm -f "${PID_FILE}"
    return 0
  fi
  local pid
  pid="$(cat "${PID_FILE}")"
  echo "[parser] Stopping PID ${pid}"
  kill "${pid}" >/dev/null 2>&1 || true
  for _ in {1..10}; do
    if ! ps -p "${pid}" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
  kill -9 "${pid}" >/dev/null 2>&1 || true
  rm -f "${PID_FILE}"
  echo "[parser] Stopped"
}

function status() {
  if is_running; then
    local pid
    pid="$(cat "${PID_FILE}")"
    echo "[parser] Running (PID ${pid})"
    if lsof -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "[parser] Port ${PORT} is listening"
    else
      echo "[parser] Warning: port ${PORT} not listening"
    fi
  else
    echo "[parser] Not running"
  fi
}

function logs() {
  touch "${LOG_FILE}"
  tail -n 100 -f "${LOG_FILE}"
}

function smoke() {
  local url="${PARSER_URL}"
  echo "[parser] Running ABC smoke against ${url}"
  PARSER_URL="${url}" "${PY}" "${REPO_DIR}/scripts/run_abc.py"
}

case "${COMMAND}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  logs) logs ;;
  smoke) smoke ;;
  *)
    cat <<EOF
Usage: $(basename "$0") <command>
Commands:
  start    Start the parser service
  stop     Stop the parser service
  restart  Restart the parser service
  status   Show parser status
  logs     Tail the parser log
  smoke    Run ABC smoke tests against the local parser
EOF
    exit 1
    ;;
esac
