#!/usr/bin/env bash
set -euo pipefail

# ===== Basics & env =====
CMD="${1:-help}"; shift || true
if [[ "${CMD}" == "-ui" ]]; then
  set -- --ui "$@"
  CMD="up"
fi
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

# Load overrides
if [[ -f "${ROOT_DIR}/.env" ]]; then set -a; source "${ROOT_DIR}/.env"; set +a; fi
if [[ -f "${ROOT_DIR}/.env.local" ]]; then set -a; source "${ROOT_DIR}/.env.local"; set +a; fi

# Defaults
: "${PARSER_ORIGIN:=https://parser.dasti.ai}"   # Edge origin (Cloudflare Zero Trust)
: "${OPEN_BROWSER:=1}"                           # 1=open browser; 0=headless
: "${TUNNEL_NETWORK:=parsernet}"                 # Docker net for connector & parser
: "${PARSER_NAME:=cv-parser-service-dev}"        # Container name
: "${IMAGE_NAME:=cv-parser-service:latest}"      # Runtime image
: "${VITE_PORT:=5173}"                           # Vite desired port
: "${CF_ACCESS_CLIENT_ID:=}"                     # For probe-edge
: "${CF_ACCESS_CLIENT_SECRET:=}"                 # For probe-edge

STATE_DIR="${ROOT_DIR}/tmp/dev-stack"
STATE_FILE="${STATE_DIR}/pids.env"
LOG_DIR="${ROOT_DIR}/tmp"
VITE_LOG="${LOG_DIR}/vite-dev.log"

mkdir -p "${STATE_DIR}" "${LOG_DIR}"

# Auto-load Mistral key from file if not set
if [[ -z "${MISTRAL_API_KEY:-}" && -f "${HOME}/.mistral_key" ]]; then
  MISTRAL_API_KEY="$(<"${HOME}/.mistral_key")"
  MISTRAL_API_KEY="${MISTRAL_API_KEY//$'\r'/}"
  MISTRAL_API_KEY="${MISTRAL_API_KEY//$'\n'/}"
  export MISTRAL_API_KEY
fi

# ===== Helpers =====
map_platform() {
  case "$(uname -m)" in
    x86_64|amd64) echo "linux/amd64" ;;
    arm64|aarch64) echo "linux/arm64" ;;
    *) echo "linux/$(uname -m)" ;;
  esac
}

normalize_origin() {
  local o="${1:-}"
  [[ -z "$o" ]] && { echo ""; return; }
  if [[ "$o" != http://* && "$o" != https://* ]]; then o="https://${o}"; fi
  o="${o%/}"
  echo "$o"
}

kill_vite_ports() {
  # Kill any dev servers lingering on 5173–5215
  for p in $(seq 5173 5215); do
    # macOS & Linux-friendly lsof usage
    pids="$(lsof -ti tcp:$p -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      echo "[run] killing process(es) on :${p} -> ${pids}"
      kill -9 ${pids} || true
    fi
  done
}

write_state() {
  mkdir -p "${STATE_DIR}"
  {
    printf 'VITE_PID=%s\n' "${1:-}"
    printf 'PARSER_STARTED=%s\n' "${2:-0}"
  } > "${STATE_FILE}"
}

read_state() {
  [[ -f "${STATE_FILE}" ]] || return 0
  while IFS='=' read -r k v; do
    case "$k" in
      VITE_PID) VITE_PID="$v" ;;
      PARSER_STARTED) PARSER_STARTED="$v" ;;
    esac
  done < "${STATE_FILE}"
}

ensure_parsernet() {
  docker network create "${TUNNEL_NETWORK}" >/dev/null 2>&1 || true
  # Connect running parser container to parsernet (idempotent)
  if docker ps --format '{{.Names}}' | grep -qx "${PARSER_NAME}"; then
    docker network connect "${TUNNEL_NETWORK}" "${PARSER_NAME}" >/dev/null 2>&1 || true
  fi
  # Prove reachability from inside the network
  docker run --rm --network "${TUNNEL_NETWORK}" curlimages/curl \
    -sS -o /dev/null -w 'inside_ready=%{http_code}\n' "http://${PARSER_NAME}:8001/ready" \
    | grep -q 'inside_ready=200'
}

# ===== Parser (Docker) =====
start_parser() {
  local OCR="${1:-auto}"           # auto|doctr|paddle|disabled
  local PLATFORM; PLATFORM="$(map_platform)"

  if docker ps --format '{{.Names}}' | grep -qx "${PARSER_NAME}"; then
    echo "[run] parser already running: ${PARSER_NAME}"
  else
    echo "[run] starting parser (${IMAGE_NAME}, OCR=${OCR}) ..."
    local -a envs=(
      -e MALLOC_ARENA_MAX=2
      -e OMP_NUM_THREADS=1
    )
    # Map OCR flag to container env
    case "${OCR}" in
      doctr)    envs+=(-e CV_OCR_ENGINE=doctr   -e OCR_ENGINE=doctr   -e API_ENABLE_MISTRAL_OCR=) ;;
      paddle)   envs+=(-e CV_OCR_ENGINE=paddle  -e OCR_ENGINE=paddle) ;;
      disabled) envs+=(-e CV_OCR_ENGINE=disabled -e OCR_ENGINE=disabled -e API_ENABLE_MISTRAL_OCR=) ;;
      auto|*)   envs+=(-e CV_OCR_ENGINE=auto    -e OCR_ENGINE=auto) ;;
    esac
    # Enable Mistral OCR automatically if key present
    if [[ -n "${MISTRAL_API_KEY:-}" ]]; then
      envs+=(-e API_ENABLE_MISTRAL_OCR=1 -e "MISTRAL_API_KEY=${MISTRAL_API_KEY}")
    fi

    # Run container
    docker run -d --rm \
      --name "${PARSER_NAME}" \
      --platform "${PLATFORM}" \
      -p 8001:8001 \
      "${envs[@]}" \
      "${IMAGE_NAME}" \
      /opt/venv/bin/python -m uvicorn --app-dir /app cv_parser_service.main:app \
      --host 0.0.0.0 --port 8001 --workers 1 --http h11 \
      --timeout-keep-alive 5 --timeout-graceful-shutdown 5 --limit-concurrency 64 >/dev/null
  fi

  # Wait for healthy
  printf "[run] waiting for http://127.0.0.1:8001/ready"
  for i in $(seq 1 45); do
    if curl -fsS http://127.0.0.1:8001/ready >/dev/null 2>&1; then echo; break; fi
    printf "."
    sleep 1
    if [[ "$i" -eq 45 ]]; then
      echo
      echo "[run] ERROR: parser failed health check" >&2
      exit 1
    fi
  done

  # Make sure connector net can reach it
  if ! ensure_parsernet; then
    echo "[run] WARNING: parser not reachable inside ${TUNNEL_NETWORK} (continuing)."
  fi
}

stop_parser() {
  if docker ps --format '{{.Names}}' | grep -qx "${PARSER_NAME}"; then
    echo "[run] stopping parser (${PARSER_NAME})"
    docker stop "${PARSER_NAME}" >/dev/null 2>&1 || true
  fi
}

# ===== Vite =====
start_vite() {
  local ORIGIN="${1:?origin required}"
  kill_vite_ports
  : > "${VITE_LOG}"
  (
    cd "${ROOT_DIR}/my-app"
    export CONVEX_PARSER_URL="${ORIGIN}"
    export VITE_PARSER_URL="${ORIGIN}"
    export VITE_CONVEX_PARSER_URL="${ORIGIN}"
    export STRUCTURED_UPLOAD_SKIP_HEALTHCHECK=1
    if [[ "${OPEN_BROWSER}" == "0" ]]; then
      BROWSER=none npx --yes vite --host localhost --port "${VITE_PORT}" --clearScreen false
    else
      npx --yes vite --host localhost --port "${VITE_PORT}" --open --clearScreen false
    fi
  ) >> "${VITE_LOG}" 2>&1 &
  echo $!
}

stop_vite() {
  local VPID="${1:-}"
  if [[ -n "${VPID}" ]] && kill -0 "${VPID}" >/dev/null 2>&1; then
    echo "[run] stopping Vite (PID ${VPID})"
    kill "${VPID}" >/dev/null 2>&1 || true
    wait "${VPID}" 2>/dev/null || true
  fi
  kill_vite_ports
}

# ===== Probes =====
probe_edge() {
  local FILE="${1:-}"
  local HOST; HOST="$(normalize_origin "${PARSER_ORIGIN}")"
  echo "== probe-edge =="
  echo "origin: ${HOST}"

  echo -n "ready: ";  curl --http1.1 -s -o /dev/null -w '%{http_code}\n' "${HOST}/ready"
  echo -n "GET /mistral-ocr/parse (expect 403/405): "
  curl --http1.1 -s -o /dev/null -w '%{http_code}\n' "${HOST}/mistral-ocr/parse"

  if [[ -n "${CF_ACCESS_CLIENT_ID}" && -n "${CF_ACCESS_CLIENT_SECRET}" && -n "${FILE}" ]]; then
    echo -n "POST /mistral-ocr/parse (service token) file=$(basename "${FILE}") -> "
    curl --http1.1 -s -o /dev/null -w '%{http_code}\n' \
      -H "Accept: application/json" -H "Expect:" \
      -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}" \
      -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}" \
      -F "file=@${FILE};type=application/pdf" \
      "${HOST}/mistral-ocr/parse"
  else
    echo "(skipping auth POST; set CF_ACCESS_CLIENT_ID/SECRET and pass a file path)"
  fi
}

assert_ocr() {
  local FILE="${1:?pdf path required}"
  echo "== local assert-ocr =="
  curl -sS -H 'content-type: application/pdf' --data-binary @"${FILE}" \
    'http://127.0.0.1:8001/parse-cv?mode=ocr' \
    | jq '.diagnostics | {engine, engine_final, pdf_pages_rendered, pdf_text_len}'
}

status() {
  echo "== status =="
  echo -n "local /ready: "
  curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8001/ready || true
  echo -n "edge  /ready: "
  curl -s -o /dev/null -w '%{http_code}\n' "$(normalize_origin "${PARSER_ORIGIN}")/ready" || true
  echo "Vite log: ${VITE_LOG}"
}

# ===== Commands =====
up() {
  local OCR="auto"
  local START_UI=0
  local USE_LOCAL_ORIGIN=0
  local USE_EDGE_ORIGIN=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ui|--with-ui) START_UI=1; shift;;
      --local-origin) USE_LOCAL_ORIGIN=1; shift;;
      --edge-origin)  USE_EDGE_ORIGIN=1; shift;;
      --ocr)          OCR="${2:-auto}"; shift 2;;
      --doctr)        OCR="doctr"; shift;;
      --paddle)       OCR="paddle"; shift;;
      --ocr-disabled|--no-ocr) OCR="disabled"; shift;;
      *) echo "unknown option: $1" >&2; exit 2;;
    esac
  done

  # Start local parser (even if FE points to edge; useful for local testing)
  start_parser "${OCR}"

  # Decide FE origin
  local ACTIVE_ORIGIN
  if [[ "${USE_LOCAL_ORIGIN}" -eq 1 && "${USE_EDGE_ORIGIN}" -eq 1 ]]; then
    echo "[run] ERROR: choose one of --local-origin or --edge-origin" >&2; exit 2
  fi
  if [[ "${USE_LOCAL_ORIGIN}" -eq 1 ]]; then
    ACTIVE_ORIGIN="http://127.0.0.1:8001"
  else
    ACTIVE_ORIGIN="$(normalize_origin "${PARSER_ORIGIN}")"
  fi

  # Optionally start Vite
  local VPID=""
  if [[ "${START_UI}" -eq 1 ]]; then
    echo "[run] starting Vite → ${ACTIVE_ORIGIN}"
    VPID="$(start_vite "${ACTIVE_ORIGIN}")"
    sleep 2
    if ! kill -0 "${VPID}" >/dev/null 2>&1; then
      echo "[run] ERROR: Vite failed to start (see ${VITE_LOG})" >&2
      exit 1
    fi
  fi

  write_state "${VPID}" "1"
  echo "----------------- Dev Stack -----------------"
  echo "FE origin: ${ACTIVE_ORIGIN}"
  echo "Parser local: OK (http://127.0.0.1:8001)"
  echo "Vite: http://localhost:${VITE_PORT} (log: ${VITE_LOG})"
  echo "---------------------------------------------"
}

down() {
  local VITE_PID=""; local PARSER_STARTED="0"
  read_state
  stop_vite "${VITE_PID:-}"
  stop_parser
  rm -f "${STATE_FILE}"
  echo "[run] down: done."
}

logs() {
  docker logs -f --tail=200 "${PARSER_NAME}"
}

smoke() {
  curl -sS http://127.0.0.1:8001/ready | jq .
}

help() {
  cat <<'EOF'
usage:
  ./run.sh up [--ui] [--edge-origin | --local-origin] [--ocr auto|doctr|paddle|disabled]
  ./run.sh down
  ./run.sh status
  ./run.sh logs
  ./run.sh smoke
  ./run.sh assert-ocr FILE.pdf
  ./run.sh probe-edge [FILE.pdf]     # uses CF_ACCESS_CLIENT_ID/SECRET if set
  ./run.sh kill-vite-ports

notes:
- FE origin defaults to PARSER_ORIGIN (edge). Use --local-origin to point FE to http://127.0.0.1:8001.
- MISTRAL is auto-enabled if MISTRAL_API_KEY is present (env or ~/.mistral_key).
- OCR flag controls local parser engine: auto (default), doctr, paddle, disabled.
EOF
}

# Trap: ensure we don't leave Vite/Parser dangling on Ctrl+C
trap 'echo "[run] interrupt -> down"; down >/dev/null 2>&1 || true; exit 130' INT TERM

case "${CMD}" in
  up) up "$@";;
  down) down;;
  status) status;;
  logs) logs;;
  smoke) smoke;;
  assert-ocr) assert_ocr "$@";;
  probe-edge) probe_edge "${1:-}";;
  kill-vite-ports) kill_vite_ports;;
  help|*) help;;
esac
