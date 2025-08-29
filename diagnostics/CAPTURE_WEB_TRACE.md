How to capture the live web-container trace for the failing `confirm-save` request
================================================================================

Purpose
-------
Tail the web container logs while sending a `confirm-save` request so you capture the real exception and full traceback emitted by the web service (the 500 happens in the web container before anything reaches the worker).

Step-by-step
------------
1. (Optional) Start services with debug logging enabled
   - From the repository root:
     PDF_INGEST_DEBUG_LOG=/tmp/pdf_ingest_debug.log LLM_MOCK=true docker compose -f pdf-ingest/docker-compose.yml up --build -d db redis web worker

2. Open Terminal A — tail web logs live:
   - docker compose -f pdf-ingest/docker-compose.yml logs -f web

3. In Terminal B — send the test request to confirm-save:
   - curl -v -X POST http://127.0.0.1:8000/api/v1/confirm-save \
       -H "Content-Type: application/json" \
       -d '{"email":"test@example.com","name":"Test","rawText":"hello","confidence":0.3}'

4. Observe Terminal A while the curl runs and copy the relevant output:
   - Look for:
     - "confirm-save called email=..."
     - Any JSON decode or Pydantic validation exceptions
     - Full Python traceback for the internal server error

5. Save the trace to a file (one-shot capture)
   - docker compose -f pdf-ingest/docker-compose.yml logs --no-color web --tail 1000 > diagnostics/web_trace.txt

Single-command automation (starts services, runs request, captures logs)
----------------------------------------------------------------------
PDF_INGEST_DEBUG_LOG=/tmp/pdf_ingest_debug.log LLM_MOCK=true docker compose -f pdf-ingest/docker-compose.yml up --build -d db redis web worker && \
sleep 6 && \
curl -s -X POST http://127.0.0.1:8000/api/v1/confirm-save -H "Content-Type: application/json" -d '{"email":"test@example.com","name":"Test","rawText":"hello","confidence":0.3"}' && \
docker compose -f pdf-ingest/docker-compose.yml logs --no-color web --tail 1000 > diagnostics/web_trace.txt

Notes and tips
--------------
- Use the explicit compose file (-f pdf-ingest/docker-compose.yml) if you run from the repo root.
- The repo already mounts ./diagnostics -> /tmp inside containers (docker-compose.yml). If you set PDF_INGEST_DEBUG_LOG=/tmp/pdf_ingest_debug.log, the container debug log will be written into `./diagnostics/pdf_ingest_debug.log`.
- Worker logs are not helpful for this issue until the web request is parsed and enqueued successfully; capture the web trace.
- Paste the full traceback (or `diagnostics/web_trace.txt`) here so I can analyze the failing line and fix the root cause.
