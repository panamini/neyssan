#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
BASE_URL="http://${HOST}:${PORT}"
READY_ENDPOINT="${BASE_URL}/ready"
ARTIFACTS_DIR="${ROOT_DIR}/artifacts"
DEV_ARTIFACTS_DIR="${ARTIFACTS_DIR}/dev"
LOG_FILE="${DEV_ARTIFACTS_DIR}/dev.log"
CONTAINER_NAME="cv-parser-service-dev"

mkdir -p "${DEV_ARTIFACTS_DIR}"
touch "${LOG_FILE}"

log() {
  local level ts message line
  if [[ $# -gt 1 ]]; then
    level="$1"
    shift
  else
    level="INFO"
  fi
  ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  message="$*"
  line="[${ts}] [${level}] ${message}"
  printf '%s\n' "${line}"
  printf '%s\n' "${line}" >> "${LOG_FILE}"
}

wait_for_consecutive() {
  local url="$1"
  local timeout="$2"
  local required="$3"
  local attempt=0
  local consecutive=0
  while (( attempt < timeout )); do
    attempt=$((attempt + 1))
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' "${url}" 2>/dev/null || printf '000')"
    if [[ "${code}" == "200" ]]; then
      consecutive=$((consecutive + 1))
      if (( consecutive >= required )); then
        return 0
      fi
    else
      consecutive=0
    fi
    sleep 1
  done
  return 1
}

ensure_timeout_helper() {
  if command -v timeout >/dev/null 2>&1; then
    return 0
  fi
  timeout() {
    local duration="$1"
    shift
    local seconds="${duration}"
    case "${duration}" in
      *s) seconds="${duration%s}" ;;
    esac
    if [[ -z "${seconds}" ]]; then
      seconds="30"
    fi
    local python_bin="python3"
    if ! command -v "${python_bin}" >/dev/null 2>&1; then
      python_bin="python"
    fi
    "${python_bin}" - "$seconds" "$@" <<'PY'
import os
import signal
import subprocess
import sys

def main():
    if len(sys.argv) < 3:
        sys.exit(2)
    try:
        timeout_sec = float(sys.argv[1])
    except ValueError:
        timeout_sec = 30.0
    cmd = sys.argv[2:]
    try:
        proc = subprocess.Popen(cmd)
    except Exception as exc:
        sys.stderr.write("timeout helper failed to start command: %s\n" % exc)
        sys.exit(1)
    try:
        returncode = proc.wait(timeout=timeout_sec)
        sys.exit(returncode)
    except subprocess.TimeoutExpired:
        proc.terminate()
        try:
            proc.wait(3.0)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        sys.exit(124)

if __name__ == "__main__":
    main()
PY
    return $?
  }
  export -f timeout
}

ensure_timeout_helper

log "Starting parser container (local-only mode)"
USE_LOCAL_PARSER=false \
  TAIL_LOGS=false \
  "${ROOT_DIR}/scripts/start-dev.sh" --service-only --no-tail-logs

log "Waiting for local parser readiness (${READY_ENDPOINT})"
if ! wait_for_consecutive "${READY_ENDPOINT}" 60 3; then
  log WARN "Local parser did not stabilize at ${READY_ENDPOINT}"
  log WARN "Last container logs (100 lines):"
  docker logs --tail=100 "${CONTAINER_NAME}" 2>&1 | sed 's/^/[container] /'
  exit 1
fi

log "Local parser ready at ${BASE_URL}"
log "Container name: ${CONTAINER_NAME}"
log "This script exits now; container remains running. To stop: docker stop ${CONTAINER_NAME}"
