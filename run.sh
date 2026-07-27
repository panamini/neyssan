#!/usr/bin/env bash
set -euo pipefail

# ===== Basics & env =====
CMD="${1:-help}"; shift || true
if [[ "${CMD}" == "-ui" ]]; then
  set -- --ui "$@"
  CMD="up"
fi

MCP_SECRET_SYNC_XTRACE_WAS_ENABLED=0
if [[ "$-" == *x* ]]; then
  if [[ "${CMD}" == "mcp-secret-sync" ]]; then
    MCP_SECRET_SYNC_XTRACE_WAS_ENABLED=1
  fi
  set +x
fi
readonly MCP_SECRET_SYNC_XTRACE_WAS_ENABLED

# Read-only diagnostics must neither source nor trace local configuration.
READ_ONLY_COMMAND=0
if [[ "${CMD}" == "doctor" || "${CMD}" == "mcp-smoke" ]]; then
  READ_ONLY_COMMAND=1
fi
readonly READ_ONLY_COMMAND
if [[ "${READ_ONLY_COMMAND}" == "1" && "$-" == *x* ]]; then
  set +x
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

# Load overrides
if [[ "${READ_ONLY_COMMAND}" != "1" ]]; then
  if [[ -f "${ROOT_DIR}/.env" ]]; then set -a; source "${ROOT_DIR}/.env"; set +a; fi
  if [[ -f "${ROOT_DIR}/.env.local" ]]; then set -a; source "${ROOT_DIR}/.env.local"; set +a; fi
  if [[ -f "${ROOT_DIR}/my-app/.env" ]]; then set -a; source "${ROOT_DIR}/my-app/.env"; set +a; fi
fi

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
TUNNEL_TOKEN_FILE="${STATE_DIR}/cloudflared-token"
MCP_TUNNEL_CONFIG_FILE="${STATE_DIR}/cloudflared-mcp.yml"
LOG_DIR="${ROOT_DIR}/tmp"
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
MCP_PRIVATE_BETA_VITE_PORT="${MCP_PRIVATE_BETA_VITE_PORT:-5196}"
MCP_PRIVATE_BETA_CLIENT_ID="local-chatgpt-client"
MCP_PRIVATE_BETA_RESOURCE="https://mcp.twoweeks.ai/mcp"
MCP_PRIVATE_BETA_AUTHORIZATION_ORIGIN="https://mcp.twoweeks.ai"
MCP_PRIVATE_BETA_REDIRECT_URI="https://chatgpt.com/connector/oauth/b7v_6OncLEsg"
MCP_PRIVATE_BETA_TUNNEL_ID="935a2064-9473-41bc-bd73-174660892847"
MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE="${MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE:-${HOME}/.cloudflared/${MCP_PRIVATE_BETA_TUNNEL_ID}.json}"
INFISICAL_MCP_PROJECT_CONFIG_FILE="${ROOT_DIR}/.infisical.json"
INFISICAL_MCP_DOMAIN="https://eu.infisical.com"
INFISICAL_MCP_ENVIRONMENT="dev"
INFISICAL_MCP_SECRET_PATH="/"
INFISICAL_MCP_SECRET_KEY="MCP_OAUTH_PRODUCTION_CLIENT_SECRET"

if [[ "${READ_ONLY_COMMAND}" != "1" ]]; then
  mkdir -p "${STATE_DIR}" "${LOG_DIR}"
  mkdir -p "${CONVEX_TMPDIR}"
  mkdir -p "${CACHE_DIR}" "${DOCKER_STATE_DIR}"
fi

# Auto-load Mistral key from file if not set
if [[ "${READ_ONLY_COMMAND}" != "1" && -z "${MISTRAL_API_KEY:-}" && -f "${HOME}/.mistral_key" ]]; then
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

RUN_OWNER_LABEL="com.twoweeks.run-sh.owner"
RUN_OWNER_ID="$(hash_string "${ROOT_DIR}")"
RUN_OWNER_PROCESS_PREFIX="twoweeks-run-sh-${RUN_OWNER_ID:0:16}"
readonly RUN_OWNER_LABEL RUN_OWNER_ID RUN_OWNER_PROCESS_PREFIX

env_reload_hash() {
  local payload=""
  local file=""
  local env_files=(
    "${ROOT_DIR}/.env"
    "${ROOT_DIR}/.env.local"
    # Vite loads client-facing VITE_* values from this file after config resolution.
    # Server-only MCP OAuth values belong in the root .env.local loaded above.
    "${ROOT_DIR}/my-app/.env.local"
    "${ROOT_DIR}/my-app/.env"
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

mcp_check_required_value() {
  local name="${1:?env name required}"
  local expected="${2:?expected value required}"
  if [[ "${!name:-}" != "${expected}" ]]; then
    echo "[run] mcp-check: ${name} is missing or does not match the private-beta contract" >&2
    return 1
  fi
}

mcp_check_required_secret() {
  local name="${1:?env name required}"
  if [[ -z "${!name:-}" ]]; then
    echo "[run] mcp-check: ${name} is missing" >&2
    return 1
  fi
}

mcp_check_root_env_key() {
  local file="${1:?env file required}"
  local name="${2:?env name required}"
  if ! grep -Eq "^[[:space:]]*(export[[:space:]]+)?${name}=" "${file}"; then
    echo "[run] mcp-check: ${name} must be defined in root .env.local" >&2
    return 1
  fi
}

mcp_derive_clerk_publishable_key() {
  CLERK_JWT_ISSUER_DOMAIN="${CLERK_JWT_ISSUER_DOMAIN:-}" node -e '
const rawIssuer = process.env.CLERK_JWT_ISSUER_DOMAIN ?? "";
let issuer;
try {
  issuer = new URL(rawIssuer);
} catch {
  process.exit(1);
}
if (
  issuer.protocol !== "https:" ||
  issuer.username ||
  issuer.password ||
  issuer.pathname !== "/" ||
  issuer.search ||
  issuer.hash
) {
  process.exit(1);
}
const prefix = issuer.hostname.endsWith(".clerk.accounts.dev") ? "pk_test_" : "pk_live_";
process.stdout.write(`${prefix}${Buffer.from(`${issuer.hostname}$`, "utf8").toString("base64")}`);
'
}

mcp_resolve_clerk_publishable_key() {
  local derived=""
  if ! derived="$(mcp_derive_clerk_publishable_key)" || [[ -z "${derived}" ]]; then
    echo "[run] mcp-check: cannot derive the Clerk publishable key from CLERK_JWT_ISSUER_DOMAIN" >&2
    return 1
  fi
  if [[ -n "${VITE_CLERK_PUBLISHABLE_KEY:-}" && "${VITE_CLERK_PUBLISHABLE_KEY}" != "${derived}" ]]; then
    echo "[run] mcp-check: configured Clerk publishable key does not match CLERK_JWT_ISSUER_DOMAIN" >&2
    return 1
  fi
  export VITE_CLERK_PUBLISHABLE_KEY="${derived}"
}

mcp_env_file_mode() {
  local file="${1:?file required}"
  if stat -L -f '%Lp' "${file}" >/dev/null 2>&1; then
    stat -L -f '%Lp' "${file}"
  else
    stat -L -c '%a' "${file}"
  fi
}

mcp_secret_sync_restore_xtrace() {
  if (( MCP_SECRET_SYNC_XTRACE_WAS_ENABLED )); then
    set -x
  fi
}

mcp_secret_sync() {
  local root_env="${ROOT_DIR}/.env.local"
  local raw_secret=""
  local digest=""
  local temp_env=""
  local previous_umask=""

  if [[ "$-" == *x* ]]; then
    set +x
  fi

  if ! command -v infisical >/dev/null 2>&1; then
    mcp_secret_sync_restore_xtrace
    echo "[run] mcp-secret-sync: Infisical CLI is required" >&2
    return 1
  fi
  if [[ ! -f "${INFISICAL_MCP_PROJECT_CONFIG_FILE}" ]]; then
    mcp_secret_sync_restore_xtrace
    echo "[run] mcp-secret-sync: .infisical.json is required" >&2
    return 1
  fi
  if [[ ! -f "${root_env}" ]]; then
    mcp_secret_sync_restore_xtrace
    echo "[run] mcp-secret-sync: root .env.local is required" >&2
    return 1
  fi
  if [[ "$(mcp_env_file_mode "${root_env}")" != "600" ]]; then
    mcp_secret_sync_restore_xtrace
    echo "[run] mcp-secret-sync: root .env.local must have mode 600" >&2
    return 1
  fi

  if ! raw_secret="$(
    infisical secrets get "${INFISICAL_MCP_SECRET_KEY}" \
      --env="${INFISICAL_MCP_ENVIRONMENT}" \
      --path="${INFISICAL_MCP_SECRET_PATH}" \
      --domain="${INFISICAL_MCP_DOMAIN}" \
      --plain \
      --silent 2>/dev/null
  )"; then
    unset raw_secret
    mcp_secret_sync_restore_xtrace
    echo "[run] mcp-secret-sync: secret retrieval failed; value not printed" >&2
    return 1
  fi
  if [[ ${#raw_secret} -lt 32 || "${raw_secret}" == *$'\n'* || "${raw_secret}" == *$'\r'* ]]; then
    unset raw_secret
    mcp_secret_sync_restore_xtrace
    echo "[run] mcp-secret-sync: retrieved secret has an invalid shape; value not printed" >&2
    return 1
  fi

  if ! digest="$(hash_string "${raw_secret}")"; then
    unset raw_secret digest
    mcp_secret_sync_restore_xtrace
    echo "[run] mcp-secret-sync: digest generation failed; value not printed" >&2
    return 1
  fi
  unset raw_secret
  if [[ ! "${digest}" =~ ^[0-9a-f]{64}$ ]]; then
    unset digest
    mcp_secret_sync_restore_xtrace
    echo "[run] mcp-secret-sync: digest generation failed; value not printed" >&2
    return 1
  fi

  previous_umask="$(umask)"
  umask 077
  if ! temp_env="$(mktemp "${root_env}.tmp.XXXXXX")"; then
    umask "${previous_umask}"
    unset digest
    mcp_secret_sync_restore_xtrace
    echo "[run] mcp-secret-sync: temporary env creation failed; value not printed" >&2
    return 1
  fi
  umask "${previous_umask}"
  if ! {
    printf '%s\n' "${digest}"
    cat "${root_env}"
  } | awk '
    NR == 1 {
      digest = $0
      replaced = 0
      next
    }
    /^[[:space:]]*(export[[:space:]]+)?MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256=/ {
      if (!replaced) {
        print "MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256=" digest
        replaced = 1
      }
      next
    }
    { print }
    END {
      if (!replaced) {
        print "MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256=" digest
      }
    }
  ' >"${temp_env}"; then
    rm -f "${temp_env}" || true
    unset digest
    mcp_secret_sync_restore_xtrace
    echo "[run] mcp-secret-sync: root .env.local update failed; value not printed" >&2
    return 1
  fi
  if ! chmod 600 "${temp_env}"; then
    rm -f "${temp_env}" || true
    unset digest
    mcp_secret_sync_restore_xtrace
    echo "[run] mcp-secret-sync: temporary env permissions failed; value not printed" >&2
    return 1
  fi
  if ! mv -f "${temp_env}" "${root_env}"; then
    rm -f "${temp_env}" || true
    unset digest
    mcp_secret_sync_restore_xtrace
    echo "[run] mcp-secret-sync: root .env.local replacement failed; value not printed" >&2
    return 1
  fi
  unset digest
  mcp_secret_sync_restore_xtrace
  echo "[run] mcp-secret-sync: PASS (digest updated; values not printed)"
}

mcp_check() {
  local failures=0
  local root_env="${ROOT_DIR}/.env.local"
  local app_env="${ROOT_DIR}/my-app/.env.local"
  local app_base_env="${ROOT_DIR}/my-app/.env"
  local root_base_env="${ROOT_DIR}/.env"
  local candidate_env=""
  local key=""
  local canonical_server_keys=(
    MCP_OAUTH_PRODUCTION_RUNTIME
    MCP_OAUTH_PRODUCTION_APPROVED
    MCP_OAUTH_PRODUCTION_ROUTE_WIRING
    MCP_OAUTH_PRODUCTION_CLIENT_IDS
    MCP_OAUTH_PRODUCTION_PRIVATE_BETA_ENABLED
    MCP_OAUTH_PRODUCTION_PRIVATE_BETA_CLIENT_IDS
    MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES
    MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS
    MCP_OAUTH_PRODUCTION_RESOURCE
    MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN
    MCP_OAUTH_PRODUCTION_REDIRECT_URIS
    MCP_OAUTH_PRODUCTION_ISSUER
    MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT
    MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256
    CLERK_JWT_ISSUER_DOMAIN
    CONVEX_URL
    CONVEX_AUTH_TOKEN
  )

  if [[ ! -f "${root_env}" ]]; then
    echo "[run] mcp-check: root .env.local is required" >&2
    failures=1
  elif [[ "$(mcp_env_file_mode "${root_env}")" != "600" ]]; then
    echo "[run] mcp-check: root .env.local must have mode 600" >&2
    failures=1
  fi

  if [[ -f "${root_env}" ]]; then
    for key in "${canonical_server_keys[@]}"; do
      mcp_check_root_env_key "${root_env}" "${key}" || failures=1
    done
  fi

  mcp_check_required_value MCP_OAUTH_PRODUCTION_RUNTIME "1" || failures=1
  mcp_check_required_value MCP_OAUTH_PRODUCTION_APPROVED "1" || failures=1
  mcp_check_required_value MCP_OAUTH_PRODUCTION_ROUTE_WIRING "1" || failures=1
  mcp_check_required_value MCP_OAUTH_PRODUCTION_CLIENT_IDS "${MCP_PRIVATE_BETA_CLIENT_ID}" || failures=1
  mcp_check_required_value MCP_OAUTH_PRODUCTION_PRIVATE_BETA_ENABLED "1" || failures=1
  mcp_check_required_value MCP_OAUTH_PRODUCTION_PRIVATE_BETA_CLIENT_IDS "${MCP_PRIVATE_BETA_CLIENT_ID}" || failures=1
  mcp_check_required_value MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES "${MCP_PRIVATE_BETA_RESOURCE}" || failures=1
  mcp_check_required_secret MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS || failures=1
  mcp_check_required_value MCP_OAUTH_PRODUCTION_RESOURCE "${MCP_PRIVATE_BETA_RESOURCE}" || failures=1
  mcp_check_required_value MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN "${MCP_PRIVATE_BETA_AUTHORIZATION_ORIGIN}" || failures=1
  mcp_check_required_value MCP_OAUTH_PRODUCTION_REDIRECT_URIS "${MCP_PRIVATE_BETA_REDIRECT_URI}" || failures=1
  mcp_check_required_secret MCP_OAUTH_PRODUCTION_ISSUER || failures=1
  mcp_check_required_secret MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT || failures=1
  mcp_check_required_secret MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256 || failures=1
  mcp_check_required_secret CLERK_JWT_ISSUER_DOMAIN || failures=1
  mcp_check_required_secret CONVEX_URL || failures=1
  mcp_check_required_secret CONVEX_AUTH_TOKEN || failures=1

  if [[ ! "${MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256:-}" =~ ^[0-9a-f]{64}$ ]]; then
    echo "[run] mcp-check: MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256 must be lowercase SHA-256 hex" >&2
    failures=1
  fi
  if [[ ! "${MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS:-}" =~ ^([0-9a-f]{64})(,[0-9a-f]{64})*$ ]]; then
    echo "[run] mcp-check: MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS must contain lowercase SHA-256 hex digests" >&2
    failures=1
  fi
  for candidate_env in "${root_base_env}" "${app_base_env}" "${app_env}"; do
    [[ -f "${candidate_env}" ]] || continue
    for key in "${canonical_server_keys[@]}"; do
      if grep -Eq "^[[:space:]]*(export[[:space:]]+)?${key}=" "${candidate_env}"; then
        echo "[run] mcp-check: canonical server keys are allowed only in root .env.local" >&2
        failures=1
        break 2
      fi
    done
  done
  if [[ ! -f "${MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE}" ]]; then
    echo "[run] mcp-check: named MCP tunnel credentials file is missing" >&2
    failures=1
  else
    local credentials_mode
    credentials_mode="$(mcp_env_file_mode "${MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE}")"
    if [[ "${credentials_mode}" != "400" && "${credentials_mode}" != "600" ]]; then
      echo "[run] mcp-check: named MCP tunnel credentials file must have mode 400 or 600" >&2
      failures=1
    fi
  fi
  if grep -Eq '^[[:space:]]*MCP_PRODUCTION_PRIVATE_BETA_' "${root_env}" "${app_env}" 2>/dev/null; then
    echo "[run] mcp-check: legacy MCP_PRODUCTION_PRIVATE_BETA_* aliases are forbidden" >&2
    failures=1
  fi
  for candidate_env in "${root_base_env}" "${root_env}" "${app_base_env}" "${app_env}"; do
    [[ -f "${candidate_env}" ]] || continue
    if grep -Eq '^[[:space:]]*(export[[:space:]]+)?MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECTS=' "${candidate_env}"; then
      echo "[run] mcp-check: raw private-beta subject identifiers are forbidden; configure only subject digests" >&2
      failures=1
      break
    fi
  done
  mcp_resolve_clerk_publishable_key || failures=1

  if [[ "${failures}" -ne 0 ]]; then
    echo "[run] mcp-check: FAIL (values were not printed)" >&2
    return 1
  fi
  echo "[run] mcp-check: PASS (canonical keys present; values not printed)"
}

doctor_pass() {
  echo "[run] doctor: PASS - $1"
}

doctor_warn() {
  DOCTOR_WARNINGS=$((DOCTOR_WARNINGS + 1))
  echo "[run] doctor: WARN - $1"
}

doctor_fail() {
  DOCTOR_FAILURES=$((DOCTOR_FAILURES + 1))
  echo "[run] doctor: FAIL - $1" >&2
}

doctor_check_command() {
  local name="${1:?command name required}"
  if command -v "${name}" >/dev/null 2>&1; then
    doctor_pass "${name} command is available"
  else
    doctor_fail "${name} command is missing"
  fi
}

doctor_check_node_runtime() {
  local version=""
  local major=""
  local probe=""
  if ! version="$(node --version 2>/dev/null)"; then
    doctor_fail "Node version cannot be determined"
    return 1
  fi
  major="${version#v}"
  major="${major%%.*}"
  if [[ ! "${major}" =~ ^[0-9]+$ || "${major}" -lt 20 ]]; then
    doctor_fail "Node 20 or newer is required"
    return 1
  fi
  if ! probe="$(node -e 'process.stdout.write(typeof require === "function" ? "node-e-ok" : "")' 2>/dev/null)" || [[ "${probe}" != "node-e-ok" ]]; then
    doctor_fail "Node cannot execute startup scripts with node -e"
    return 1
  fi
  if ! probe="$(node - 2>/dev/null <<'NODE'
process.stdout.write(typeof require === "function" ? "node-stdin-ok" : "");
NODE
  )" || [[ "${probe}" != "node-stdin-ok" ]]; then
    doctor_fail "Node cannot execute doctor scripts from standard input"
    return 1
  fi
  doctor_pass "Node 20+ startup script execution is available"
  return 0
}

is_wsl_runtime() {
  local kernel_release=""
  if [[ -n "${WSL_DISTRO_NAME:-}" || -n "${WSL_INTEROP:-}" ]] || grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null; then
    kernel_release="$(uname -r 2>/dev/null || true)"
    case "${kernel_release}" in
      *microsoft-standard*|*Microsoft-standard*|*WSL2*|*wsl2*) return 0 ;;
    esac
  fi
  return 1
}

mcp_tunnel_uses_native_linux_host_network() {
  local docker_operating_system=""
  [[ "$(uname -s 2>/dev/null || true)" == "Linux" ]] || return 1
  is_wsl_runtime && return 1
  docker_operating_system="$(docker info --format '{{.OperatingSystem}}' 2>/dev/null || true)"
  [[ "${docker_operating_system}" != *"Docker Desktop"* ]]
}

doctor_check_mcp_tunnel_network() {
  local docker_operating_system=""
  if mcp_tunnel_uses_native_linux_host_network; then
    doctor_pass "MCP tunnel uses native Linux host networking to reach loopback Vite"
    return 0
  fi
  docker_operating_system="$(docker info --format '{{.OperatingSystem}}' 2>/dev/null || true)"
  if is_wsl_runtime && [[ "${docker_operating_system}" != *"Docker Desktop"* ]]; then
    doctor_fail "WSL2 MCP tunnel requires Docker Desktop integration"
    return 0
  fi
  doctor_pass "MCP tunnel uses the Docker Desktop host gateway to reach loopback Vite"
}

doctor_check_platform() {
  local kernel=""
  local kernel_release=""
  local architecture=""
  kernel="$(uname -s 2>/dev/null || true)"
  case "${kernel}" in
    Darwin)
      doctor_pass "platform is macOS (Bash 3.2+ supported)"
      ;;
    Linux)
      if [[ -n "${WSL_DISTRO_NAME:-}" || -n "${WSL_INTEROP:-}" ]] || grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null; then
        kernel_release="$(uname -r 2>/dev/null || true)"
        case "${kernel_release}" in
          *microsoft-standard*|*Microsoft-standard*|*WSL2*|*wsl2*)
            doctor_pass "platform is Windows through WSL2"
            ;;
          *)
            doctor_fail "WSL1 is unsupported; upgrade the distribution to WSL2"
            ;;
        esac
      else
        doctor_pass "platform is Linux"
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      doctor_fail "native Windows shells are unsupported; use WSL2 with Docker Desktop integration"
      ;;
    *)
      doctor_fail "unsupported operating system"
      ;;
  esac

  if [[ "${kernel}" == "Darwin" || "${kernel}" == "Linux" ]]; then
    architecture="$(uname -m 2>/dev/null || true)"
    case "${architecture}" in
      x86_64|amd64|arm64|aarch64)
        doctor_pass "CPU architecture is supported"
        ;;
      *)
        doctor_fail "CPU architecture is unsupported"
        ;;
    esac
  fi

  if (( BASH_VERSINFO[0] > 3 || (BASH_VERSINFO[0] == 3 && BASH_VERSINFO[1] >= 2) )); then
    doctor_pass "Bash version is compatible"
  else
    doctor_fail "Bash 3.2 or newer is required"
  fi
}

doctor_check_file() {
  local path="${1:?path required}"
  local label="${2:?label required}"
  local remediation="${3:-}"
  if [[ -f "${path}" ]]; then
    doctor_pass "${label} is available"
  elif [[ -n "${remediation}" ]]; then
    doctor_fail "${label} is missing; ${remediation}"
  else
    doctor_fail "${label} is missing"
  fi
}

doctor_check_executable() {
  local path="${1:?path required}"
  local label="${2:?label required}"
  local remediation="${3:-}"
  if [[ -x "${path}" ]]; then
    doctor_pass "${label} is available"
  elif [[ -n "${remediation}" ]]; then
    doctor_fail "${label} is missing or not executable; ${remediation}"
  else
    doctor_fail "${label} is missing or not executable"
  fi
}

doctor_check_startup_env_syntax() {
  local env_path=""
  local invalid=0
  for env_path in \
    "${ROOT_DIR}/.env" \
    "${ROOT_DIR}/.env.local" \
    "${ROOT_DIR}/my-app/.env"; do
    [[ -f "${env_path}" ]] || continue
    if ! "${BASH}" -n "${env_path}" >/dev/null 2>&1; then
      invalid=1
    fi
  done
  if (( invalid )); then
    doctor_fail "startup environment file syntax is invalid"
    return 1
  fi
  doctor_pass "startup environment file syntax is valid"
  return 0
}

doctor_check_startup_env_literals() {
  local integer_declaration=""
  local integer_name=""
  local integer_names=""
  local readonly_declaration=""
  local readonly_name=""
  local readonly_names=""
  while IFS= read -r integer_declaration; do
    if [[ "${integer_declaration}" =~ ^declare[[:space:]]+-[^[:space:]]*i[^[:space:]]*[[:space:]]+([A-Za-z_][A-Za-z0-9_]*)(=|$) ]]; then
      integer_name="${BASH_REMATCH[1]}"
      integer_names+="${integer_name}"$'\n'
    fi
  done < <(
    while IFS= read -r integer_name; do
      declare -p "${integer_name}" 2>/dev/null || true
    done < <(compgen -A variable)
  )
  while IFS= read -r readonly_declaration; do
    if [[ "${readonly_declaration}" =~ ^declare[[:space:]]+-[^[:space:]]*r[^[:space:]]*[[:space:]]+([A-Za-z_][A-Za-z0-9_]*)(=|$) ]]; then
      readonly_name="${BASH_REMATCH[1]}"
      readonly_names+="${readonly_name}"$'\n'
    fi
  done < <(readonly -p)

  if node - "${ROOT_DIR}" "${readonly_names}" "${integer_names}" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [rootDir, readonlyNamesInput = "", integerNamesInput = ""] = process.argv.slice(2);
const blockedShellNames = new Set(
  `${readonlyNamesInput}\n${integerNamesInput}`.split("\n").filter(Boolean),
);

function stripInlineComment(raw) {
  let quote = "";
  let escaped = false;
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === '"' && character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "#" && index > 0 && /\s/u.test(raw[index - 1])) {
      return raw.slice(0, index);
    }
  }
  if (quote || escaped) return null;
  return raw;
}

function logicalStatements(source) {
  if (source.includes("\r")) return null;
  const statements = [];
  let current = "";
  let quote = "";
  let escaped = false;
  let comment = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (comment) {
      if (character === "\n") {
        statements.push(current);
        current = "";
        comment = false;
      }
      continue;
    }
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (quote === '"' && character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      current += character;
      quote = character;
      continue;
    }
    if (character === "#" && (!current || /\s/u.test(current[current.length - 1]))) {
      comment = true;
      continue;
    }
    if (character === "\n") {
      statements.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (quote || escaped) return null;
  if (current || !source.endsWith("\n")) statements.push(current);
  return statements;
}

function parseLiteralAssignmentValue(raw, environment) {
  if (/^[ \t]/u.test(raw) && raw.trim() && !raw.trim().startsWith("#")) return null;
  const stripped = stripInlineComment(raw);
  if (stripped === null) return null;
  const value = stripped.trim();
  if (!value) return "";
  let quote = "";
  let parsed = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote === "'") {
      if (character === "'") quote = "";
      else parsed += character;
      continue;
    }
    if (quote === '"') {
      if (character === '"') {
        quote = "";
        continue;
      }
      if (character === "\\" || character === String.fromCharCode(96)) return null;
    } else {
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      if (index === 0 && character === "~") return null;
      if (/\s/u.test(character) || /[\\;|&<>()]/u.test(character) || character === String.fromCharCode(96)) return null;
    }
    if (character !== "$") {
      parsed += character;
      continue;
    }
    const parameter = value.slice(index).match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}|^\$([A-Za-z_][A-Za-z0-9_]*)/u);
    if (!parameter) return null;
    const key = parameter[1] || parameter[2];
    if (!Object.prototype.hasOwnProperty.call(environment, key)) return null;
    parsed += environment[key];
    index += parameter[0].length - 1;
  }
  return quote ? null : parsed;
}

const blockedStartupControlKeys = new Set([
  "BUILDKIT_PROGRESS",
  "DOCKER_API_VERSION",
  "DOCKER_CERT_PATH",
  "DOCKER_CONFIG",
  "DOCKER_CONTEXT",
  "DOCKER_CUSTOM_HEADERS",
  "DOCKER_DEFAULT_PLATFORM",
  "DOCKER_HIDE_LEGACY_COMMANDS",
  "DOCKER_HOST",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "IFS",
  "NODE_OPTIONS",
  "NO_COLOR",
  "NO_PROXY",
  "PATH",
  "ROOT_DIR",
  "http_proxy",
  "https_proxy",
  "no_proxy",
]);
const environment = { ...process.env, ROOT_DIR: rootDir };
let valid = true;
for (const envPath of [path.join(rootDir, ".env"), path.join(rootDir, ".env.local"), path.join(rootDir, "my-app", ".env")]) {
  if (!fs.existsSync(envPath)) continue;
  let source = "";
  try {
    source = fs.readFileSync(envPath, "utf8");
  } catch {
    valid = false;
    break;
  }
  const statements = logicalStatements(source);
  if (statements === null) {
    valid = false;
    break;
  }
  for (const statement of statements) {
    if (!statement.trim()) continue;
    const match = statement.match(/^\s*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/u);
    const parsedValue = match ? parseLiteralAssignmentValue(match[2], environment) : null;
    if (
      !match
      || blockedStartupControlKeys.has(match[1])
      || blockedShellNames.has(match[1])
      || parsedValue === null
    ) {
      valid = false;
      break;
    }
    environment[match[1]] = parsedValue;
  }
  if (!valid) break;
}
process.exit(valid ? 0 : 1);
NODE
  then
    doctor_pass "startup environment files contain literal assignments only"
    return 0
  fi
  doctor_fail "startup environment files must contain literal assignments only"
  return 1
}

doctor_load_runtime_overrides() {
  local target="${1:-local-fast}"
  local record_type=""
  local key=""
  local encoded=""
  local decoded=""
  local parsed=""
  if ! parsed="$(node - "${ROOT_DIR}" "${target}" <<'NODE'
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const [rootDir, target] = process.argv.slice(2);
const allowed = [
  "LOCAL_CONVEX_CLOUD_PORT",
  "LOCAL_CONVEX_SITE_PORT",
  "HOME",
  "IMAGE_NAME",
  "PARSER_NAME",
  "CLOUDFLARED_NAME",
  "CONVEX_TMPDIR",
  "CONVEX_TEAM",
  "CONVEX_TEAM_SLUG",
  "CONVEX_PROJECT",
  "CONVEX_PROJECT_SLUG",
  "CONVEX_LOCAL_DEPLOYMENT_NAME",
  "CONVEX_LOCAL_DEPLOYMENT",
  "CONVEX_DEPLOYMENT",
  "LOCAL_CONVEX_URL",
  "LOCAL_CONVEX_STARTUP_TIMEOUT",
];
if (target === "mcp-private-beta") allowed.push("MCP_PRIVATE_BETA_VITE_PORT", "FORCE_REBUILD");
else allowed.push("VITE_PORT");
const environment = { ...process.env, ROOT_DIR: rootDir };
const resolved = new Map(allowed.map((key) => [key, environment[key] || ""]));

function stripInlineComment(raw) {
  let quote = "";
  let escaped = false;
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === '"' && character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "#" && index > 0 && /\s/u.test(raw[index - 1])) {
      return raw.slice(0, index);
    }
  }
  if (quote || escaped) return null;
  return raw;
}

function logicalStatements(source) {
  if (source.includes("\r")) return null;
  const statements = [];
  let current = "";
  let quote = "";
  let escaped = false;
  let comment = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (comment) {
      if (character === "\n") {
        statements.push(current);
        current = "";
        comment = false;
      }
      continue;
    }
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (quote === '"' && character === "\\") {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      current += character;
      quote = character;
      continue;
    }
    if (character === "#" && (!current || /\s/u.test(current[current.length - 1]))) {
      comment = true;
      continue;
    }
    if (character === "\n") {
      statements.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (quote || escaped) return null;
  if (current || !source.endsWith("\n")) statements.push(current);
  return statements;
}

function parseValue(raw) {
  if (/^[ \t]/u.test(raw) && raw.trim() && !raw.trim().startsWith("#")) return null;
  const stripped = stripInlineComment(raw);
  if (stripped === null) return null;
  const value = stripped.trim();
  if (!value) return "";
  let quote = "";
  let parsed = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote === "'") {
      if (character === "'") quote = "";
      else parsed += character;
      continue;
    }
    if (quote === '"') {
      if (character === '"') {
        quote = "";
        continue;
      }
      if (character === "\\" || character === String.fromCharCode(96)) return null;
    } else {
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      if (index === 0 && character === "~") return null;
      if (/\s/u.test(character) || /[\\;|&<>()]/u.test(character) || character === String.fromCharCode(96)) return null;
    }
    if (character !== "$") {
      parsed += character;
      continue;
    }
    const parameter = value.slice(index).match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}|^\$([A-Za-z_][A-Za-z0-9_]*)/u);
    if (!parameter) return null;
    const key = parameter[1] || parameter[2];
    if (!Object.prototype.hasOwnProperty.call(environment, key)) return null;
    parsed += environment[key];
    index += parameter[0].length - 1;
  }
  return quote ? null : parsed;
}

const invalid = new Set();
const fatal = new Set();

for (const envPath of [path.join(rootDir, ".env"), path.join(rootDir, ".env.local"), path.join(rootDir, "my-app", ".env")]) {
  if (!fs.existsSync(envPath)) continue;
  let source = "";
  try {
    source = fs.readFileSync(envPath, "utf8");
  } catch {
    process.exit(1);
  }
  const statements = logicalStatements(source);
  if (statements === null) process.exit(1);
  for (const statement of statements) {
    const match = statement.match(/^\s*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)=([\s\S]*)$/u);
    if (match) {
      const [key, rawValue] = [match[1], match[2]];
      const value = parseValue(rawValue);
      if (value !== null) environment[key] = value;
      if (!allowed.includes(key)) continue;
      if (value === null) {
        invalid.add(key);
        fatal.add(key);
      } else {
        invalid.delete(key);
        resolved.set(key, value);
      }
      continue;
    }
    const malformed = statement.match(/^\s*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]+=/u);
    if (malformed && allowed.includes(malformed[1])) {
      invalid.add(malformed[1]);
      fatal.add(malformed[1]);
    }
  }
}

for (const [key, value] of resolved) {
  if (fatal.has(key) || invalid.has(key)) {
    process.stdout.write(`ERROR\t${key}\n`);
    continue;
  }
  if (!value) {
    process.stdout.write(`EMPTY\t${key}\n`);
    continue;
  }
  if (key.endsWith("_PORT")) {
    const port = Number(value);
    if (!/^[0-9]+$/u.test(value) || port < 1 || port > 65535) {
      process.stdout.write(`ERROR\t${key}\n`);
      continue;
    }
  }
  if (key === "LOCAL_CONVEX_STARTUP_TIMEOUT" && (!/^[0-9]+$/u.test(value) || !/[1-9]/u.test(value))) {
    process.stdout.write(`ERROR\t${key}\n`);
    continue;
  }
  if (key === "IMAGE_NAME") {
    // `docker image ls` accepts reference globs that `docker build -t` rejects.
    // Preserve a bracketed IPv6 registry authority, then block only glob syntax;
    // Docker validates the remaining reference grammar below.
    const authority = value.match(/^\[([^\]]+)\](?::[0-9]+)?\//u);
    const globCandidate = authority
      && /^[0-9A-Fa-f:]+$/u.test(authority[1])
      && net.isIP(authority[1]) === 6
      ? value.slice(authority[0].length)
      : value;
    if (/[*?\[\]]/u.test(globCandidate)) {
      process.stdout.write(`ERROR\t${key}\n`);
      continue;
    }
  }
  if ((key === "PARSER_NAME" || key === "CLOUDFLARED_NAME") && !/^[A-Za-z0-9][A-Za-z0-9_.-]+$/u.test(value)) {
    process.stdout.write(`ERROR\t${key}\n`);
    continue;
  }
  process.stdout.write(`VALUE\t${key}\t${Buffer.from(value, "utf8").toString("base64")}\n`);
}
NODE
  )"; then
    doctor_fail "runtime dotenv parser failed"
    return 1
  fi
  while IFS=$'\t' read -r record_type key encoded; do
    case "${record_type}" in
      VALUE)
        if ! decoded="$(node -e 'process.stdout.write(Buffer.from(process.argv[1], "base64").toString("utf8"))' "${encoded}" 2>/dev/null)"; then
          doctor_fail "runtime dotenv value decoder failed"
          continue
        fi
        case "${key}" in
          VITE_PORT) VITE_PORT="${decoded}" ;;
          LOCAL_CONVEX_CLOUD_PORT) LOCAL_CONVEX_CLOUD_PORT="${decoded}" ;;
          LOCAL_CONVEX_SITE_PORT) LOCAL_CONVEX_SITE_PORT="${decoded}" ;;
          MCP_PRIVATE_BETA_VITE_PORT) MCP_PRIVATE_BETA_VITE_PORT="${decoded}" ;;
          FORCE_REBUILD) FORCE_REBUILD="${decoded}" ;;
          HOME) HOME="${decoded}" ;;
          IMAGE_NAME) IMAGE_NAME="${decoded}" ;;
          PARSER_NAME) PARSER_NAME="${decoded}" ;;
          CLOUDFLARED_NAME) CLOUDFLARED_NAME="${decoded}" ;;
          CONVEX_TMPDIR) CONVEX_TMPDIR="${decoded}" ;;
          CONVEX_TEAM) CONVEX_TEAM="${decoded}" ;;
          CONVEX_TEAM_SLUG) CONVEX_TEAM_SLUG="${decoded}" ;;
          CONVEX_PROJECT) CONVEX_PROJECT="${decoded}" ;;
          CONVEX_PROJECT_SLUG) CONVEX_PROJECT_SLUG="${decoded}" ;;
          CONVEX_LOCAL_DEPLOYMENT_NAME) CONVEX_LOCAL_DEPLOYMENT_NAME="${decoded}" ;;
          CONVEX_LOCAL_DEPLOYMENT) CONVEX_LOCAL_DEPLOYMENT="${decoded}" ;;
          CONVEX_DEPLOYMENT) CONVEX_DEPLOYMENT="${decoded}" ;;
          LOCAL_CONVEX_URL) LOCAL_CONVEX_URL="${decoded}" ;;
          LOCAL_CONVEX_STARTUP_TIMEOUT) LOCAL_CONVEX_STARTUP_TIMEOUT="${decoded}" ;;
        esac
        ;;
      EMPTY)
        case "${key}" in
          VITE_PORT) VITE_PORT="5173" ;;
          LOCAL_CONVEX_CLOUD_PORT) LOCAL_CONVEX_CLOUD_PORT="3210" ;;
          LOCAL_CONVEX_SITE_PORT) LOCAL_CONVEX_SITE_PORT="3211" ;;
          MCP_PRIVATE_BETA_VITE_PORT) MCP_PRIVATE_BETA_VITE_PORT="5196" ;;
          FORCE_REBUILD) FORCE_REBUILD="false" ;;
          HOME) HOME="" ;;
          IMAGE_NAME) IMAGE_NAME="cv-parser-service:latest" ;;
          PARSER_NAME) PARSER_NAME="cv-parser-service-dev" ;;
          CLOUDFLARED_NAME) CLOUDFLARED_NAME="cloudflared" ;;
          CONVEX_TMPDIR) CONVEX_TMPDIR="${ROOT_DIR}/tmp/convex-tmp" ;;
          CONVEX_TEAM) CONVEX_TEAM="" ;;
          CONVEX_TEAM_SLUG) CONVEX_TEAM_SLUG="" ;;
          CONVEX_PROJECT) CONVEX_PROJECT="" ;;
          CONVEX_PROJECT_SLUG) CONVEX_PROJECT_SLUG="" ;;
          CONVEX_LOCAL_DEPLOYMENT_NAME) CONVEX_LOCAL_DEPLOYMENT_NAME="" ;;
          CONVEX_LOCAL_DEPLOYMENT) CONVEX_LOCAL_DEPLOYMENT="" ;;
          CONVEX_DEPLOYMENT) CONVEX_DEPLOYMENT="" ;;
          LOCAL_CONVEX_URL) LOCAL_CONVEX_URL="" ;;
          LOCAL_CONVEX_STARTUP_TIMEOUT) LOCAL_CONVEX_STARTUP_TIMEOUT="180" ;;
        esac
        ;;
      ERROR)
        if [[ "${key}" == "LOCAL_CONVEX_STARTUP_TIMEOUT" ]]; then
          doctor_fail "LOCAL_CONVEX_STARTUP_TIMEOUT must be a positive integer"
        elif [[ "${key}" == "IMAGE_NAME" ]]; then
          doctor_fail "IMAGE_NAME must be a valid Docker image reference"
        elif [[ "${key}" == "PARSER_NAME" || "${key}" == "CLOUDFLARED_NAME" ]]; then
          doctor_fail "${key} must be a valid Docker container name"
        else
          doctor_fail "dotenv override for ${key} is not a supported literal"
        fi
        ;;
    esac
  done <<< "${parsed}"
  return 0
}

doctor_check_runtime_path() {
  local path="${1:?path required}"
  local label="${2:?label required}"
  local parent=""
  if [[ "${path}" != /* ]]; then
    path="${ROOT_DIR}/${path}"
  fi
  if [[ -e "${path}" ]]; then
    if [[ -d "${path}" && -w "${path}" && -x "${path}" ]]; then
      doctor_pass "${label} is writable"
    else
      doctor_fail "${label} is not a writable directory"
    fi
    return 0
  fi
  parent="$(dirname "${path}")"
  while [[ ! -e "${parent}" && "${parent}" != "/" ]]; do
    parent="$(dirname "${parent}")"
  done
  if [[ -d "${parent}" && -w "${parent}" && -x "${parent}" ]]; then
    doctor_pass "${label} can be created"
  else
    doctor_fail "${label} cannot be created"
  fi
}

doctor_check_runtime_paths() {
  doctor_check_runtime_path "${ROOT_DIR}/tmp" "tmp runtime directory"
  doctor_check_runtime_path "${STATE_DIR}" "dev stack state directory"
  doctor_check_runtime_path "${ROOT_DIR}/.docker" "Docker state directory"
  doctor_check_runtime_path "${ROOT_DIR}/.buildx-cache" "build cache directory"
  doctor_check_runtime_path "${CONVEX_TMPDIR}" "Convex temporary directory"
}

doctor_check_port() {
  local port="${1:?port required}"
  local label="${2:?port label required}"
  local occupied_behavior="${3:-warn}"
  if ! port="$(doctor_normalize_port "${port}")"; then
    doctor_fail "${label} must be between 1 and 65535"
    return 0
  fi
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  if lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    if [[ "${occupied_behavior}" == "fail" ]]; then
      doctor_fail "${label} is already in use by an untracked process"
    else
      doctor_warn "${label} is already in use; stop the conflicting process or reuse the tracked stack"
    fi
  else
    doctor_pass "${label} is available"
  fi
}

doctor_check_vite_port() {
  local port="${1:?port required}"
  local label="${2:?port label required}"
  local normalized=""
  if ! normalized="$(doctor_normalize_port "${port}")"; then
    doctor_fail "${label} must be between 1 and 65535"
    return 0
  fi
  if (( normalized >= 5173 && normalized <= 5215 )); then
    doctor_check_port "${normalized}" "${label}" warn
  else
    doctor_check_port "${normalized}" "${label}" fail
  fi
}

doctor_normalize_port() {
  local port="${1:-}"
  [[ "${port}" =~ ^[0-9]+$ ]] || return 1
  while [[ "${port}" == 0* && "${#port}" -gt 1 ]]; do
    port="${port#0}"
  done
  [[ "${port}" != 0 && "${#port}" -le 5 ]] || return 1
  (( port <= 65535 )) || return 1
  printf '%s' "${port}"
}

doctor_port_value_is_valid() {
  doctor_normalize_port "${1:-}" >/dev/null
}

doctor_check_port_relationships() {
  local target="${1:?target required}"
  local cloud_port=""
  local site_port=""
  local vite_port=""
  cloud_port="$(doctor_normalize_port "${2:-}" 2>/dev/null || true)"
  site_port="$(doctor_normalize_port "${3:-}" 2>/dev/null || true)"
  if [[ "${target}" == "mcp-private-beta" ]]; then
    vite_port="$(doctor_normalize_port "${MCP_PRIVATE_BETA_VITE_PORT}" 2>/dev/null || true)"
  else
    vite_port="$(doctor_normalize_port "${VITE_PORT}" 2>/dev/null || true)"
  fi
  [[ -n "${cloud_port}" && -n "${site_port}" && -n "${vite_port}" ]] || return 0

  if [[ "${cloud_port}" == "${site_port}" ]]; then
    doctor_fail "resolved Convex cloud and site ports must be distinct"
  fi
  if [[ "${cloud_port}" == "8001" || "${site_port}" == "8001" ]]; then
    doctor_fail "resolved Convex ports must not collide with the parser"
  fi
  if (( (cloud_port >= 5173 && cloud_port <= 5215) || (site_port >= 5173 && site_port <= 5215) )); then
    doctor_fail "resolved Convex ports must stay outside the Vite cleanup range"
  fi
  if [[ "${vite_port}" == "8001" || "${vite_port}" == "${cloud_port}" || "${vite_port}" == "${site_port}" ]]; then
    doctor_fail "selected Vite port must not collide with parser or Convex ports"
  fi
}

doctor_check_local_convex_url_port() {
  local url="${1:-}"
  local cloud_port="${2:-}"
  local url_port=""
  [[ -n "${url}" ]] || return 0
  if [[ "${url}" =~ ^http://(127\.0\.0\.1|localhost):([0-9]+)$ ]]; then
    url_port="${BASH_REMATCH[2]}"
    if ! url_port="$(doctor_normalize_port "${url_port}")"; then
      doctor_fail "LOCAL_CONVEX_URL port must be between 1 and 65535"
      return 0
    fi
    cloud_port="$(doctor_normalize_port "${cloud_port}" 2>/dev/null || printf '%s' "${cloud_port}")"
    if [[ "${url_port}" != "${cloud_port}" ]]; then
      doctor_fail "LOCAL_CONVEX_URL port must match the resolved Convex cloud port"
    fi
  else
    doctor_fail "LOCAL_CONVEX_URL must be a loopback HTTP URL with an explicit port"
  fi
}

doctor_check_local_convex_state_config() {
  local config_path="${1:-}"
  [[ -n "${config_path}" ]] || return 0
  if [[ "${DOCTOR_NODE_READY:-0}" != "1" ]]; then
    return 1
  fi
  if node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "${config_path}" >/dev/null 2>&1; then
    doctor_pass "local Convex state configuration is valid JSON"
    return 0
  fi
  doctor_fail "local Convex state configuration is invalid JSON"
  return 1
}

doctor_running_parser_matches_target() {
  local target="${1:-local-fast}"
  local expected_runtime="workspace"
  command -v docker >/dev/null 2>&1 || return 1
  if [[ "${target}" == "mcp-private-beta" ]]; then
    expected_runtime="image"
  fi
  container_is_owned_by_run_sh "${PARSER_NAME}" || return 1
  parser_container_matches_runtime "${expected_runtime}"
}

doctor_running_parser_is_tracked() {
  command -v docker >/dev/null 2>&1 || return 1
  docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${PARSER_NAME}" \
    && container_is_owned_by_run_sh "${PARSER_NAME}"
}

parser_container_owns_port() {
  command -v docker >/dev/null 2>&1 || return 1
  docker port "${PARSER_NAME}" 8001/tcp 2>/dev/null | grep -Eq '(^|:)8001$'
}

workspace_runtime_surface_probe() {
  docker exec "${PARSER_NAME}" node -e 'const fs = require("fs"); const platformTag = `${process.platform}-${process.arch}`; const checks = [["tsx loader", "/app/my-app/node_modules/tsx/dist/esm/index.mjs"], ["playwright package", "/app/node_modules/playwright"], ["playwright browsers", "/ms-playwright"], [`esbuild package (${platformTag})`, `/app/my-app/node_modules/@esbuild/${platformTag}`]]; const missing = checks.filter(([, path]) => !fs.existsSync(path)); if (missing.length) { console.error(missing.map(([label, path]) => `${label}: ${path}`).join("\n")); process.exit(1); }'
}

doctor_local_fast_tracked_stack_will_restart_parser() {
  local VITE_PID=""; local PARSER_STARTED="0"; local CONVEX_PID=""; local CONVEX_URL=""; local TUNNEL_STARTED="0"; local STACK_MODE=""
  local ACTIVE_ORIGIN=""; local PARSER_RUNTIME_MODE=""; local PARSER_RELOAD="0"; local PARSER_OCR="auto"; local CONVEX_MODE="cloud"; local UI_STARTED="0"; local ENV_HASH=""; local CONVEX_BINDING_HASH=""
  local current_env_hash=""
  [[ -f "${STATE_FILE}" ]] || return 1
  read_state
  [[ "${STACK_MODE:-}" == "local-fast" ]] || return 1
  [[ "${ACTIVE_ORIGIN:-}" == "http://127.0.0.1:8001" ]] || return 1
  [[ "${PARSER_STARTED:-0}" == "1" ]] || return 1
  [[ "${PARSER_RUNTIME_MODE:-}" == "workspace" ]] || return 1
  [[ "${PARSER_RELOAD:-0}" == "1" ]] || return 1
  [[ "${PARSER_OCR:-auto}" == "auto" ]] || return 1
  [[ "${CONVEX_MODE:-cloud}" == "local" ]] || return 1
  [[ "${UI_STARTED:-0}" == "1" ]] || return 1
  [[ "${TUNNEL_STARTED:-0}" == "0" ]] || return 1
  tracked_stack_is_live || return 1
  if ! current_env_hash="$(env_reload_hash 2>/dev/null)"; then
    return 0
  fi
  [[ "${ENV_HASH:-}" != "${current_env_hash}" ]]
}

doctor_docker_endpoint_is_local() {
  local context_name=""
  local endpoint=""
  if [[ -n "${DOCKER_HOST:-}" ]]; then
    endpoint="${DOCKER_HOST}"
  else
    context_name="$(docker context show 2>/dev/null || true)"
    [[ -n "${context_name}" ]] || return 1
    endpoint="$(docker context inspect "${context_name}" --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)"
  fi
  case "${endpoint}" in
    unix://*|npipe://*) return 0 ;;
    *) return 1 ;;
  esac
}

doctor_check_docker() {
  local target="${1:-local-fast}"
  local parser_reusable="${2:-0}"
  local force_rebuild_requested=0
  if ! command -v docker >/dev/null 2>&1; then
    return 0
  fi
  if docker info >/dev/null 2>&1; then
    doctor_pass "Docker daemon is reachable"
  else
    case "$(uname -s 2>/dev/null || true)" in
      Darwin)
        doctor_fail "Docker daemon is unavailable; start Docker Desktop, then rerun: ./run.sh doctor ${target}"
        ;;
      Linux)
        if is_wsl_runtime; then
          doctor_fail "Docker daemon is unavailable; start Docker Desktop and enable WSL2 integration, then rerun: ./run.sh doctor ${target}"
        else
          doctor_fail "Docker daemon is unavailable; start the local Docker daemon (for example: sudo systemctl start docker), then rerun: ./run.sh doctor ${target}"
        fi
        ;;
      *)
        doctor_fail "Docker daemon is unavailable; start the local Docker daemon, then rerun: ./run.sh doctor ${target}"
        ;;
    esac
    return 0
  fi
  if doctor_docker_endpoint_is_local; then
    doctor_pass "Docker daemon uses a local socket"
  else
    doctor_fail "Docker daemon must use a local socket"
    return 0
  fi

  if ! docker image ls "${IMAGE_NAME}" --format '{{.ID}}' >/dev/null 2>&1; then
    doctor_fail "IMAGE_NAME must be a valid Docker image reference"
    return 0
  fi

  if [[ "${target}" == "mcp-private-beta" && "$(to_bool "${FORCE_REBUILD}")" == "true" ]]; then
    force_rebuild_requested=1
  fi

  if (( force_rebuild_requested )) && docker buildx inspect >/dev/null 2>&1; then
    doctor_pass "forced parser rebuild has an available buildx builder"
  elif (( force_rebuild_requested )) && docker buildx version >/dev/null 2>&1; then
    doctor_warn "forced parser rebuild requires a builder; mcp-private-beta startup will configure it"
  elif (( force_rebuild_requested )); then
    doctor_fail "forced parser rebuild requires Docker buildx"
  elif [[ "${target}" == "local-fast" && "${parser_reusable}" == "1" ]]; then
    doctor_pass "parser runtime image is not required while the tracked parser is reusable"
  elif docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1; then
    doctor_pass "parser runtime image is available"
  elif [[ "${target}" == "local-fast" ]] && docker buildx inspect >/dev/null 2>&1; then
    doctor_warn "parser runtime image is missing; local-fast startup will build it with the configured builder"
  elif [[ "${target}" == "local-fast" ]] && docker buildx version >/dev/null 2>&1; then
    doctor_warn "parser runtime image is missing; local-fast startup will configure a builder and build it"
  elif [[ "${target}" == "mcp-private-beta" ]] && docker buildx inspect >/dev/null 2>&1; then
    doctor_warn "parser runtime image is missing; mcp-private-beta startup will build it with the available builder"
  elif [[ "${target}" == "mcp-private-beta" ]] && docker buildx version >/dev/null 2>&1; then
    doctor_warn "parser runtime image and buildx builder are missing; mcp-private-beta startup will configure the builder and build the image"
  else
    doctor_fail "parser runtime image is missing and cannot be prepared by the selected startup"
  fi
}

doctor_check_mcp_configuration() {
  local original_home="${1:-}"
  if [[ "${DOCTOR_NODE_READY:-0}" != "1" ]]; then
    doctor_fail "private-beta MCP configuration cannot be validated without a working Node 20+ runtime"
    return 0
  fi

  if node - \
    "${ROOT_DIR}" \
    "${MCP_PRIVATE_BETA_TUNNEL_ID}" \
    "${MCP_PRIVATE_BETA_CLIENT_ID}" \
    "${MCP_PRIVATE_BETA_RESOURCE}" \
    "${MCP_PRIVATE_BETA_AUTHORIZATION_ORIGIN}" \
    "${MCP_PRIVATE_BETA_REDIRECT_URI}" \
    "${original_home}" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [rootDir, tunnelId, clientId, resource, authorizationOrigin, redirectUri, originalHome] = process.argv.slice(2);
const baseEnvironment = { ...process.env, HOME: originalHome };
const rootEnvPath = path.join(rootDir, ".env.local");
const otherEnvPaths = [
  path.join(rootDir, ".env"),
  path.join(rootDir, "my-app", ".env"),
  path.join(rootDir, "my-app", ".env.local"),
];
let failures = 0;
const fatalDotenvValue = "\u0000fatal";

function fail(message) {
  failures += 1;
  process.stderr.write(`[run] doctor: MCP config - ${message}\n`);
}

function stripInlineComment(raw) {
  let quote = "";
  let escaped = false;
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === '"' && character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "#" && index > 0 && /\s/u.test(raw[index - 1])) {
      return raw.slice(0, index);
    }
  }
  if (quote || escaped) return null;
  return raw;
}

function parseLiteralAssignmentValue(raw, environment) {
  if (/^[ \t]/u.test(raw) && raw.trim() && !raw.trim().startsWith("#")) return null;
  const stripped = stripInlineComment(raw);
  if (stripped === null) return null;
  const value = stripped.trim();
  if (!value) return "";
  let quote = "";
  let parsed = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote === "'") {
      if (character === "'") quote = "";
      else parsed += character;
      continue;
    }
    if (quote === '"') {
      if (character === '"') {
        quote = "";
        continue;
      }
      if (character === "\\" || character === String.fromCharCode(96)) return null;
    } else {
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      if (index === 0 && character === "~") return null;
      if (/\s/u.test(character) || /[\\;|&<>()]/u.test(character) || character === String.fromCharCode(96)) return null;
    }
    if (character !== "$") {
      parsed += character;
      continue;
    }
    const parameter = value.slice(index).match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}|^\$([A-Za-z_][A-Za-z0-9_]*)/u);
    if (!parameter) return null;
    const key = parameter[1] || parameter[2];
    if (!Object.prototype.hasOwnProperty.call(environment, key)) return null;
    parsed += environment[key];
    index += parameter[0].length - 1;
  }
  return quote ? null : parsed;
}

function parseDotenv(filePath, environment) {
  const result = new Map();
  function record(key, value) {
    if (value === fatalDotenvValue || result.get(key) !== fatalDotenvValue) {
      result.set(key, value);
    }
  }
  if (!fs.existsSync(filePath)) return result;
  let source = "";
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch {
    fail("startup environment file could not be read");
    return result;
  }
  for (const line of source.split(/\r?\n/u)) {
    const match = line.match(/^\s*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match) {
      const malformed = line.match(/^\s*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]+=/u);
      if (malformed) record(malformed[1], fatalDotenvValue);
      continue;
    }
    const value = parseLiteralAssignmentValue(match[2], environment);
    if (value === null) {
      record(match[1], fatalDotenvValue);
      continue;
    }
    record(match[1], value);
    environment[match[1]] = value;
  }
  return result;
}

const canonicalKeys = [
  "MCP_OAUTH_PRODUCTION_RUNTIME",
  "MCP_OAUTH_PRODUCTION_APPROVED",
  "MCP_OAUTH_PRODUCTION_ROUTE_WIRING",
  "MCP_OAUTH_PRODUCTION_CLIENT_IDS",
  "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_ENABLED",
  "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_CLIENT_IDS",
  "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES",
  "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS",
  "MCP_OAUTH_PRODUCTION_RESOURCE",
  "MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN",
  "MCP_OAUTH_PRODUCTION_REDIRECT_URIS",
  "MCP_OAUTH_PRODUCTION_ISSUER",
  "MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT",
  "MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256",
  "CLERK_JWT_ISSUER_DOMAIN",
  "CONVEX_URL",
  "CONVEX_AUTH_TOKEN",
];

try {
  const mode = (fs.lstatSync(rootEnvPath).mode & 0o777).toString(8);
  if (mode !== "600") fail("root .env.local must have mode 600");
} catch (error) {
  if (error && error.code === "ENOENT") fail("root .env.local is required");
  else fail("root .env.local could not be inspected");
}

const startupEnvPaths = [otherEnvPaths[0], rootEnvPath, otherEnvPaths[1]];
const rootEnvironment = { ...baseEnvironment, ROOT_DIR: rootDir };
parseDotenv(otherEnvPaths[0], rootEnvironment);
const rootEnv = parseDotenv(rootEnvPath, rootEnvironment);
const startupEnvironment = { ...baseEnvironment, ROOT_DIR: rootDir };
const startupEnvs = startupEnvPaths.map((envPath) => parseDotenv(envPath, startupEnvironment));
for (const env of [...startupEnvs, parseDotenv(otherEnvPaths[2], { ...startupEnvironment })]) {
  if (env.has("MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECTS")) {
    fail("raw private-beta subject identifiers are forbidden; configure only subject digests");
  }
}

function resolveStartupValue(key) {
  let value = baseEnvironment[key] ?? "";
  let present = Object.prototype.hasOwnProperty.call(baseEnvironment, key);
  let fatal = false;
  for (const env of startupEnvs) {
    if (!env.has(key)) continue;
    present = true;
    const nextValue = env.get(key);
    if (nextValue === fatalDotenvValue) fatal = true;
    else {
      value = nextValue;
    }
  }
  return { fatal, present, value };
}

for (const key of canonicalKeys) {
  if (rootEnv.get(key) === fatalDotenvValue) fail(`${key} must use a supported literal assignment`);
  else if (!rootEnv.has(key)) fail(`${key} must be defined in root .env.local`);
}

const expected = new Map([
  ["MCP_OAUTH_PRODUCTION_RUNTIME", "1"],
  ["MCP_OAUTH_PRODUCTION_APPROVED", "1"],
  ["MCP_OAUTH_PRODUCTION_ROUTE_WIRING", "1"],
  ["MCP_OAUTH_PRODUCTION_CLIENT_IDS", clientId],
  ["MCP_OAUTH_PRODUCTION_PRIVATE_BETA_ENABLED", "1"],
  ["MCP_OAUTH_PRODUCTION_PRIVATE_BETA_CLIENT_IDS", clientId],
  ["MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES", resource],
  ["MCP_OAUTH_PRODUCTION_RESOURCE", resource],
  ["MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN", authorizationOrigin],
  ["MCP_OAUTH_PRODUCTION_REDIRECT_URIS", redirectUri],
]);
for (const [key, expectedValue] of expected) {
  if (rootEnv.get(key) !== expectedValue) fail(`${key} is missing or does not match the private-beta contract`);
}

for (const key of [
  "MCP_OAUTH_PRODUCTION_ISSUER",
  "MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT",
  "MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256",
  "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS",
  "CLERK_JWT_ISSUER_DOMAIN",
  "CONVEX_URL",
  "CONVEX_AUTH_TOKEN",
]) {
  if (!rootEnv.get(key)) fail(`${key} is missing`);
}
if (!/^[0-9a-f]{64}$/u.test(rootEnv.get("MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256") ?? "")) {
  fail("MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256 must be lowercase SHA-256 hex");
}
if (!/^(?:[0-9a-f]{64})(?:,[0-9a-f]{64})*$/u.test(rootEnv.get("MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS") ?? "")) {
  fail("MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS must contain lowercase SHA-256 hex digests");
}
try {
  const issuer = new URL(rootEnv.get("CLERK_JWT_ISSUER_DOMAIN") ?? "");
  if (issuer.protocol !== "https:" || issuer.username || issuer.password || issuer.pathname !== "/" || issuer.search || issuer.hash) {
    throw new Error("invalid issuer");
  }
  const prefix = issuer.hostname.endsWith(".clerk.accounts.dev") ? "pk_test_" : "pk_live_";
  const derivedPublishableKey = `${prefix}${Buffer.from(`${issuer.hostname}$`, "utf8").toString("base64")}`;
  const configuredPublishableKey = resolveStartupValue("VITE_CLERK_PUBLISHABLE_KEY");
  if (configuredPublishableKey.fatal) {
    fail("VITE_CLERK_PUBLISHABLE_KEY must use a supported literal assignment");
  } else if (configuredPublishableKey.value && configuredPublishableKey.value !== derivedPublishableKey) {
    fail("configured Clerk publishable key does not match CLERK_JWT_ISSUER_DOMAIN");
  }
} catch {
  fail("CLERK_JWT_ISSUER_DOMAIN must be a canonical HTTPS origin");
}

for (const envPath of otherEnvPaths) {
  const env = parseDotenv(envPath, { ...process.env });
  if (canonicalKeys.some((key) => env.has(key))) {
    fail("canonical server keys are allowed only in root .env.local");
    break;
  }
}
if ([rootEnv, parseDotenv(otherEnvPaths[2], { ...process.env })].some((env) => [...env.keys()].some((key) => key.startsWith("MCP_PRODUCTION_PRIVATE_BETA_")))) {
  fail("legacy MCP_PRODUCTION_PRIVATE_BETA_* aliases are forbidden");
}

const configuredCredentialsFile = resolveStartupValue("MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE");
if (configuredCredentialsFile.fatal) {
  fail("MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE must use a supported literal assignment");
}
if (configuredCredentialsFile.value && configuredCredentialsFile.value.startsWith("~")) {
  fail("MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE must not use tilde expansion");
}
const configuredHome = resolveStartupValue("HOME");
if (configuredHome.fatal || !configuredHome.value) fail("HOME must use a supported non-empty literal assignment");
const defaultCredentialsFile = path.join(configuredHome.value || process.env.HOME || "", ".cloudflared", `${tunnelId}.json`);
const credentialsFile = configuredCredentialsFile.value || defaultCredentialsFile;
if (credentialsFile.includes(",")) fail("MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE must not contain commas");
if (!fs.existsSync(credentialsFile)) {
  fail("named MCP tunnel credentials file is missing");
} else {
  try {
    const credentialsStat = fs.statSync(credentialsFile);
    if (!credentialsStat.isFile()) fail("named MCP tunnel credentials path must be a regular file");
    const mode = (fs.lstatSync(credentialsFile).mode & 0o777).toString(8);
    if (mode !== "400" && mode !== "600") fail("named MCP tunnel credentials file must have mode 400 or 600");
  } catch {
    fail("named MCP tunnel credentials file could not be inspected");
  }
}

process.exit(failures === 0 ? 0 : 1);
NODE
  then
    doctor_pass "private-beta MCP configuration is valid"
  else
    doctor_fail "private-beta MCP configuration is invalid"
  fi
}

doctor() {
  local target="${1:-local-fast}"
  local original_home="${HOME:-}"
  local resolved_convex_cloud_port=""
  local resolved_convex_site_port=""
  local resolved_convex_url=""
  local convex_reusable=0
  local parser_reusable=0
  if [[ "${target}" != "local-fast" && "${target}" != "mcp-private-beta" ]]; then
    echo "usage: ./run.sh doctor [local-fast|mcp-private-beta]" >&2
    return 2
  fi

  DOCTOR_FAILURES=0
  DOCTOR_WARNINGS=0
  DOCTOR_NODE_READY=0

  echo "[run] doctor: checking ${target} (values are not printed)"
  doctor_check_platform
  doctor_check_command docker
  doctor_check_command node
  if command -v npm >/dev/null 2>&1; then
    doctor_pass "npm command is available"
  else
    doctor_warn "npm command is missing; dependency installation commands will be unavailable"
  fi
  doctor_check_command curl
  doctor_check_command seq
  if command -v lsof >/dev/null 2>&1; then
    doctor_pass "lsof command is available"
  else
    doctor_warn "lsof command is missing; port conflict checks will be skipped"
  fi
  doctor_check_startup_env_syntax || true
  if command -v node >/dev/null 2>&1 && doctor_check_node_runtime; then
    DOCTOR_NODE_READY=1
    doctor_check_startup_env_literals || true
    doctor_load_runtime_overrides "${target}" || true
  fi
  resolved_convex_cloud_port="${LOCAL_CONVEX_CLOUD_PORT}"
  resolved_convex_site_port="${LOCAL_CONVEX_SITE_PORT}"
  doctor_check_file "${ROOT_DIR}/cv_parser_service/Dockerfile" "parser Dockerfile"
  doctor_check_file "${ROOT_DIR}/my-app/package.json" "frontend package manifest"
  doctor_check_file "${ROOT_DIR}/my-app/node_modules/vite/bin/vite.js" "Vite dependency" "run: npm ci --prefix my-app"
  doctor_check_executable "${ROOT_DIR}/my-app/node_modules/.bin/convex" "Convex CLI dependency" "run: npm ci --prefix my-app"
  doctor_check_file "${ROOT_DIR}/scripts/local-convex-supervisor.cjs" "local Convex supervisor"
  doctor_check_runtime_paths

  if resolve_convex_project_binding >/dev/null 2>&1; then
    doctor_pass "Convex team/project binding is available"
    resolve_local_convex_runtime "${CONVEX_DEPLOYMENT_NAME_RESULT:-}"
    resolved_convex_cloud_port="${LOCAL_CONVEX_CLOUD_PORT_RESULT:-${LOCAL_CONVEX_CLOUD_PORT}}"
    resolved_convex_site_port="${LOCAL_CONVEX_SITE_PORT_RESULT:-${LOCAL_CONVEX_SITE_PORT}}"
    resolved_convex_url="${LOCAL_CONVEX_URL_RESULT:-}"
    if doctor_check_local_convex_state_config "${LOCAL_CONVEX_STATE_CONFIG_RESULT:-}" \
      && reuse_running_local_convex_from_state "${CONVEX_DEPLOYMENT_NAME_RESULT:-}" >/dev/null 2>&1; then
      convex_reusable=1
      doctor_pass "tracked local Convex backend is reusable"
    fi
  else
    doctor_fail "Convex team/project binding is missing; configure CONVEX_TEAM and CONVEX_PROJECT"
  fi

  if local_convex_deployments_disabled; then
    doctor_fail "local Convex deployments are disabled; re-enable them before starting this target"
  else
    doctor_pass "local Convex deployments are enabled"
  fi

  if doctor_running_parser_matches_target "${target}"; then
    if ! parser_container_owns_port; then
      doctor_fail "tracked parser does not publish the required host port"
    elif ! curl -fsS http://127.0.0.1:8001/ready >/dev/null 2>&1; then
      doctor_fail "tracked parser is not ready"
    elif [[ "${target}" == "local-fast" ]] && ! workspace_runtime_surface_probe >/dev/null 2>&1; then
      doctor_fail "tracked workspace parser is missing runtime dependencies"
    else
      parser_reusable=1
      doctor_pass "tracked parser is reusable"
    fi
  elif doctor_running_parser_is_tracked; then
    if parser_container_owns_port; then
      doctor_pass "tracked parser can be replaced by startup"
    else
      doctor_check_port 8001 "parser port" fail
    fi
  else
    doctor_check_port 8001 "parser port" fail
  fi
  if (( parser_reusable )) \
    && [[ "${target}" == "local-fast" ]] \
    && doctor_local_fast_tracked_stack_will_restart_parser; then
    parser_reusable=0
    doctor_warn "tracked local-fast stack will restart the parser because environment files changed"
  fi
  doctor_check_docker "${target}" "${parser_reusable}"
  if (( convex_reusable )); then
    doctor_pass "tracked local Convex ports are reusable"
  else
    doctor_check_port "${resolved_convex_cloud_port}" "resolved Convex cloud port" fail
    doctor_check_port "${resolved_convex_site_port}" "resolved Convex site port" fail
  fi
  doctor_check_local_convex_url_port "${resolved_convex_url}" "${resolved_convex_cloud_port}"
  doctor_check_port_relationships "${target}" "${resolved_convex_cloud_port}" "${resolved_convex_site_port}"
  if [[ "${target}" == "mcp-private-beta" ]]; then
    doctor_check_vite_port "${MCP_PRIVATE_BETA_VITE_PORT}" "MCP_PRIVATE_BETA_VITE_PORT"
    doctor_check_mcp_configuration "${original_home}"
    doctor_check_mcp_tunnel_network
  else
    doctor_check_vite_port "${VITE_PORT}" "VITE_PORT"
    doctor_pass "my-app/.env.local remains Vite-only; server configuration remains in root .env.local"
  fi

  if (( DOCTOR_FAILURES > 0 )); then
    echo "[run] doctor: FAIL (${DOCTOR_FAILURES} blocker(s), ${DOCTOR_WARNINGS} warning(s); values were not printed)" >&2
    return 1
  fi
  echo "[run] doctor: PASS (${DOCTOR_WARNINGS} warning(s); values were not printed)"
}

ensure_buildx() {
  if ! docker buildx inspect >/dev/null 2>&1; then
    echo "[run] configuring docker buildx builder"
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
    echo "[run] runtime image up-to-date (${IMAGE_NAME})"
    return 0
  fi

  ensure_buildx
  echo "[run] building parser runtime image (${IMAGE_NAME}, ${platform})"
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
    echo "[run] runtime image available (${IMAGE_NAME})"
    return 0
  fi
  echo "[run] runtime image missing; building ${IMAGE_NAME}"
  build_runtime_image
}

require_port_available() {
  local port="${1:?port required}"
  local label="${2:?label required}"
  if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[run] ERROR: ${label} is already in use; run ./run.sh status or stop the owning process explicitly." >&2
    return 1
  fi
}

process_is_owned_by_run_sh() {
  local pid="${1:-}"
  [[ "${pid}" =~ ^[0-9]+$ ]] || return 1
  kill -0 "${pid}" >/dev/null 2>&1 || return 1
  command -v ps >/dev/null 2>&1 || return 1
  ps ww -p "${pid}" -o command= 2>/dev/null | grep -Fq "${RUN_OWNER_PROCESS_PREFIX}:"
}

stop_owned_process() {
  local pid="${1:-}"
  local label="${2:?label required}"
  [[ -n "${pid}" ]] || return 0
  if ! [[ "${pid}" =~ ^[0-9]+$ ]]; then
    echo "[run] ERROR: refusing to stop ${label}; tracked PID is invalid." >&2
    return 1
  fi
  if ! kill -0 "${pid}" >/dev/null 2>&1; then
    return 0
  fi
  if ! process_is_owned_by_run_sh "${pid}"; then
    echo "[run] ERROR: refusing to stop unowned ${label} process (PID ${pid})." >&2
    return 1
  fi
  echo "[run] stopping ${label} (PID ${pid})"
  kill -TERM -- "-${pid}" >/dev/null 2>&1 || kill "${pid}" >/dev/null 2>&1 || true
  wait "${pid}" 2>/dev/null || true
  for _ in {1..20}; do
    kill -0 "${pid}" >/dev/null 2>&1 || return 0
    process_is_owned_by_run_sh "${pid}" || return 0
    sleep 0.1
  done
  if process_is_owned_by_run_sh "${pid}"; then
    echo "[run] ${label} did not stop after SIGTERM; sending SIGKILL to its owned process group." >&2
    kill -KILL -- "-${pid}" >/dev/null 2>&1 || kill -KILL "${pid}" >/dev/null 2>&1 || true
  fi
}

container_owner_id() {
  local name="${1:?container name required}"
  docker inspect --format "{{ index .Config.Labels \"${RUN_OWNER_LABEL}\" }}" "${name}" 2>/dev/null || true
}

container_is_owned_by_run_sh() {
  local name="${1:?container name required}"
  [[ "$(container_owner_id "${name}")" == "${RUN_OWNER_ID}" ]]
}

require_owned_container() {
  local name="${1:?container name required}"
  local label="${2:?label required}"
  if ! container_is_owned_by_run_sh "${name}"; then
    echo "[run] ERROR: refusing to stop or replace unowned ${label} container (${name})." >&2
    return 1
  fi
}

write_state() {
  mkdir -p "${STATE_DIR}"
  {
    printf 'STATE_OWNER_ID=%s\n' "${RUN_OWNER_ID}"
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
  STATE_OWNER_ID=""
  [[ -f "${STATE_FILE}" ]] || return 0
  while IFS='=' read -r k v; do
    case "$k" in
      STATE_OWNER_ID) STATE_OWNER_ID="$v" ;;
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
  ./run.sh doctor [target]  read-only startup diagnostics for local-fast or mcp-private-beta
  ./run.sh mcp-private-beta  reproducible private-beta MCP origin + tunnel
  ./run.sh mcp-secret-sync   refresh the OAuth digest from Infisical without printing values
  ./run.sh mcp-check         validate MCP runtime keys without printing values
  ./run.sh tunnel          stable full workflow
  ./run.sh local-fast      fast full-app parser development
  ./run.sh parser-dev      parser-only hacking
  ./run.sh reload-env      restart-only refresh after env changes
  ./run.sh rebuild-docker  rebuild runtime / Docker stack
  ./run.sh down            normal stop
  ./run.sh reset           stronger cleanup
  ./run.sh status          quick stack status
  ./run.sh logs            parser logs
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

parser_container_matches_runtime() {
  local expected_runtime="${1:-image}"
  local current_runtime=""
  local current_image=""
  local expected_image=""
  parser_container_running || return 1
  current_runtime="$(parser_runtime_mode)"
  [[ "${current_runtime}" == "${expected_runtime}" ]] || return 1
  if [[ "${expected_runtime}" == "workspace" ]]; then
    return 0
  fi
  current_image="$(parser_image_id)"
  expected_image="$(target_image_id)"
  [[ -n "${current_image}" && -n "${expected_image}" && "${current_image}" == "${expected_image}" ]]
}

tunnel_container_running() {
  docker ps --format '{{.Names}}' | grep -qx "${CLOUDFLARED_NAME}"
}

vite_process_running() {
  [[ -n "${VITE_PID:-}" ]] && process_is_owned_by_run_sh "${VITE_PID}"
}

convex_process_running() {
  [[ -n "${CONVEX_PID:-}" ]] \
    && process_is_owned_by_run_sh "${CONVEX_PID}" \
    && [[ -n "${CONVEX_URL:-}" ]] \
    && is_convex_ready "${CONVEX_URL}"
}

tracked_stack_is_live() {
  if [[ "${PARSER_STARTED:-0}" == "1" ]]; then
    container_is_owned_by_run_sh "${PARSER_NAME}" || return 1
    parser_container_matches_runtime "${PARSER_RUNTIME_MODE:-image}" || return 1
    parser_container_owns_port || return 1
    curl -fsS http://127.0.0.1:8001/ready >/dev/null 2>&1 || return 1
    if [[ "${PARSER_RUNTIME_MODE:-image}" == "workspace" ]]; then
      workspace_runtime_surface_probe >/dev/null 2>&1 || return 1
    fi
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
  if state_requests_tunnel && ! container_is_owned_by_run_sh "${CLOUDFLARED_NAME}"; then
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
  if [[ "${STATE_OWNER_ID:-}" != "${RUN_OWNER_ID}" ]]; then
    echo "[run] ERROR: tracked stack state is legacy or belongs to another worktree; run ./run.sh doctor before recovery." >&2
    return 1
  fi
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
    echo "[run] detected env change for active ${requested_stack_mode} stack; reloading without Docker rebuild"
    reload_env_stack
  else
    echo "[run] ${requested_stack_mode} already matches current env; nothing to do"
  fi
  return 0
}

ensure_workspace_runtime_surface() {
  local diagnostic=""
  diagnostic="$(workspace_runtime_surface_probe 2>&1)" || {
    echo "[run] ERROR: workspace parser runtime is missing export dependencies." >&2
    if [[ -n "${diagnostic}" ]]; then
      echo "${diagnostic}" >&2
    fi
    echo "[run] Run \`./run.sh rebuild-docker\` to refresh the parser/export runtime image, then retry \`./run.sh local-fast\`." >&2
    stop_parser || true
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
  grep -Eo "\"${field}\"[[:space:]]*:[[:space:]]*[0-9]+" "${file}" \
    | head -n1 \
    | tr -d '[:space:]' \
    | cut -d: -f2
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
    echo "[run] ERROR: Convex local deployments are disabled on this machine." >&2
    echo "[run] Run \`cd my-app && npx convex disable-local-deployments --undo-global\` and retry local-fast." >&2
    exit 1
  fi

  local active_name=""
  active_name="$(local_convex_instance_name "${convex_url}")"
  if [[ -n "${active_name}" ]]; then
    if [[ -n "${deployment_name}" && "${active_name}" != "${deployment_name}" ]]; then
      echo "[run] ERROR: a different local Convex backend (${active_name}) is already running at ${convex_url}." >&2
      echo "[run] Use ./run.sh down or ./run.sh reset for this repo, or stop the conflicting backend before retrying." >&2
      exit 1
    fi
    echo "[run] ERROR: local Convex backend ${active_name} is already running at ${convex_url}, but it is not tracked by this run.sh state." >&2
    echo "[run] Stop it with ./run.sh reset or terminate the existing \`convex dev\` process before retrying." >&2
    exit 1
  fi

  local cloud_listener=""
  local site_listener=""
  cloud_listener="$(port_listener_details "${cloud_port}")"
  if [[ -n "${cloud_listener}" ]]; then
    echo "[run] ERROR: local Convex cloud port ${cloud_port} is already occupied by a non-Convex listener." >&2
    echo "${cloud_listener}" >&2
    exit 1
  fi
  site_listener="$(port_listener_details "${site_port}")"
  if [[ -n "${site_listener}" ]]; then
    echo "[run] ERROR: local Convex site port ${site_port} is already occupied by another listener." >&2
    echo "${site_listener}" >&2
    exit 1
  fi
}

reuse_running_local_convex_from_state() {
  local expected_name="${1:-}"
  local VITE_PID=""; local PARSER_STARTED="0"; local CONVEX_PID=""; local CONVEX_URL=""; local TUNNEL_STARTED="0"; local STACK_MODE=""
  read_state

  [[ "${STATE_OWNER_ID:-}" == "${RUN_OWNER_ID}" ]] || return 1
  if [[ -z "${CONVEX_PID:-}" || -z "${CONVEX_URL:-}" ]]; then
    return 1
  fi
  if ! process_is_owned_by_run_sh "${CONVEX_PID}"; then
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

  echo "[run] reusing tracked local Convex backend ${active_name:-unknown} at ${CONVEX_URL}" >&2
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
    ENABLE_MCP_CONTROLLED_SYNTHETIC_RAIL
    MISTRAL_API_KEY
    MCP_CONTROLLED_SYNTHETIC_RAIL_MODE
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
  echo "[run] syncing local Convex env" >&2
  (
    cd "${ROOT_DIR}/my-app"
    local convex_bin="./node_modules/.bin/convex"
    if [[ ! -x "${convex_bin}" ]]; then
      echo "[run] ERROR: missing Convex CLI at ${ROOT_DIR}/my-app/${convex_bin}" >&2
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
    if [[ "${STACK_MODE_OVERRIDE:-}" != "mcp-private-beta" ]]; then
      for name in ENABLE_MCP_CONTROLLED_SYNTHETIC_RAIL MCP_CONTROLLED_SYNTHETIC_RAIL_MODE; do
        if [[ -n "${convex_env_url}" && -n "${convex_env_admin_key}" ]]; then
          CONVEX_SELF_HOSTED_URL="${convex_env_url}" CONVEX_SELF_HOSTED_ADMIN_KEY="${convex_env_admin_key}" "${convex_bin}" env remove "${name}" >/dev/null 2>&1 || true
        elif [[ -n "${convex_env_deployment_name}" ]]; then
          CONVEX_DEPLOYMENT="local:${convex_env_deployment_name}" "${convex_bin}" env remove "${name}" >/dev/null 2>&1 || true
        else
          "${convex_bin}" env remove "${name}" >/dev/null 2>&1 || true
        fi
      done
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
            echo "[run] skipping secret env sync for ${name}" >&2
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
    require_owned_container "${PARSER_NAME}" "parser" || return 1
    local current_mode
    current_mode="$(parser_runtime_mode)"
    if parser_container_matches_runtime "${RUNTIME_MODE}" && parser_container_owns_port; then
      echo "[run] parser already running in ${current_mode} runtime: ${PARSER_NAME}"
      PARSER_NEEDS_START=0
    else
      echo "[run] replacing stale parser runtime: ${PARSER_NAME} (have ${current_mode}, want ${RUNTIME_MODE})"
      docker stop "${PARSER_NAME}" >/dev/null 2>&1 || true
    fi
  fi

  if [[ "${PARSER_NEEDS_START}" -eq 1 ]]; then
    echo "[run] starting parser (${IMAGE_NAME}, runtime=${RUNTIME_MODE}, OCR=${OCR})"
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
        --label "${RUN_OWNER_LABEL}=${RUN_OWNER_ID}" \
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
        --label "${RUN_OWNER_LABEL}=${RUN_OWNER_ID}" \
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
      echo "[run] ERROR: parser failed health check" >&2
      exit 1
    fi
  done

  if [[ "${RUNTIME_MODE}" == "workspace" ]]; then
    ensure_workspace_runtime_surface
  fi

  # Make sure connector net can reach it
  if ! ensure_parsernet; then
    echo "[run] WARNING: parser not reachable inside ${TUNNEL_NETWORK} (continuing)."
  fi
}

remove_parser_container() {
  for _ in $(seq 1 10); do
    if ! docker container inspect "${PARSER_NAME}" >/dev/null 2>&1; then
      return 0
    fi
    require_owned_container "${PARSER_NAME}" "parser" || return 1
    docker rm -f "${PARSER_NAME}" >/dev/null 2>&1 || true
    sleep 0.5
  done
  echo "[run] ERROR: could not remove stale parser container ${PARSER_NAME}" >&2
  docker ps -a --filter "name=${PARSER_NAME}" >&2 || true
  exit 1
}

stop_parser() {
  if docker container inspect "${PARSER_NAME}" >/dev/null 2>&1; then
    require_owned_container "${PARSER_NAME}" "parser" || return 1
    if docker ps --format '{{.Names}}' | grep -qx "${PARSER_NAME}"; then
      echo "[run] stopping parser (${PARSER_NAME})"
      docker stop "${PARSER_NAME}" >/dev/null 2>&1 || true
    fi
    remove_parser_container
  fi
}

start_tunnel() {
  local service_host="host.docker.internal"
  local -a tunnel_network_args=(--network "${TUNNEL_NETWORK}")
  if [[ "${MCP_PRIVATE_BETA_TUNNEL:-0}" == "1" ]] && mcp_tunnel_uses_native_linux_host_network; then
    service_host="127.0.0.1"
    tunnel_network_args=(--network host)
  else
    docker network create "${TUNNEL_NETWORK}" >/dev/null 2>&1 || true
  fi
  if docker container inspect "${CLOUDFLARED_NAME}" >/dev/null 2>&1; then
    require_owned_container "${CLOUDFLARED_NAME}" "tunnel" || return 1
    docker rm -f "${CLOUDFLARED_NAME}" >/dev/null 2>&1 || true
  fi
  echo "[run] starting cloudflared (${CLOUDFLARED_NAME})"
  if [[ "${MCP_PRIVATE_BETA_TUNNEL:-0}" == "1" ]]; then
    local config_temp="${MCP_TUNNEL_CONFIG_FILE}.tmp.$$"
    rm -f "${config_temp}" "${MCP_TUNNEL_CONFIG_FILE}"
    (umask 077; cat > "${config_temp}" <<EOF
tunnel: ${MCP_PRIVATE_BETA_TUNNEL_ID}
credentials-file: /run/secrets/cloudflared-mcp-credentials.json
ingress:
  - hostname: mcp.twoweeks.ai
    service: http://${service_host}:${MCP_PRIVATE_BETA_VITE_PORT}
  - service: http_status:404
EOF
    )
    chmod 600 "${config_temp}"
    mv "${config_temp}" "${MCP_TUNNEL_CONFIG_FILE}"
    if ! docker run -d --name "${CLOUDFLARED_NAME}" --restart=unless-stopped \
      --label "${RUN_OWNER_LABEL}=${RUN_OWNER_ID}" \
      "${tunnel_network_args[@]}" \
      --mount "type=bind,source=${MCP_TUNNEL_CONFIG_FILE},target=/etc/cloudflared/config.yml,readonly" \
      --mount "type=bind,source=${MCP_PRIVATE_BETA_TUNNEL_CREDENTIALS_FILE},target=/run/secrets/cloudflared-mcp-credentials.json,readonly" \
      cloudflare/cloudflared:latest \
      --loglevel debug tunnel --config /etc/cloudflared/config.yml --no-autoupdate run >/dev/null; then
      rm -f "${MCP_TUNNEL_CONFIG_FILE}"
      echo "[run] ERROR: MCP cloudflared failed to start" >&2
      exit 1
    fi
  else
    if [[ -z "${TUNNEL_TOKEN}" ]]; then
      echo "[run] ERROR: TUNNEL_TOKEN is required for tunnel mode" >&2
      exit 1
    fi
    local token_temp="${TUNNEL_TOKEN_FILE}.tmp.$$"
    rm -f "${token_temp}" "${TUNNEL_TOKEN_FILE}"
    (umask 077; printf '%s' "${TUNNEL_TOKEN}" > "${token_temp}")
    chmod 600 "${token_temp}"
    mv "${token_temp}" "${TUNNEL_TOKEN_FILE}"
    if ! docker run -d --name "${CLOUDFLARED_NAME}" --restart=unless-stopped \
      --label "${RUN_OWNER_LABEL}=${RUN_OWNER_ID}" \
      --network "${TUNNEL_NETWORK}" \
      --mount "type=bind,source=${TUNNEL_TOKEN_FILE},target=/run/secrets/cloudflared-token,readonly" \
      cloudflare/cloudflared:latest \
      --loglevel debug tunnel --no-autoupdate run --protocol auto \
      --token-file /run/secrets/cloudflared-token >/dev/null; then
      rm -f "${TUNNEL_TOKEN_FILE}"
      echo "[run] ERROR: cloudflared failed to start" >&2
      exit 1
    fi
  fi
  sleep 2
}

stop_tunnel() {
  if docker container inspect "${CLOUDFLARED_NAME}" >/dev/null 2>&1; then
    require_owned_container "${CLOUDFLARED_NAME}" "tunnel" || return 1
    if docker ps --format '{{.Names}}' | grep -qx "${CLOUDFLARED_NAME}"; then
      echo "[run] stopping tunnel (${CLOUDFLARED_NAME})"
      docker stop "${CLOUDFLARED_NAME}" >/dev/null 2>&1 || true
    fi
    docker rm -f "${CLOUDFLARED_NAME}" >/dev/null 2>&1 || true
  fi
  rm -f "${TUNNEL_TOKEN_FILE}" "${MCP_TUNNEL_CONFIG_FILE}"
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
    echo "[run] ERROR: could not determine Convex team/project for local-fast." >&2
    echo "[run] Add the non-secret Convex binding to .env.local or my-app/.env.local:" >&2
    echo "[run]   CONVEX_TEAM=<team_slug>" >&2
    echo "[run]   CONVEX_PROJECT=<project_slug>" >&2
    echo "[run] Optional if you already have a named local deployment:" >&2
    echo "[run]   CONVEX_DEPLOYMENT=local:<deployment_name>" >&2
    echo "[run] Legacy Convex CLI comments are still accepted: CONVEX_DEPLOYMENT=... # team: <team>, project: <project>" >&2
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
    echo "[run] discovered local Convex state ${LOCAL_CONVEX_STATE_CONFIG_RESULT} -> ${actual_url}" >&2
  fi
  echo "[run] starting local Convex deployment (${convex_team}/${convex_project})" >&2

  local convex_pid_file="${STATE_DIR}/convex.pid"
  rm -f "${convex_pid_file}"
  (
    cd "${ROOT_DIR}/my-app"
    local convex_bin="./node_modules/.bin/convex"
    if [[ ! -x "${convex_bin}" ]]; then
      echo "[run] ERROR: missing Convex CLI at ${ROOT_DIR}/my-app/${convex_bin}" >&2
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
    export TWOWEEKS_RUN_OWNER_ARGV0="${RUN_OWNER_PROCESS_PREFIX}:convex"
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
  argv0: process.env.TWOWEEKS_RUN_OWNER_ARGV0,
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
      local -a convex_cmd=(node "${convex_bin}" dev --verbose --tail-logs always --local-cloud-port "${convex_cloud_port}" --local-site-port "${convex_site_port}" --local-force-upgrade)
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
  argv0: process.env.TWOWEEKS_RUN_OWNER_ARGV0,
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
    echo "[run] ERROR: failed to launch local Convex process" >&2
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
      echo "[run] ERROR: local Convex failed to start (see ${CONVEX_LOG})" >&2
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
  echo >&2
  echo "[run] ERROR: local Convex did not become reachable (see ${CONVEX_LOG})" >&2
  exit 1
}

stop_convex() {
  local CPID="${1:-}"
  stop_owned_process "${CPID}" "local Convex"
}

# ===== Vite =====
start_vite() {
  local ORIGIN="${1:?origin required}"
  local CONVEX_URL="${2:-}"
  require_port_available "${VITE_PORT}" "Vite port ${VITE_PORT}" || return 1
  : > "${VITE_LOG}"
  local vite_pid_file="${STATE_DIR}/vite.pid"
  rm -f "${vite_pid_file}"
  (
    cd "${ROOT_DIR}/my-app"
    export CONVEX_PARSER_URL="${ORIGIN}"
    export VITE_PARSER_URL="${ORIGIN}"
    export VITE_CONVEX_PARSER_URL="${ORIGIN}"
    if [[ "${STACK_MODE_OVERRIDE:-}" == "mcp-private-beta" ]]; then
      export MCP_SAFE_SUMMARY_LIVE_ADAPTER_V8="1"
    fi
    if [[ -n "${CONVEX_URL}" ]]; then
      export VITE_CONVEX_URL="${CONVEX_URL}"
      export NEXT_PUBLIC_CONVEX_URL="${CONVEX_URL}"
      if [[ -n "${LOCAL_CONVEX_SITE_PORT_RESULT:-${LOCAL_CONVEX_SITE_PORT:-}}" ]]; then
        export LOCAL_CONVEX_SITE_PORT="${LOCAL_CONVEX_SITE_PORT_RESULT:-${LOCAL_CONVEX_SITE_PORT}}"
      fi
    fi
    export STRUCTURED_UPLOAD_SKIP_HEALTHCHECK=1
    export TWOWEEKS_RUN_OWNER_ARGV0="${RUN_OWNER_PROCESS_PREFIX}:vite"
    local vite_bin="./node_modules/vite/bin/vite.js"
    if [[ ! -f "${vite_bin}" ]]; then
      echo "[run] ERROR: missing Vite binary at ${vite_bin}" >&2
      exit 1
    fi
    local -a vite_cmd=(node "${vite_bin}" --host 127.0.0.1 --port "${VITE_PORT}" --strictPort --clearScreen false)
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
  argv0: process.env.TWOWEEKS_RUN_OWNER_ARGV0,
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

wait_for_vite_ready() {
  local pid="${1:?Vite PID required}"
  local attempt=""
  for attempt in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${VITE_PORT}/" >/dev/null 2>&1; then
      return 0
    fi
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      return 1
    fi
    sleep 1
  done
  return 1
}

stop_vite() {
  local VPID="${1:-}"
  stop_owned_process "${VPID}" "Vite"
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
    echo "[run] ERROR: no tracked stack to reload. Start one with ./run.sh up, ./run.sh local-fast, ./run.sh tunnel, or ./run.sh parser-dev." >&2
    exit 1
  fi
  if [[ "${STATE_OWNER_ID:-}" != "${RUN_OWNER_ID}" ]]; then
    echo "[run] ERROR: refusing to reload legacy or foreign stack state; run ./run.sh doctor before recovery." >&2
    exit 1
  fi
  if [[ "${STACK_MODE}" == "mcp-private-beta" ]]; then
    STACK_MODE_OVERRIDE="mcp-private-beta"
    export STACK_MODE_OVERRIDE
    MCP_SAFE_SUMMARY_LIVE_ADAPTER_V8="1"
    export MCP_SAFE_SUMMARY_LIVE_ADAPTER_V8
    ENABLE_MCP_CONTROLLED_SYNTHETIC_RAIL="1"
    export ENABLE_MCP_CONTROLLED_SYNTHETIC_RAIL
    MCP_CONTROLLED_SYNTHETIC_RAIL_MODE="development"
    export MCP_CONTROLLED_SYNTHETIC_RAIL_MODE
    MCP_PRIVATE_BETA_TUNNEL=1
    mcp_check
  fi

  current_env_hash="$(env_reload_hash)"
  current_convex_binding_hash="$(convex_binding_hash)"
  [[ "${ENV_HASH:-}" != "${current_env_hash}" ]] && env_changed="true"
  [[ "${CONVEX_BINDING_HASH:-}" != "${current_convex_binding_hash}" ]] && binding_changed="true"
  if [[ "${binding_changed}" == "true" && "${CONVEX_MODE:-cloud}" == "local" ]]; then
    local_binding_changed="true"
  fi

  if [[ "${env_changed}" != "true" && "${binding_changed}" != "true" ]]; then
    echo "[run] reload-env: no env changes detected"
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
      echo "[run] ERROR: Vite failed to restart during env reload (see ${VITE_LOG})" >&2
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

  echo "[run] reload-env: refreshed ${STACK_MODE} without Docker rebuild"
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
  if [[ "${STACK_MODE:-}" == "mcp-private-beta" ]]; then
    echo -n "mcp metadata:   "
    curl -s -o /dev/null -w '%{http_code}\n' "${MCP_PRIVATE_BETA_AUTHORIZATION_ORIGIN}/.well-known/oauth-authorization-server" || true
  else
    echo -n "edge  /ready: "
    curl -s -o /dev/null -w '%{http_code}\n' "$(normalize_origin "${PARSER_ORIGIN}")/ready" || true
  fi
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
  if [[ -n "${VITE_PID:-}" ]] && process_is_owned_by_run_sh "${VITE_PID}"; then
    if curl -fsS "http://127.0.0.1:${VITE_PORT}/" >/dev/null 2>&1; then
      echo "Vite:           running (http://127.0.0.1:${VITE_PORT})"
    else
      echo "Vite:           tracked but unreachable"
    fi
  else
    echo "Vite:           stopped"
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
    echo "[run] ERROR: parser runtime mode must be image or workspace" >&2
    exit 2
  fi
  if [[ "${USE_LOCAL_ORIGIN}" -eq 1 && "${USE_EDGE_ORIGIN}" -eq 1 ]]; then
    echo "[run] ERROR: choose one of --local-origin or --edge-origin" >&2
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
  if [[ -n "${STACK_MODE_OVERRIDE:-}" ]]; then
    TARGET_STACK_MODE="${STACK_MODE_OVERRIDE}"
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
    ensure_runtime_image_exists
    if [[ "${START_UI}" -eq 1 && "${USE_LOCAL_CONVEX}" -eq 1 && "${USE_LOCAL_ORIGIN}" -eq 1 && "${PARSER_RELOAD}" == "1" ]]; then
      echo "[run] local-fast: workspace parser runtime with autoreload enabled"
    else
      echo "[run] WARNING: workspace parser runtime requested explicitly; export runtime parity is not guaranteed"
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
    echo "[run] starting Vite → ${ACTIVE_ORIGIN}"
    if [[ "${USE_LOCAL_CONVEX}" -eq 1 ]]; then
      if ! VPID="$(start_vite "${ACTIVE_ORIGIN}" "${CURL}")"; then
        echo "[run] ERROR: Vite failed to start (see ${VITE_LOG})" >&2
        stop_convex "${CPID}" || true
        stop_parser || true
        exit 1
      fi
    else
      if ! VPID="$(start_vite "${ACTIVE_ORIGIN}")"; then
        echo "[run] ERROR: Vite failed to start (see ${VITE_LOG})" >&2
        stop_parser || true
        exit 1
      fi
    fi
    if ! wait_for_vite_ready "${VPID}"; then
      echo "[run] ERROR: Vite did not become reachable (see ${VITE_LOG})" >&2
      stop_vite "${VPID}" || true
      stop_convex "${CPID}" || true
      stop_parser || true
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
  local stop_failed="0"
  read_state
  if [[ -f "${STATE_FILE}" && "${STATE_OWNER_ID:-}" != "${RUN_OWNER_ID}" ]]; then
    echo "[run] ERROR: refusing to use legacy or foreign stack state; inspect it and stop those resources explicitly." >&2
    return 1
  fi
  stop_vite "${VITE_PID:-}" || stop_failed="1"
  stop_convex "${CONVEX_PID:-}" || stop_failed="1"
  if [[ "${PARSER_STARTED:-0}" == "1" ]]; then
    stop_parser || stop_failed="1"
  fi
  if [[ "${TUNNEL_STARTED:-0}" == "1" ]]; then
    stop_tunnel || stop_failed="1"
  fi
  if [[ "${stop_failed}" == "1" ]]; then
    echo "[run] ERROR: down preserved state because at least one resource was not proven to be owned by this worktree." >&2
    return 1
  fi
  rm -f "${STATE_FILE}"
  echo "[run] down: done."
  print_command_banner
}

reset() {
  local VITE_PID=""; local PARSER_STARTED="0"; local CONVEX_PID=""; local CONVEX_URL=""; local TUNNEL_STARTED="0"; local STACK_MODE=""
  read_state
  if ! down >/dev/null; then
    echo "[run] ERROR: reset stopped because tracked ownership could not be proven." >&2
    return 1
  fi
  stop_tunnel
  stop_parser
  clear_dev_state
  echo "[run] reset: done."
  echo "[run] reset never scans or kills unrelated port ranges; run ./run.sh doctor if a port remains occupied."
  print_command_banner
}

local_stack() {
  up --ui --local-origin --cloud-convex "$@"
}

local_convex_stack() {
  echo "[run] local-convex is a legacy alias; using local-fast"
  local_fast_stack "$@"
}

local_fast_stack() {
  up --ui --local-origin --local-convex --workspace-mount --parser-reload "$@"
}

mcp_private_beta_stack() {
  # The controlled v10 proof adapter is scoped to the private-beta stack and
  # must reach the Vite child without requiring a second .env.local file.
  MCP_SAFE_SUMMARY_LIVE_ADAPTER_V8="1"
  export MCP_SAFE_SUMMARY_LIVE_ADAPTER_V8
  # The synthetic rail is local/private-beta only and is synced to Convex
  # without creating a second .env.local file.
  ENABLE_MCP_CONTROLLED_SYNTHETIC_RAIL="1"
  export ENABLE_MCP_CONTROLLED_SYNTHETIC_RAIL
  MCP_CONTROLLED_SYNTHETIC_RAIL_MODE="development"
  export MCP_CONTROLLED_SYNTHETIC_RAIL_MODE
  mcp_check
  VITE_PORT="${MCP_PRIVATE_BETA_VITE_PORT}"
  OPEN_BROWSER=0
  PARSER_ORIGIN="${MCP_PRIVATE_BETA_AUTHORIZATION_ORIGIN}"
  MCP_PRIVATE_BETA_TUNNEL=1
  STACK_MODE_OVERRIDE="mcp-private-beta"
  up --tunnel-stack --ui --local-origin --local-convex --image-runtime "$@"
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

  echo "[run] rebuild-docker: rebuilding parser/runtime image"
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
    echo "[run] rebuild-docker: local parser ready"
  else
    echo "[run] rebuild-docker: local parser failed readiness" >&2
    exit 1
  fi
  if [[ "${restart_mode}" == "tunnel" ]]; then
    if curl -fsS "$(normalize_origin "${PARSER_ORIGIN}")/ready" >/dev/null 2>&1; then
      echo "[run] rebuild-docker: edge ready"
    else
      echo "[run] rebuild-docker: edge readiness check failed" >&2
      exit 1
    fi
  fi

  echo "[run] rebuild-docker: done (${restart_mode})"
  print_command_banner
}

logs() {
  print_command_banner
  docker logs -f --tail=200 "${PARSER_NAME}"
}

smoke() {
  curl -sS http://127.0.0.1:8001/ready | jq .
}

mcp_smoke() {
  node "${ROOT_DIR}/scripts/mcp-private-beta-smoke.mjs" "$@"
}

help() {
  cat <<'EOF'
usage:
  ./run.sh doctor [local-fast|mcp-private-beta]
  ./run.sh mcp-private-beta [--ocr auto|doctr|paddle|disabled]
  ./run.sh mcp-secret-sync
  ./run.sh mcp-check
  ./run.sh mcp-smoke [--origin https://host]
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
  ./run.sh logs
  ./run.sh smoke
  ./run.sh assert-ocr FILE.pdf
  ./run.sh probe-edge [FILE.pdf]     # uses CF_ACCESS_CLIENT_ID/SECRET if set

notes:
- doctor = read-only, secret-free startup diagnostics. macOS and Linux are supported directly; Windows uses WSL2 with Docker Desktop integration.
- mcp-private-beta = exact private-beta MCP origin on port 5196 with local Convex, image parser runtime, and the named Cloudflare tunnel.
- mcp-secret-sync = retrieve the raw OAuth client secret from the linked Infisical EU project and atomically update only its digest in root .env.local.
- mcp-check = fail-closed validation of canonical private-beta keys; it prints key names/status only, never values.
- mcp-smoke = read-only public metadata/discovery/auth-challenge/error smoke; it sends no credentials or private data and never prints response bodies.
- local-fast = recommended fast full-app parser workflow: local parser + local Convex + Vite + autoreload, with export/runtime deps preserved inside the container.
- tunnel = stable validation mode on the validated image runtime.
- local = local parser + export-capable image runtime + Vite pointed at http://127.0.0.1:8001.
- local-convex = legacy alias for local-fast.
- parser-dev = parser-only / advanced workspace-mounted parser with autoreload; fast Python iteration, not stable runtime validation.
- reload-env = restart-only refresh for parser/Vite/local Convex/tunnel after env changes, without rebuilding the Docker image.
- rebuild-docker = explicit rebuild for parser/export Docker runtime, then clean restart + readiness checks.
- down stops only the processes/containers tracked as started by run.sh and keeps images/caches intact.
- reset does down plus cleanup of orphaned containers carrying this worktree's ownership label, then clears tmp/dev-stack state and stale temp logs.
- legacy or foreign processes and containers are never killed automatically; inspect them explicitly when doctor reports a conflict.
- workspace mount mode is explicit-only via --workspace-mount and is not the default runtime.
- FE origin defaults to PARSER_ORIGIN (edge). Use --local-origin to point FE to http://127.0.0.1:8001.
- Use --local-convex when you want the app to talk to the local Convex backend managed by run.sh.
- Without --local-convex, Convex stays on its configured env/default path (typically cloud), which preserves the existing Cloudflare tunnel flow.
- In local-fast, both Vite and server-side structuredUpload resolve the local parser at http://127.0.0.1:8001, and export worker dependencies come from the container image instead of host node_modules.
- MISTRAL is auto-enabled if MISTRAL_API_KEY is present (env or ~/.mistral_key).
- OCR flag controls local parser engine: auto (default), doctr, paddle, disabled.
EOF
  print_command_banner
}

# Trap: ensure long-running stack commands do not leave Vite/Parser dangling.
# Doctor is read-only, so interruption must never tear down an existing stack.
if [[ "${READ_ONLY_COMMAND}" == "1" ]]; then
  trap 'exit 130' INT TERM
else
  trap 'echo "[run] interrupt -> down"; down >/dev/null 2>&1 || true; exit 130' INT TERM
fi

case "${CMD}" in
  doctor) doctor "$@";;
  mcp-private-beta) mcp_private_beta_stack "$@";;
  mcp-secret-sync) mcp_secret_sync;;
  mcp-check) mcp_check;;
  mcp-smoke) mcp_smoke "$@";;
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
  logs) logs;;
  smoke) smoke;;
  assert-ocr) assert_ocr "$@";;
  probe-edge) probe_edge "${1:-}";;
  help|*) help;;
esac
