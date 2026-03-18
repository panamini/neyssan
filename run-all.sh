#!/usr/bin/env bash
# run-all.sh - Clean, build, and start pdf-ingest backend, worker, and frontend.
# Usage: ./run-all.sh [OPTIONS]

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE=""
QUIET=false
FORCE=false
DETACH_FRONTEND=false
CLEAN=false
SKIP_BACKFILL=false
RUN_BACKFILL=false

# -----------------------
# Print help
# -----------------------
if [[ "${1-}" == "--help" ]]; then
  cat <<'EOF'
run-all.sh - Clean, build, and start pdf-ingest backend, worker, and frontend.

Usage: ./run-all.sh [OPTIONS]

Options:
  --force             Free host ports if in use
  --quiet             Suppress non-error output
  --detach-frontend   Run frontend in background
  --clean             Remove all Docker containers, volumes, and networks before start
  --skip-backfill     Skip running the backfill script
  --run-backfill      Execute actual backfill after dry-run
  --log-file=PATH     Append log output to specified file
  --help              Show this help message
EOF
  exit 0
fi

# -----------------------
# Parse args
# -----------------------
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --quiet) QUIET=true ;;
    --detach-frontend) DETACH_FRONTEND=true ;;
    --clean) CLEAN=true ;;
    --skip-backfill) SKIP_BACKFILL=true ;;
    --run-backfill) RUN_BACKFILL=true ;;
    --log-file=*) LOG_FILE="${arg#*=}" ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# -----------------------
# Logging functions
# -----------------------
log() {
    if [ "$QUIET" = "false" ]; then echo "$@"; fi
    if [ -n "$LOG_FILE" ]; then
        mkdir -p "$(dirname "$LOG_FILE")"
        echo "$@" >> "$LOG_FILE"
    fi
}
err() {
    echo "[ERROR] $@" >&2
    if [ -n "$LOG_FILE" ]; then
        mkdir -p "$(dirname "$LOG_FILE")"
        echo "[ERROR] $@" >> "$LOG_FILE"
    fi
}

log "[run-all] Running from $ROOT_DIR"

# -----------------------
# Check Docker & Compose
# -----------------------
if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  err "Docker not installed or daemon not running."
  exit 1
fi
if ! docker compose version --short | grep -q '^2'; then
  err "Requires Docker Compose v2+."
  exit 1
fi

# -----------------------
# Optional clean
# -----------------------
if [ "$CLEAN" = true ]; then
  log "[run-all] Performing full clean..."
  docker compose down --volumes --remove-orphans || true
  docker volume prune -f || true
  docker network prune -f || true
  log "[run-all] Clean complete."
fi

# -----------------------
# Check ports
# -----------------------
: "${BACKEND_PORT:=8000}"
: "${REDIS_PORT:=6379}"
: "${DB_PORT:=5432}"
PORTS=("$BACKEND_PORT" "$REDIS_PORT" "$DB_PORT")
CONFLICTS=0

for PORT in "${PORTS[@]}"; do
  PIDS="$(lsof -ti tcp:${PORT} 2>/dev/null || true)"
  if [ -n "$PIDS" ]; then
    log "[run-all] Port $PORT in use by host process(es): $PIDS"
    if [ "$FORCE" = "true" ]; then
      log "[run-all] Terminating processes on port $PORT..."
      kill -15 $PIDS >/dev/null 2>&1 || true
      sleep 1
      kill -9 $PIDS >/dev/null 2>&1 || true
      sleep 0.5
    else
      CONFLICTS=1
    fi
  fi
done

if [ "$CONFLICTS" -eq 1 ] && [ "$FORCE" = "false" ]; then
  err "Conflicts detected. Use --force to free ports or stop processes manually."
  exit 2
fi

# -----------------------
# Teardown function
# -----------------------
teardown() {
  log "[run-all] Stopping services..."
  cd "$ROOT_DIR/pdf-ingest"
  docker compose down || true
  if [ "$DETACH_FRONTEND" = "true" ] && [ -n "${FRONTEND_PID-}" ]; then
    kill -15 "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
  exit 0
}
trap teardown SIGINT SIGTERM

# -----------------------
# Build images and start core Docker services (db + redis) first
# This order ensures we can run migrations before bringing up web/worker.
# -----------------------
cd "$ROOT_DIR/pdf-ingest"

log "[run-all] Building web image (for migrations and run-once tasks)..."
docker compose build --pull --no-cache web || {
  log "[run-all] Warning: web image build failed (continuing)."
}

log "[run-all] Starting Postgres and Redis..."
docker compose up -d db redis


# -----------------------
# Wait for Postgres
# -----------------------
log "[run-all] Waiting for Postgres..."
RETRIES=60
until docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 || [ $RETRIES -le 0 ]; do
  log "[run-all] waiting for postgres... ($RETRIES)"
  sleep 1
  ((RETRIES--))
done
if [ $RETRIES -le 0 ]; then
  err "Postgres did not start in time."
  docker compose logs db --no-color --tail 50 || true
  exit 1
fi
log "[run-all] Postgres ready."

# -----------------------
# Run database migrations
# -----------------------
log "[run-all] Running database migrations..."
docker compose run --rm web alembic upgrade head

# Verify migration success
log "[run-all] Verifying migration success..."
docker compose exec -T db psql -U postgres -d pdf_ingest -c "\dt" | grep -E '(profiles|llm_history)'

if [ $? -eq 0 ]; then
  log "[run-all] Database migrations completed successfully!"
else
  err "ERROR: Database migrations may have failed - required tables not found"
  exit 1
fi

# -----------------------
# Start web and worker now that DB + migrations are ready
# -----------------------
log "[run-all] Starting web and worker services..."
docker compose up -d --build web worker

# -----------------------
# Wait for backend
# -----------------------
log "[run-all] Waiting for backend..."
sleep 5 # Add a short delay to allow the service to start
RETRIES=30
until curl -sS "http://127.0.0.1:${BACKEND_PORT}/api/v1/health" >/dev/null 2>&1 || [ $RETRIES -le 0 ]; do
  log "[run-all] waiting for backend... ($RETRIES)"
  sleep 1
  ((RETRIES--))
done
if [ $RETRIES -le 0 ]; then
  err "Backend did not start in time."
  docker compose logs web --no-color --tail 200 || true
  exit 1
fi
log "[run-all] Backend responsive."

# -----------------------
# Backfill (dry-run first)
# -----------------------
if [ "$SKIP_BACKFILL" = false ]; then
  log "[run-all] Running backfill dry-run..."
  docker compose exec -T web bash -c \
    "PYTHONPATH=/app python scripts/backfill_convex_status.py --base-url http://web:8000 --batch-limit 10 --sleep 1.0 --dry-run"

  if [ "$RUN_BACKFILL" = true ]; then
    log "[run-all] Running actual backfill..."
    docker compose exec -T web bash -c \
      "PYTHONPATH=/app python scripts/backfill_convex_status.py --base-url http://web:8000 --batch-limit 10 --sleep 1.0"
  fi
fi

# -----------------------
# Start frontend
# -----------------------
cd "$ROOT_DIR/my-app"
PM=""
if [ -f pnpm-lock.yaml ]; then
  PM="pnpm"
elif [ -f package-lock.json ]; then
  PM="npm"
else
  PM="npm"
fi

if [ ! -d node_modules ]; then
  if command -v "$PM" >/dev/null 2>&1; then
    log "[run-all] Installing frontend dependencies with $PM..."
    "$PM" install
    else
    err "$PM not found. Please install it and rerun."
    exit 1
  fi
fi

if [ "$DETACH_FRONTEND" = true ]; then
  log "[run-all] Starting frontend in background..."
  VITE_PDF_INGEST_URL="http://localhost:${BACKEND_PORT}" "$PM" run dev &
  FRONTEND_PID=$!
  log "[run-all] Frontend PID: $FRONTEND_PID"
else
  log "[run-all] Starting frontend in foreground..."
  VITE_PDF_INGEST_URL="http://localhost:${BACKEND_PORT}" "$PM" run dev
fi
