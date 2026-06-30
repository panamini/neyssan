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
if [[ -f "${ROOT_DIR}/my-app/.env" ]]; then set -a; source "${ROOT_DIR}/my-app/.env"; set +a; fi
if [[ -f "${ROOT_DIR}/my-app/.env.local" ]]; then set -a; source "${ROOT_DIR}/my-app/.env.local"; set +a; fi

# Defaults
: "${PARSER_ORIGIN:=https://parser.dasti.ai}"   # Edge origin (Cloudflare Zero Trust)
: "${OPEN_BROWSER:=1}"                           # 1=open browser; 0=headless
: "${TUNNEL_NETWORK:=parsernet}"                 # Docker net for connector & parser
: "${PARSER_NAME:=cv-parser-service-dev}"        # Container name
: "${CLOUDFLARED_NAME:=cloudflared}"             # Tunnel container name
: "${IMAGE_NAME:=cv-parser-service:latest}"      # Runtime image
: "${FORCE_REBUILD:=false}"                      # Force runtime image rebuild
: "${PARSER_RUNTIME_MODE:=image}"                # image|workspace
: "${VITE_PORT:=5173}"                           # Vite desired port
: "${CF_ACCESS_CLIENT_ID:=}"                     # For probe-edge
: "${CF_ACCESS_CLIENT_SECRET:=}"                 # For probe-edge
: "${TUNNEL_TOKEN:=}"                            # For run.sh tunnel

STATE_DIR="${ROOT_DIR}/tmp/dev-stack"
STATE_FILE="${STATE_DIR}/pids.env"
LOG_DIR="${ROOT_DIR}/tmp"
RUN_LOG_FILE="${LOG_DIR}/run.log"
LOG_LEVEL="${LOG_LEVEL:-info}"
case "${LOG_LEVEL}" in
  debug|info|warn|error) ;;
  *) LOG_LEVEL="info" ;;
esac
VITE_LOG="${LOG_DIR}/vite-dev.log"
CONVEX_LOG="${LOG_DIR}/convex-dev.log"
LOCAL_CONVEX_URL="${LOCAL_CONVEX_URL:-}"
LOCAL_CONVEX_CLOUD_PORT="${LOCAL_CONVEX_CLOUD_PORT:-3210}"
LOCAL_CONVEX_SITE_PORT="${LOCAL_CONVEX_SITE_PORT:-3211}"
# Convex can spend well over 90s on a cold local start while bootstrapping
# indexes and bundling functions, so give local-fast a wider default window.
LOCAL_CONVEX_STARTUP_TIMEOUT="${LOCAL_CONVEX_STARTUP_TIMEOUT:-180}"
CONVEX_TMPDIR="${CONVEX_TMPDIR:-${ROOT_DIR}/tmp/convex-tmp}"
LOCAL_CONVEX_SYNC_SECRETS="${LOCAL_CONVEX_SYNC_SECRETS:-1}"
CACHE_DIR="${ROOT_DIR}/.buildx-cache"
DOCKER_STATE_DIR="${ROOT_DIR}/.docker"

mkdir -p "${STATE_DIR}" "${LOG_DIR}"
mkdir -p "${CONVEX_TMPDIR}"
mkdir -p "${CACHE_DIR}" "${DOCKER_STATE_DIR}"

# Auto-load Mistral key from file if not set
if [[ -z "${MISTRAL_API_KEY:-}" && -f "${HOME}/.mistral_key" ]]; then
  MISTRAL_API_KEY="$(<"${HOME}/.mistral_key")"
  MISTRAL_API_KEY="${MISTRAL_API_KEY//$'\r'/}"
  MISTRAL_API_KEY="${MISTRAL_API_KEY//$'\n'/}"
  export MISTRAL_API_KEY
fi

# ===== Helpers =====
log_timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

redact_log_line() {
  sed -E 's/([A-Za-z0-9_]*(KEY|SECRET|TOKEN|PASSWORD|PRIVATE)[A-Za-z0-9_]*=)[^[:space:]]+/\1[redacted]/g'
}

log_should_emit() {
  local level="${1:-info}"
  case "${LOG_LEVEL}:${level}" in
    debug:*) return 0 ;;
    info:debug) return 1 ;;
    info:*) return 0 ;;
    warn:debug|warn:info) return 1 ;;
    warn:*) return 0 ;;
    error:error) return 0 ;;
    error:*) return 1 ;;
    *) return 0 ;;
  esac
}

log_line() {
  local level="${1:?level required}"
  shift || true
  log_should_emit "${level}" || return 0

  local line
  line="[run] $(log_timestamp) ${level^^}: $*"
  line="$(printf '%s\n' "${line}" | redact_log_line)"

  case "${level}" in
    error|warn) printf '%s\n' "${line}" >&2 ;;
    *) printf '%s\n' "${line}" ;;
  esac
  printf '%s\n' "${line}" >> "${RUN_LOG_FILE}"
}

log_debug() { log_line debug "$@"; }
log_info() { log_line info "$@"; }
log_warn() { log_line warn "$@"; }
log_error() { log_line error "$@"; }

map_platform() {
  case "$(uname -m)" in
    x86_64|amd64) echo "linux/amd64" ;;
    arm64|aarch64) echo "linux/arm64" ;;
    *) echo "linux/$(uname -m)" ;;
  esac
}

to_bool() {
  case "$(echo "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) echo "true" ;;
    *) echo "false" ;;
  esac
}

normalize_origin() {
  local o="${1:-}"
  [[ -z "$o" ]] && { echo ""; return; }
  if [[ "$o" != http://* && "$o" != https://* ]]; then o="https://${o}"; fi
  o="${o%/}"
  echo "$o"
}

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

hash_string() {
  local value="${1:-}"
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "${value}" | sha256sum | awk '{print $1}'
  else
    printf '%s' "${value}" | shasum -a 256 | awk '{print $1}'
  fi
}

env_reload_hash() {
  local payload=""
  local file=""
  local env_files=(
    "${ROOT_DIR}/.env"
    "${ROOT_DIR}/.env.local"
    "${ROOT_DIR}/my-app/.env"
    "${ROOT_DIR}/my-app/.env.local"
  )
  for file in "${env_files[@]}"; do
    payload+="${file}:$(hash_file "${file}")"$'\n'
  done
  hash_string "${payload}"
}

convex_binding_hash() {
  local payload=""
  local file=""
  local line=""
  local candidate_files=(
    "${ROOT_DIR}/.env.local"
    "${ROOT_DIR}/.env"
    "${ROOT_DIR}/my-app/.env.local"
    "${ROOT_DIR}/my-app/.env"
  )
  for file in "${candidate_files[@]}"; do
    line=""
    if [[ -f "${file}" ]]; then
      line="$(grep -E '^(CONVEX_TEAM|CONVEX_TEAM_SLUG|CONVEX_PROJECT|CONVEX_PROJECT_SLUG|CONVEX_LOCAL_DEPLOYMENT_NAME|CONVEX_LOCAL_DEPLOYMENT|CONVEX_DEPLOYMENT)=' "${file}" | tail -n20 || true)"
    fi
    payload+="${file}:${line}"$'\n'
  done
  hash_string "${payload}"
}

ensure_buildx() {
  if ! docker buildx inspect >/dev/null 2>&1; then
    log_info "Configuring docker buildx builder"
    docker buildx create --name cvparser-builder --driver docker-container --use >/dev/null
    docker buildx inspect --bootstrap >/dev/null
  fi
}

build_runtime_image() {
  local runtime_dockerfile root_pkg root_lock app_pkg app_lock dockerignore sig last platform targetarch
  runtime_dockerfile="$(hash_file cv_parser_service/Dockerfile)"
  root_pkg="$(hash_file package.json)"
  root_lock="$(hash_file package-lock.json)"
  app_pkg="$(hash_file my-app/package.json)"
  app_lock="$(hash_file my-app/package-lock.json)"
  dockerignore="$(hash_file .dockerignore)"
  platform="$(map_platform)"
  targetarch="${platform##*/}"
  sig="${runtime_dockerfile}_${root_pkg}_${root_lock}_${app_pkg}_${app_lock}_${dockerignore}_${platform}"
  last="$(cat "${DOCKER_STATE_DIR}/last-runtime-hash" 2>/dev/null || true)"

  if [[ "$(to_bool "${FORCE_REBUILD}")" != "true" ]] && docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1 && [[ "${last}" == "${sig}" ]]; then
    log_info "Runtime image up-to-date (${IMAGE_NAME})"
    return 0
  fi

  ensure_buildx
  log_info "Building parser runtime image (${IMAGE_NAME}, ${platform})"
  DOCKER_BUILDKIT=1 docker buildx build \
    --platform "${platform}" \
    --build-arg TARGETARCH="${targetarch}" \
    --target runtime \
    --file cv_parser_service/Dockerfile \
    --cache-from=type=local,src="${CACHE_DIR}" \
    -t "${IMAGE_NAME}" \
    --load .
  printf '%s' "${sig}" > "${DOCKER_STATE_DIR}/last-runtime-hash"
}

ensure_runtime_image_exists() {
  if docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1; then
    log_info "Runtime image available (${IMAGE_NAME})"
    return 0
  fi
  log_info "Runtime image missing; building ${IMAGE_NAME}"
  build_runtime_image
}

kill_vite_ports() {
  # Kill any dev servers lingering on 5173–5215
  for p in $(seq 5173 5215); do
    # macOS & Linux-friendly lsof usage
    pids="$(lsof -ti tcp:$p -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      log_warn "Killing process(es) on :${p} -> ${pids}"
      kill -9 ${pids} || true
    fi
  done
}

write_state() {
  mkdir -p "${STATE_DIR}"
  {
    printf 'VITE_PID=%s\n' "${1:-}"
    printf 'PARSER_STARTED=%s\n' "${2:-0}"
    printf 'CONVEX_PID=%s\n' "${3:-}"
    printf 'CONVEX_URL=%s\n' "${4:-}"
    printf 'TUNNEL_STARTED=%s\n' "${5:-0}"
    printf 'STACK_MODE=%s\n' "${6:-}"
    printf 'ACTIVE_ORIGIN=%s\n' "${7:-}"
    printf 'PARSER_RUNTIME_MODE=%s\n' "${8:-}"
    printf 'PARSER_RELOAD=%s\n' "${9:-0}"
    printf 'PARSER_OCR=%s\n' "${10:-auto}"
    printf 'CONVEX_MODE=%s\n' "${11:-cloud}"
    printf 'UI_STARTED=%s\n' "${12:-0}"
    printf 'ENV_HASH=%s\n' "${13:-}"
    printf 'CONVEX_BINDING_HASH=%s\n' "${14:-}"
  } > "${STATE_FILE}"
}

write_current_state() {
  write_state \
    "${1:-}" \
    "${2:-0}" \
    "${3:-}" \
    "${4:-}" \
    "${5:-0}" \
    "${6:-}" \
    "${7:-}" \
    "${8:-}" \
    "${9:-0}" \
    "${10:-auto}" \
    "${11:-cloud}" \
    "${12:-0}" \
    "$(env_reload_hash)" \
    "$(convex_binding_hash)"
}

read_state() {
  [[ -f "${STATE_FILE}" ]] || return 0
  while IFS='=' read -r k v; do
    case "$k" in
      VITE_PID) VITE_PID="$v" ;;
      PARSER_STARTED) PARSER_STARTED="$v" ;;
      CONVEX_PID) CONVEX_PID="$v" ;;
      CONVEX_URL) CONVEX_URL="$v" ;;
      TUNNEL_STARTED) TUNNEL_STARTED="$v" ;;
      STACK_MODE) STACK_MODE="$v" ;;
      ACTIVE_ORIGIN) ACTIVE_ORIGIN="$v" ;;
      PARSER_RUNTIME_MODE) PARSER_RUNTIME_MODE="$v" ;;
      PARSER_RELOAD) PARSER_RELOAD="$v" ;;
      PARSER_OCR) PARSER_OCR="$v" ;;
      CONVEX_MODE) CONVEX_MODE="$v" ;;
      UI_STARTED) UI_STARTED="$v" ;;
      ENV_HASH) ENV_HASH="$v" ;;
      CONVEX_BINDING_HASH) CONVEX_BINDING_HASH="$v" ;;
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

parser_uses_workspace_mount() {
  local mounts=""
  mounts="$(docker inspect "${PARSER_NAME}" --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}' 2>/dev/null || true)"
  grep -Fq "${ROOT_DIR} -> /app" <<<"${mounts}"
}

parser_runtime_mode() {
  if parser_uses_workspace_mount; then
    echo "workspace"
  else
    echo "image"
  fi
}

parser_ocr_mode() {
  local env_value=""
  env_value="$(docker inspect "${PARSER_NAME}" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -E '^CV_OCR_ENGINE=' | tail -n1 | cut -d= -f2- || true)"
  if [[ -n "${env_value}" ]]; then
    echo "${env_value}"
  else
    echo "auto"
  fi
}

parser_image_id() {
  docker inspect "${PARSER_NAME}" --format '{{.Image}}' 2>/dev/null || true
}

target_image_id() {
  docker image inspect "${IMAGE_NAME}" --format '{{.Id}}' 2>/dev/null || true
}

print_command_banner() {
  cat <<'EOF'

Commands:
  ./run.sh tunnel          stable full workflow
  ./run.sh local-fast      fast full-app parser development
  ./run.sh parser-dev      parser-only hacking
  ./run.sh reload-env      restart-only refresh after env changes
  ./run.sh rebuild-docker  rebuild runtime / Docker stack
  ./run.sh down            normal stop
  ./run.sh reset           stronger cleanup
  ./run.sh status          quick stack status
  ./run.sh logs            service logs
EOF
}

state_requests_local_convex() {
  [[ "${CONVEX_MODE:-cloud}" == "local" ]]
}

state_requests_ui() {
  [[ "${UI_STARTED:-0}" == "1" ]]
}

state_requests_tunnel() {
  [[ "${TUNNEL_STARTED:-0}" == "1" ]]
}

parser_container_running() {
  docker ps --format '{{.Names}}' | grep -qx "${PARSER_NAME}"
}

tunnel_container_running() {
  docker ps --format '{{.Names}}' | grep -qx "${CLOUDFLARED_NAME}"
}

vite_process_running() {
  [[ -n "${VITE_PID:-}" ]] && kill -0 "${VITE_PID}" >/dev/null 2>&1
}

convex_process_running() {
  [[ -n "${CONVEX_PID:-}" ]] && kill -0 "${CONVEX_PID}" >/dev/null 2>&1 && [[ -n "${CONVEX_URL:-}" ]] && is_convex_ready "${CONVEX_URL}"
}

tracked_stack_is_live() {
  if [[ "${PARSER_STARTED:-0}" == "1" ]] && ! parser_container_running; then
    return 1
  fi
  if state_requests_ui && ! vite_process_running; then
    return 1
  fi
  if state_requests_local_convex && ! convex_process_running; then
    return 1
  fi
  if state_requests_tunnel && ! tunnel_container_running; then
    return 1
  fi
  return 0
}

handle_existing_stack_request() {
  local requested_stack_mode="${1:-}"
  local requested_active_origin="${2:-}"
  local requested_runtime_mode="${3:-image}"
  local requested_parser_reload="${4:-0}"
  local requested_parser_ocr="${5:-auto}"
  local requested_convex_mode="${6:-cloud}"
  local requested_ui_started="${7:-0}"
  local requested_tunnel_started="${8:-0}"
  local VITE_PID=""; local PARSER_STARTED="0"; local CONVEX_PID=""; local CONVEX_URL=""; local TUNNEL_STARTED="0"; local STACK_MODE=""
  local ACTIVE_ORIGIN=""; local PARSER_RUNTIME_MODE=""; local PARSER_RELOAD="0"; local PARSER_OCR="auto"; local CONVEX_MODE="cloud"; local UI_STARTED="0"; local ENV_HASH=""; local CONVEX_BINDING_HASH=""

  read_state
  [[ -n "${STACK_MODE:-}" ]] || return 1
  [[ "${STACK_MODE}" == "${requested_stack_mode}" ]] || return 1
  [[ "${ACTIVE_ORIGIN:-}" == "${requested_active_origin}" ]] || return 1
  [[ "${PARSER_RUNTIME_MODE:-}" == "${requested_runtime_mode}" ]] || return 1
  [[ "${PARSER_RELOAD:-0}" == "${requested_parser_reload}" ]] || return 1
  [[ "${PARSER_OCR:-auto}" == "${requested_parser_ocr}" ]] || return 1
  [[ "${CONVEX_MODE:-cloud}" == "${requested_convex_mode}" ]] || return 1
  [[ "${UI_STARTED:-0}" == "${requested_ui_started}" ]] || return 1
  [[ "${TUNNEL_STARTED:-0}" == "${requested_tunnel_started}" ]] || return 1
  tracked_stack_is_live || return 1

  if [[ "${ENV_HASH:-}" != "$(env_reload_hash)" || "${CONVEX_BINDING_HASH:-}" != "$(convex_binding_hash)" ]]; then
    log_info "Detected env change for active ${requested_stack_mode} stack; reloading without Docker rebuild"
    reload_env_stack
  else
    log_info "${requested_stack_mode} already matches current env; nothing to do"
  fi
  return 0
}

ensure_workspace_runtime_surface() {
  local diagnostic=""
  diagnostic="$(
    docker exec "${PARSER_NAME}" node -e 'const fs = require("fs"); const platformTag = `${process.platform}-${process.arch}`; const checks = [["tsx loader", "/app/my-app/node_modules/tsx/dist/esm/index.mjs"], ["playwright package", "/app/node_modules/playwright"], ["playwright browsers", "/ms-playwright"], [`esbuild package (${platformTag})`, `/app/my-app/node_modules/@esbuild/${platformTag}`]]; const missing = checks.filter(([, path]) => !fs.existsSync(path)); if (missing.length) { console.error(missing.map(([label, path]) => `${label}: ${path}`).join("\n")); process.exit(1); }' 2>&1
  )" || {
    log_error "Workspace parser runtime is missing export dependencies."
    if [[ -n "${diagnostic}" ]]; then
      while IFS= read -r diagnostic_line; do
        log_error "${diagnostic_line}"
      done <<< "${diagnostic}"
    fi
    log_error "Run \`./run.sh rebuild-docker\` to refresh the parser/export runtime image, then retry \`./run.sh local-fast\`."
    docker stop "${PARSER_NAME}" >/dev/null 2>&1 || true
    exit 1
  }
}

resolve_convex_project_binding() {
  local candidate_files=(
    "${ROOT_DIR}/.env.local"
    "${ROOT_DIR}/.env"
    "${ROOT_DIR}/my-app/.env.local"
    "${ROOT_DIR}/my-app/.env"
  )
  local file=""
  local line=""
  local env_team="${CONVEX_TEAM:-${CONVEX_TEAM_SLUG:-}}"
  local env_project="${CONVEX_PROJECT:-${CONVEX_PROJECT_SLUG:-}}"
  local env_deployment="${CONVEX_LOCAL_DEPLOYMENT_NAME:-${CONVEX_LOCAL_DEPLOYMENT:-${CONVEX_DEPLOYMENT:-}}}"
  dotenv_value_from_file() {
    local dotenv_file="${1:-}"
    local dotenv_key="${2:-}"
    local dotenv_line=""
    local dotenv_value=""
    [[ -n "${dotenv_file}" && -n "${dotenv_key}" && -f "${dotenv_file}" ]] || return 1
    dotenv_line="$(grep -E "^${dotenv_key}=" "${dotenv_file}" | tail -n1 || true)"
    [[ -n "${dotenv_line}" ]] || return 1
    dotenv_value="${dotenv_line#*=}"
    dotenv_value="${dotenv_value%%#*}"
    dotenv_value="${dotenv_value//\"/}"
    dotenv_value="${dotenv_value//\'/}"
    dotenv_value="$(printf '%s' "${dotenv_value}" | xargs)"
    [[ -n "${dotenv_value}" ]] || return 1
    printf '%s' "${dotenv_value}"
  }

  for file in "${candidate_files[@]}"; do
    [[ -f "${file}" ]] || continue
    [[ -n "${env_team}" ]] || env_team="$(dotenv_value_from_file "${file}" CONVEX_TEAM || true)"
    [[ -n "${env_team}" ]] || env_team="$(dotenv_value_from_file "${file}" CONVEX_TEAM_SLUG || true)"
    [[ -n "${env_project}" ]] || env_project="$(dotenv_value_from_file "${file}" CONVEX_PROJECT || true)"
    [[ -n "${env_project}" ]] || env_project="$(dotenv_value_from_file "${file}" CONVEX_PROJECT_SLUG || true)"
    [[ -n "${env_deployment}" ]] || env_deployment="$(dotenv_value_from_file "${file}" CONVEX_LOCAL_DEPLOYMENT_NAME || true)"
    [[ -n "${env_deployment}" ]] || env_deployment="$(dotenv_value_from_file "${file}" CONVEX_LOCAL_DEPLOYMENT || true)"
    [[ -n "${env_deployment}" ]] || env_deployment="$(dotenv_value_from_file "${file}" CONVEX_DEPLOYMENT || true)"
  done

  if [[ -n "${env_team}" && -n "${env_project}" ]]; then
    CONVEX_TEAM_RESULT="${env_team}"
    CONVEX_PROJECT_RESULT="${env_project}"
    if [[ "${env_deployment}" =~ ^local:(.+)$ ]]; then
      CONVEX_DEPLOYMENT_NAME_RESULT="${BASH_REMATCH[1]}"
    elif [[ "${env_deployment}" =~ ^local-.+ ]]; then
      CONVEX_DEPLOYMENT_NAME_RESULT="${env_deployment}"
    elif [[ -f "${HOME}/.convex/convex-backend-state/local-${env_team}-${env_project}/config.json" ]]; then
      CONVEX_DEPLOYMENT_NAME_RESULT="local-${env_team}-${env_project}"
    else
      CONVEX_DEPLOYMENT_NAME_RESULT=""
    fi
    return 0
  fi

  for file in "${candidate_files[@]}"; do
    [[ -f "${file}" ]] || continue
    line="$(grep -E '^CONVEX_DEPLOYMENT=.*# team: [^,]+, project: [^[:space:]]+' "${file}" | tail -n1 || true)"
    if [[ -n "${line}" ]]; then
      if [[ "${line}" =~ \#\ team:\ ([^,]+),\ project:\ ([^[:space:]]+) ]]; then
        CONVEX_TEAM_RESULT="${BASH_REMATCH[1]}"
        CONVEX_PROJECT_RESULT="${BASH_REMATCH[2]}"
        if [[ "${line}" =~ ^CONVEX_DEPLOYMENT=local:([^[:space:]#]+) ]]; then
          CONVEX_DEPLOYMENT_NAME_RESULT="${BASH_REMATCH[1]}"
        else
          CONVEX_DEPLOYMENT_NAME_RESULT=""
        fi
        return 0
      fi
    fi
  done
  local local_state_root="${HOME}/.convex/convex-backend-state"
  local local_configs=()
  if [[ -d "${local_state_root}" ]]; then
    while IFS= read -r config_file; do
      local_configs+=("${config_file}")
    done < <(find "${local_state_root}" -mindepth 2 -maxdepth 2 -path "${local_state_root}/local-*/config.json" -print 2>/dev/null)
  fi
  if [[ "${#local_configs[@]}" -eq 1 ]]; then
    local deployment_dir
    local deployment_name
    deployment_dir="$(dirname "${local_configs[0]}")"
    deployment_name="$(basename "${deployment_dir}")"
    if [[ "${deployment_name}" =~ ^local-([^-]+)-(.+)$ ]]; then
      CONVEX_TEAM_RESULT="${BASH_REMATCH[1]}"
      CONVEX_PROJECT_RESULT="${BASH_REMATCH[2]}"
      CONVEX_DEPLOYMENT_NAME_RESULT="${deployment_name}"
      return 0
    fi
  fi
  return 1
}

json_number_field() {
  local file="${1:-}"
  local field="${2:-}"
  [[ -n "${file}" && -n "${field}" && -f "${file}" ]] || return 1
  grep -Eo "\"${field}\":[0-9]+" "${file}" | head -n1 | cut -d: -f2
}

local_convex_deployments_disabled() {
  local config_file="${HOME}/.convex/config.json"
  [[ -f "${config_file}" ]] || return 1
  grep -Eq '"optOutOfLocalDevDeploymentsUntilBetaOver"[[:space:]]*:[[:space:]]*true' "${config_file}"
}

resolve_local_convex_runtime() {
  local deployment_name="${1:-}"
  LOCAL_CONVEX_STATE_CONFIG_RESULT=""
  LOCAL_CONVEX_CLOUD_PORT_RESULT="${LOCAL_CONVEX_CLOUD_PORT}"
  LOCAL_CONVEX_SITE_PORT_RESULT="${LOCAL_CONVEX_SITE_PORT}"

  if [[ -n "${deployment_name}" ]]; then
    local config_file="${HOME}/.convex/convex-backend-state/${deployment_name}/config.json"
    if [[ -f "${config_file}" ]]; then
      LOCAL_CONVEX_STATE_CONFIG_RESULT="${config_file}"
      LOCAL_CONVEX_CLOUD_PORT_RESULT="$(json_number_field "${config_file}" cloud || true)"
      LOCAL_CONVEX_SITE_PORT_RESULT="$(json_number_field "${config_file}" site || true)"
      [[ -n "${LOCAL_CONVEX_CLOUD_PORT_RESULT}" ]] || LOCAL_CONVEX_CLOUD_PORT_RESULT="${LOCAL_CONVEX_CLOUD_PORT}"
      [[ -n "${LOCAL_CONVEX_SITE_PORT_RESULT}" ]] || LOCAL_CONVEX_SITE_PORT_RESULT="${LOCAL_CONVEX_SITE_PORT}"
    fi
  fi

  if [[ -n "${LOCAL_CONVEX_URL}" ]]; then
    LOCAL_CONVEX_URL_RESULT="${LOCAL_CONVEX_URL}"
  else
    LOCAL_CONVEX_URL_RESULT="http://127.0.0.1:${LOCAL_CONVEX_CLOUD_PORT_RESULT}"
  fi
}

local_convex_instance_name() {
  local url="${1:-}"
  [[ -n "${url}" ]] || return 1
  curl -fsS "${url}/instance_name" 2>/dev/null || true
}

port_listener_details() {
  local port="${1:-}"
  [[ -n "${port}" ]] || return 1
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
}

ensure_local_convex_preflight() {
  local deployment_name="${1:-}"
  local convex_url="${2:-}"
  local cloud_port="${3:-}"
  local site_port="${4:-}"

  if local_convex_deployments_disabled; then
    log_error "Convex local deployments are disabled on this machine."
    log_error "  Run \`cd my-app && npx convex disable-local-deployments --undo-global\` and retry local-fast."
    exit 1
  fi

  local active_name=""
  active_name="$(local_convex_instance_name "${convex_url}")"
  if [[ -n "${active_name}" ]]; then
    if [[ -n "${deployment_name}" && "${active_name}" != "${deployment_name}" ]]; then
      log_error "A different local Convex backend (${active_name}) is already running at ${convex_url}."
      log_error "  Use ./run.sh down or ./run.sh reset for this repo, or stop the conflicting backend before retrying."
      exit 1
    fi
    log_error "Local Convex backend ${active_name} is already running at ${convex_url}, but it is not tracked by this run.sh state."
    log_error "  Stop it with ./run.sh reset or terminate the existing \`convex dev\` process before retrying."
    exit 1
  fi

  local cloud_listener=""
  local site_listener=""
  cloud_listener="$(port_listener_details "${cloud_port}")"
  if [[ -n "${cloud_listener}" ]]; then
    log_error "Local Convex cloud port ${cloud_port} is already occupied by a non-Convex listener."
    exit 1
  fi
  site_listener="$(port_listener_details "${site_port}")"
  if [[ -n "${site_listener}" ]]; then
    log_error "Local Convex site port ${site_port} is already occupied by another listener."
    exit 1
  fi
}

reuse_running_local_convex_from_state() {
  local expected_name="${1:-}"
  local VITE_PID=""; local PARSER_STARTED="0"; local CONVEX_PID=""; local CONVEX_URL=""; local TUNNEL_STARTED="0"; local STACK_MODE=""
  read_state

  if [[ -z "${CONVEX_PID:-}" || -z "${CONVEX_URL:-}" ]]; then
    return 1
  fi
  if ! kill -0 "${CONVEX_PID}" >/dev/null 2>&1; then
    return 1
  fi
  if ! is_convex_ready "${CONVEX_URL}"; then
    return 1
  fi

  local active_name=""
  active_name="$(local_convex_instance_name "${CONVEX_URL}")"
  if [[ -n "${expected_name}" && -n "${active_name}" && "${active_name}" != "${expected_name}" ]]; then
    return 1
  fi

  log_info "Reusing tracked local Convex backend ${active_name:-unknown} at ${CONVEX_URL}"
  CONVEX_PID_RESULT="${CONVEX_PID}"
  CONVEX_URL_RESULT="${CONVEX_URL}"
  return 0
}

sync_local_convex_env() {
  local -a env_names=(
    API_ENABLE_MISTRAL_OCR
    CF_ACCESS_CLIENT_ID
    CF_ACCESS_CLIENT_SECRET
    CLERK_JWT_ISSUER_DOMAIN
    CLIENT_ORIGIN_WHITELIST
    CONVEX_PARSER_URL
    COVER_LETTER_PREMIUM_PATH_V1
    DEV_NO_LLM
    ENABLE_COVER_LETTER_PREMIUM_PATH_V1
    ENABLE_NER
    EXTENSION_ORIGIN
    DEEPSEEK_API_KEY
    DEEPSEEK_CHAT_COMPLETIONS_URL
    MISTRAL_API_KEY
    NER_SERVICE_KEY
    NER_SERVICE_URL
    OPENAI_API_KEY
    QWEN_API_KEY
    QWEN_CHAT_COMPLETIONS_URL
    STRUCTURED_UPLOAD_DEBUG
    STRUCTURED_UPLOAD_SKIP_HEALTHCHECK
    STRUCTURED_UPLOAD_STRICT
    STRUCTURED_UPLOAD_USE_CF_ACCESS
    UI_ENABLE_MISTRAL_OCR
    VITE_CLERK_PUBLISHABLE_KEY
    VITE_PUBLIC_CLERK_PUBLISHABLE_KEY
    VITE_UI_ENABLE_MISTRAL_OCR
    cover_letter_premium_path_v1
  )
  local name=""
  local value=""
  log_info "Syncing local Convex env"
  (
    cd "${ROOT_DIR}/my-app"
    local convex_bin="./node_modules/.bin/convex"
    if [[ ! -x "${convex_bin}" ]]; then
      log_error "Missing Convex CLI at ${ROOT_DIR}/my-app/${convex_bin}"
      exit 1
    fi
    unset CONVEX_DEPLOYMENT
    unset CONVEX_DEPLOY_KEY
    unset CONVEX_SELF_HOSTED_URL
    unset CONVEX_SELF_HOSTED_ADMIN_KEY
    export CONVEX_TMPDIR="${CONVEX_TMPDIR}"
    if [[ -z "${CONVEX_DEPLOYMENT_NAME_RESULT:-}" ]]; then
      resolve_convex_project_binding >/dev/null 2>&1 || true
    fi
    local convex_env_deployment_name="${CONVEX_DEPLOYMENT_NAME_RESULT:-}"
    if [[ -n "${convex_env_deployment_name}" ]]; then
      resolve_local_convex_runtime "${convex_env_deployment_name}" >/dev/null 2>&1 || true
    fi
    local convex_env_url="${CONVEX_URL_RESULT:-}"
    local convex_env_admin_key=""
    if [[ -z "${convex_env_url}" ]]; then
      convex_env_url="$(discover_local_convex_url)"
    fi
    if [[ -n "${LOCAL_CONVEX_STATE_CONFIG_RESULT:-}" && -f "${LOCAL_CONVEX_STATE_CONFIG_RESULT}" ]]; then
      convex_env_admin_key="$(
        node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).adminKey || "")' "${LOCAL_CONVEX_STATE_CONFIG_RESULT}"
      )"
    fi
    for name in "${env_names[@]}"; do
      if [[ "${name}" == "CONVEX_PARSER_URL" ]]; then
        value="http://127.0.0.1:8001"
      else
        value="${!name:-}"
      fi
      [[ -n "${value}" ]] || continue
      if [[ "$(to_bool "${LOCAL_CONVEX_SYNC_SECRETS}")" != "true" ]]; then
        case "${name}" in
          *API_KEY|*SECRET|*_TOKEN|NER_SERVICE_KEY)
            log_debug "Skipping secret env sync for ${name}"
            continue
            ;;
        esac
      fi
      if [[ -n "${convex_env_url}" && -n "${convex_env_admin_key}" ]]; then
        CONVEX_SELF_HOSTED_URL="${convex_env_url}" CONVEX_SELF_HOSTED_ADMIN_KEY="${convex_env_admin_key}" "${convex_bin}" env set "${name}" "${value}" >/dev/null
      elif [[ -n "${convex_env_deployment_name}" ]]; then
        CONVEX_DEPLOYMENT="local:${convex_env_deployment_name}" "${convex_bin}" env set "${name}" "${value}" >/dev/null
      else
        "${convex_bin}" env set "${name}" "${value}" >/dev/null
      fi
    done
  ) >> "${CONVEX_LOG}" 2>&1
}

# ===== Parser (Docker) =====
start_parser() {
  local OCR="${1:-auto}"           # auto|doctr|paddle|disabled
  local RUNTIME_MODE="${2:-${PARSER_RUNTIME_MODE}}"
  local RELOAD="${3:-0}"
  local PLATFORM; PLATFORM="$(map_platform)"
  local PARSER_NEEDS_START=1

  if docker ps --format '{{.Names}}' | grep -qx "${PARSER_NAME}"; then
    local current_mode current_image target_image
    current_mode="$(parser_runtime_mode)"
    current_image="$(parser_image_id)"
    target_image="$(target_image_id)"
    if [[ "${current_mode}" == "${RUNTIME_MODE}" && ( "${RUNTIME_MODE}" == "workspace" || "${current_image}" == "${target_image}" ) ]]; then
      log_info "Parser already running in ${current_mode} runtime: ${PARSER_NAME}"
      PARSER_NEEDS_START=0
    else
      log_info "Replacing stale parser runtime: ${PARSER_NAME} (have ${current_mode}/${current_image}, want ${RUNTIME_MODE}/${target_image})"
      docker stop "${PARSER_NAME}" >/dev/null 2>&1 || true
    fi
  fi

  if [[ "${PARSER_NEEDS_START}" -eq 1 ]]; then
    log_info "Starting parser (${IMAGE_NAME}, runtime=${RUNTIME_MODE}, OCR=${OCR})"
    local -a envs=(
      -e MALLOC_ARENA_MAX=2
      -e OMP_NUM_THREADS=1
      -e PYTHONPATH=/app
    )
    local -a mounts=()
    if [[ "${RUNTIME_MODE}" == "workspace" ]]; then
      mounts=(
        -v "${ROOT_DIR}:/app"
        -v /app/node_modules
        -v /app/my-app/node_modules
      )
    fi
    # Map OCR flag to container env
    case "${OCR}" in
      doctr)    envs+=(-e CV_OCR_ENGINE=doctr   -e OCR_ENGINE=doctr   -e API_ENABLE_MISTRAL_OCR=) ;;
      paddle)   envs+=(-e CV_OCR_ENGINE=paddle  -e OCR_ENGINE=paddle) ;;
      disabled) envs+=(-e CV_OCR_ENGINE=disabled -e OCR_ENGINE=disabled -e API_ENABLE_MISTRAL_OCR=) ;;
      auto|*)   envs+=(-e CV_OCR_ENGINE=auto    -e OCR_ENGINE=auto) ;;
    esac
    # Enable Mistral OCR automatically if key present, unless secret sync is disabled.
    if [[ "$(to_bool "${LOCAL_CONVEX_SYNC_SECRETS}")" == "true" && -n "${MISTRAL_API_KEY:-}" ]]; then
      envs+=(-e API_ENABLE_MISTRAL_OCR=1 -e "MISTRAL_API_KEY=${MISTRAL_API_KEY}")
    fi

    # Run container
    remove_parser_container
    if [[ "${RUNTIME_MODE}" == "workspace" ]]; then
      docker run -d --rm \
        --name "${PARSER_NAME}" \
        --platform "${PLATFORM}" \
        -p 8001:8001 \
        "${mounts[@]}" \
        "${envs[@]}" \
        "${IMAGE_NAME}" \
        /opt/venv/bin/python -m uvicorn --app-dir /app cv_parser_service.main:app \
        --host 0.0.0.0 --port 8001 --http h11 \
        $( [[ "${RELOAD}" == "1" ]] && printf '%s' '--reload' || printf '%s' '--workers 1' ) \
        --timeout-keep-alive 5 --timeout-graceful-shutdown 5 --limit-concurrency 64 >/dev/null
    else
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
  fi

  # Wait for healthy
  printf "[run] waiting for http://127.0.0.1:8001/ready"
  for i in $(seq 1 45); do
    if curl -fsS http://127.0.0.1:8001/ready >/dev/null 2>&1; then echo; break; fi
    printf "."
    sleep 1
    if [[ "$i" -eq 45 ]]; then
      echo
      log_error "Parser failed health check"
      exit 1
    fi
  done

  if [[ "${RUNTIME_MODE}" == "workspace" ]]; then
    ensure_workspace_runtime_surface
  fi

  # Make sure connector net can reach it
  if ! ensure_parsernet; then
    log_warn "Parser not reachable inside ${TUNNEL_NETWORK} (continuing)."
  fi
}

remove_parser_container() {
  for _ in $(seq 1 10); do
    if ! docker container inspect "${PARSER_NAME}" >/dev/null 2>&1; then
      return 0
    fi
    docker rm -f "${PARSER_NAME}" >/dev/null 2>&1 || true
    sleep 0.5
  done
  log_error "Could not remove stale parser container ${PARSER_NAME}"
  docker ps -a --filter "name=${PARSER_NAME}" >&2 || true
  exit 1
}

stop_parser() {
  if docker ps --format '{{.Names}}' | grep -qx "${PARSER_NAME}"; then
    log_info "Stopping parser (${PARSER_NAME})"
    docker stop "${PARSER_NAME}" >/dev/null 2>&1 || true
    remove_parser_container
  fi
}

start_tunnel() {
  if [[ -z "${TUNNEL_TOKEN}" ]]; then
    log_error "TUNNEL_TOKEN is required for tunnel mode"
    exit 1
  fi
  docker network create "${TUNNEL_NETWORK}" >/dev/null 2>&1 || true
  docker rm -f "${CLOUDFLARED_NAME}" >/dev/null 2>&1 || true
  log_info "Starting cloudflared (${CLOUDFLARED_NAME})"
  docker run -d --name "${CLOUDFLARED_NAME}" --restart=unless-stopped \
    --network "${TUNNEL_NETWORK}" \
    cloudflare/cloudflared:latest \
    --loglevel debug tunnel --no-autoupdate run --protocol auto \
    --token "${TUNNEL_TOKEN}" >/dev/null
  sleep 2
}

stop_tunnel() {
  if docker ps --format '{{.Names}}' | grep -qx "${CLOUDFLARED_NAME}"; then
    log_info "Stopping tunnel (${CLOUDFLARED_NAME})"
    docker stop "${CLOUDFLARED_NAME}" >/dev/null 2>&1 || true
  fi
}

kill_stale_convex() {
  local pids=""
  pids="$(pgrep -f 'node .*/node_modules/\.bin/convex dev|npm exec convex dev|convex-local-backend .*--instance-name' 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    log_warn "Killing stale Convex process(es): ${pids}"
    kill ${pids} >/dev/null 2>&1 || true
    sleep 1
    pids="$(pgrep -f 'node .*/node_modules/\.bin/convex dev|npm exec convex dev|convex-local-backend .*--instance-name' 2>/dev/null || true)"
    [[ -n "${pids}" ]] && kill -9 ${pids} >/dev/null 2>&1 || true
  fi
}

clear_dev_state() {
  rm -f "${STATE_FILE}" "${STATE_DIR}/"*.pid 2>/dev/null || true
  rm -f "${VITE_LOG}" "${CONVEX_LOG}" "${LOG_DIR}/structured_upload.log" 2>/dev/null || true
  rm -rf "${CONVEX_TMPDIR}/"* 2>/dev/null || true
}

is_convex_ready() {
  local url="${1:-}"
  [[ -z "${url}" ]] && return 1
  node -e '
const http = require("node:http");
const url = `${process.argv[1].replace(/\/$/, "")}/instance_name`;
const req = http.get(url, (res) => {
  res.resume();
  res.on("end", () => process.exit(res.statusCode === 200 ? 0 : 1));
});
req.on("error", () => process.exit(1));
req.setTimeout(1000, () => {
  req.destroy();
  process.exit(1);
});
' "${url}" >/dev/null 2>&1
}

discover_local_convex_url() {
  if [[ -n "${LOCAL_CONVEX_URL}" ]]; then
    echo "${LOCAL_CONVEX_URL}"
    return 0
  fi

  if [[ -z "${CONVEX_DEPLOYMENT_NAME_RESULT:-}" ]]; then
    resolve_convex_project_binding >/dev/null 2>&1 || true
  fi
  local deployment_name="${CONVEX_DEPLOYMENT_NAME_RESULT:-}"
  resolve_local_convex_runtime "${deployment_name}"
  if [[ -n "${LOCAL_CONVEX_URL_RESULT:-}" ]]; then
    echo "${LOCAL_CONVEX_URL_RESULT}"
    return 0
  fi

  if [[ -f "${CONVEX_LOG}" ]]; then
    local explicit_url
    explicit_url="$(grep -Eo 'http://127\.0\.0\.1:[0-9]+' "${CONVEX_LOG}" | tail -n1 || true)"
    if [[ -n "${explicit_url}" ]]; then
      echo "${explicit_url}"
      return 0
    fi

    local port
    port="$(grep -Eo -- '--port [0-9]+' "${CONVEX_LOG}" | awk '{print $2}' | tail -n1 || true)"
    if [[ -n "${port}" ]]; then
      echo "http://127.0.0.1:${port}"
      return 0
    fi
  fi

  echo "http://127.0.0.1:${LOCAL_CONVEX_CLOUD_PORT}"
  return 0
}

start_convex() {
  CONVEX_PID_RESULT=""
  CONVEX_URL_RESULT=""

  local convex_team=""
  local convex_project=""
  if ! resolve_convex_project_binding; then
    log_error "Could not determine Convex team/project for local-fast."
    log_error "  Add the non-secret Convex binding to .env.local or my-app/.env.local:"
    log_error "  CONVEX_TEAM=<team_slug>"
    log_error "  CONVEX_PROJECT=<project_slug>"
    log_error "  Optional if you already have a named local deployment:"
    log_error "    CONVEX_DEPLOYMENT=local:<deployment_name>"
    log_error "  Legacy Convex CLI comments are still accepted: CONVEX_DEPLOYMENT=... # team: <team>, project: <project>"
    exit 1
  fi
  convex_team="${CONVEX_TEAM_RESULT}"
  convex_project="${CONVEX_PROJECT_RESULT}"
  local convex_deployment_name="${CONVEX_DEPLOYMENT_NAME_RESULT:-}"
  resolve_local_convex_runtime "${convex_deployment_name}"
  local convex_cloud_port="${LOCAL_CONVEX_CLOUD_PORT_RESULT:-${LOCAL_CONVEX_CLOUD_PORT}}"
  local convex_site_port="${LOCAL_CONVEX_SITE_PORT_RESULT:-${LOCAL_CONVEX_SITE_PORT}}"
  local actual_url="${LOCAL_CONVEX_URL_RESULT:-http://127.0.0.1:${convex_cloud_port}}"

  if reuse_running_local_convex_from_state "${convex_deployment_name}"; then
    return 0
  fi
  ensure_local_convex_preflight "${convex_deployment_name}" "${actual_url}" "${convex_cloud_port}" "${convex_site_port}"

  : > "${CONVEX_LOG}"
  if [[ -n "${LOCAL_CONVEX_STATE_CONFIG_RESULT:-}" ]]; then
    log_info "Discovered an existing local Convex state"
  fi
  log_info "Starting local Convex deployment (${convex_team}/${convex_project})"

  local convex_pid_file="${STATE_DIR}/convex.pid"
  rm -f "${convex_pid_file}"
  (
    cd "${ROOT_DIR}/my-app"
    local convex_bin="./node_modules/.bin/convex"
    if [[ ! -x "${convex_bin}" ]]; then
      log_error "Missing Convex CLI at ${ROOT_DIR}/my-app/${convex_bin}"
      exit 1
    fi
    unset CONVEX_DEPLOYMENT
    unset CONVEX_DEPLOY_KEY
    unset CONVEX_SELF_HOSTED_URL
    unset CONVEX_SELF_HOSTED_ADMIN_KEY
    unset VITE_CONVEX_URL
    unset NEXT_PUBLIC_CONVEX_URL
    unset VITE_CONVEX_URL
    unset NEXT_PUBLIC_CONVEX_URL
    export CONVEX_PARSER_URL="http://127.0.0.1:8001"
    export STRUCTURED_UPLOAD_PREFER_LOOPBACK=1
    export CONVEX_TMPDIR="${CONVEX_TMPDIR}"
    local direct_backend_bin=""
    local direct_backend_state_dir=""
    if [[ -n "${LOCAL_CONVEX_STATE_CONFIG_RESULT:-}" && -n "${convex_deployment_name}" ]]; then
      direct_backend_state_dir="$(dirname "${LOCAL_CONVEX_STATE_CONFIG_RESULT}")"
      direct_backend_bin="$(
        node -e '
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const config = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
process.stdout.write(path.join(os.homedir(), ".cache", "convex", "binaries", config.backendVersion, process.platform === "win32" ? "convex-local-backend.exe" : "convex-local-backend"));
' "${LOCAL_CONVEX_STATE_CONFIG_RESULT}"
      )"
    fi
    if [[ -n "${direct_backend_bin}" && -x "${direct_backend_bin}" ]]; then
      node -e '
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const [pidFile, logFile, supervisor, ...args] = process.argv.slice(1);
const logFd = fs.openSync(logFile, "a");
const child = spawn(process.execPath, [supervisor, pidFile, logFile, ...args], {
  cwd: process.cwd(),
  env: process.env,
  detached: true,
  stdio: ["ignore", logFd, logFd],
});
fs.writeFileSync(pidFile, String(child.pid));
child.unref();
' \
        "${convex_pid_file}" \
        "${CONVEX_LOG}" \
        "${ROOT_DIR}/scripts/local-convex-supervisor.cjs" \
        "${direct_backend_bin}" \
        "${actual_url}" \
        "${convex_cloud_port}" \
        "${convex_site_port}" \
        "${convex_deployment_name}" \
        "${direct_backend_state_dir}/convex_local_storage" \
        "${direct_backend_state_dir}/convex_local_backend.sqlite3" \
        "${convex_bin}" \
        "${LOCAL_CONVEX_STATE_CONFIG_RESULT}" \
        "${LOCAL_CONVEX_STARTUP_TIMEOUT}"
    else
      local -a convex_cmd=("${convex_bin}" dev --verbose --tail-logs always --local-cloud-port "${convex_cloud_port}" --local-site-port "${convex_site_port}" --local-force-upgrade)
      if [[ -n "${convex_deployment_name}" ]]; then
        convex_cmd+=(--local)
      else
        convex_cmd+=(--configure existing --team "${convex_team}" --project "${convex_project}" --dev-deployment local)
      fi
      node -e '
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const [pidFile, logFile, cmd, ...args] = process.argv.slice(1);
const logFd = fs.openSync(logFile, "a");
const child = spawn(cmd, args, {
  cwd: process.cwd(),
  env: process.env,
  detached: true,
  stdio: ["ignore", logFd, logFd],
});
fs.writeFileSync(pidFile, String(child.pid));
child.unref();
' "${convex_pid_file}" "${CONVEX_LOG}" "${convex_cmd[@]}"
    fi
  )
  local cpid=""
  for _ in $(seq 1 50); do
    [[ -s "${convex_pid_file}" ]] && break
    sleep 0.1
  done
  cpid="$(cat "${convex_pid_file}" 2>/dev/null || true)"
  rm -f "${convex_pid_file}"
  if [[ -z "${cpid}" ]]; then
    log_error "Failed to launch local Convex process"
    exit 1
  fi
  printf "[run] waiting for local Convex" >&2
  for i in $(seq 1 "${LOCAL_CONVEX_STARTUP_TIMEOUT}"); do
    if grep -q '\[run\] Convex local backend is ready' "${CONVEX_LOG}" || grep -q 'Convex functions ready!' "${CONVEX_LOG}"; then
      echo >&2
      sync_local_convex_env
      CONVEX_PID_RESULT="${cpid}"
      CONVEX_URL_RESULT="${actual_url}"
      return 0
    fi
    if [[ -n "${actual_url}" ]] && is_convex_ready "${actual_url}"; then
      echo >&2
      sync_local_convex_env
      CONVEX_PID_RESULT="${cpid}"
      CONVEX_URL_RESULT="${actual_url}"
      return 0
    fi
    if ! kill -0 "${cpid}" >/dev/null 2>&1; then
      echo >&2
      log_error "Local Convex failed to start (see ${CONVEX_LOG})"
      exit 1
    fi
    if [[ "${i}" -ge 10 ]] && grep -q 'Started running a deployment locally at http://127.0.0.1:' "${CONVEX_LOG}"; then
      actual_url="$(grep -Eo 'Started running a deployment locally at http://127\.0\.0\.1:[0-9]+' "${CONVEX_LOG}" | tail -n1 | awk '{print $NF}' || true)"
      if [[ -n "${actual_url}" ]] && is_convex_ready "${actual_url}"; then
        echo >&2
        sync_local_convex_env
        CONVEX_PID_RESULT="${cpid}"
        CONVEX_URL_RESULT="${actual_url}"
        return 0
      fi
    fi
    printf "." >&2
    sleep 1
  done
  log_error "Local Convex did not become reachable (see ${CONVEX_LOG})"
  exit 1
}

stop_convex() {
  local CPID="${1:-}"
  if [[ -n "${CPID}" ]] && kill -0 "${CPID}" >/dev/null 2>&1; then
    log_info "Stopping local Convex (PID ${CPID})"
    kill "${CPID}" >/dev/null 2>&1 || true
    wait "${CPID}" 2>/dev/null || true
  fi
}

# ===== Vite =====
start_vite() {
  local ORIGIN="${1:?origin required}"
  local CONVEX_URL="${2:-}"
  kill_vite_ports
  : > "${VITE_LOG}"
  local vite_pid_file="${STATE_DIR}/vite.pid"
  rm -f "${vite_pid_file}"
  (
    cd "${ROOT_DIR}/my-app"
    export CONVEX_PARSER_URL="${ORIGIN}"
    export VITE_PARSER_URL="${ORIGIN}"
    export VITE_CONVEX_PARSER_URL="${ORIGIN}"
    if [[ -n "${CONVEX_URL}" ]]; then
      export VITE_CONVEX_URL="${CONVEX_URL}"
      export NEXT_PUBLIC_CONVEX_URL="${CONVEX_URL}"
    fi
    export STRUCTURED_UPLOAD_SKIP_HEALTHCHECK=1
    local vite_bin="./node_modules/vite/bin/vite.js"
    if [[ ! -f "${vite_bin}" ]]; then
      log_error "Missing Vite binary at ${vite_bin}"
      exit 1
    fi
    local -a vite_cmd=(node "${vite_bin}" --host 127.0.0.1 --port "${VITE_PORT}" --clearScreen false)
    if [[ "${OPEN_BROWSER}" != "0" ]]; then
      vite_cmd+=(--open)
    fi
    if [[ "${OPEN_BROWSER}" == "0" ]]; then
      export BROWSER=none
    fi
    node -e '
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const [pidFile, logFile, cmd, ...args] = process.argv.slice(1);
const logFd = fs.openSync(logFile, "a");
const child = spawn(cmd, args, {
  cwd: process.cwd(),
  env: process.env,
  detached: true,
  stdio: ["ignore", logFd, logFd],
});
fs.writeFileSync(pidFile, String(child.pid));
child.unref();
' "${vite_pid_file}" "${VITE_LOG}" "${vite_cmd[@]}"
  )
  cat "${vite_pid_file}"
  rm -f "${vite_pid_file}"
}

stop_vite() {
  local VPID="${1:-}"
  if [[ -n "${VPID}" ]] && kill -0 "${VPID}" >/dev/null 2>&1; then
    log_info "Stopping Vite (PID ${VPID})"
    kill "${VPID}" >/dev/null 2>&1 || true
    wait "${VPID}" 2>/dev/null || true
  fi
  kill_vite_ports
}

reload_env_stack() {
  local VITE_PID=""; local PARSER_STARTED="0"; local CONVEX_PID=""; local CONVEX_URL=""; local TUNNEL_STARTED="0"; local STACK_MODE=""
  local ACTIVE_ORIGIN=""; local PARSER_RUNTIME_MODE=""; local PARSER_RELOAD="0"; local PARSER_OCR="auto"; local CONVEX_MODE="cloud"; local UI_STARTED="0"; local ENV_HASH=""; local CONVEX_BINDING_HASH=""
  local current_env_hash=""
  local current_convex_binding_hash=""
  local env_changed="false"
  local binding_changed="false"
  local local_binding_changed="false"
  local current_open_browser="${OPEN_BROWSER:-1}"
  local next_vite_pid=""
  local next_convex_pid=""
  local next_convex_url=""

  read_state
  if [[ -z "${STACK_MODE:-}" ]]; then
    log_error "No tracked stack to reload. Start one with ./run.sh up, ./run.sh local-fast, ./run.sh tunnel, or ./run.sh parser-dev."
    exit 1
  fi

  current_env_hash="$(env_reload_hash)"
  current_convex_binding_hash="$(convex_binding_hash)"
  [[ "${ENV_HASH:-}" != "${current_env_hash}" ]] && env_changed="true"
  [[ "${CONVEX_BINDING_HASH:-}" != "${current_convex_binding_hash}" ]] && binding_changed="true"
  if [[ "${binding_changed}" == "true" && "${CONVEX_MODE:-cloud}" == "local" ]]; then
    local_binding_changed="true"
  fi

  if [[ "${env_changed}" != "true" && "${binding_changed}" != "true" ]]; then
    log_info "Reload-env: no env changes detected"
    return 0
  fi

  next_vite_pid="${VITE_PID:-}"
  next_convex_pid="${CONVEX_PID:-}"
  next_convex_url="${CONVEX_URL:-}"

  if [[ "${env_changed}" == "true" && "${PARSER_STARTED:-0}" == "1" ]]; then
    stop_parser
    start_parser "${PARSER_OCR:-$(parser_ocr_mode)}" "${PARSER_RUNTIME_MODE:-image}" "${PARSER_RELOAD:-0}"
  fi

  if [[ "${local_binding_changed}" == "true" ]]; then
    stop_convex "${CONVEX_PID:-}"
    start_convex
    next_convex_pid="${CONVEX_PID_RESULT:-}"
    next_convex_url="${CONVEX_URL_RESULT:-}"
  elif [[ "${env_changed}" == "true" && "${CONVEX_MODE:-cloud}" == "local" ]]; then
    sync_local_convex_env
  fi

  if [[ "${env_changed}" == "true" && "${TUNNEL_STARTED:-0}" == "1" ]]; then
    stop_tunnel
    start_tunnel
  fi

  if [[ "${UI_STARTED:-0}" == "1" && ( "${env_changed}" == "true" || "${local_binding_changed}" == "true" ) ]]; then
    stop_vite "${VITE_PID:-}"
    OPEN_BROWSER="0"
    if [[ "${CONVEX_MODE:-cloud}" == "local" ]]; then
      next_vite_pid="$(start_vite "${ACTIVE_ORIGIN}" "${next_convex_url}")"
    else
      next_vite_pid="$(start_vite "${ACTIVE_ORIGIN}")"
    fi
    OPEN_BROWSER="${current_open_browser}"
    sleep 2
    if ! kill -0 "${next_vite_pid}" >/dev/null 2>&1; then
      log_error "Vite failed to restart during env reload (see ${VITE_LOG})"
      exit 1
    fi
  fi

  write_state \
    "${next_vite_pid}" \
    "${PARSER_STARTED:-0}" \
    "${next_convex_pid}" \
    "${next_convex_url}" \
    "${TUNNEL_STARTED:-0}" \
    "${STACK_MODE}" \
    "${ACTIVE_ORIGIN}" \
    "${PARSER_RUNTIME_MODE}" \
    "${PARSER_RELOAD:-0}" \
    "${PARSER_OCR:-auto}" \
    "${CONVEX_MODE:-cloud}" \
    "${UI_STARTED:-0}" \
    "${current_env_hash}" \
    "${current_convex_binding_hash}"

  log_info "Reload-env: refreshed ${STACK_MODE} without Docker rebuild"
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
  local VITE_PID=""; local PARSER_STARTED="0"; local CONVEX_PID=""; local CONVEX_URL=""; local TUNNEL_STARTED="0"; local STACK_MODE=""
  read_state
  echo "== status =="
  echo -n "local /ready: "
  curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8001/ready || true
  echo -n "edge  /ready: "
  curl -s -o /dev/null -w '%{http_code}\n' "$(normalize_origin "${PARSER_ORIGIN}")/ready" || true
  local convex_url=""
  convex_url="$(discover_local_convex_url)"
  if [[ -n "${convex_url}" ]] && is_convex_ready "${convex_url}"; then
    echo "convex local:   ${convex_url}"
  else
    echo "convex local:   stopped"
  fi
  if docker ps --format '{{.Names}}' | grep -qx "${PARSER_NAME}"; then
    echo "parser runtime: $(parser_runtime_mode)"
    echo "parser image:   $(parser_image_id)"
  else
    echo "parser runtime: stopped"
  fi
  if docker ps --format '{{.Names}}' | grep -qx "${CLOUDFLARED_NAME}"; then
    echo "tunnel:         running"
  else
    echo "tunnel:         stopped"
  fi
  if [[ -n "${STACK_MODE:-}" ]]; then
    echo "stack mode:     ${STACK_MODE}"
  fi
  echo "Vite log: ${VITE_LOG}"
  print_command_banner
}

# ===== Commands =====
up() {
  local OCR="auto"
  local START_UI=0
  local USE_LOCAL_ORIGIN=0
  local USE_EDGE_ORIGIN=0
  local USE_LOCAL_CONVEX=0
  local RUNTIME_MODE="${PARSER_RUNTIME_MODE}"
  local PARSER_RELOAD="0"
  local INTERNAL_TUNNEL_STACK=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ui|--with-ui) START_UI=1; shift;;
      --local-origin) USE_LOCAL_ORIGIN=1; shift;;
      --edge-origin)  USE_EDGE_ORIGIN=1; shift;;
      --local-convex) USE_LOCAL_CONVEX=1; shift;;
      --cloud-convex) USE_LOCAL_CONVEX=0; shift;;
      --workspace-mount) RUNTIME_MODE="workspace"; shift;;
      --image-runtime) RUNTIME_MODE="image"; shift;;
      --parser-reload) PARSER_RELOAD="1"; shift;;
      --tunnel-stack) INTERNAL_TUNNEL_STACK=1; shift;;
      --rebuild|--force-rebuild) FORCE_REBUILD="true"; shift;;
      --ocr)          OCR="${2:-auto}"; shift 2;;
      --doctr)        OCR="doctr"; shift;;
      --paddle)       OCR="paddle"; shift;;
      --ocr-disabled|--no-ocr) OCR="disabled"; shift;;
      *) echo "unknown option: $1" >&2; exit 2;;
    esac
  done

  if [[ "${RUNTIME_MODE}" != "image" && "${RUNTIME_MODE}" != "workspace" ]]; then
    log_error "Parser runtime mode must be image or workspace"
    exit 2
  fi
  if [[ "${USE_LOCAL_ORIGIN}" -eq 1 && "${USE_EDGE_ORIGIN}" -eq 1 ]]; then
    log_error "Choose one of --local-origin or --edge-origin"
    exit 2
  fi

  local ACTIVE_ORIGIN=""
  if [[ "${USE_LOCAL_ORIGIN}" -eq 1 ]]; then
    ACTIVE_ORIGIN="http://127.0.0.1:8001"
  else
    ACTIVE_ORIGIN="$(normalize_origin "${PARSER_ORIGIN}")"
  fi

  local TARGET_STACK_MODE="parser-only"
  if [[ "${START_UI}" -eq 1 ]]; then
    if [[ "${INTERNAL_TUNNEL_STACK}" -eq 1 ]]; then
      TARGET_STACK_MODE="tunnel"
    elif [[ "${USE_LOCAL_CONVEX}" -eq 1 && "${USE_LOCAL_ORIGIN}" -eq 1 && "${RUNTIME_MODE}" == "workspace" && "${PARSER_RELOAD}" == "1" ]]; then
      TARGET_STACK_MODE="local-fast"
    elif [[ "${USE_LOCAL_CONVEX}" -eq 1 ]]; then
      TARGET_STACK_MODE="local-convex"
    elif [[ "${USE_LOCAL_ORIGIN}" -eq 1 ]]; then
      TARGET_STACK_MODE="local"
    else
      TARGET_STACK_MODE="up"
    fi
  elif [[ "${RUNTIME_MODE}" == "workspace" && "${PARSER_RELOAD}" == "1" ]]; then
    TARGET_STACK_MODE="parser-dev"
  fi

  if handle_existing_stack_request \
    "${TARGET_STACK_MODE}" \
    "${ACTIVE_ORIGIN}" \
    "${RUNTIME_MODE}" \
    "${PARSER_RELOAD}" \
    "${OCR}" \
    "$( [[ "${USE_LOCAL_CONVEX}" -eq 1 ]] && echo local || echo cloud )" \
    "$( [[ "${START_UI}" -eq 1 ]] && echo 1 || echo 0 )" \
    "$( [[ "${INTERNAL_TUNNEL_STACK}" -eq 1 ]] && echo 1 || echo 0 )"; then
    return 0
  fi

  if [[ "${RUNTIME_MODE}" == "image" ]]; then
    if [[ "$(to_bool "${FORCE_REBUILD}")" == "true" ]]; then
      build_runtime_image
    else
      ensure_runtime_image_exists
    fi
  else
    if [[ "${START_UI}" -eq 1 && "${USE_LOCAL_CONVEX}" -eq 1 && "${USE_LOCAL_ORIGIN}" -eq 1 && "${PARSER_RELOAD}" == "1" ]]; then
      log_info "Local-fast: workspace parser runtime with autoreload enabled"
    else
      log_warn "Workspace parser runtime requested explicitly; export runtime parity is not guaranteed"
    fi
  fi

  # Start local parser (even if FE points to edge; useful for local testing)
  start_parser "${OCR}" "${RUNTIME_MODE}" "${PARSER_RELOAD}"

  # Optionally start Vite
  local VPID=""
  local CPID=""
  local CURL=""
  if [[ "${START_UI}" -eq 1 ]]; then
    if [[ "${USE_LOCAL_CONVEX}" -eq 1 ]]; then
      start_convex
      CPID="${CONVEX_PID_RESULT:-}"
      CURL="${CONVEX_URL_RESULT:-}"
    fi
    log_info "Starting Vite"
    if [[ "${USE_LOCAL_CONVEX}" -eq 1 ]]; then
      VPID="$(start_vite "${ACTIVE_ORIGIN}" "${CURL}")"
    else
      VPID="$(start_vite "${ACTIVE_ORIGIN}")"
    fi
    sleep 2
    if ! kill -0 "${VPID}" >/dev/null 2>&1; then
      log_error "Vite failed to start (see ${VITE_LOG})"
      exit 1
    fi
  fi

  local stack_mode="${TARGET_STACK_MODE}"
  local tunnel_started="0"
  if [[ "${INTERNAL_TUNNEL_STACK}" -eq 1 ]]; then
    start_tunnel
    tunnel_started="1"
  fi

  write_current_state \
    "${VPID}" \
    "1" \
    "${CPID}" \
    "${CURL}" \
    "${tunnel_started}" \
    "${stack_mode}" \
    "${ACTIVE_ORIGIN}" \
    "${RUNTIME_MODE}" \
    "${PARSER_RELOAD}" \
    "${OCR}" \
    "$( [[ "${USE_LOCAL_CONVEX}" -eq 1 ]] && echo local || echo cloud )" \
    "$( [[ "${START_UI}" -eq 1 ]] && echo 1 || echo 0 )"
  echo "----------------- Dev Stack -----------------"
  echo "Mode: ${stack_mode}"
  echo "FE origin: ${ACTIVE_ORIGIN}"
  echo "Parser local: OK (http://127.0.0.1:8001, runtime=${RUNTIME_MODE})"
  if [[ "${USE_LOCAL_CONVEX}" -eq 1 ]]; then
    echo "Convex local: ${CURL} (log: ${CONVEX_LOG})"
    echo "Frontend target mode: local Convex + $( [[ "${USE_LOCAL_ORIGIN}" -eq 1 ]] && echo local parser || echo edge parser )"
  else
    echo "Convex: env/default (cloud unless overridden)"
    if [[ "${USE_LOCAL_ORIGIN}" -eq 1 ]]; then
      echo "NOTE: local parser origin is set in Vite, but structured upload actions still follow the configured Convex backend/env."
    fi
  fi
  if [[ "${tunnel_started}" == "1" ]]; then
    echo "Tunnel: active via ${PARSER_ORIGIN}"
  fi
  echo "Vite: http://localhost:${VITE_PORT} (log: ${VITE_LOG})"
  echo "---------------------------------------------"
  print_command_banner
}

down() {
  local VITE_PID=""; local PARSER_STARTED="0"; local CONVEX_PID=""; local CONVEX_URL=""; local TUNNEL_STARTED="0"; local STACK_MODE=""
  read_state
  stop_vite "${VITE_PID:-}"
  stop_convex "${CONVEX_PID:-}"
  if [[ "${PARSER_STARTED:-0}" == "1" ]]; then
    stop_parser
  fi
  if [[ "${TUNNEL_STARTED:-0}" == "1" ]]; then
    stop_tunnel
  fi
  rm -f "${STATE_FILE}"
  log_info "Down: done."
  print_command_banner
}

reset() {
  local VITE_PID=""; local PARSER_STARTED="0"; local CONVEX_PID=""; local CONVEX_URL=""; local TUNNEL_STARTED="0"; local STACK_MODE=""
  read_state
  down >/dev/null 2>&1 || true
  stop_tunnel || true
  docker rm -f "${PARSER_NAME}" "${CLOUDFLARED_NAME}" >/dev/null 2>&1 || true
  stop_parser || true
  kill_stale_convex
  kill_vite_ports
  clear_dev_state
  log_info "Reset: done."
  print_command_banner
}

local_stack() {
  up --ui --local-origin --cloud-convex "$@"
}

local_convex_stack() {
  log_info "local-convex is a legacy alias; using local-fast"
  local_fast_stack "$@"
}

local_fast_stack() {
  up --ui --local-origin --local-convex --workspace-mount --parser-reload "$@"
}

tunnel_stack() {
  up --tunnel-stack --ui --edge-origin --cloud-convex "$@"
}

parser_dev_stack() {
  local OCR="auto"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ocr) OCR="${2:-auto}"; shift 2 ;;
      --doctr) OCR="doctr"; shift ;;
      --paddle) OCR="paddle"; shift ;;
      --ocr-disabled|--no-ocr) OCR="disabled"; shift ;;
      *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
  done

  if handle_existing_stack_request "parser-dev" "" "workspace" "1" "${OCR}" "cloud" "0" "0"; then
    return 0
  fi

  ensure_runtime_image_exists
  start_parser "${OCR}" "workspace" "1"
  write_current_state "" "1" "" "" "0" "parser-dev" "" "workspace" "1" "${OCR}" "cloud" "0"
  echo "----------------- Parser Dev ----------------"
  echo "Parser local: OK (http://127.0.0.1:8001, runtime=workspace)"
  echo "Mode: dev-only Python parser hacking with workspace mount"
  echo "Reload: uvicorn --reload is enabled for Python changes"
  echo "Use this for fast parser iteration, not stable export/runtime validation."
  echo "---------------------------------------------"
  print_command_banner
}

rebuild_docker_stack() {
  local VITE_PID=""; local PARSER_STARTED="0"; local CONVEX_PID=""; local CONVEX_URL=""; local TUNNEL_STARTED="0"; local STACK_MODE=""
  local restart_mode="parser-only"
  read_state
  if [[ -n "${STACK_MODE:-}" ]]; then
    restart_mode="${STACK_MODE}"
  elif [[ "${TUNNEL_STARTED:-0}" == "1" ]]; then
    restart_mode="tunnel"
  elif [[ -n "${VITE_PID:-}" && -n "${CONVEX_PID:-}" ]]; then
    restart_mode="local-convex"
  elif [[ -n "${VITE_PID:-}" ]]; then
    restart_mode="local"
  fi

  log_info "rebuild-docker: rebuilding parser/runtime image"
  down >/dev/null 2>&1 || true
  FORCE_REBUILD="true"
  build_runtime_image

  case "${restart_mode}" in
    tunnel)
      OPEN_BROWSER="${OPEN_BROWSER}" tunnel_stack
      ;;
    local-fast|local-convex)
      OPEN_BROWSER="${OPEN_BROWSER}" up --ui --local-origin --local-convex --image-runtime
      ;;
    local)
      OPEN_BROWSER="${OPEN_BROWSER}" local_stack
      ;;
    *)
      start_parser "auto" "image"
      write_current_state "" "1" "" "" "0" "parser-only" "" "image" "0" "auto" "cloud" "0"
      ;;
  esac

  if curl -fsS http://127.0.0.1:8001/ready >/dev/null 2>&1; then
    log_info "Rebuild-docker: local parser ready"
  else
    log_error "Rebuild-docker: local parser failed readiness"
    exit 1
  fi
  if [[ "${restart_mode}" == "tunnel" ]]; then
    if curl -fsS "$(normalize_origin "${PARSER_ORIGIN}")/ready" >/dev/null 2>&1; then
      log_info "Rebuild-docker: edge ready"
    else
      log_error "Rebuild-docker: edge readiness check failed"
      exit 1
    fi
  fi

  log_info "Rebuild-docker: done (${restart_mode})"
  print_command_banner
}

show_file_logs() {
  local label="${1:?label required}"
  local file="${2:?file required}"
  local tail_count="${3:?tail count required}"
  local follow="${4:-0}"

  printf '\n== %s ==\n' "${label}"

  if [[ ! -f "${file}" ]]; then
    log_warn "Log file is not available: ${file}"
    return 0
  fi

  if [[ "${follow}" == "1" ]]; then
    tail -n "${tail_count}" -f "${file}" | redact_log_line
  else
    tail -n "${tail_count}" "${file}" | redact_log_line
  fi
}

show_parser_logs() {
  local tail_count="${1:?tail count required}"
  local follow="${2:-0}"
  local -a docker_args=(logs --tail "${tail_count}")

  printf '\n== Parser ==\n'

  if ! command -v docker >/dev/null 2>&1; then
    log_warn "Docker is not installed or unavailable"
    return 0
  fi
  if ! docker info >/dev/null 2>&1; then
    log_warn "Docker daemon is not available"
    return 0
  fi
  if ! docker inspect "${PARSER_NAME}" >/dev/null 2>&1; then
    log_warn "Parser container does not exist"
    return 0
  fi

  [[ "${follow}" == "1" ]] && docker_args+=(-f)
  docker "${docker_args[@]}" "${PARSER_NAME}" 2>&1 | redact_log_line
}

logs() {
  local service="parser"
  local tail_count="200"
  local follow="0"

  if [[ $# -gt 0 && "${1}" != --* ]]; then
    service="${1}"
    shift
  fi

  while [[ $# -gt 0 ]]; do
    case "${1}" in
      --tail)
        if [[ $# -lt 2 || ! "${2:-}" =~ ^[1-9][0-9]*$ ]]; then
          log_error "--tail requires a positive integer"
          return 2
        fi
        tail_count="${2}"
        shift 2
        ;;
      --follow)
        follow="1"
        shift
        ;;
      *)
        log_error "Unknown logs option: ${1}"
        return 2
        ;;
    esac
  done

  case "${service}" in
    parser|vite|convex|run|all) ;;
    *) log_error "Unknown log service: ${service}"; return 2 ;;
  esac

  if [[ "${service}" == "all" && "${follow}" == "1" ]]; then
    log_error "logs all --follow is not supported; choose one service"
    return 2
  fi

  case "${service}" in
    parser) show_parser_logs "${tail_count}" "${follow}" ;;
    vite)   show_file_logs "Vite" "${VITE_LOG}" "${tail_count}" "${follow}" ;;
    convex) show_file_logs "Convex" "${CONVEX_LOG}" "${tail_count}" "${follow}" ;;
    run)    show_file_logs "run.sh" "${RUN_LOG_FILE}" "${tail_count}" "${follow}" ;;
    all)
      show_parser_logs "${tail_count}" "0"
      show_file_logs "Vite" "${VITE_LOG}" "${tail_count}" "0"
      show_file_logs "Convex" "${CONVEX_LOG}" "${tail_count}" "0"
      show_file_logs "run.sh" "${RUN_LOG_FILE}" "${tail_count}" "0"
      ;;
  esac
}

smoke() {
  curl -sS http://127.0.0.1:8001/ready | jq .
}

help() {
  cat <<'EOF'
usage:
  ./run.sh local-fast [--ocr auto|doctr|paddle|disabled]
  ./run.sh local [--ocr auto|doctr|paddle|disabled]
  ./run.sh local-convex [--ocr auto|doctr|paddle|disabled]
  ./run.sh tunnel [--ocr auto|doctr|paddle|disabled]
  ./run.sh parser-dev [--ocr auto|doctr|paddle|disabled]
  ./run.sh reload-env
  ./run.sh rebuild-docker
  ./run.sh down
  ./run.sh reset
  ./run.sh up [--ui] [--edge-origin | --local-origin] [--local-convex | --cloud-convex] [--ocr auto|doctr|paddle|disabled]
  ./run.sh status
  ./run.sh logs [parser|vite|convex|run|all] [--tail N] [--follow]
  ./run.sh smoke
  ./run.sh assert-ocr FILE.pdf
  ./run.sh probe-edge [FILE.pdf]     # uses CF_ACCESS_CLIENT_ID/SECRET if set
  ./run.sh kill-vite-ports

notes:
- Env files are loaded in this order, with later files overriding earlier ones:
  .env -> .env.local -> my-app/.env -> my-app/.env.local
- Env values are never printed by help because they may contain secrets.
- local-fast = recommended fast full-app parser workflow: local parser + local Convex + Vite + autoreload, with export/runtime deps preserved inside the container.
- tunnel = stable validation mode on the validated image runtime.
- local = local parser + export-capable image runtime + Vite pointed at http://127.0.0.1:8001.
- local-convex = legacy alias for local-fast.
- parser-dev = parser-only / advanced workspace-mounted parser with autoreload; fast Python iteration, not stable runtime validation.
- reload-env = restart-only refresh for parser/Vite/local Convex/tunnel after env changes, without rebuilding the Docker image.
- rebuild-docker = explicit rebuild for parser/export Docker runtime, then clean restart + readiness checks.
- down stops only the processes/containers tracked as started by run.sh and keeps images/caches intact.
- reset does down plus stale process/container cleanup and clears tmp/dev-stack state and stale temp logs.
- workspace mount mode is explicit-only via --workspace-mount and is not the default runtime.
- FE origin defaults to PARSER_ORIGIN (edge). Use --local-origin to point FE to http://127.0.0.1:8001.
- Use --local-convex when you want the app to talk to the local Convex backend managed by run.sh.
- Without --local-convex, Convex stays on its configured env/default path (typically cloud), which preserves the existing Cloudflare tunnel flow.
- In local-fast, both Vite and server-side structuredUpload resolve the local parser at http://127.0.0.1:8001, and export worker dependencies come from the container image instead of host node_modules.
- MISTRAL is auto-enabled if MISTRAL_API_KEY is present (env or ~/.mistral_key).
- OCR flag controls local parser engine: auto (default), doctr, paddle, disabled.
- logs defaults to parser with the last 200 lines.
- logs all --follow is not supported; choose one service.
EOF
  print_command_banner
}

# Trap: ensure we don't leave Vite/Parser dangling on Ctrl+C
if [[ "${CMD}" == "logs" ]]; then
  trap 'exit 130' INT TERM
else
  trap 'log_warn "interrupt -> down"; down >/dev/null 2>&1 || true; exit 130' INT TERM
fi

case "${CMD}" in
  local-fast) local_fast_stack "$@";;
  local) local_stack "$@";;
  local-convex) local_convex_stack "$@";;
  tunnel) tunnel_stack "$@";;
  parser-dev) parser_dev_stack "$@";;
  reload-env) reload_env_stack;;
  rebuild-docker) rebuild_docker_stack;;
  up) up "$@";;
  down) down;;
  reset) reset;;
  status) status;;
  logs) logs "$@";;
  smoke) smoke;;
  assert-ocr) assert_ocr "$@";;
  probe-edge) probe_edge "${1:-}";;
  kill-vite-ports) kill_vite_ports;;
  help|*) help;;
esac
