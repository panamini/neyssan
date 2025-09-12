#!/usr/bin/env bash
# Diagnostic script for PDF ingest + LLM refine flow.
#
# Usage:
#   cd pdf-ingest
#   ./run_diagnostic.sh
#
# This script:
#  - starts db + redis + web + worker (with LLM_MOCK=true)
#  - runs parse-now on pdf.pdf
#  - saves parsed JSON to a temp file
#  - confirm-save the parsed profile
#  - enqueue llm-refine with profileId + rawText
#  - polls RQ job status until finished (or timeout)
#  - fetches llm-history, profile, and profile llm-history list
#  - collects recent worker logs
#  - writes all output to a timestamped log in ./diagnostics/
#
set -euo pipefail

LOG_DIR="./diagnostics"
mkdir -p "${LOG_DIR}"
TS=$(date -u +"%Y%m%dT%H%M%SZ")
LOG_FILE="${LOG_DIR}/diagnostic_${TS}.log"

echo "Diagnostic started at $(date -u)" | tee -a "${LOG_FILE}"
echo "Log file: ${LOG_FILE}" | tee -a "${LOG_FILE}"
echo "" | tee -a "${LOG_FILE}"

# Helper to timestamp lines
ts() { while IFS= read -r line; do printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$line"; done; }

cd "$(dirname "$0")"

echo "Step 1: Starting DB and Redis via docker-compose..." | tee -a "${LOG_FILE}"
docker-compose up -d db redis 2>&1 | ts >> "${LOG_FILE}"

echo "Waiting 5 seconds for services to initialize..." | tee -a "${LOG_FILE}"
sleep 5

echo "Step 2: Starting web and worker with LLM_MOCK=true..." | tee -a "${LOG_FILE}"
LLM_MOCK=true docker-compose up -d web worker 2>&1 | ts >> "${LOG_FILE}"

echo "Waiting 3 seconds for web+worker to come up..." | tee -a "${LOG_FILE}"
sleep 3

# 1) parse-now
echo "==== PARSE NOW: POST /api/v1/parse-now ====" | tee -a "${LOG_FILE}"
PARSE_OUT_RAW=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:8000/api/v1/parse-now -F "file=@cv.pdf")
# Split body and status code
PARSE_BODY=$(echo "${PARSE_OUT_RAW}" | sed '$d')
PARSE_CODE=$(echo "${PARSE_OUT_RAW}" | tail -n1)
echo "HTTP ${PARSE_CODE}" | ts >> "${LOG_FILE}"
echo "${PARSE_BODY}" | ts >> "${LOG_FILE}"
echo "${PARSE_BODY}" > /tmp/diagnostic_parsed.json

echo "" | tee -a "${LOG_FILE}"

# 2) confirm-save (persist profile)
echo "==== CONFIRM SAVE: POST /api/v1/confirm-save ====" | tee -a "${LOG_FILE}"
SAVE_OUT=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:8000/api/v1/confirm-save -H "Content-Type: application/json" -d @/tmp/diagnostic_parsed.json)
SAVE_BODY=$(echo "${SAVE_OUT}" | sed '$d')
SAVE_CODE=$(echo "${SAVE_OUT}" | tail -n1)
echo "HTTP ${SAVE_CODE}" | ts >> "${LOG_FILE}"
echo "${SAVE_BODY}" | ts >> "${LOG_FILE}"
PROFILE_ID=$(echo "${SAVE_BODY}" | jq -r '.id // empty' 2>/dev/null || echo "")

if [ -z "${PROFILE_ID}" ]; then
  echo "No profile ID returned by confirm-save; aborting diagnostic. See log." | tee -a "${LOG_FILE}"
  docker-compose logs --tail 200 web worker 2>&1 | ts >> "${LOG_FILE}" || true

   # Capture recent web + worker logs
  docker-compose logs --tail 200 web worker 2>&1 | ts >> "${LOG_FILE}" || true
  
  docker-compose down || true
  exit 1
fi
echo "Persisted profile id: ${PROFILE_ID}" | ts >> "${LOG_FILE}"

echo "" | tee -a "${LOG_FILE}"


# 3) enqueue llm-refine (use canonical rawText from parsed JSON)
echo "==== ENQUEUE LLM-REFINE: POST /api/v1/llm-refine ====" | tee -a "${LOG_FILE}"
RAWTEXT=$(jq -r '.rawText // ""' /tmp/diagnostic_parsed.json | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || jq -r '.rawText // ""' /tmp/diagnostic_parsed.json | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))")
# Build JSON payload safely
REFINE_PAYLOAD=$(jq -n --arg pid "$PROFILE_ID" --arg raw "$(jq -Rs '.' /tmp/diagnostic_parsed.json | jq -r '.')" '{profileId: $pid, rawText: (.rawText // $raw)}' 2>/dev/null || printf '{"profileId":"%s","rawText":%s}' "$PROFILE_ID" "$(jq -R . /tmp/diagnostic_parsed.json)")
# Simpler fallback if above fails:
if [ -z "$REFINE_PAYLOAD" ] || [ "$REFINE_PAYLOAD" = "null" ]; then
  REFINE_PAYLOAD=$(jq -n --arg pid "$PROFILE_ID" --arg raw "$(jq -r '.rawText' /tmp/diagnostic_parsed.json)" '{"profileId":$pid,"rawText":$raw}')
fi

echo "Refine payload (trimmed):" | ts >> "${LOG_FILE}"
echo "${REFINE_PAYLOAD}" | jq '.' | ts >> "${LOG_FILE}"

REF_RESP=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:8000/api/v1/llm-refine -H "Content-Type: application/json" -d "${REFINE_PAYLOAD}")
REF_BODY=$(echo "${REF_RESP}" | sed '$d')
REF_CODE=$(echo "${REF_RESP}" | tail -n1)
echo "HTTP ${REF_CODE}" | ts >> "${LOG_FILE}"
echo "${REF_BODY}" | ts >> "${LOG_FILE}"

JOB_ID=$(echo "${REF_BODY}" | jq -r '.jobId // .llm_job_id // empty' 2>/dev/null || echo "")
echo "Job ID: ${JOB_ID}" | ts >> "${LOG_FILE}"

echo "" | tee -a "${LOG_FILE}"

# 4) poll job
echo "==== POLL RQ JOB STATUS ====" | tee -a "${LOG_FILE}"
if [ -n "${JOB_ID}" ]; then
  MAX_ATTEMPTS=60
  ATTEMPT=0
  STATUS=""
  while [ ${ATTEMPT} -lt ${MAX_ATTEMPTS} ]; do
    sleep 1
    ATTEMPT=$((ATTEMPT+1))
    ST_RESP=$(curl -s -X GET "http://127.0.0.1:8000/api/v1/rq-job/${JOB_ID}")
    ST=$(echo "${ST_RESP}" | jq -r '.status // empty' 2>/dev/null || echo "")
    echo "poll ${ATTEMPT} -> ${ST}" | ts >> "${LOG_FILE}"
    STATUS=${ST}
    if [ "${ST}" = "finished" ] || [ "${ST}" = "failed" ]; then
      break
    fi
  done
  echo "Final job status: ${STATUS}" | ts >> "${LOG_FILE}"
else
  echo "No job id available; skipping polling" | ts >> "${LOG_FILE}"
fi

echo "" | tee -a "${LOG_FILE}"

# 5) fetch history and profile
echo "==== LLM HISTORY (by job id) ====" | tee -a "${LOG_FILE}"
if [ -n "${JOB_ID}" ]; then
  curl -s "http://127.0.0.1:8000/api/v1/llm-history/${JOB_ID}" | jq '.' 2>&1 | ts >> "${LOG_FILE}" || true
fi

echo "==== PROFILE ROW ====" | tee -a "${LOG_FILE}"
curl -s "http://127.0.0.1:8000/api/v1/profiles/${PROFILE_ID}" | jq '.' 2>&1 | ts >> "${LOG_FILE}" || true

echo "==== PROFILE LLM HISTORY LIST ====" | tee -a "${LOG_FILE}"
curl -s "http://127.0.0.1:8000/api/v1/profiles/${PROFILE_ID}/llm-history" | jq '.' 2>&1 | ts >> "${LOG_FILE}" || true

echo "" | tee -a "${LOG_FILE}"

echo "==== WORKER LOGS (tail 200) ====" | tee -a "${LOG_FILE}"
docker-compose logs worker --tail 200 2>&1 | ts >> "${LOG_FILE}" || true

echo "" | tee -a "${LOG_FILE}"
echo "Diagnostic completed at $(date -u)" | tee -a "${LOG_FILE}"

echo "Tearing down containers..." | tee -a "${LOG_FILE}"
docker-compose down 2>&1 | ts >> "${LOG_FILE}" || true

echo "Diagnostic log saved to ${LOG_FILE}"
