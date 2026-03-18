#!/usr/bin/env bash
set -euo pipefail

echo "[cleanup] Killing any stale Cloudflare tunnels..."
pkill -f "cloudflared tunnel --url http://127.0.0.1:8000" 2>/dev/null || true
pkill -f "/node_modules/.bin/cloudflared" 2>/dev/null || true

echo "[cleanup] Stopping parser container if running..."
docker stop cv-parser-service-dev >/dev/null 2>&1 || true

echo "[cleanup] Removing tunnel URL cache..."
rm -f "$(git rev-parse --show-toplevel)/my-app/.parser-tunnel-url"

echo "[cleanup] Done. You can now run ./start-dev.sh"
