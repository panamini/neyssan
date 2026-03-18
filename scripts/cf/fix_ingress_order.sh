#!/usr/bin/env bash
# file: scripts/cf/fix_ingress_order.sh
# Ensure specific→catch-all order for HOST only. DRY-RUN unless FIX=1.
set -euo pipefail
: "${CF_API_TOKEN:?CF_API_TOKEN missing}"
: "${CF_ACCOUNT_ID:?CF_ACCOUNT_ID missing}"
: "${CF_TUNNEL_ID:?CF_TUNNEL_ID missing}"
HOST="${HOST:-parser.dasti.ai}"
SVC="${SVC:-http://cv-parser-service-dev:8001}"
FIX="${FIX:-0}"
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
api(){ curl -sS --fail -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" "https://api.cloudflare.com/client/v4$1"; }

CFG="$(api "/accounts/$CF_ACCOUNT_ID/cfd_tunnel/$CF_TUNNEL_ID/configurations" || true)"
if ! echo "$CFG" | jq -e '.success==true' >/dev/null 2>&1; then
  CFG="$(api "/accounts/$CF_ACCOUNT_ID/cfd_tunnel/$CF_TUNNEL_ID/config" || true)"
fi

ING="$(echo "$CFG" | jq '(.result.config.ingress // .result.ingress) // []')"
OTHER="$(echo "$ING" | jq --arg host "$HOST" 'map(select(.hostname != $host))')"
TARGET="$(jq -n --arg host "$HOST" --arg svc "$SVC" '[
  {hostname:$host, path:"/mistral-ocr/*", service:$svc},
  {hostname:$host, path:"/parse-cv",      service:$svc},
  {hostname:$host, path:"/ready",         service:$svc},
  {hostname:$host, path:"/*",             service:$svc}
]')"
MERGED="$(jq -n --argjson other "$OTHER" --argjson target "$TARGET" '$other + $target')"

echo "== CURRENT (all) =="; echo "$ING" | jq -r '.[]? | "\(.hostname) \(.path) -> \(.service)"'
echo "== TARGET (for host) =="; echo "$TARGET" | jq -r '.[] | "\(.hostname) \(.path) -> \(.service)"'

if [[ "$FIX" != "1" ]]; then
  echo "DRY-RUN (set FIX=1 to apply)"; exit 0
fi

NEW="$(echo "$CFG" | jq --argjson merged "$MERGED" '
  . as $r | if $r.result.config then .result.config.ingress = $merged else .result.ingress = $merged end
')"

OUT="$(curl -sS --fail -X PUT -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/cfd_tunnel/$CF_TUNNEL_ID/configurations" --data "$NEW" || true)"
if ! echo "$OUT" | jq -e '.success==true' >/dev/null 2>&1; then
  OUT="$(curl -sS --fail -X PUT -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/cfd_tunnel/$CF_TUNNEL_ID/config" --data "$NEW" || true)"
fi
echo "$OUT" | jq '{success, errors, messages}'
