#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CONTAINER_NAME="cv-parser-service-dev"
IMAGE_NAME="cv-parser-service"
PARSER_URL="http://localhost:8001/parse-cv"
HEALTH_URL="http://localhost:8001/healthz"

make docker-build

# Ensure the container is not already running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[dev] Stopping existing ${CONTAINER_NAME} container..."
  docker stop "${CONTAINER_NAME}" >/dev/null
fi

# Start the parser service in the background so we can run pnpm dev alongside it
docker run -d --rm --name "${CONTAINER_NAME}" -p 8001:8001 "${IMAGE_NAME}" > /dev/null

cleanup() {
  echo "\n[dev] Shutting down parser service..."
  docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Wait for the service to become available
printf '[dev] Waiting for parser service to become healthy'
for _ in {1..20}; do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    break
  fi
  printf '.'
  sleep 1
done
printf '\n[dev] Parser service ready at %s (health: %s)\n' "$PARSER_URL" "$HEALTH_URL"

export CONVEX_PARSER_URL="${CONVEX_PARSER_URL:-$PARSER_URL}"

cd my-app

echo "[dev] Starting pnpm dev (frontend + Convex)."
pnpm dev
