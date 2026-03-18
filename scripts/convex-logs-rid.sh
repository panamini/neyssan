#!/usr/bin/env bash
set -euo pipefail
# Usage: scripts/convex-logs-rid.sh <RID> [HISTORY_LINES]
RID="${1:?RID required}"
HIST="${2:-4000}"
TIMEOUT_SECS="${TIMEOUT:-4s}"

cd "$(dirname "$0")/../my-app"
: "${CONVEX_DEPLOYMENT:=dev:neat-starfish-33}"

{ timeout "${TIMEOUT_SECS}" npx --yes convex logs --history "$HIST" 2>/dev/null || true; } \
  | awk -v n="$HIST" -v rid="$RID" '
      BEGIN {
        printed = 0
        found = 0
        pat = "\\[Request ID: " rid "\\]"
      }
      /^Watching logs for / { next }
      {
        lines[NR] = $0
        printed++
        if (printed >= n) {
          for (i = 1; i <= NR; i++) {
            if (match(lines[i], pat)) {
              found = 1
              for (j = i; j <= NR && j < i + 160; j++) {
                print lines[j]
              }
              break
            }
          }
          if (!found) {
            print "RID not found in last " n " lines" > "/dev/stderr"
            exit 2
          }
          exit
        }
      }
    '
