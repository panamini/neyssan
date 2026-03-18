#!/usr/bin/env bash
set -euo pipefail

PDF="${1:-fixtures/sample_scanned_resume.pdf}"
BASE="${PARSER_BASE:-http://127.0.0.1:8000}"
NAME="${CONTAINER_NAME:-cv-parser-service-dev}"

if [[ ! -f "$PDF" ]]; then
  echo "[verify] sample PDF not found: $PDF" >&2
  exit 2
fi

echo "[verify] container: $NAME  base: $BASE  pdf: $PDF"

# Ensure container is up
cid="$(docker ps -q -f "name=^${NAME}$")"
if [[ -z "$cid" ]]; then
  echo "[verify] container ${NAME} not running" >&2
  exit 2
fi

echo "[verify] env in container:"
docker exec "$NAME" bash -lc 'echo DOCTR_PY=$DOCTR_PY DOCTR_BACKEND=$DOCTR_BACKEND OCR_ENGINE=$OCR_ENGINE CV_OCR_ENGINE=$CV_OCR_ENGINE CV_DOCTR_SITE_PACKAGES=$CV_DOCTR_SITE_PACKAGES'

echo "[verify] doctr venv + imports:"
docker exec "$NAME" bash -lc 'ls -l /opt/doctr-venv/bin/python && /opt/doctr-venv/bin/python - <<PY
import tensorflow as tf, doctr
print("OK", tf.__version__, getattr(doctr, "__version__", "unknown"))
PY'

echo "[verify] wait /ready (max 60s)…"
for i in $(seq 1 60); do
  ready="$(curl -sS "$BASE/ready" || true)"
  eng="$(jq -r '.ocr.engine // ""' <<<"$ready" 2>/dev/null || true)"
  sel="$(jq -r '.ocr.selected // ""' <<<"$ready" 2>/dev/null || true)"
  av="$(jq -r '.ocr.available // ""' <<<"$ready" 2>/dev/null || true)"
  echo "[ready] eng=$eng sel=$sel av=$av"
  if [[ "$sel" == "doctr" && "$av" == "true" ]]; then
    break
  fi
  sleep 1
done

resp_dir="tmp"
resp_file="${resp_dir}/direct_ocr.json"
mkdir -p "$resp_dir"

echo "[verify] direct OCR smoke on image-only PDF…"
curl -sS -H 'content-type: application/pdf' --data-binary @"$PDF" \
  "$BASE/parse-cv?mode=ocr" > "$resp_file"

if command -v jq >/dev/null 2>&1; then
  jq '{engine:.diagnostics.engine, engine_final:.diagnostics.engine_final, pdf_pages_rendered:.diagnostics.pdf_pages_rendered, pdf_text_len:.diagnostics.pdf_text_len, failure_reason:.diagnostics.failure_reason}' "$resp_file"
  engine_final="$(jq -r '.diagnostics.engine_final // ""' "$resp_file")"
  failure_reason="$(jq -r '.diagnostics.failure_reason // ""' "$resp_file")"
else
  cat "$resp_file"
  engine_final="$(sed -n 's/.*"engine_final":"\([^"]*\)".*/\1/p' "$resp_file" | head -n1)"
  failure_reason="$(sed -n 's/.*"failure_reason":"\([^"]*\)".*/\1/p' "$resp_file" | head -n1)"
fi

if [[ "$engine_final" != "doctr" || "$failure_reason" == "doctr_unavailable" ]]; then
  echo "[verify] FAIL: expected engine_final=doctr; got engine_final=\"$engine_final\" failure_reason=\"$failure_reason\"" >&2
  exit 3
fi

echo "[verify] PASS: docTR available and selected"
