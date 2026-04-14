#!/usr/bin/env bash
set -euo pipefail

# --- basic paths ---
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

# --- defaults (tweakable via env or CLI) ---
IMAGE_NAME="${IMAGE_NAME:-cv-parser-service:latest}"
DEPS_IMAGE="${DEPS_IMAGE:-cv-parser-deps:3.3.0}"   # bump to invalidate stale deps layer
CONTAINER_NAME="${CONTAINER_NAME:-cv-parser-service-dev}"

# frontend origin selection
PARSER_ORIGIN="${PARSER_ORIGIN:-https://parser.dasti.ai}"   # edge
USE_LOCAL_ORIGIN="${USE_LOCAL_ORIGIN:-false}"               # FE → local parser when true

# health + urls
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8001/ready}"
HEALTH_FALLBACK_URL="${HEALTH_FALLBACK_URL:-http://127.0.0.1:8001/health}"
LOCAL_PARSER_BASE="${HEALTH_URL%/ready}"
[[ "${LOCAL_PARSER_BASE}" == "${HEALTH_URL}" ]] && LOCAL_PARSER_BASE="${HEALTH_FALLBACK_URL%/health}"

# ocr mode: auto | doctr | paddle | disabled
OCR="${OCR:-auto}"

# misc
PADDLE_VOLUME="${PADDLE_VOLUME:-cv-parser-paddle-cache}"
DETACH_MODE="${DETACH_MODE:-true}"          # true = do not tie lifecycle to this process
TAIL_LOGS="${TAIL_LOGS:-false}"             # container log follow
SMOKE="${SMOKE:-0}"                         # optional tiny smoke via convex action
OPEN_BROWSER="${OPEN_BROWSER:-1}"           # open vite browser tab (1=yes)
VITE_LOG_FILE="${ROOT_DIR}/tmp/vite-dev.log"
STRUCTURED_LOG="${ROOT_DIR}/tmp/structured_upload.log"
FORCE_REBUILD="${FORCE_REBUILD:-false}"

# cloudflare service token (for probe-edge)
CF_ACCESS_CLIENT_ID="${CF_ACCESS_CLIENT_ID:-}"
CF_ACCESS_CLIENT_SECRET="${CF_ACCESS_CLIENT_SECRET:-}"

# Optional: Mistral key auto-enable
if [[ -z "${MISTRAL_API_KEY:-}" && -f "${HOME}/.mistral_key" ]]; then
  MISTRAL_API_KEY="$(<"${HOME}/.mistral_key")"
  MISTRAL_API_KEY="${MISTRAL_API_KEY//$'\r'/}"
  MISTRAL_API_KEY="${MISTRAL_API_KEY//$'\n'/}"
  export MISTRAL_API_KEY
fi

# --- helpers ---
log() { printf '[start-dev] %s\n' "$*"; }
to_bool() { case "$(echo "${1:-}" | tr '[:upper:]' '[:lower:]')" in 1|true|yes|on) echo "true";; *) echo "false";; esac; }
map_platform() { case "${1:-$(uname -m)}" in amd64|x86_64) echo "linux/amd64";; arm64|aarch64) echo "linux/arm64";; *) echo "linux/${1}";; esac; }

HOST_ARCH="$(uname -m)"
: "${DOCKER_DEFAULT_PLATFORM:=$(map_platform "${HOST_ARCH}")}"
export DOCKER_DEFAULT_PLATFORM

CACHE_DIR="${ROOT_DIR}/.buildx-cache"
DOCKER_STATE_DIR="${ROOT_DIR}/.docker"
mkdir -p "${CACHE_DIR}" "${DOCKER_STATE_DIR}" "${ROOT_DIR}/tmp" >/dev/null 2>&1 || true

hash_file() {
  local f="${1:-}"
  if [[ -f "${f}" ]]; then
    if command -v sha256sum >/dev/null 2>&1; then sha256sum "${f}" | awk '{print $1}'
    else shasum -a 256 "${f}" | awk '{print $1}'; fi
  else echo "missing"; fi
}

ensure_buildx() {
  if ! docker buildx inspect >/dev/null 2>&1; then
    log "configuring docker buildx builder..."
    docker buildx create --name cvparser-builder --driver docker-container --use >/dev/null
    docker buildx inspect --bootstrap >/dev/null
  fi
}

build_deps_if_needed() {
  local top_lock top_reqs srv_reqs dockerfile self_hash
  top_lock="$(hash_file requirements.lock)"
  top_reqs="$(hash_file requirements.txt)"
  srv_reqs="$(hash_file cv_parser_service/requirements.txt)"
  dockerfile="$(hash_file cv_parser_service/Dockerfile)"
  self_hash="$(hash_file scripts/start-dev.sh)"
  local sig="${top_lock}_${top_reqs}_${srv_reqs}_${dockerfile}_${self_hash}_${DOCKER_DEFAULT_PLATFORM}"
  local last="$(cat "${DOCKER_STATE_DIR}/last-deps-hash" 2>/dev/null || true)"
  local have="$(docker images -q "${DEPS_IMAGE}" 2>/dev/null || true)"

  if [[ -z "${have}" || "${last}" != "${sig}" ]]; then
    log "building deps image (${DEPS_IMAGE})..."
    DOCKER_BUILDKIT=1 docker buildx build \
      --platform "${DOCKER_DEFAULT_PLATFORM}" \
      --build-arg TARGETARCH="${DOCKER_DEFAULT_PLATFORM##*/}" \
      --target deps \
      --file cv_parser_service/Dockerfile \
      --cache-from=type=local,src="${CACHE_DIR}" \
      --cache-to=type=local,dest="${CACHE_DIR}",mode=max \
      -t "${DEPS_IMAGE}" \
      --load .
    printf '%s' "${sig}" > "${DOCKER_STATE_DIR}/last-deps-hash"
  else
    log "deps image up-to-date (${DEPS_IMAGE})"
  fi
}

build_runtime_image() {
  local runtime_dockerfile root_pkg root_lock app_pkg app_lock self_hash sig last
  runtime_dockerfile="$(hash_file cv_parser_service/Dockerfile)"
  root_pkg="$(hash_file package.json)"
  root_lock="$(hash_file package-lock.json)"
  app_pkg="$(hash_file my-app/package.json)"
  app_lock="$(hash_file my-app/package-lock.json)"
  self_hash="$(hash_file scripts/start-dev.sh)"
  sig="${runtime_dockerfile}_${root_pkg}_${root_lock}_${app_pkg}_${app_lock}_${self_hash}_${DOCKER_DEFAULT_PLATFORM}"
  last="$(cat "${DOCKER_STATE_DIR}/last-runtime-hash" 2>/dev/null || true)"

  if [[ "$(to_bool "${FORCE_REBUILD}")" != "true" ]] && docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1 && [[ "${last}" == "${sig}" ]]; then
    log "runtime image up-to-date (${IMAGE_NAME})"
    return
  fi
  log "building runtime image (${IMAGE_NAME})..."
  DOCKER_BUILDKIT=1 docker buildx build \
    --platform "${DOCKER_DEFAULT_PLATFORM}" \
    --build-arg TARGETARCH="${DOCKER_DEFAULT_PLATFORM##*/}" \
    --target runtime \
    --file cv_parser_service/Dockerfile \
    --cache-from=type=local,src="${CACHE_DIR}" \
    --cache-to=type=local,dest="${CACHE_DIR}",mode=max \
    -t "${IMAGE_NAME}" \
    --load .
  printf '%s' "${sig}" > "${DOCKER_STATE_DIR}/last-runtime-hash"
}

ensure_paddle_volume() {
  if ! docker volume inspect "${PADDLE_VOLUME}" >/dev/null 2>&1; then
    log "creating paddle cache volume ${PADDLE_VOLUME}..."
    docker volume create "${PADDLE_VOLUME}" >/dev/null
  fi
  docker run --rm -v "${PADDLE_VOLUME}:/home/app/.paddlex" alpine:3.20 \
    sh -c 'mkdir -p /home/app/.paddlex/official_models /home/app/.paddlex/temp && chmod -R 777 /home/app/.paddlex' >/dev/null 2>&1 || true
}

kill_vite_ports() {
  log "killing stale vite ports (5173–5215)"
  for p in {5173..5215}; do
    if lsof -ti tcp:$p >/dev/null 2>&1; then
      lsof -ti tcp:$p | xargs -r kill -9 || true
    fi
  done
}

start_container() {
  log "starting ${CONTAINER_NAME} (${DOCKER_DEFAULT_PLATFORM})..."
  # honor OCR flag
  local -a ocr_env=()
  case "${OCR}" in
    doctr)    ocr_env+=(-e CV_OCR_ENGINE=doctr   -e OCR_ENGINE=doctr);;
    paddle)   ocr_env+=(-e CV_OCR_ENGINE=paddle  -e OCR_ENGINE=paddle);;
    disabled) ocr_env+=(-e CV_OCR_ENGINE=disabled -e OCR_ENGINE=disabled);;
    auto|*)   ocr_env+=(-e CV_OCR_ENGINE=auto    -e OCR_ENGINE=auto);;
  esac

  # mistral auto-enable if key present
  local -a mistral_env=()
  if [[ -n "${MISTRAL_API_KEY:-}" ]]; then
    mistral_env+=(-e API_ENABLE_MISTRAL_OCR=1 -e MISTRAL_API_KEY="${MISTRAL_API_KEY}")
  fi

  # optional ARM/DoTR hints passthroughs
  local -a opt_env=()
  [[ -n "${CV_ALLOW_DOCTR_ON_ARM:-}" ]] && opt_env+=(-e "CV_ALLOW_DOCTR_ON_ARM=${CV_ALLOW_DOCTR_ON_ARM}")
  [[ -n "${DOCTR_PY:-}" ]]            && opt_env+=(-e "DOCTR_PY=${DOCTR_PY}")            || opt_env+=(-e DOCTR_PY)
  [[ -n "${DOCTR_BACKEND:-}" ]]       && opt_env+=(-e "DOCTR_BACKEND=${DOCTR_BACKEND}")  || opt_env+=(-e DOCTR_BACKEND)

  # clean previous
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

  docker run -d --rm \
    --platform "${DOCKER_DEFAULT_PLATFORM}" \
    --name "${CONTAINER_NAME}" \
    -p 8001:8001 \
    --shm-size=1g \
    -e PYTHONPATH=/app \
    -e MALLOC_ARENA_MAX=2 \
    -v "${ROOT_DIR}:/app" \
    -v "${PADDLE_VOLUME}:/home/app/.paddlex" \
    "${ocr_env[@]}" \
    "${mistral_env[@]}" \
    "${opt_env[@]}" \
    "${IMAGE_NAME}" \
    /opt/venv/bin/python -m uvicorn \
      --app-dir /app cv_parser_service.main:app \
      --host 0.0.0.0 --port 8001 --workers 1 --http h11 \
      --timeout-keep-alive 5 --timeout-graceful-shutdown 5 --limit-concurrency 64 >/dev/null

  # health
  local code
  printf '[start-dev] waiting for /ready'
  for ((i=0;i<120;i++)); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "${HEALTH_URL}" || true)"
    if [[ "${code}" == "200" || "${code}" == "201" ]]; then echo; return 0; fi
    printf '.'
    sleep 1
  done
  echo
  log "ERROR: service not healthy after 120s (last code=${code})"
  docker logs --tail 120 "${CONTAINER_NAME}" || true
  exit 1
}

stop_container_on_exit="false"
cleanup() {
  set +e
  if [[ "${stop_container_on_exit}" == "true" ]]; then
    log "stopping ${CONTAINER_NAME}..."
    docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

start_vite() {
  local origin="${1:?origin required}"
  kill_vite_ports
  rm -f "${VITE_LOG_FILE}"; mkdir -p "$(dirname "${VITE_LOG_FILE}")"; : > "${VITE_LOG_FILE}"
  (
    cd "${ROOT_DIR}/my-app"
    export CONVEX_PARSER_URL="${origin}"
    export VITE_PARSER_URL="${origin}"
    export VITE_CONVEX_PARSER_URL="${origin}"
    export STRUCTURED_UPLOAD_SKIP_HEALTHCHECK=1
   if [[ "${OPEN_BROWSER}" == "0" ]]; then
  npm run dev:frontend -- \
    --host 127.0.0.1 \
    --port 5173 \
    --strictPort \
    --clearScreen false
else
  npm run dev:frontend -- \
    --host 127.0.0.1 \
    --port 5173 \
    --strictPort \
    --open \
    --clearScreen false
fi
  ) >> "${VITE_LOG_FILE}" 2>&1 &
  local vite_pid=$!
  sleep 1
  if ! kill -0 "${vite_pid}" >/dev/null 2>&1; then
    log "ERROR: vite failed to start; see ${VITE_LOG_FILE}"
    exit 1
  fi
  log "vite started (PID ${vite_pid}) → http://127.0.0.1:5173 (logs: ${VITE_LOG_FILE})"
  if [[ "$(to_bool "${DETACH_MODE}")" == "false" && "$(to_bool "${TAIL_LOGS}")" == "true" ]]; then
    tail -f "${VITE_LOG_FILE}" &
  fi
}

probe_edge() {
  local file="${1:-}"
  local host="${PARSER_ORIGIN%/}"
  echo "== edge probe =="
  curl --http1.1 -s -o /dev/null -w 'ready=%{http_code}\n' "${host}/ready"
  curl --http1.1 -s -o /dev/null -w 'get=%{http_code}\n'   "${host}/mistral-ocr/parse"
  if [[ -n "${file}" && -f "${file}" && -n "${CF_ACCESS_CLIENT_ID}" && -n "${CF_ACCESS_CLIENT_SECRET}" ]]; then
    curl --http1.1 -s -o /dev/null -w 'post=%{http_code}\n' \
      -H "Accept: application/json" -H "Expect:" \
      -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}" \
      -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}" \
      -F "file=@${file};type=application/pdf" \
      "${host}/mistral-ocr/parse"
  else
    echo "post=SKIPPED (need FILE and CF_ACCESS_* set)"
  fi
}

print_summary() {
  local active="${1}"
  local have_key="no"
  [[ -n "${MISTRAL_API_KEY:-}" ]] && have_key="yes"
  cat <<EOF
-----------------------------------------------
Frontend origin : ${active}
Local parser    : http://127.0.0.1:8001
OCR mode        : ${OCR}  (Mistral key: ${have_key})
Vite            : http://127.0.0.1:5173
-----------------------------------------------
EOF
}

# --- CLI args ---
ACTION="${1:-up}"; shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --local-origin) USE_LOCAL_ORIGIN="true"; shift;;
    --edge-origin)  USE_LOCAL_ORIGIN="false"; shift;;
    --doctr)        OCR="doctr"; shift;;
    --paddle)       OCR="paddle"; shift;;
    --ocr)          OCR="${2:-auto}"; shift 2;;
    --disabled|--no-ocr) OCR="disabled"; shift;;
    --detach)       DETACH_MODE="true"; shift;;
    --no-detach)    DETACH_MODE="false"; shift;;
    --tail-logs)    TAIL_LOGS="true"; shift;;
    --no-tail-logs) TAIL_LOGS="false"; shift;;
    --smoke)        SMOKE="1"; shift;;
    --rebuild|--force-rebuild) FORCE_REBUILD="true"; shift;;
    --open)         OPEN_BROWSER="1"; shift;;
    --no-open)      OPEN_BROWSER="0"; shift;;
    *) log "unknown option: $1"; exit 2;;
  esac
done

# --- actions ---
case "${ACTION}" in
  up)
    ensure_buildx
    build_deps_if_needed
    build_runtime_image
    ensure_paddle_volume

    # run container
    start_container

    # stop container on exit if foreground (no-detach)
    if [[ "$(to_bool "${DETACH_MODE}")" == "false" ]]; then
      stop_container_on_exit="true"
    fi

    # pick FE origin
    active_origin="${PARSER_ORIGIN%/}"
    if [[ "$(to_bool "${USE_LOCAL_ORIGIN}")" == "true" ]]; then
      active_origin="${LOCAL_PARSER_BASE%/}"
      log "FE will use LOCAL parser origin: ${active_origin}"
    else
      log "FE will use EDGE parser origin: ${active_origin}"
    fi

    # optional smoke (Convex action; requires convex CLI + cloud env)
    if [[ "${SMOKE}" == "1" ]]; then
      if command -v npx >/dev/null 2>&1; then
        log "running structuredUpload smoke (text mode)…"
        (cd "${ROOT_DIR}/my-app" && npx --yes convex run actions/structuredUpload:structuredUpload \
          '{"rawText":"start-dev smoke resume line","mode":"text"}' | tee "${STRUCTURED_LOG}") || true
      else
        log "skip smoke (npx not found)"
      fi
    fi

    # start frontend
    start_vite "${active_origin}"

    print_summary "${active_origin}"

    # foreground mode holds the terminal; otherwise exit
    if [[ "$(to_bool "${DETACH_MODE}")" == "false" ]]; then
      log "press Ctrl+C to stop (container will be stopped)"
      # follow container logs if requested
      if [[ "$(to_bool "${TAIL_LOGS}")" == "true" ]]; then
        docker logs -f --tail=200 "${CONTAINER_NAME}" &
        wait $! || true
      else
        # idle wait
        while true; do sleep 3600; done
      fi
    else
      log "running detached. to stop: docker stop ${CONTAINER_NAME}"
    fi
    ;;

  probe-edge)
    probe_edge "${1:-}"
    ;;

  down)
    log "stopping vite is manual for this script (just close the process)."
    log "stopping ${CONTAINER_NAME}…"
    docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    ;;

  logs)
    docker logs -f --tail=200 "${CONTAINER_NAME}"
    ;;

  *)
    cat <<'EOF'
usage:
  scripts/start-dev.sh up [--local-origin|--edge-origin] [--doctr|--paddle|--ocr auto|--disabled] [--no-detach] [--tail-logs] [--smoke]
  scripts/start-dev.sh probe-edge [FILE.pdf]   # checks /ready, GET /mistral-ocr/parse, and auth POST if CF_ACCESS_* set
  scripts/start-dev.sh down
  scripts/start-dev.sh logs
notes:
  - with --local-origin the frontend talks to http://127.0.0.1:8001 (no tunnel required).
  - with edge origin the frontend talks to ${PARSER_ORIGIN}; you need your Cloudflare tunnel + routes set.
  - mistral OCR is auto-enabled if MISTRAL_API_KEY is present; otherwise only local engines (doctr/paddle/disabled) run.
EOF
    exit 2
    ;;
esac
