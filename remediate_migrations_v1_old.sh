#!/usr/bin/env bash
# remediate_migrations-grok.sh (v2 - Hardened)
# Fully idempotent Alembic/Postgres remediation for Docker Compose.
set -euo pipefail

# --- Configuration ---
COMPOSE_FILES=()
DB_SERVICE="db"
ALEMBIC_SERVICE="alembic"
DB_USER="postgres"
DB_NAME="pdf_ingest"
DB_TIMEOUT=60
VERBOSE=false
ALEMBIC_VERSIONS_DIR="pdf-ingest/alembic/versions"

# --- Terminal Colors ---
C_RESET='\033[0m'
C_RED='\033[0;31m'
C_GREEN='\033[0;32m'
C_BLUE='\033[0;34m'
C_YELLOW='\033[0;33m'
C_CYAN='\033[0;36m'

# --- Helper Functions ---
log_step() { echo -e "\n${C_BLUE}--- $1 ---${C_RESET}"; }
log_ok() { echo -e "${C_GREEN}✅ $1${C_RESET}"; }
log_warn() { echo -e "${C_YELLOW}⚠️ WARNING: $1${C_RESET}"; }
log_info() { echo -e "${C_CYAN}-> $1${C_RESET}"; }
log_error() { echo -e "${C_RED}❌ ERROR: $1${C_RESET}" >&2; exit 1; }
log_verbose() { if [ "$VERBOSE" = true ]; then echo "VERBOSE: $*" >&2; fi; }

usage() {
    cat <<EOF
Usage: $0 [options]

Performs an idempotent remediation of an Alembic/Postgres database.

Options:
  --compose <file>         Docker Compose file (can be repeated).
  --db-service <name>      Database service name (default: "db").
  --alembic-service <name> Alembic service name (default: "alembic").
  --db-user <user>         Database user (default: "postgres").
  --db-name <name>         Database name (default: "pdf_ingest").
  --versions-dir <path>    Path to Alembic versions directory (default: "pdf-ingest/alembic/versions").
  --verbose                Enable verbose output.
  -h, --help               Show this help message.
EOF
}

# --- Argument Parsing ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --compose) COMPOSE_FILES+=("$2"); shift 2 ;;
        --db-service) DB_SERVICE="$2"; shift 2 ;;
        --alembic-service) ALEMBIC_SERVICE="$2"; shift 2 ;;
        --db-user) DB_USER="$2"; shift 2 ;;
        --db-name) DB_NAME="$2"; shift 2 ;;
        --versions-dir) ALEMBIC_VERSIONS_DIR="$2"; shift 2 ;;
        --verbose) VERBOSE=true; shift ;;
        -h|--help) usage; exit 0 ;;
        *) log_error "Unknown argument: $1";;
    esac
done

# --- Pre-flight Checks ---
# Detect Docker Compose command (V2 or V1)
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD=(docker compose)
    log_info "Using 'docker compose' (V2)."
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD=(docker-compose)
    log_info "Using 'docker-compose' (V1)."
else
    log_error "Neither 'docker compose' nor 'docker-compose' command found."
fi

# Build compose flags and check if files exist
COMPOSE_FLAGS=()
if [ ${#COMPOSE_FILES[@]} -eq 0 ]; then
    # Default to docker-compose.yml if no files are specified
    if [ -f "docker-compose.yml" ]; then
        COMPOSE_FILES+=("docker-compose.yml")
    else
        log_error "No --compose files specified and default 'docker-compose.yml' not found."
    fi
fi
for f in "${COMPOSE_FILES[@]}"; do
    if [ ! -f "$f" ]; then
        log_error "Compose file not found: '$f'"
    fi
    COMPOSE_FLAGS+=("-f" "$f")
done

if [ ! -d "$ALEMBIC_VERSIONS_DIR" ]; then
    log_error "Alembic versions directory not found at '$ALEMBIC_VERSIONS_DIR'."
fi

# --- Docker Compose Helpers ---
dc_run() {
    local svc="$1"; shift
    log_verbose "Running in new container for '$svc': $*"
    # The --no-TTY flag is often needed for non-interactive 'run' commands
    if ! "${DOCKER_COMPOSE_CMD[@]}" "${COMPOSE_FLAGS[@]}" run --rm --no-TTY "$svc" "$@"; then
        log_error "Docker Compose 'run' command failed for service '$svc'. Ensure the service name is correct and the service can start."
    fi
}

dc_exec() {
    local svc="$1"; shift
    log_verbose "Executing in running service '$svc': $*"
    # -T disables pseudo-tty allocation, crucial for automation.
    if ! "${DOCKER_COMPOSE_CMD[@]}" "${COMPOSE_FLAGS[@]}" exec -T "$svc" "$@" < /dev/null; then
        log_error "Docker Compose 'exec' command failed for service '$svc'. Ensure the service is running."
    fi
}

run_psql() {
    # Returns output of query; masks errors with `|| true` to prevent exit on "not found", etc.
    dc_exec "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1" || true
}

# --- Main Script Logic ---
echo
echo "🚀 === Alembic/Postgres Remediation Script === 🚀"
log_info "DB Service: $DB_SERVICE | Alembic Service: $ALEMBIC_SERVICE | DB Name: $DB_NAME"

log_step "[1/7] Waiting for PostgreSQL"
count=0
until dc_exec "$DB_SERVICE" pg_isready -q -U "$DB_USER" -d "$DB_NAME"; do
    sleep 1; count=$((count + 1))
    if [ "$count" -ge "$DB_TIMEOUT" ]; then
        log_error "Database did not become ready within $DB_TIMEOUT seconds."
    fi
done
log_ok "Database is ready."

log_step "[2/7] Detecting Alembic Head Revision"
# This is the robust method using Alembic's own tooling.
ALEMBIC_HEAD=$(dc_run "$ALEMBIC_SERVICE" alembic heads | awk '{print $1}')
if [[ -z "$ALEMBIC_HEAD" ]]; then
    log_warn "Could not determine Alembic head revision. This is normal if you have no migrations yet."
    ALEMBIC_HEAD="<none>"
else
    log_ok "Alembic head is: $ALEMBIC_HEAD"
fi

log_step "[3/7] Reading Current DB Revision"
# Ensure alembic_version table exists before reading from it, and that the column is of type TEXT
run_psql "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num));" >/dev/null
run_psql "ALTER TABLE alembic_version ALTER COLUMN version_num TYPE TEXT;" >/dev/null
CURRENT_REV=$(run_psql "SELECT version_num FROM alembic_version LIMIT 1;" | tr -d '[:space:]')
if [[ -z "$CURRENT_REV" ]]; then
    log_info "Database is at base (no revision stamped)."
    CURRENT_REV="<base>"
else
    log_ok "Current DB revision is: $CURRENT_REV"
fi

log_step "[4/7] Checking if Database Schema is Empty"
# This is a safer heuristic. Instead of guessing the exact version, we just check
# if the DB is empty or not. This avoids the dangerous mismatch you saw.
SCHEMA_TABLES_COUNT=$(run_psql "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name != 'alembic_version';" | tr -d '[:space:]')

# If the DB has no revision, but the schema is NOT empty, we have a problem.
if [[ "$CURRENT_REV" == "<base>" && "$SCHEMA_TABLES_COUNT" -gt 0 ]]; then
    log_warn "Database is unstamped but schema is NOT empty. Stamping with the first available revision."
    # Get the very first revision ID from history
    FIRST_REV=$(dc_run "$ALEMBIC_SERVICE" alembic history | grep -oE '^[a-f0-9]+' | tail -n 1)
    if [[ -z "$FIRST_REV" ]]; then
        log_error "Could not find the first revision to stamp. Cannot proceed."
    fi
    log_step "[5/7] Stamping database with first revision: $FIRST_REV"
    dc_run "$ALEMBIC_SERVICE" alembic stamp "$FIRST_REV"
else
    log_step "[5/7] Stamping not required"
    log_ok "Database state is consistent."
fi

log_step "[6/7] Upgrading to Head"
if [[ "$ALEMBIC_HEAD" == "<none>" ]]; then
    log_ok "No migrations exist. Nothing to upgrade."
else
    log_info "Running 'alembic upgrade head'..."
    dc_run "$ALEMBIC_SERVICE" alembic upgrade head
    log_ok "Upgrade command finished."
fi

log_step "[7/7] Verifying Final State"
FINAL_REV=$(dc_run "$ALEMBIC_SERVICE" alembic current | awk '{print $1}' | tr -d '[:space:]')
log_info "Final DB revision: $FINAL_REV"
log_info "Expected head revision: $ALEMBIC_HEAD"
if [[ "$FINAL_REV" != "$ALEMBIC_HEAD" && "$ALEMBIC_HEAD" != "<none>" ]]; then
    log_warn "Final revision does not match Alembic head. Manual inspection may be needed."
else
    log_ok "Database is up to date."
fi

echo
echo "✅ === Remediation Complete === ✅"
