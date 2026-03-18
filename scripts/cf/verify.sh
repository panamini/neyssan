# verify.sh — prints the three final statuses
HOST="parser.dasti.ai"; FILE="./fixtures/cv_png.pdf"
set -a; [ -f ./.env.local ] && . ./.env.local; set +a
CID="${CF_ACCESS_CLIENT_ID:-${CF_ID:-}}"; CSEC="${CF_ACCESS_CLIENT_SECRET:-${CF_SECRET:-}}"

printf 'ready       = '; curl --http1.1 -s -o /dev/null -w '%{http_code}\n' "https://${HOST}/ready"
printf 'no_token    = '; curl --http1.1 -s -o /dev/null -w '%{http_code}\n' "https://${HOST}/mistral-ocr/parse"
printf 'with_tok_get= '; curl --http1.1 -s -o /dev/null -w '%{http_code}\n' \
  -H "CF-Access-Client-Id: ${CID}" -H "CF-Access-Client-Secret: ${CSEC}" "https://${HOST}/mistral-ocr/parse"
printf 'with_tok_post= '; curl --http1.1 -s -o /dev/null -w '%{http_code}\n' \
  -H 'Accept: application/json' -H 'Expect:' \
  -H "CF-Access-Client-Id: ${CID}" -H "CF-Access-Client-Secret: ${CSEC}" \
  -F "file=@${FILE};type=application/pdf" "https://${HOST}/mistral-ocr/parse"
