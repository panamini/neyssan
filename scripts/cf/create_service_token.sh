#!/usr/bin/env bash
# file: scripts/cf/create_service_token.sh
set -euo pipefail
: "${CF_API_TOKEN:?CF_API_TOKEN missing}"
: "${CF_ACCOUNT_ID:?CF_ACCOUNT_ID missing}"
NAME="${1:-parser2}"
curl -sS --fail -X POST -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/service_tokens" \
  --data "{\"name\":\"$NAME\"}" \
| jq -r '.result | "CF_ACCESS_CLIENT_ID=\(.client_id)\nCF_ACCESS_CLIENT_SECRET=\(.client_secret)"'
