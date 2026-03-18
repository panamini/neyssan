#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}/my-app"

DEPLOY="${CONVEX_DEPLOYMENT:-dev:neat-starfish-33}"
export CONVEX_DEPLOYMENT="${DEPLOY}"

run_convex_env() {
  local action="$1"; shift
  if ! npx --yes convex env "${action}" "$@" >/dev/null; then
    echo "[bootstrap-convex-env] ERROR: convex env ${action} $* failed." >&2
    exit 1
  fi
}

run_convex_env set CONVEX_PARSER_URL https://parser.dasti.ai
echo "[bootstrap-convex-env] CONVEX_PARSER_URL set to https://parser.dasti.ai"
run_convex_env set STRUCTURED_UPLOAD_SKIP_HEALTHCHECK 1
echo "[bootstrap-convex-env] STRUCTURED_UPLOAD_SKIP_HEALTHCHECK set to 1"

if [[ -n "${CF_ACCESS_CLIENT_ID:-}" && -n "${CF_ACCESS_CLIENT_SECRET:-}" ]]; then
  run_convex_env set CF_ACCESS_CLIENT_ID "${CF_ACCESS_CLIENT_ID}"
  run_convex_env set CF_ACCESS_CLIENT_SECRET "${CF_ACCESS_CLIENT_SECRET}"
  echo "[bootstrap-convex-env] CF Access headers synced."
else
  echo "[bootstrap-convex-env] CF Access headers not provided; skipping."
fi

parser_url=$(npx --yes convex env get CONVEX_PARSER_URL 2>/dev/null | tr -d '\r')
skip_hc=$(npx --yes convex env get STRUCTURED_UPLOAD_SKIP_HEALTHCHECK 2>/dev/null | tr -d '\r')
echo "[bootstrap-convex-env] CONVEX_PARSER_URL currently: ${parser_url}"
echo "[bootstrap-convex-env] STRUCTURED_UPLOAD_SKIP_HEALTHCHECK currently: ${skip_hc}"

npx --yes convex env get CF_ACCESS_CLIENT_ID >/dev/null 2>&1 && echo "[bootstrap-convex-env] CF_ACCESS_CLIENT_ID present." || echo "[bootstrap-convex-env] CF_ACCESS_CLIENT_ID unset."
npx --yes convex env get CF_ACCESS_CLIENT_SECRET >/dev/null 2>&1 && echo "[bootstrap-convex-env] CF_ACCESS_CLIENT_SECRET present." || echo "[bootstrap-convex-env] CF_ACCESS_CLIENT_SECRET unset."
