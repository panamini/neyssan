#!/usr/bin/env bash
set -euo pipefail

CMD="${1:-help}"; shift || true

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

# Load environment overrides if present
if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/.env"
  set +a
fi
if [[ -f "${ROOT_DIR}/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/.env.local"
  set +a
fi

: "${CONVEX_DEPLOYMENT:=dev:neat-starfish-33}"
: "${PARSER_ORIGIN:=https://parser.dasti.ai}"
: "${OPEN_BROWSER:=1}"
: "${TUNNEL_NETWORK:=parsernet}"
: "${PARSER_NAME:=cv-parser-service-dev}"
if [[ -z "${MISTRAL_API_KEY:-}" && -f "${HOME}/.mistral_key" ]]; then
  MISTRAL_API_KEY="$(<"${HOME}/.mistral_key")"
  MISTRAL_API_KEY="${MISTRAL_API_KEY//$'\r'/}"
  MISTRAL_API_KEY="${MISTRAL_API_KEY//$'\n'/}"
fi
if [[ -n "${MISTRAL_API_KEY:-}" ]]; then
  export MISTRAL_API_KEY
fi

OCR="auto"
START_UI=0
TAIL=0
RELOAD=0
REBUILD=0
STATE_DIR="${ROOT_DIR}/tmp/dev-stack"
STATE_FILE="${STATE_DIR}/pids.env"

if [[ "$CMD" == "up" ]]; then
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ocr) OCR="${2:-auto}"; shift 2;;
      --doctr) OCR="doctr"; shift;;
      --paddle) OCR="paddle"; shift;;
      --ocr-disabled|--no-ocr) OCR="disabled"; shift;;
      --ui|--with-ui) START_UI=1; shift;;
      --tail|--tail-logs) TAIL=1; shift;;
      --reload) RELOAD=1; shift;;
      --rebuild|--force-rebuild) REBUILD=1; shift;;  # allow explicit rebuild from CLI
      *) echo "unknown option: $1"; exit 2;;
    esac
  done
fi

map_platform() {
  case "$(uname -m)" in
    x86_64) echo "linux/amd64" ;;
    amd64) echo "linux/amd64" ;;
    arm64|aarch64) echo "linux/arm64" ;;
    *) echo "linux/$(uname -m)" ;;
  esac
}

is_trycloudflare() {
  local value="${1:-}"
  if [[ -z "${value}" ]]; then
    return 1
  fi
  local hostname
  if hostname="$(printf '%s\n' "${value}" | sed 's#^[^:]*://##' | cut -d'/' -f1)"; then
    :
  else
    hostname="${value}"
  fi
  [[ "${hostname}" =~ trycloudflare\.com$ ]]
}

normalize_origin() {
  local origin="${1:-}"
  origin="${origin%/}"
  if [[ -z "${origin}" ]]; then
    echo ""
    return
  fi
  if [[ "${origin}" != http://* && "${origin}" != https://* ]]; then
    origin="https://${origin}"
  fi
  # shellcheck disable=SC2001
  echo "$(printf '%s' "${origin}" | sed 's#//*#//#g' | sed 's#/$##')"
}

ensure_parsernet() {
  docker network create "${TUNNEL_NETWORK}" >/dev/null 2>&1 || true

  for _ in {1..40}; do
    if docker ps --format '{{.Names}}' | grep -qx "${PARSER_NAME}"; then
      break
    fi
    sleep 0.5
  done

  if ! docker network inspect "${TUNNEL_NETWORK}" | grep -q "\"Name\": \"${PARSER_NAME}\""; then
    docker network connect "${TUNNEL_NETWORK}" "${PARSER_NAME}" >/dev/null 2>&1 || true
  fi

  docker run --rm --network "${TUNNEL_NETWORK}" curlimages/curl \
    -sS -o /dev/null -w 'inside_ready=%{http_code}\n' "http://${PARSER_NAME}:8001/ready" \
    | grep -q 'inside_ready=200'
}

PARSER_STATUS_MESSAGE=""
PARSER_STARTED_FLAG=0
parser_up() {
  local container="cv-parser-service-dev"
  local mistral_key="${MISTRAL_API_KEY:-}"
  if [[ -z "${mistral_key}" && -f "${HOME}/.mistral_key" ]]; then
    mistral_key="$(<"${HOME}/.mistral_key")"
    mistral_key="${mistral_key//$'\r'/}"
    mistral_key="${mistral_key//$'\n'/}"
  fi
  if [[ -z "${mistral_key}" ]]; then
    echo "[parser-up] ERROR: MISTRAL_API_KEY not provided and ~/.mistral_key missing." >&2
    return 1
  fi

  if docker ps --format '{{.Names}}' | grep -q "^${container}\$"; then
    PARSER_STATUS_MESSAGE="OK (http://127.0.0.1:8001)"
    PARSER_STARTED_FLAG=1
  else
    if docker ps -a --format '{{.Names}}' | grep -q "^${container}\$"; then
      docker rm -f "${container}" >/dev/null 2>&1 || true
    fi
    docker run -d --rm \
      --name "${container}" \
      --platform "$(map_platform)" \
      -p 8001:8001 \
      -e API_ENABLE_MISTRAL_OCR=1 \
      -e MISTRAL_API_KEY="${mistral_key}" \
      cv-parser-service \
      /opt/venv/bin/python -m uvicorn --app-dir /app cv_parser_service.main:app \
      --host 0.0.0.0 --port 8001 --workers 1 --http h11 \
      --timeout-keep-alive 5 --timeout-graceful-shutdown 5 --limit-concurrency 64 >/dev/null
    PARSER_STARTED_FLAG=1
  fi

  local ready=0
  for _ in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:8001/ready >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "${ready}" -ne 1 ]]; then
    echo "[parser-up] ERROR: Parser health check failed at http://127.0.0.1:8001/ready" >&2
    return 1
  fi
  PARSER_STATUS_MESSAGE="OK (http://127.0.0.1:8001)"
  echo "Parser local: ${PARSER_STATUS_MESSAGE}"
}

VITE_PID=""
VITE_LOG_FILE=""
start_vite() {
  local origin="${1:?origin required}"
  VITE_LOG_FILE="${ROOT_DIR}/tmp/vite-dev.log"
  mkdir -p "$(dirname "${VITE_LOG_FILE}")"
  : > "${VITE_LOG_FILE}"
  (
    cd "${ROOT_DIR}/my-app"
    export CONVEX_PARSER_URL="${origin}"
    export VITE_PARSER_URL="${origin}"
    export VITE_CONVEX_PARSER_URL="${origin}"
    export STRUCTURED_UPLOAD_SKIP_HEALTHCHECK=1
    if [[ "${OPEN_BROWSER}" == "0" ]]; then
      BROWSER=none npx --yes vite --host 127.0.0.1 --port 5173 --clearScreen false
    else
      npx --yes vite --host 127.0.0.1 --port 5173 --open --clearScreen false
    fi
  ) >>"${VITE_LOG_FILE}" 2>&1 &
  VITE_PID=$!
  sleep 2
  if ! kill -0 "${VITE_PID}" >/dev/null 2>&1; then
    echo "[run] ERROR: Vite dev server failed to start (see ${VITE_LOG_FILE})." >&2
    return 1
  fi
  echo "[run] Vite dev server started (PID ${VITE_PID}, logs -> ${VITE_LOG_FILE})"
}

write_state_file() {
  mkdir -p "${STATE_DIR}"
  {
    printf 'PARSER_STARTED=%s\n' "${PARSER_STARTED_FLAG}"
    printf 'VITE_PID=%s\n' "${VITE_PID:-}"
  } > "${STATE_FILE}"
}

print_summary() {
  local origin="${1:-}"
  local parser_status="${2:-SKIPPED}"
  local cf_status="${3:-disabled}"
  cat <<EOF
----------------- Dev Stack -----------------
Origin in use: ${origin}
CF Access headers: ${cf_status}
Parser local: ${parser_status}
Vite URL: http://localhost:5173
---------------------------------------------
EOF
}

up() {
  local origin_raw="${PARSER_ORIGIN:-https://parser.dasti.ai}"
  local origin
  origin="$(normalize_origin "${origin_raw}")"
  if is_trycloudflare "${origin}"; then
    echo "[run] ERROR: trycloudflare origins are not allowed (${origin})." >&2
    exit 1
  fi
  export PARSER_ORIGIN="${origin}"

  local bootstrap_script="${ROOT_DIR}/scripts/bootstrap-convex-env.sh"
  if [[ ! -x "${bootstrap_script}" ]]; then
    echo "[run] ERROR: ${bootstrap_script} not found or not executable." >&2
    exit 1
  fi
  if ! "${bootstrap_script}"; then
    echo "[run] ERROR: Failed to bootstrap Convex env." >&2
    exit 1
  fi

  mkdir -p "${STATE_DIR}"
  : > "${STATE_FILE}"

  if [[ "${SKIP_PARSER:-0}" == "1" ]]; then
    PARSER_STATUS_MESSAGE="SKIPPED"
    echo "Parser local: SKIPPED"
    PARSER_STARTED_FLAG=0
  else
    if ! parser_up; then
      exit 1
    fi
    echo "[run] ensuring ${PARSER_NAME} is reachable from ${TUNNEL_NETWORK}..."
    if ! ensure_parsernet; then
      echo "[run] ERROR: parser not reachable on ${TUNNEL_NETWORK}" >&2
      exit 1
    fi
  fi

  if [[ "${START_UI}" == "1" ]]; then
    if ! start_vite "${origin}"; then
      echo "[run] ERROR: Failed to start Vite dev server." >&2
      exit 1
    fi
  else
    VITE_PID=""
  fi

  write_state_file

  local cf_status="disabled"
  if [[ -n "${CF_ACCESS_CLIENT_ID:-}" && -n "${CF_ACCESS_CLIENT_SECRET:-}" ]]; then
    cf_status="enabled"
  fi
  print_summary "${origin}" "${PARSER_STATUS_MESSAGE:-SKIPPED}" "${cf_status}"
}

down() {
  local vite_pid=""
  if [[ -f "${STATE_FILE}" ]]; then
    while IFS='=' read -r key value; do
      case "${key}" in
        VITE_PID) vite_pid="${value}" ;;
      esac
    done < "${STATE_FILE}"
  fi

  if [[ -n "${vite_pid}" ]] && kill -0 "${vite_pid}" >/dev/null 2>&1; then
    echo "[run] stopping Vite dev server (PID ${vite_pid})"
    kill "${vite_pid}" >/dev/null 2>&1 || true
    wait "${vite_pid}" 2>/dev/null || true
  fi

  if docker ps --format '{{.Names}}' | grep -q '^cv-parser-service-dev$'; then
    echo "[run] stopping parser container (cv-parser-service-dev)"
    docker stop cv-parser-service-dev >/dev/null 2>&1 || true
  fi

  rm -f "${STATE_FILE}"
  echo "[run] parser stopped."
}

logs() {
  docker logs -f --tail=200 cv-parser-service-dev
}

smoke() {
  curl -sS http://127.0.0.1:8001/ready | jq .
}

smoke_ocr() {
  local file="${1:?pdf path required}"
  curl -sS -H 'content-type: application/pdf' --data-binary @"$file" \
    'http://127.0.0.1:8001/parse-cv?mode=ocr' \
    | jq '.diagnostics | {engine,engine_final,pdf_pages_rendered,pdf_text_len}'
}

status() {
  curl -sS http://127.0.0.1:8001/ready | jq '{ok, prewarm, ocr: {engine: .ocr.engine, selected: .ocr.selected, available: .ocr.available, reason: .ocr.reason}}'
}

assert_ocr() {
  local file="${1:?pdf path required}"
  local ready_json selected expected_engine available reason

  ready_json="$(curl -sS http://127.0.0.1:8001/ready || true)"
  if [[ -z "$ready_json" ]]; then
    echo "[assert-ocr] FAIL: /ready unreachable" >&2
    exit 1
  fi

  selected="$(echo "$ready_json" | jq -r '.ocr.selected // ""')"
  reason="$(echo "$ready_json" | jq -r '.ocr.reason // ""')"

  if [[ "$selected" == "pdfplumber" || -z "$selected" || "$selected" == "null" ]]; then
    echo "[assert-ocr] FAIL: selected engine='$selected' (expected doctr|paddle|paddle_subproc)" >&2
    exit 1
  fi

  expected_engine="$selected"
  if [[ "$expected_engine" == "paddle_subproc" ]]; then
    expected_engine="paddle"
  fi

  local diag
  diag="$(curl -sS -H 'content-type: application/pdf' --data-binary @"$file" \
    'http://127.0.0.1:8001/parse-cv?mode=ocr' | jq -c '.diagnostics')"

  echo "$diag" | jq '{engine,engine_final,pdf_pages_rendered,pdf_text_len}'

  local engine_final pages textlen
  engine_final="$(echo "$diag" | jq -r '.engine_final // .engine // "unknown"')"
  pages="$(echo "$diag" | jq -r '.pdf_pages_rendered // 0')"
  textlen="$(echo "$diag" | jq -r '.pdf_text_len // 0')"

  if [[ "$engine_final" == "paddle_subproc" && "$expected_engine" == "paddle" ]]; then
    engine_final="paddle"
  fi

  # When doctr requested, allow pdfplumber if docTR failed but produced usable text
  if [[ "$expected_engine" == "doctr" ]]; then
    if [[ "$engine_final" != "doctr" && "$engine_final" != "pdfplumber" ]]; then
      echo "[assert-ocr] FAIL: engine_final=$engine_final (expected doctr or pdfplumber)" >&2
      exit 1
    fi
  else
    if [[ "$engine_final" != "$expected_engine" ]]; then
      echo "[assert-ocr] FAIL: engine_final=$engine_final (expected $expected_engine)" >&2
      exit 1
    fi
  fi
  if [[ "$pages" -lt 1 || "$textlen" -lt 5 ]]; then
    echo "[assert-ocr] FAIL: weak OCR output (pages_rendered=$pages, text_len=$textlen)" >&2
    exit 1
  fi
  echo "[assert-ocr] PASS"
}

case "$CMD" in
  up) up;;
  parser-up) parser_up;;
  down) down;;
  logs) logs;;
  smoke) smoke;;
  smoke-ocr) smoke_ocr "$@";;
  status) status;;
  assert-ocr) assert_ocr "$@";;
  help|*)
    cat <<'EOF'
usage:
  ./run.sh up [--ui]
  ./run.sh parser-up
  ./run.sh down
  ./run.sh status | logs | smoke | smoke-ocr FILE.pdf | assert-ocr FILE.pdf

Log helpers (non-blocking):
  ./scripts/convex-logs-history.sh [HIST]
  ./scripts/convex-logs-last-rid.sh [HIST]
  ./scripts/convex-logs-rid.sh <RID> [HIST]
EOF
    ;;
esac
