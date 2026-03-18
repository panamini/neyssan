#!/usr/bin/env bash
set -euo pipefail
# Usage: scripts/convex-logs-history.sh [HISTORY_LINES]
HIST="${1:-2000}"
TIMEOUT_SECS="${TIMEOUT:-3s}"

cd "$(dirname "$0")/../my-app"
: "${CONVEX_DEPLOYMENT:=dev:neat-starfish-33}"

{ timeout "${TIMEOUT_SECS}" npx --yes convex logs --history "$HIST" 2>/dev/null || true; } \
  | awk -v n="$HIST" '
      BEGIN { printed=0 }
      /^Watching logs for / { next }
      { print; printed++; if (printed>=n) exit }
    '
