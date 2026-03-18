#!/usr/bin/env bash
# verify-flow.sh - quick verification of confirm-save -> enqueue -> poll -> fetch profile
# Usage: ./verify-flow.sh [API_BASE]; default: http://127.0.0.1:8000
set -euo pipefail

API_BASE=${1:-http://127.0.0.1:8000}

echo "[verify-flow] Using API base: $API_BASE"

# 1) Confirm-save a low-confidence profile (should auto-enqueue if LLM_THRESHOLD > 0.05)
PAYLOAD=$(cat <<JSON
{
  "name":"Dev Test User",
  "email":"dev-test+$(date +%s)@example.com",
  "summary":"Test profile",
  "skills":["Python","FastAPI"],
  "experience": [],
  "rawText": "sample raw",
  "confidence": 0.05,
  "metadata": {}
}
JSON
)

echo "[verify-flow] Posting confirm-save..."
RESP=$(curl -sS -X POST "$API_BASE/api/v1/confirm-save" -H "Content-Type: application/json" -d "$PAYLOAD" || true)
echo "$RESP" | jq . 2>/dev/null || echo "$RESP"

# Extract profile id and possibly llm job id
PROFILE_ID=$(echo "$RESP" | jq -r '.id // empty' 2>/dev/null || echo "")
LLM_JOB_ID=$(echo "$RESP" | jq -r '.llm_job_id // empty' 2>/dev/null || echo "")

if [ -z "$PROFILE_ID" ]; then
  echo "[verify-flow] ERROR: could not get profile id from confirm-save response."
  exit 1
fi
echo "[verify-flow] profile id: $PROFILE_ID"

if [ -n "$LLM_JOB_ID" ]; then
  echo "[verify-flow] llm_job_id returned: $LLM_JOB_ID"
else
  echo "[verify-flow] No llm_job_id returned from confirm-save. Enqueuing explicitly..."
  ENQ_RESP=$(curl -sS -X POST "$API_BASE/api/v1/llm-refine" -H "Content-Type: application/json" -d "{\"profileId\":\"$PROFILE_ID\"}" || true)
  echo "$ENQ_RESP" | jq . 2>/dev/null || echo "$ENQ_RESP"
  LLM_JOB_ID=$(echo "$ENQ_RESP" | jq -r '.jobId // .llm_job_id // empty' 2>/dev/null || echo "")
  if [ -z "$LLM_JOB_ID" ]; then
    echo "[verify-flow] ERROR: unable to enqueue job."
    exit 1
  fi
  echo "[verify-flow] enqueued job id: $LLM_JOB_ID"
fi

# Poll job
echo "[verify-flow] Polling job status..."
MAX=60
i=0
while [ $i -lt $MAX ]; do
  sleep 1
  STATUS_RESP=$(curl -sS "$API_BASE/api/v1/rq-job/$LLM_JOB_ID" || true)
  ST=$(echo "$STATUS_RESP" | jq -r '.status // empty' 2>/dev/null || echo "")
  echo "[verify-flow] attempt $i: status=$ST"
  if [ "$ST" = "finished" ] || [ "$ST" = "failed" ]; then
    echo "[verify-flow] final job response:"
    echo "$STATUS_RESP" | jq . 2>/dev/null || echo "$STATUS_RESP"
    break
  fi
  i=$((i+1))
done

if [ $i -ge $MAX ]; then
  echo "[verify-flow] timeout waiting for job to finish."
  exit 1
fi

# Fetch updated profile
echo "[verify-flow] Fetching profile..."
curl -sS "$API_BASE/api/v1/profiles/$PROFILE_ID" | jq . 2>/dev/null || true

echo "[verify-flow] Done."
