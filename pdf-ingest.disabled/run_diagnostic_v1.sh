#!/usr/bin/env bash
# Diagnostic script for PDF ingest + LLM refine flow.
#
# Usage:
#   cd pdf-ingest
#   ./run_diagnostic.sh
#
# This script:
#  - starts db + redis + web + worker (with LLM_MOCK=true)
#  - runs parse-now on cv.pdf
#  - saves parsed JSON to a temp file
#  - confirm-save the parsed profile
#  - enqueue llm-refine with profileId + rawText
#  - polls RQ job status until finished (or timeout)
#  - fetches llm-history, profile, and profile llm-history list
#  - collects recent worker logs
#  - writes all output to a timestamped log in ./diagnostics/
#
set -euo pipefail



########################################
# Step 0: Init paths
########################################
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/diagnostics"
mkdir -p "$LOG_DIR"
TS=$(date -u +"%Y%m%dT%H%M%SZ")
LOG_FILE="$LOG_DIR/diagnostic_${TS}.log"
DEBUG_LOG="/tmp/pdf_ingest_debug.log"

# --- Envs for containers ---
export PDF_INGEST_DEBUG_LOG="$DEBUG_LOG"
export LLM_MOCK=true

log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG_FILE"; }

log "=== Starting diagnostics ==="
log "Log file: $LOG_FILE"
log "Debug log will be written inside container at $DEBUG_LOG and mounted to $LOG_DIR"


########################################
# Step 1: Start DB + Redis
########################################
echo "Step 1: Starting DB and Redis..." | tee -a "${LOG_FILE}"
docker-compose up -d db redis 2>&1 | ts >> "${LOG_FILE}"
sleep 5

########################################
# Step 2: Start web + worker with LLM_MOCK=true
########################################
echo "Step 2: Starting web and worker with LLM_MOCK=true (and PDF_INGEST_DEBUG_LOG if set)..." | tee -a "${LOG_FILE}"
# Allow caller to override PDF_INGEST_DEBUG_LOG; default to /tmp/pdf_ingest_debug.log inside container
PDF_INGEST_DEBUG_LOG="${PDF_INGEST_DEBUG_LOG:-/tmp/pdf_ingest_debug.log}" LLM_MOCK=true docker-compose up -d web worker 2>&1 | ts >> "${LOG_FILE}"
# Give services a bit more time to start and for worker to pick up queues
sleep 8

########################################
# Step 3: parse-now
########################################
echo "==== PARSE NOW: POST /api/v1/parse-now ====" | tee -a "${LOG_FILE}"
PARSE_OUT_RAW=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:8000/api/v1/parse-now -F "file=@cv.pdf")
PARSE_BODY=$(echo "$PARSE_OUT_RAW" | sed '$d')
PARSE_CODE=$(echo "$PARSE_OUT_RAW" | tail -n1)
echo "PARSE HTTP ${PARSE_CODE}" | ts >> "${LOG_FILE}"
echo "$PARSE_BODY" | ts >> "${LOG_FILE}"
echo "$PARSE_BODY" | jq '.' > /tmp/diag_parsed.json

########################################
# Step 4: confirm-save
########################################
echo "==== CONFIRM SAVE: POST /api/v1/confirm-save ====" | tee -a "${LOG_FILE}"
SAVE_OUT=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:8000/api/v1/confirm-save \
    -H "Content-Type: application/json" -d @/tmp/diag_parsed.json)
SAVE_BODY=$(echo "$SAVE_OUT" | sed '$d')
SAVE_CODE=$(echo "$SAVE_OUT" | tail -n1)
echo "CONFIRM SAVE HTTP ${SAVE_CODE}" | ts >> "${LOG_FILE}"
echo "$SAVE_BODY" | ts >> "${LOG_FILE}"
echo "$SAVE_BODY" > /tmp/diag_confirm_body.txt

# Try to extract profile ID; if missing, create a placeholder
PROFILE_ID=$(echo "$SAVE_BODY" | jq -r '.id // empty' || echo "")
if [ -z "$PROFILE_ID" ]; then
  echo "No profile ID returned; using placeholder for diagnostic." | tee -a "${LOG_FILE}"
  PROFILE_ID="placeholder-$(uuidgen)"
fi
echo "Persisted / placeholder profile id: ${PROFILE_ID}" | ts >> "${LOG_FILE}"

########################################
# Step 5: enqueue llm-refine
########################################
echo "==== ENQUEUE LLM-REFINE: POST /api/v1/llm-refine ====" | tee -a "${LOG_FILE}"
RAWTEXT=$(jq -r '.rawText // ""' /tmp/diag_parsed.json | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || jq -r '.rawText // ""' /tmp/diag_parsed.json | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))")
REFINE_PAYLOAD=$(jq -n --arg pid "$PROFILE_ID" --arg raw "$RAWTEXT" '{profileId: $pid, rawText: $raw}')
echo "Refine payload (trimmed):" | ts >> "${LOG_FILE}"
echo "$REFINE_PAYLOAD" | jq '.' | ts >> "${LOG_FILE}"

REF_RESP=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:8000/api/v1/llm-refine \
    -H "Content-Type: application/json" -d "$REFINE_PAYLOAD")
REF_BODY=$(echo "$REF_RESP" | sed '$d')
REF_CODE=$(echo "$REF_RESP" | tail -n1)
echo "HTTP ${REF_CODE}" | ts >> "${LOG_FILE}"
echo "$REF_BODY" | ts >> "${LOG_FILE}"
JOB_ID=$(echo "$REF_BODY" | jq -r '.jobId // .llm_job_id // empty' || echo "")
echo "Job ID: ${JOB_ID}" | ts >> "${LOG_FILE}"

########################################
# Step 6: poll RQ job status
########################################
echo "==== POLL RQ JOB STATUS ====" | tee -a "${LOG_FILE}"
if [ -n "$JOB_ID" ]; then
  MAX_ATTEMPTS=60
  ATTEMPT=0
  STATUS=""
  while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    sleep 1
    ATTEMPT=$((ATTEMPT+1))
    ST_RESP=$(curl -s -X GET "http://127.0.0.1:8000/api/v1/rq-job/$JOB_ID")
    ST=$(echo "$ST_RESP" | jq -r '.status // empty' || echo "")
    echo "poll $ATTEMPT -> $ST" | ts >> "${LOG_FILE}"
    STATUS=$ST
    if [ "$ST" = "finished" ] || [ "$ST" = "failed" ]; then
      break
    fi
  done
  echo "Final job status: $STATUS" | ts >> "${LOG_FILE}"
else
  echo "No job id available; skipping polling" | ts >> "${LOG_FILE}"
fi

########################################
# Step 7: fetch history and profile
########################################
echo "==== LLM HISTORY (by job id) ====" | tee -a "${LOG_FILE}"
if [ -n "$JOB_ID" ]; then
  curl -s "http://127.0.0.1:8000/api/v1/llm-history/$JOB_ID" | jq '.' 2>&1 | ts >> "${LOG_FILE}" || true
fi

echo "==== PROFILE ROW ====" | tee -a "${LOG_FILE}"
curl -s "http://127.0.0.1:8000/api/v1/profiles/$PROFILE_ID" | jq '.' 2>&1 | ts >> "${LOG_FILE}" || true

echo "==== PROFILE LLM HISTORY LIST ====" | tee -a "${LOG_FILE}"
curl -s "http://127.0.0.1:8000/api/v1/profiles/$PROFILE_ID/llm-history" | jq '.' 2>&1 | ts >> "${LOG_FILE}" || true

########################################
# Step 8: worker logs
########################################
echo "==== WORKER LOGS (tail 200) ====" | tee -a "${LOG_FILE}"
docker-compose logs worker --tail 200 2>&1 | ts >> "${LOG_FILE}" || true

echo "" | tee -a "${LOG_FILE}"
echo "Diagnostic completed at $(date -u)" | tee -a "${LOG_FILE}"

########################################
# Step 9: teardown
########################################
echo "Tearing down containers..." | tee -a "${LOG_FILE}"
docker-compose down 2>&1 | ts >> "${LOG_FILE}" || true

echo "Diagnostic log saved to ${LOG_FILE}"
