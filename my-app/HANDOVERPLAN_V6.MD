PDF-Ingest / My-App Full Handover & Next Steps

Date: 2025-08-27
Author: Consolidated Plan

Purpose:
Make pdf-ingest the authoritative processor of CVs and canonical profiles. Ensure the frontend (my-app) can:

Upload PDFs (parse-now)

Persist canonical profiles (confirm-save)

Trigger LLM refinement

Display canonical profiles in the UI via Convex

This plan can be executed by a developer or an AI without improvisation.

1️⃣ Environment Setup

Verify Docker:

docker info


Clean old resources:

docker-compose -f pdf-ingest/docker-compose.yml down --volumes --remove-orphans || true


Start core services:

docker-compose -f pdf-ingest/docker-compose.yml up -d db web worker

2️⃣ Database Remediation

Remediate migrations (idempotent):

cd pdf-ingest
./remediate_migrations-grok.sh \
  --compose docker-compose.yml \
  --db-service db \
  --alembic-service alembic \
  --db-user postgres \
  --db-name pdf_ingest \
  --versions-dir alembic/versions


Verify Alembic revision:

docker-compose -f docker-compose.yml exec -T db \
psql -U postgres -d pdf_ingest -t -A -c "SELECT version_num FROM alembic_version LIMIT 1;"

docker-compose -f docker-compose.yml run --rm --no-TTY web alembic heads

3️⃣ Backend Setup & Configuration

Set LLM active (disable mock):

export LLM_MOCK=false


Set PDF-Ingest debug log (optional):

export PDF_INGEST_DEBUG_LOG=/tmp/pdf_ingest_debug.log


Run backend (uvicorn or via docker-compose):

# local dev
cd pdf-ingest
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# or docker
./run-all.sh --force --log-file=diagnostics/run-all-$(date +%Y%m%d%H%M%S).log

4️⃣ Frontend Setup

Set environment URL (frontend to call backend):

my-app/.env:

VITE_PDF_INGEST_URL=http://127.0.0.1:8000


Start frontend dev server:

cd my-app
npm install
npm run dev -- --port 5175

5️⃣ Verification Steps

Step 5.1: Backend health

curl -v http://127.0.0.1:8000/api/v1/health


Expected: 200 OK

Step 5.2: Confirm-save test (full payload)

curl -i -X POST 'http://127.0.0.1:8000/api/v1/confirm-save' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test User","email":"test@example.com","summary":"sample","confidence":0.85,"skills":[],"experience":[],"rawText":"","metadata":{}}'


Expected: 200 OK + profile ID returned

Step 5.3: Parse-now test (CV upload)

curl -v -X POST 'http://127.0.0.1:8000/api/v1/parse-now' \
  -F "file=@../test-files/sample_cv.pdf"


Expected: JSON response with status success

Step 5.4: Observe logs (LLM + Worker)

# web logs
docker-compose -f pdf-ingest/docker-compose.yml logs -f web

# worker logs
docker-compose -f pdf-ingest/docker-compose.yml logs -f worker


Expected: persistProfile entries showing LLM processing is triggered

Step 5.5: Frontend / canonical profile

Open http://localhost:5175

Load a CV

Confirm left pane updates with canonical profile after LLM processing

Check DevTools Network: /api/v1/confirm-save & /api/v1/parse-now succeed

If UI shows "Loading canonical profile…", wait a few seconds for LLM + worker to complete

6️⃣ Convex Verification

Start Convex dev server:

cd my-app/convex
npx convex dev


Check logs: profilesPublic.get should be registered

UI should show canonical profile once backend persists

7️⃣ Troubleshooting / Notes

Ensure LLM_MOCK=false for real processing

parse-now success does not mean canonical profile exists until LLM runs

Backend logs: look for persistProfile success entries

Frontend logs: console.log shows POST/response and canonical JSON updates

Docker networking: host port mapping 127.0.0.1:8000 must match VITE_PDF_INGEST_URL

8️⃣ Optional Diagnostics
# OPTIONS preflight test
curl -i -X OPTIONS 'http://127.0.0.1:8000/api/v1/confirm-save' \
  -H 'Origin: http://localhost:5175' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type, authorization'


Expected: CORS headers present (already fixed)

9️⃣ Checklist (for AI or dev)

 Docker is running, old resources cleaned

 Database migration is complete

 Backend running (web + worker)

 LLM active (LLM_MOCK=false)

 Frontend running, correct .env

 Upload CV → backend returns success

 Confirm-save POST returns profile ID

 Worker logs show persistProfile called

 Convex dev server running

 UI shows canonical profile after processing

./run-all.sh --skip-backfill

CREATE A LOG to check the app running
 docker compose -f pdf-ingest/docker-compose.yml logs -f web worker > worker.log
