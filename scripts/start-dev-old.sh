#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

IMAGE_NAME="cv-parser-service"
DEPS_IMAGE="cv-parser-deps:3.3.0"     # why: bump to invalidate stale deps image with no /opt/doctr-venv
CONTAINER_NAME="cv-parser-service-dev"

PARSER_URL="http://127.0.0.1:8001/parse-cv"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8001/ready}"
HEALTH_FALLBACK_URL="${HEALTH_FALLBACK_URL:-http://127.0.0.1:8001/health}"
LOCAL_PARSER_BASE="${HEALTH_URL%/ready}"
if [[ "${LOCAL_PARSER_BASE}" == "${HEALTH_URL}" ]]; then
  LOCAL_PARSER_BASE="${HEALTH_FALLBACK_URL%/health}"
fi

TUNNEL_SCRIPT="${ROOT_DIR}/my-app/scripts/start-parser-tunnel.mjs"
TUNNEL_URL_FILE="${ROOT_DIR}/my-app/.parser-tunnel-url"
STRUCTURED_LOG="${ROOT_DIR}/tmp/structured_upload.log"
MAX_TUNNEL_WAIT=240
MAX_HEALTH_WAIT="${MAX_HEALTH_WAIT:-900}"

TAIL_LOGS_DEFAULT="1"
SERVICE_ONLY="false"
FORCE_REBUILD="${FORCE_REBUILD:-false}"
TAIL_LOGS="${TAIL_LOGS:-${TAIL_LOGS_DEFAULT}}"
FORCE_TUNNEL="${FORCE_TUNNEL:-false}"
PADDLE_VOLUME="${PADDLE_VOLUME:-cv-parser-paddle-cache}"

TUNNEL_PID=""
TUNNEL_URL=""
LOG_FOLLOW_PID=""
ACTIVE_CONTAINER=""
STOP_CONTAINER_ON_EXIT="false"
ARTIFACTS_DIR="${ROOT_DIR}/artifacts"
VITE_PID=""
VITE_LOG_TAIL_PID=""
VITE_LOG_FILE=""
DEV_STATE_DIR="${ROOT_DIR}/tmp/dev-stack"
PID_STATE_FILE="${DEV_STATE_DIR}/pids.env"
TUNNEL_LOG_FILE="${ROOT_DIR}/tmp/parser-tunnel.log"

# --- Path Summary (local) ---
printf '[paths] ROOT_DIR=%s\n' "${ROOT_DIR}"
printf '[paths] scripts/start-dev.sh: OK %s\n' "${ROOT_DIR}/scripts/start-dev.sh"
printf '[paths] cv_parser_service/main.py: %s %s\n' \
  "$( [[ -f "${ROOT_DIR}/cv_parser_service/main.py" ]] && echo OK || echo MISSING )" \
  "${ROOT_DIR}/cv_parser_service/main.py"
printf '[paths] cv_parser/canonicalize.py: %s %s\n' \
  "$( [[ -f "${ROOT_DIR}/cv_parser/canonicalize.py" ]] && echo OK || echo MISSING )" \
  "${ROOT_DIR}/cv_parser/canonicalize.py"

map_platform() {
  local arch="${1:-}"
  case "${arch}" in
    amd64|x86_64) echo "linux/amd64" ;;
    arm64|aarch64) echo "linux/arm64" ;;
    *) echo "linux/${arch}" ;;
  esac
}
HOST_UNAME="$(uname -m)"
: "${TARGETARCH:=${HOST_UNAME}}"
: "${DOCKER_DEFAULT_PLATFORM:=$(map_platform "${TARGETARCH}")}"
export DOCKER_DEFAULT_PLATFORM

CACHE_DIR="${ROOT_DIR}/.buildx-cache"
DOCKER_STATE_DIR="${ROOT_DIR}/.docker"
if [[ "${RUN_SMOKE:-0}" == "1" && -z "${RELOAD:-}" ]]; then
  RELOAD=0
fi
if [[ "${RUN_SMOKE:-0}" == "1" && -z "${HTTP_IMPL:-}" ]]; then
  HTTP_IMPL="h11"
fi
# Default to docTR in dev unless explicitly overridden
if [[ -z "${CV_OCR_ENGINE:-}" ]]; then
  CV_OCR_ENGINE="doctr"
fi
if [[ -z "${OCR_ENGINE:-}" ]]; then
  OCR_ENGINE="${CV_OCR_ENGINE}"
fi

log() {
  printf '[dev] %s\n' "$*"
}

compute_ocr_signature() {
  local engine="${CV_OCR_ENGINE:-${OCR_ENGINE:-auto}}"
  local prewarm="${PREWARM:-0}"
  local reload="${RELOAD:-0}"
  local http="${HTTP_IMPL:-h11}"
  printf '%s|PREWARM=%s|RELOAD=%s|HTTP=%s' "${engine}" "${prewarm}" "${reload}" "${http}"
}

is_loopback() {
  case "$1" in
    http://127.0.0.1*|http://localhost*|https://127.0.0.1*|https://localhost*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

to_bool() {
  local value="${1:-}"
  value="$(printf '%s' "${value}" | tr '[:upper:]' '[:lower:]')"
  case "${value}" in
    1|true|yes|on)
      echo "true"
      ;;
    *)
      echo "false"
      ;;
  esac
}

FORCE_REBUILD="$(to_bool "${FORCE_REBUILD}")"
TAIL_LOGS="$(to_bool "${TAIL_LOGS}")"
FORCE_TUNNEL="$(to_bool "${FORCE_TUNNEL}")"
if [[ -z "${HTTP_IMPL:-}" ]]; then
  HTTP_IMPL="h11"
fi

OCR_SIGNATURE="$(compute_ocr_signature)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service-only)
      SERVICE_ONLY="true"
      shift
      ;;
    --rebuild|--force-rebuild)
      FORCE_REBUILD="true"
      shift
      ;;
    --tail-logs)
      TAIL_LOGS="true"
      shift
      ;;
    --no-tail-logs)
      TAIL_LOGS="false"
      shift
      ;;
    *)
      log "Unknown argument: $1"
      exit 2
      ;;
  esac
done

FORCE_REBUILD="$(to_bool "${FORCE_REBUILD}")"
TAIL_LOGS="$(to_bool "${TAIL_LOGS}")"
FORCE_TUNNEL="$(to_bool "${FORCE_TUNNEL}")"
USE_LOCAL_PARSER="$(to_bool "${USE_LOCAL_PARSER:-true}")"
RUN_SMOKE="${RUN_SMOKE:-0}"
RUN_PARSE_FIXTURES="${RUN_PARSE_FIXTURES:-0}"
DETACH_MODE="$(to_bool "${DETACH_MODE:-true}")"

if [[ "${DETACH_MODE}" == "true" ]]; then
  TAIL_LOGS="false"
fi

mkdir -p "${DEV_STATE_DIR}" || true
rm -f "${PID_STATE_FILE}"

if [[ "${USE_LOCAL_PARSER}" == "true" ]]; then
  log "Starting parser via scripts/parser.sh ..."
  HOST="${HOST:-127.0.0.1}" PORT="${PORT:-8001}" \
    "${ROOT_DIR}/scripts/parser.sh" start
  if [[ "${RUN_SMOKE}" == "1" ]]; then
    log "RUN_SMOKE=1 detected; executing ABC smoke."
    HOST="${HOST:-127.0.0.1}" PORT="${PORT:-8001}" \
      "${ROOT_DIR}/scripts/parser.sh" smoke || {
        if [[ "${SKIP_SMOKE:-0}" == "1" ]]; then
          log "WARNING: ABC smoke failed but SKIP_SMOKE=1; continuing."
        else
          log "ERROR: ABC smoke failed."
          exit 1
        fi
      }
  fi
  if [[ "${RUN_PARSE_FIXTURES}" == "1" ]]; then
    log "RUN_PARSE_FIXTURES=1 → parsing fixtures/fixturetest"
    PARSE_PY_BIN="${PYTHON_BIN:-}"
    if [[ -z "${PARSE_PY_BIN}" ]]; then
      if command -v python3 >/dev/null 2>&1; then
        PARSE_PY_BIN="python3"
      else
        PARSE_PY_BIN="python"
      fi
    fi
    PARSER_URL="http://${HOST:-127.0.0.1}:${PORT:-8001}/parse-cv" \
      "${PARSE_PY_BIN}" "${ROOT_DIR}/scripts/parse.py" fixtures/fixturetest || {
        log "ERROR: Fixture parse failed."
        exit 1
      }
  fi
  exit 0
fi

if [[ "${FORCE_TUNNEL}" == "true" && "${SERVICE_ONLY}" == "true" ]]; then
  log "FORCE_TUNNEL enabled; overriding service-only mode."
  SERVICE_ONLY="false"
fi

hash_file() {
  local f="${1:-}"
  if [[ -f "${f}" ]]; then
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum "${f}" | awk '{print $1}'
    else
      shasum -a 256 "${f}" | awk '{print $1}'
    fi
  else
    echo "missing"
  fi
}

ensure_buildx() {
  if ! docker buildx inspect >/dev/null 2>&1; then
    log "Configuring docker buildx builder..."
    docker buildx create --name cvparser-builder --driver docker-container --use >/dev/null
    docker buildx inspect --bootstrap >/dev/null
  fi
}

build_deps_if_needed() {
  local last_hash image_exists
  last_hash="$(cat "${DOCKER_STATE_DIR}/last-deps-hash" 2>/dev/null || true)"
  image_exists="$(docker images -q "${DEPS_IMAGE}" 2>/dev/null || true)"
  if [[ "${FORCE_REBUILD}" == "true" || -z "${image_exists}" || "${last_hash}" != "${COMBINED_HASH}" ]]; then
    log "Building deps image (${DEPS_IMAGE})..."
    # Fast path: optionally skip the slow cache export to local disk to avoid stalls.
    if [[ "${SKIP_CACHE_EXPORT:-0}" != "1" ]]; then
      DOCKER_BUILDKIT=1 docker buildx build \
        --platform "${DOCKER_DEFAULT_PLATFORM}" \
        --build-arg TARGETARCH="${DOCKER_DEFAULT_PLATFORM##*/}" \
        --target deps \
        --file cv_parser_service/Dockerfile \
        --cache-from=type=local,src="${CACHE_DIR}" \
        --cache-to=type=local,dest="${CACHE_DIR}",mode=max \
        -t "${DEPS_IMAGE}" \
        --load \
        .
    else
      DOCKER_BUILDKIT=1 docker buildx build \
        --platform "${DOCKER_DEFAULT_PLATFORM}" \
        --build-arg TARGETARCH="${DOCKER_DEFAULT_PLATFORM##*/}" \
        --target deps \
        --file cv_parser_service/Dockerfile \
        --cache-from=type=local,src="${CACHE_DIR}" \
        -t "${DEPS_IMAGE}" \
        --load \
        .
    fi
    printf '%s' "${COMBINED_HASH}" > "${DOCKER_STATE_DIR}/last-deps-hash"
  else
    log "Deps image up-to-date (${DEPS_IMAGE}); skipping build."
  fi
}

build_runtime_image() {
  if [[ "${FORCE_REBUILD}" != "true" ]] && docker image inspect "${IMAGE_NAME}:latest" >/dev/null 2>&1; then
    log "Runtime image up-to-date (${IMAGE_NAME}); skipping rebuild."
    return
  fi

  log "Building ${IMAGE_NAME} (runtime)..."
  # Fast path: optionally skip the slow cache export to local disk to avoid stalls.
  if [[ "${SKIP_CACHE_EXPORT:-0}" != "1" ]]; then
    DOCKER_BUILDKIT=1 docker buildx build \
      --platform "${DOCKER_DEFAULT_PLATFORM}" \
      --build-arg TARGETARCH="${DOCKER_DEFAULT_PLATFORM##*/}" \
      --build-arg RUNTIME_CACHE_BUST="${RUNTIME_CACHE_BUST:-0}" \
      --target runtime \
      --file cv_parser_service/Dockerfile \
      --cache-from=type=local,src="${CACHE_DIR}" \
      --cache-to=type=local,dest="${CACHE_DIR}",mode=max \
      -t "${IMAGE_NAME}" \
      --load \
      .
  else
    DOCKER_BUILDKIT=1 docker buildx build \
      --platform "${DOCKER_DEFAULT_PLATFORM}" \
      --build-arg TARGETARCH="${DOCKER_DEFAULT_PLATFORM##*/}" \
      --build-arg RUNTIME_CACHE_BUST="${RUNTIME_CACHE_BUST:-0}" \
      --target runtime \
      --file cv_parser_service/Dockerfile \
      --cache-from=type=local,src="${CACHE_DIR}" \
      -t "${IMAGE_NAME}" \
      --load \
      .
  fi
}

ensure_paddle_volume() {
  if ! docker volume inspect "${PADDLE_VOLUME}" >/dev/null 2>&1; then
    log "Creating PaddleOCR cache volume ${PADDLE_VOLUME}..."
    docker volume create "${PADDLE_VOLUME}" >/dev/null
  else
    log "Reusing PaddleOCR cache volume ${PADDLE_VOLUME}."
  fi
  docker run --rm -v "${PADDLE_VOLUME}:/home/app/.paddlex" alpine:3.20 \
    sh -c 'mkdir -p /home/app/.paddlex/official_models /home/app/.paddlex/temp && chown -R 10001:10001 /home/app/.paddlex && chmod -R 777 /home/app/.paddlex' >/dev/null 2>&1 || true
}

stop_log_follow() {
  if [[ -n "${LOG_FOLLOW_PID}" ]]; then
    kill "${LOG_FOLLOW_PID}" >/dev/null 2>&1 || true
    wait "${LOG_FOLLOW_PID}" 2>/dev/null || true
    LOG_FOLLOW_PID=""
  fi
}

stop_tunnel() {
  if [[ -n "${TUNNEL_PID}" ]]; then
    log "Stopping parser tunnel..."
    kill "${TUNNEL_PID}" >/dev/null 2>&1 || true
    wait "${TUNNEL_PID}" 2>/dev/null || true
    TUNNEL_PID=""
  fi
}

ensure_convex_cli() {
  if command -v convex >/dev/null 2>&1; then
    return 0
  fi

  if command -v npx >/dev/null 2>&1; then
    log "Convex CLI not found; bootstrapping via npx --yes convex --version"
    if npx --yes convex --version >/dev/null 2>&1; then
      return 0
    fi
    log "WARNING: npx --yes convex --version failed; attempting global convex install."
  else
    log "WARNING: npx command not available; attempting global convex install."
  fi

  if command -v npm >/dev/null 2>&1; then
    if npm install -g convex >/dev/null 2>&1; then
      return 0
    fi
    log "WARNING: npm install -g convex failed."
  else
    log "WARNING: npm command not available; cannot install Convex CLI automatically."
  fi

  return 1
}

sync_convex_env() {
  local url="${1:-}"
  if [[ -z "${url}" ]]; then
    log "ERROR: Empty tunnel URL received; skipping Convex env sync."
    return 1
  fi

  if ! ensure_convex_cli; then
    log "WARNING: Convex CLI unavailable; skipping Convex env sync."
    return 1
  fi

  local delays=(1 3 5)
  local total=${#delays[@]}
  local success="false"

  for idx in "${!delays[@]}"; do
    local attempt=$((idx + 1))
    local delay=${delays[$idx]}
    log "Syncing Convex env (attempt ${attempt}/${total})..."
    if (cd "${ROOT_DIR}/my-app" && npx convex env set CONVEX_PARSER_URL "${url}"); then
      local persisted=""
      if persisted=$(cd "${ROOT_DIR}/my-app" && npx convex env get CONVEX_PARSER_URL 2>/dev/null); then
        persisted="${persisted//$'\r'/}"
        persisted="${persisted//$'\n'/}"
        if [[ "${persisted}" == "${url}" ]]; then
          log "Convex env updated: CONVEX_PARSER_URL=${persisted}"
          success="true"
          break
        fi
        log "ERROR: Convex env returned CONVEX_PARSER_URL=${persisted} (expected ${url})."
        return 1
      else
        log "WARNING: Unable to read back CONVEX_PARSER_URL after sync attempt ${attempt}."
      fi
    else
      log "WARNING: convex env set failed on attempt ${attempt}."
    fi

    if (( attempt < total )); then
      log "Retrying Convex env sync in ${delay}s..."
      sleep "${delay}"
    fi
  done

  if [[ "${success}" != "true" ]]; then
    log "WARNING: Convex env sync failed after ${total} attempts."
    return 1
  fi

  return 0
}

cleanup() {
  set +e
  stop_log_follow
  if [[ -n "${VITE_LOG_TAIL_PID}" ]]; then
    kill "${VITE_LOG_TAIL_PID}" >/dev/null 2>&1 || true
    wait "${VITE_LOG_TAIL_PID}" 2>/dev/null || true
    VITE_LOG_TAIL_PID=""
  fi
  if [[ -n "${VITE_PID}" ]]; then
    log "Stopping Vite dev server..."
    kill "${VITE_PID}" >/dev/null 2>&1 || true
    wait "${VITE_PID}" 2>/dev/null || true
    VITE_PID=""
  fi
  stop_tunnel
  if [[ "${STOP_CONTAINER_ON_EXIT}" == "true" && -n "${ACTIVE_CONTAINER}" ]]; then
    log "Stopping parser container..."
    docker stop "${ACTIVE_CONTAINER}" >/dev/null 2>&1 || true
  fi
  rm -f "${PID_STATE_FILE}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

check_service_health() {
  curl -fsS "${HEALTH_URL}" >/dev/null 2>&1
}

wait_for_health() {
  local timeout="${1:-${MAX_HEALTH_WAIT}}"
  printf '[dev] Waiting for parser service to become healthy (timeout=%ss)' "${timeout}"
  for ((attempt=1; attempt<=timeout; attempt++)); do
    if check_service_health; then
      echo
      return 0
    fi
    printf '.'
    sleep 1
  done
  echo
  return 1
}

stop_container_if_running() {
  local running_id
  running_id="$(docker ps -q -f "name=^${CONTAINER_NAME}$")"
  if [[ -n "${running_id}" ]]; then
    log "Stopping existing ${CONTAINER_NAME}..."
    docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi
}

remove_container_if_exists() {
  local existing_id
  existing_id="$(docker ps -aq -f "name=^${CONTAINER_NAME}$")"
  if [[ -n "${existing_id}" ]]; then
    log "Removing leftover container ${CONTAINER_NAME}..."
    docker rm "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi
}

start_container() {
  log "Starting ${CONTAINER_NAME} (platform=${DOCKER_DEFAULT_PLATFORM}) with hot reload..."
  local -a args=(
    -d --rm
    --platform "${DOCKER_DEFAULT_PLATFORM}"
    --name "${CONTAINER_NAME}"
    --label "cvparser.ocr_sig=${OCR_SIGNATURE}"
    -p 8001:8001
    -e PYTHONPATH=/app
    -e PREWARM="${PREWARM:-0}"
    -e MALLOC_ARENA_MAX=2
    --shm-size=1g
    -v "${ROOT_DIR}:/app"
    -v "${PADDLE_VOLUME}:/home/app/.paddlex"
  )
  # Always inject engine env into the container (mirror between OCR_ENGINE/CV_OCR_ENGINE)
  args+=(-e "CV_OCR_ENGINE=${CV_OCR_ENGINE:-${OCR_ENGINE:-doctr}}")
  args+=(-e "OCR_ENGINE=${OCR_ENGINE:-${CV_OCR_ENGINE:-doctr}}")
  args+=(-e "CV_DOCTR_SITE_PACKAGES=${CV_DOCTR_SITE_PACKAGES:-/opt/doctr-venv/lib/python3.11/site-packages}")
  args+=(-e "TF_CPP_MIN_LOG_LEVEL=${TF_CPP_MIN_LOG_LEVEL:-2}")
  args+=(-e "OMP_NUM_THREADS=${OMP_NUM_THREADS:-1}")
  args+=(-e "TF_NUM_INTRAOP_THREADS=${TF_NUM_INTRAOP_THREADS:-1}")
  args+=(-e "TF_NUM_INTEROP_THREADS=${TF_NUM_INTEROP_THREADS:-1}")
  args+=(-e "CV_OCR_DISABLE_PADDLE_FALLBACK=1")
  # Pass docTR hints explicitly (avoid implicit passthrough ambiguity)
  local doctr_py_env="${DOCTR_PY:-}"
  local doctr_backend_env="${DOCTR_BACKEND:-}"
  if [[ "${TARGETARCH}" == "arm64" || "${TARGETARCH}" == "aarch64" ]]; then
    doctr_py_env="${doctr_py_env:-/opt/doctr-venv/bin/python}"
    doctr_backend_env="${doctr_backend_env:-tensorflow}"
  fi
  if [[ -n "${doctr_py_env}" ]]; then
    args+=(-e "DOCTR_PY=${doctr_py_env}")
  else
    args+=(-e DOCTR_PY)
  fi
  if [[ -n "${doctr_backend_env}" ]]; then
    args+=(-e "DOCTR_BACKEND=${doctr_backend_env}")
  else
    args+=(-e DOCTR_BACKEND)
  fi
  # Allow Paddle on arm64 explicitly (dev convenience)
  args+=(-e "CV_OCR_ENABLE_PADDLE_ARM64=1")
  if [[ -n "${CV_ALLOW_DOCTR_ON_ARM:-}" ]]; then
    args+=(-e "CV_ALLOW_DOCTR_ON_ARM=${CV_ALLOW_DOCTR_ON_ARM}")
  fi
  if [[ -n "${CV_OCR_PADDLE_TIMEOUT:-}" ]]; then
    args+=(-e "CV_OCR_PADDLE_TIMEOUT=${CV_OCR_PADDLE_TIMEOUT}")
  fi
  if [[ -n "${PADDLE_MIRROR:-}" ]]; then
    log "Using Paddle mirror ${PADDLE_MIRROR} for model downloads"
    args+=(--env "PADDLE_MODEL_URL_BASE=${PADDLE_MIRROR}")
  fi
  if [[ -n "${API_ENABLE_MISTRAL_OCR:-}" ]]; then
    args+=(-e "API_ENABLE_MISTRAL_OCR=${API_ENABLE_MISTRAL_OCR}")
  fi
  if [[ -n "${MISTRAL_API_KEY:-}" ]]; then
    args+=(-e "MISTRAL_API_KEY=${MISTRAL_API_KEY}")
  fi

  local http_impl="${HTTP_IMPL:-h11}"
  local -a uvicorn_cmd=(
    /opt/venv/bin/python -m uvicorn
    --app-dir /app
    cv_parser_service.main:app
    --host 0.0.0.0
    --port 8001
    --workers 1
    --http "${http_impl}"
    --timeout-keep-alive 5
    --timeout-graceful-shutdown 5
    --limit-concurrency 64
  )
  if [[ "${USE_LOCAL_PARSER}" == "true" && "${RELOAD:-0}" == "1" ]]; then
    uvicorn_cmd+=(
      --reload
      --reload-dir cv_parser_service
      --reload-dir cv_parser
      "--reload-exclude=artifacts/*"
      "--reload-exclude=fixtures/*"
      "--reload-exclude=*.log"
    )
  fi

  # Print the exact docker run command (single line) for debugging (mask secrets)
  printable_args=()
  i=0
  while [[ $i -lt ${#args[@]} ]]; do
    token="${args[$i]}"
    if [[ "${token}" == "-e" && $((i + 1)) -lt ${#args[@]} ]]; then
      next="${args[$((i + 1))]}"
      if [[ "${next}" == MISTRAL_API_KEY=* ]]; then
        printable_args+=("-e" "MISTRAL_API_KEY=***")
        i=$((i + 2))
        continue
      fi
    fi
    printable_args+=("${token}")
    i=$((i + 1))
  done
  echo "[dev] DEBUG docker run args: docker run ${printable_args[*]} ${IMAGE_NAME} ${uvicorn_cmd[*]}"
  echo "[dev] DEBUG environment variables: DOCTR_PY=${DOCTR_PY:-unset}, DOCTR_BACKEND=${DOCTR_BACKEND:-unset}"

  docker run "${args[@]}" "${IMAGE_NAME}" \
    "${uvicorn_cmd[@]}" >/dev/null

  ACTIVE_CONTAINER="${CONTAINER_NAME}"
}

follow_container_logs() {
  stop_log_follow
  docker logs -f --tail="${1:-50}" "${CONTAINER_NAME}" &
  LOG_FOLLOW_PID=$!
}

mkdir -p "${CACHE_DIR}" "${DOCKER_STATE_DIR}" "${ROOT_DIR}/tmp" "${ARTIFACTS_DIR}"
ensure_buildx
# Enhanced cache busting that includes architecture to prevent mismatched images
CURRENT_ARCH="$(uname -m)"
TOP_LOCK_HASH="$(hash_file requirements.lock)"
TOP_REQ_HASH="$(hash_file requirements.txt)"
SRV_REQ_HASH="$(hash_file cv_parser_service/requirements.txt)"
DOCKERFILE_HASH="$(hash_file cv_parser_service/Dockerfile)"
SELF_HASH="$(hash_file scripts/start-dev.sh)"
RUN_SH_HASH="$(hash_file run.sh)"
COMBINED_HASH="${TOP_LOCK_HASH}_${TOP_REQ_HASH}_${SRV_REQ_HASH}_${DOCKERFILE_HASH}_${SELF_HASH}_${RUN_SH_HASH}_${DOCKER_DEFAULT_PLATFORM}"
RUNTIME_CACHE_BUST="${COMBINED_HASH}"

build_deps_if_needed
build_runtime_image
ensure_paddle_volume
log "Ensuring Paddle cache temp directory is writable..."
timeout_prefix=()
if command -v timeout >/dev/null 2>&1; then
  timeout_prefix=(timeout 15s)
fi
if ! "${timeout_prefix[@]}" docker run --rm \
    --platform "${DOCKER_DEFAULT_PLATFORM}" \
    -v "${PADDLE_VOLUME}:/home/app/.paddlex" \
    "${IMAGE_NAME}" \
    bash -lc 'mkdir -p /home/app/.paddlex/tmp && chmod 777 /home/app/.paddlex /home/app/.paddlex/tmp'; then
  log "WARNING: paddle cache init skipped (timeout or error); container will create it on demand."
fi

REUSED_CONTAINER="false"
running_container_id="$(docker ps -q -f "name=^${CONTAINER_NAME}$")"
if [[ "${FORCE_REBUILD}" == "true" ]]; then
  stop_container_if_running
  remove_container_if_exists
elif [[ -n "${running_container_id}" ]]; then
  existing_signature="$(docker inspect -f '{{ index .Config.Labels "cvparser.ocr_sig"}}' "${CONTAINER_NAME}" 2>/dev/null || true)"
  existing_signature="${existing_signature//<no value>/}"
  existing_signature="${existing_signature:-}"
  if [[ "${existing_signature}" != "${OCR_SIGNATURE}" ]]; then
    log "OCR signature changed (current='${existing_signature:-unset}', desired='${OCR_SIGNATURE}'); recreating ${CONTAINER_NAME}."
    stop_container_if_running
    remove_container_if_exists
  elif check_service_health; then
    log "Reusing healthy container ${CONTAINER_NAME}."
    ACTIVE_CONTAINER="${CONTAINER_NAME}"
    REUSED_CONTAINER="true"
  else
    log "Existing container ${CONTAINER_NAME} not healthy; restarting."
    stop_container_if_running
    remove_container_if_exists
  fi
else
  remove_container_if_exists
fi

if [[ "${REUSED_CONTAINER}" != "true" ]]; then
  start_container
  # Quick import probe inside the container for immediate visibility
  log "Probing Python import state inside container (${CONTAINER_NAME}) (writing ${ARTIFACTS_DIR}/boot_probe.txt)..."
  "${ROOT_DIR}/scripts/probe_container.sh" "${CONTAINER_NAME}" | tee "${ARTIFACTS_DIR}/boot_probe.txt"
  if [[ "${SERVICE_ONLY}" == "true" ]]; then
    STOP_CONTAINER_ON_EXIT="false"
  else
    STOP_CONTAINER_ON_EXIT="true"
  fi
  follow_container_logs 100
  ready_probe_code="$(curl -s -o /dev/null -w '%{http_code}' "${HEALTH_URL}" 2>/dev/null || true)"
  if [[ "${ready_probe_code}" == "404" ]]; then
    log "Ready endpoint unavailable; falling back to ${HEALTH_FALLBACK_URL}"
    HEALTH_URL="${HEALTH_FALLBACK_URL}"
  fi
  if ! wait_for_health "${MAX_HEALTH_WAIT}"; then
    stop_log_follow
    log "ERROR: Parser service failed to become healthy after ${MAX_HEALTH_WAIT}s"
    if [[ -f "${ARTIFACTS_DIR}/boot_probe.txt" ]]; then
      log "Last lines of ${ARTIFACTS_DIR}/boot_probe.txt:"
      tail -n 40 "${ARTIFACTS_DIR}/boot_probe.txt" || true
    else
      log "WARNING: ${ARTIFACTS_DIR}/boot_probe.txt not found."
    fi
    log "Tail of container logs (120 lines):"
    docker logs --tail 120 "${CONTAINER_NAME}" || true
    exit 1
  fi
  stop_log_follow
else
  STOP_CONTAINER_ON_EXIT="false"
fi

if [[ "${SERVICE_ONLY}" == "true" ]]; then
  STOP_CONTAINER_ON_EXIT="false"
fi

log "Parser service healthy at ${PARSER_URL}"

rm -f "${TUNNEL_URL_FILE}"

if [[ ! -f "${TUNNEL_SCRIPT}" ]]; then
  if [[ "${SERVICE_ONLY}" == "true" && "${FORCE_TUNNEL}" != "true" ]]; then
    log "Parser tunnel script not found at ${TUNNEL_SCRIPT}; service-only mode will skip tunnel."
  else
    log "ERROR: Parser tunnel script not found at ${TUNNEL_SCRIPT}. Tunnel is required for this run."
    exit 1
  fi
fi

if [[ "${SERVICE_ONLY}" == "true" ]]; then
  printf '%s\n' "${LOCAL_PARSER_BASE}" > "${TUNNEL_URL_FILE}"
  log "Recorded local parser URL at ${TUNNEL_URL_FILE}"
  log "WARNING: Using local-only parser URL ${LOCAL_PARSER_BASE}; Convex cloud env unchanged."
  log "Service-only mode. Skipping Convex env sync."

  export CONVEX_PARSER_URL="${PARSER_URL}"
  export VITE_PARSER_URL="${PARSER_URL}"
  export VITE_CONVEX_PARSER_URL="${PARSER_URL}"
  log "Exported local CONVEX_PARSER_URL=${CONVEX_PARSER_URL}"
  if [[ "${TAIL_LOGS}" == "true" ]]; then
    log "Tailing logs (Ctrl+C to exit)..."
    docker logs -f "${CONTAINER_NAME}"
  else
    log "Parser service is running (logs not tailed)."
  fi
  exit 0
fi

external_origin_raw="${PARSER_ORIGIN:-${CONVEX_PARSER_URL:-}}"
external_origin="${external_origin_raw%/}"
should_skip_tunnel="0"
if [[ "${SKIP_TUNNEL:-0}" == "1" ]]; then
  should_skip_tunnel="1"
elif [[ -n "${external_origin}" && ! "${external_origin}" =~ trycloudflare\.com ]]; then
  should_skip_tunnel="1"
fi

if [[ "${should_skip_tunnel}" == "1" ]]; then
  TUNNEL_PID=""
  if [[ -n "${external_origin}" ]]; then
    log "Skipping tunnel setup; using external parser origin: ${external_origin}"
    printf '%s\n' "${external_origin}" > "${TUNNEL_URL_FILE}" 2>/dev/null || true
    if command -v npx >/dev/null 2>&1; then
      if [[ -n "${CONVEX_DEPLOYMENT:-}" ]]; then
        if npx --yes convex env set CONVEX_PARSER_URL "${external_origin}" --deployment "${CONVEX_DEPLOYMENT}" >/dev/null 2>&1; then
          log "Convex env set to ${external_origin}"
        else
          log "WARNING: Failed to sync Convex env with external origin"
        fi
      else
        if npx --yes convex env set CONVEX_PARSER_URL "${external_origin}" >/dev/null 2>&1; then
          log "Convex env set to ${external_origin}"
        else
          log "WARNING: Failed to sync Convex env with external origin"
        fi
      fi
    fi
    export CONVEX_PARSER_URL="${external_origin}"
    export VITE_PARSER_URL="${external_origin}"
    export VITE_CONVEX_PARSER_URL="${external_origin}"
    TUNNEL_URL="${external_origin}"
  else
    log "Skipping tunnel setup (SKIP_TUNNEL=1)."
    TUNNEL_URL=""
  fi
else
  log "Opening parser tunnel via Cloudflare..."
  if [[ "${DETACH_MODE}" == "true" ]]; then
    rm -f "${TUNNEL_LOG_FILE}"
    touch "${TUNNEL_LOG_FILE}"
    nohup node "${TUNNEL_SCRIPT}" >>"${TUNNEL_LOG_FILE}" 2>&1 &
  else
    node "${TUNNEL_SCRIPT}" &
  fi
  TUNNEL_PID=$!

  printf '[dev] Waiting for tunnel URL'
  for ((attempt=1; attempt<=MAX_TUNNEL_WAIT; attempt++)); do
    if [[ -s "${TUNNEL_URL_FILE}" ]]; then
      TUNNEL_URL="$(<"${TUNNEL_URL_FILE}")"
      TUNNEL_URL="${TUNNEL_URL//$'\r'/}"
      TUNNEL_URL="${TUNNEL_URL//$'\n'/}"
      if [[ -n "${TUNNEL_URL// }" ]]; then
        break
      fi
    fi
    if ! kill -0 "${TUNNEL_PID}" >/dev/null 2>&1; then
      echo
      log "Tunnel process exited early."
      exit 1
    fi
    printf '.'
    sleep 1
  done
  echo

  if [[ -z "${TUNNEL_URL// }" ]]; then
    log "Failed to read tunnel URL from ${TUNNEL_URL_FILE}"
    exit 1
  fi

  log "Tunnel established at ${TUNNEL_URL}"
  if [[ "${DETACH_MODE}" == "true" && -f "${TUNNEL_LOG_FILE}" ]]; then
    tail -n 50 "${TUNNEL_LOG_FILE}" | grep -m1 "tunnel established" | while read -r line; do
      [[ -n "${line}" ]] && log "[tunnel-log] ${line}"
    done || true
  fi

  if is_loopback "${TUNNEL_URL}"; then
    log "WARNING: Tunnel URL appears to be loopback (${TUNNEL_URL}); skipping Convex env sync."
  else
    if ! sync_convex_env "${TUNNEL_URL}"; then
      log "WARNING: Convex env sync failed; continuing with local environment variables only."
    fi
  fi

  export CONVEX_PARSER_URL="${TUNNEL_URL}"
  export VITE_PARSER_URL="${TUNNEL_URL}"
  export VITE_CONVEX_PARSER_URL="${TUNNEL_URL}"
  log "Tunnel started and Convex env updated: ${CONVEX_PARSER_URL}"
fi

if [[ "${SKIP_SMOKE:-0}" == "1" ]]; then
  log "Skipping structuredUpload smoke test (SKIP_SMOKE=1)."
else
  log "Running structuredUpload smoke test (logs -> ${STRUCTURED_LOG})"
  if ! (cd "${ROOT_DIR}/my-app" && npx convex run actions/structuredUpload:structuredUpload '{"rawText":"Codex automation smoke test resume line","mode":"text"}' | tee "${STRUCTURED_LOG}"); then
    log "WARNING: structuredUpload action failed. See ${STRUCTURED_LOG}."
  else
    grep -q '"diagnostics"' "${STRUCTURED_LOG}" >/dev/null 2>&1 || log "structuredUpload response recorded (no diagnostics key found)."
  fi
fi

log "Starting Vite frontend (Convex stays in cloud)"
VITE_LOG_FILE="${ROOT_DIR}/tmp/vite-dev.log"
rm -f "${VITE_LOG_FILE}"
touch "${VITE_LOG_FILE}"
if [[ "${DETACH_MODE}" == "true" ]]; then
  nohup bash -lc 'cd "$1" && npm run dev:frontend' _ "${ROOT_DIR}/my-app" >>"${VITE_LOG_FILE}" 2>&1 &
  VITE_PID=$!
else
  (cd "${ROOT_DIR}/my-app" && npm run dev:frontend) >>"${VITE_LOG_FILE}" 2>&1 &
  VITE_PID=$!
fi
log "Vite dev server (PID ${VITE_PID}) logs -> ${VITE_LOG_FILE}"
log "Frontend available at http://localhost:5173"

if [[ "${DETACH_MODE}" == "true" ]]; then
  {
    printf 'TUNNEL_PID=%s\n' "${TUNNEL_PID}"
    printf 'VITE_PID=%s\n' "${VITE_PID}"
    printf 'TUNNEL_URL=%s\n' "${TUNNEL_URL}"
    printf 'VITE_LOG_FILE=%s\n' "${VITE_LOG_FILE}"
    printf 'TUNNEL_LOG_FILE=%s\n' "${TUNNEL_LOG_FILE}"
  } > "${PID_STATE_FILE}"
  # Prevent EXIT trap from tearing down running services now that we're detached.
  trap - EXIT
  # Shield background processes from SIGHUP when this script exits.
  disown -h -- "${TUNNEL_PID}" 2>/dev/null || true
  disown -h -- "${VITE_PID}" 2>/dev/null || true
  log "Dev stack running in detached mode."
  log "Tunnel PID=${TUNNEL_PID}, Vite PID=${VITE_PID}."
  log "To stop services run: ./run.sh down"
  exit 0
fi

if [[ "${TAIL_LOGS}" == "true" ]]; then
  follow_container_logs 100
  tail -f "${VITE_LOG_FILE}" &
  VITE_LOG_TAIL_PID=$!
  wait "${VITE_PID}"
  status=$?
  exit "${status}"
else
  wait "${VITE_PID}"
  status=$?
  if [[ "${status}" -ne 0 ]]; then
    log "Vite dev server exited with status ${status}"
  fi
  exit "${status}"
fi
