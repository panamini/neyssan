#!/usr/bin/env bash
# safe-start.sh - Non-destructive helper to start pdf-ingest docker services.
# Usage:
#   ./safe-start.sh           # checks for conflicts and exits if ports in use
#   ./safe-start.sh --force   # skip port checks and start services (no host-kill)
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

FORCE=false
if [ "${1-}" = "--force" ]; then
  FORCE=true
fi

echo "[safe-start] Running from ${ROOT_DIR}"

# Check pdf-ingest/.env exists
if [ ! -f "$ROOT_DIR/pdf-ingest/.env" ]; then
  echo "[safe-start] ERROR: pdf-ingest/.env not found. Create it (with MISTRAL_API_KEY etc) before starting."
  exit 1
fi

# Ports we expect docker to bind (host side). We will *not* kill any processes.
PORTS=(8000 6379 5432)
CONFLICTS=0
for PORT in "${PORTS[@]}"; do
  PIDS=""
  if command -v lsof >/dev/null 2>&1; then
    PIDS="$(lsof -ti tcp:${PORT} 2>/dev/null || true)"
  elif command -v ss >/dev/null 2>&1; then
    PIDS="$(ss -ltnp 2>/dev/null | awk -v p=\":${PORT}\" '$4~p { sub(/.*pid=/,"",$6); sub(/,.*$/,"",$6); print $6 }' | sort -u)"
  fi

  if [ -n "$PIDS" ]; then
    echo "[safe-start] Port ${PORT} appears in use by host process(es): ${PIDS}"
    CONFLICTS=1
  fi
done

if [ "$CONFLICTS" -eq 1 ] && [ "$FORCE" = "false" ]; then
  echo ""
  echo "[safe-start] Conflicts detected. To avoid killing host processes, safe-start.sh stops here."
  echo "If you understand the risk and want the script to proceed anyway, re-run with:"
  echo "  ./safe-start.sh --force"
  echo ""
  echo "Alternatively, manually stop the conflicting processes (inspect PIDs above) and re-run the script."
  exit 2
fi

echo "[safe-start] Starting docker compose (web, db, redis, worker)..."
cd "$ROOT_DIR/pdf-ingest"
docker compose up -d --build web db redis worker

echo "[safe-start] Waiting for Postgres to be ready..."
RETRIES=60
until docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 || [ $RETRIES -le 0 ]; do
  echo "[safe-start] waiting for postgres... ($RETRIES)"
  sleep 1
  ((RETRIES--))
done

if [ $RETRIES -le 0 ]; then
  echo "[safe-start] ERROR: Postgres did not become ready in time."
  docker compose logs db --no-color --tail 50 || true
  exit 1
fi
echo "[safe-start] Postgres is ready."

echo "[safe-start] Waiting for backend (Uvicorn) to respond..."
RETRIES=30
until curl -sS http://127.0.0.1:8000/api/v1/health >/dev/null 2>&1 || [ $RETRIES -le 0 ]; do
  echo "[safe-start] waiting for backend... ($RETRIES)"
  sleep 1
  ((RETRIES--))
done
if [ $RETRIES -le 0 ]; then
  echo "[safe-start] ERROR: backend did not start in time. Check docker compose logs."
  docker compose logs web --no-color --tail 200 || true
  exit 1
fi
echo "[safe-start] Backend is responsive."

echo "[safe-start] All docker services started. To see logs:"
echo "  docker compose logs -f --no-color web worker"
