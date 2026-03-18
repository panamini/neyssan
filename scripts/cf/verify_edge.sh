#!/usr/bin/env bash
# file: scripts/cf/audit_cf.sh
set -euo pipefail
: "${CF_API_TOKEN:?CF_API_TOKEN missing}"
: "${CF_ACCOUNT_ID:?CF_ACCOUNT_ID missing}"
: "${CF_ZONE_ID:?CF_ZONE_ID missing}"
: "${CF_TUNNEL_ID:?CF_TUNNEL_ID missing}"
HOST="${HOST:-parser.dasti.ai}"
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
api(){ curl -sS --fail -H "Authorization: Bearer $CF_API_TOKEN" "https://api.cloudflare.com/client/v4$1"; }

echo "== Access apps on $HOST =="
APPS_JSON="$(api "/accounts/$CF_ACCOUNT_ID/access/apps?per_page=1000" || true)"
echo "$APPS_JSON" | jq -r --arg host "$HOST" '
 .result | map(select((.domain==$host) or (.self_hosted_domains // [] | any(.domain==$host))))
 | .[]? as $a
 | "APP\t\($a.id)\t\($a.name)\t" +
   (if $a.domain then "domain=\($a.domain)" else "multi" end) + "\tpaths=" +
   ((($a.self_hosted_domains // []) | map(select(.domain==$host) | .path)) | join(","))'
readarray -t APP_IDS < <(echo "$APPS_JSON" | jq -r --arg host "$HOST" '
 .result | map(select((.domain==$host) or (.self_hosted_domains // [] | any(.domain==$host)))) | .[].id')

echo -e "\n== Access policies (ordered) =="
for id in "${APP_IDS[@]:-}"; do
  echo "APP $id"
  api "/accounts/$CF_ACCOUNT_ID/access/apps/$id/policies?per_page=1000" \
  | jq -r '.result | sort_by(.precedence) | to_entries[]
    | "\(.key+1)) action=\(.value.decision // .value.action) include=" +
      ((.value.include // []) | map(keys[0]) | unique | join(","))'
done

echo -e "\n== Workers routes touching $HOST =="
api "/zones/$CF_ZONE_ID/workers/routes?per_page=500" \
| jq -r --arg host "$HOST" '
 .result
 | map(select(.pattern | test("^" + ($host|gsub("\\.";"\\.")) + "(/.*)?$")))
 | if length==0 then "NONE" else .[] | "ROUTE\t\(.pattern)\tscript=\(.script // "NONE")" end'

echo -e "\n== Tunnel published routes (ingress order) =="
CFG="$(api "/accounts/$CF_ACCOUNT_ID/cfd_tunnel/$CF_TUNNEL_ID/configurations" || true)"
if ! echo "$CFG" | jq -e '.success==true' >/dev/null 2>&1; then
  CFG="$(api "/accounts/$CF_ACCOUNT_ID/cfd_tunnel/$CF_TUNNEL_ID/config" || true)"
fi
echo "$CFG" | jq -r '
 (.result.config.ingress // .result.ingress)
 | to_entries[]? | "\(.key+1)) host=\(.value.hostname // "*") path=\(.value.path // "/*") svc=\(.value.service // "none")"'

echo -e "\n== Heuristics =="
APPCOUNT=${#APP_IDS[@]}
echo "ACCESS_APPS_FOR_HOST=$APPCOUNT  # expect 2"
HOST_ING="$(echo "$CFG" | jq --arg host "$HOST" '(.result.config.ingress // .result.ingress) | map(select(.hostname==$host))')"
echo "$HOST_ING" | jq -r '
  {
    has_mo: any(.[]; .path=="/mistral-ocr/*"),
    has_pc: any(.[]; .path=="/parse-cv"),
    has_ready: any(.[]; .path=="/ready"),
    has_catch_all: any(.[]; .path=="/*"),
    last_is_catch_all: (length>0 and (.[length-1].path=="/*"))
  }
  | "INGRESS_HAS_MISTRAL=\(.has_mo)  INGRESS_HAS_PARSE_CV=\(.has_pc)  INGRESS_HAS_READY=\(.has_ready)  CATCH_ALL_PRESENT=\(.has_catch_all)  CATCH_ALL_LAST_FOR_HOST=\(.last_is_catch_all)"'
BAD_PATHS="$(echo "$CFG" | jq -r '
 (.result.config.ingress // .result.ingress)
 | map(select((.hostname!=null) and (.path!=null) and (.path|startswith("/")==false)))
 | .[]? | "\(.hostname)  \(.path)"')"
if [[ -n "${BAD_PATHS:-}" ]]; then
  echo -e "\nWARN: Found ingress paths missing leading \"/\" (should be e.g. \"/*\"):"; echo "$BAD_PATHS"
fi
