#!/usr/bin/env bash
# start-all.sh - Bring up backend infra, worker service, and start frontend dev server
# Usage: ./start-all.sh
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[start-all] Starting Postgres, Redis and backend (docker compose)..."

# Free host ports used by previous local processes (non-blocking, best-effort).
# This helps avoid "address already in use" when containers try to bind host ports (8000, 6379, 5432).
# We try `lsof` then `ss` as a fallback. We only kill plain processes on the host, not Docker containers.
for PORT in 8000 6379 5432; do
  if command -v lsof >/dev/null 2>&1; then
    PIDS="$(lsof -ti tcp:${PORT} 2>/dev/null || true)"
  elif command -v ss >/dev/null 2>&1; then
    PIDS="$(ss -ltnp 2>/dev/null | awk -v p=\":${PORT}\" '$4~p { sub(/.*pid=/,"",$6); sub(/,.*$/,"",$6); print $6 }' | sort -u)"
  else
    PIDS=""
  fi

  if [ -n "$PIDS" ]; then
    echo "[start-all] Found processes listening on port ${PORT}: ${PIDS}. Killing (SIGKILL) to free the port..."
    # Best-effort kill; ignore failures
    kill -9 ${PIDS} >/dev/null 2>&1 || true
    sleep 0.5
  fi
done

cd "$ROOT_DIR/pdf-ingest"
docker compose up --build -d

echo "[start-all] Waiting for Postgres to be ready..."
RETRIES=60
until docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 || [ $RETRIES -le 0 ]; do
  echo "[start-all] waiting for postgres... ($RETRIES)"
  sleep 1
  ((RETRIES--))
done

if [ $RETRIES -le 0 ]; then
  echo "[start-all] ERROR: Postgres did not become ready in time."
  docker compose logs db --no-color --tail 50 || true
  exit 1
fi
echo "[start-all] Postgres is ready."

echo "[start-all] Ensuring backend is up..."
# Wait for Uvicorn to respond
RETRIES=30
until curl -sS http://127.0.0.1:8000/api/v1/health >/dev/null 2>&1 || [ $RETRIES -le 0 ]; do
  echo "[start-all] waiting for backend... ($RETRIES)"
  sleep 1
  ((RETRIES--))
done
if [ $RETRIES -le 0 ]; then
  echo "[start-all] ERROR: backend did not start in time. Check docker compose logs."
  docker compose logs web --no-color --tail 200 || true
  exit 1
fi
echo "[start-all] Backend is responsive."

echo "[start-all] Starting worker service (docker-compose-managed)..."
# The docker-compose file includes a 'worker' service; ensure it's started
docker compose up -d worker || true

echo "[start-all] Starting frontend (Vite) on host..."
cd "$ROOT_DIR/my-app"
if [ ! -d node_modules ]; then
  if command -v npm >/dev/null 2>&1; then
    echo "[start-all] Installing frontend dependencies with npm..."
    npm install
  elif command -v pnpm >/dev/null 2>&1; then
    echo "[start-all] Installing frontend dependencies with pnpm..."
    pnpm install
  else
    echo "[start-all] ERROR: npm/pnpm not installed. Please install Node and run 'npm install' in my-app/ then rerun."
    exit 1
  fi
fi

echo "[start-all] Launching Vite dev server (foreground). Use Ctrl-C to stop frontend. Docker services remain running."
npm run dev
