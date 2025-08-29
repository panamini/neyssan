# HANDOVERPLAN_v3.MD

Status: Investigation started (option 2 selected). Small, gated debug instrumentation added to the running web service and worker to gather traces for the failing /api/v1/confirm-save flow.

This document records exactly what I changed, why, how to reproduce, what to collect, and the next steps to identify and remediate the root cause. It also contains safe SQL snippets for an immediate atomic upsert approach you can use after diagnosis.

---

## 0. Summary / Objective

Ticket: investigate and fix `/api/v1/confirm-save` in `pdf-ingest` so that:

- No uncaught 500s surface in logs or TaskGroup errors.
- Upserts Profile by `email` correctly.
- `education` and `achievements` are stored in `Profile.meta` (JSONB) and merged non-destructively.
- LLM refine enqueue behavior is preserved for profiles below `LLM_THRESHOLD`.
- Missing `email`/`name` are inferred or replaced with flagged placeholders.
- SQLAlchemy async semantics and transactions are used safely (no session misuse across concurrent tasks).

You chose next step: Option 2 — add targeted try/except and debug logging around DB operations (session.begin, flush, refresh, SELECT FOR UPDATE) and worker enqueue/TaskGroup areas. This is lower-risk than relaxing global exception handlers and will capture stack traces for the root cause.

---

## 1. Files I inspected before changes

- pdf-ingest/app.py
- pdf-ingest/db.py
- pdf-ingest/worker.py
- pdf-ingest/convex_persist.py (referenced)
- pdf-ingest/run_diagnostic.sh
- pdf-ingest/docker-compose.yml
- pdf-ingest/tests/test_api_confirm_save.py
- diagnostics/diagnostic_*.log (existing artifacts)

Paths are repo-relative.

---

## 2. Files modified (small, gated debugging/defensive logs)

I created a short-lived debug branch (recommended) and applied minimal changes, guarded where appropriate.

Edits saved in working tree (already applied):

1) pdf-ingest/app.py
- Added optional debug FileHandler controlled by environment var `PDF_INGEST_DEBUG_LOG`.
  - Code looks up `PDF_INGEST_DEBUG_LOG` and attaches a logging.FileHandler if present.
  - Example default path used in instructions: `/tmp/pdf_ingest_debug.log`.
  - This is intentionally environment-gated; it does not change behavior unless env var is set.
- Surround the `async with session.begin():` block in `confirm_save` with `try:` / `logger.debug(...)` and re-raise after logging to allow existing defensive wrapper/global handler to produce stable responses while capturing the full traceback in logs.
- Enhanced SELECT FOR UPDATE error logging to include `session.bind` and `exc_info=True`.
- Added a guard to log transaction failure just before re-raising, giving context: payload keys, email candidate.

Files / locations edited:
- pdf-ingest/app.py (top-level logger configuration and `confirm_save` transaction block). Use the file in repo root for exact content.

2) pdf-ingest/db.py
- Added `import logging` at top (small change to support potential future debug traces and keep consistent style).
- No behavioral change to sessionmaker semantics.

3) pdf-ingest/worker.py
- Instrumented `enqueue_llm_cleanup` with debug logging when starting, and when acquiring a sync session.
- Added debug logs in `llm_refine_profile` to log whether an injected session is used or a new session will be opened (helps detect session reuse across tasks).
- These logs help determine if the worker uses the same SyncSession/AsyncSession across tasks or incorrectly shares sessions with the FastAPI request lifecycle.

Files / locations edited:
- pdf-ingest/worker.py (enqueue_llm_cleanup, llm_refine_profile debug statements).

All edits are minimal logging and exception-context improvements behind environment flags or in controlled code paths. No change to business logic or DB schema was performed.

---

## 3. Rationale for the instrumentation

Observed prior behavior:
- `parse-now` succeeds.
- `confirm-save` previously caused:
  - "Database error" 500s
  - "unhandled errors in a TaskGroup (1 sub-exception)"
- Defensive `safe_route` / global exception handler suppressed 5xx responses (returns stable 200 error payloads), which hid root tracebacks. The goal is to preserve that production safety but capture the underlying trace in logs.

Why targeted logging (option 2):
- Minimized risk: keep the defensive wrapper and global handler in place while gathering more context.
- Pinpoint likely hotspots: `session.begin()`, SELECT FOR UPDATE, `flush()`, `refresh()`, and worker TaskGroup concurrency.
- Provide contextual log attributes (email_to_use, payload keys, session.bind) that help identify whether:
  - Sessions are being reused in concurrent tasks (invalid).
  - Exceptions originate from SQL statements (IntegrityError, serialization failure, deadlock).
  - Asynchronous session misuse or nested transactions cause TaskGroup exceptions.

---

## 4. How to run diagnostics (exact commands)

Pick one of the two run modes below depending on whether you run the service via docker-compose or run app locally.

A) Docker (recommended to match previously observed environment)
1. From repo root ensure docker compose files are present:
   - pdf-ingest/docker-compose.yml is the service definition used by the repo-level `docker compose`.

2. Start stack with debug logging enabled:
   - PDF_INGEST_DEBUG_LOG=/tmp/pdf_ingest_debug.log docker compose up --build
   - or, if you want host binding for logs:
     - mount diagnostics into container (example snippet to add to the `pdf-ingest` service):
       volumes:
         - ./diagnostics:/tmp
     - then run:
       PDF_INGEST_DEBUG_LOG=/tmp/pdf_ingest_debug.log docker compose up --build

B) Local python dev run (if you prefer not to run containers)
1. Ensure Python venv with requirements installed:
   - python -m venv .venv && source .venv/bin/activate
   - pip install -r pdf-ingest/requirements.txt
2. Set env var and run uvicorn:
   - export PDF_INGEST_DEBUG_LOG=/tmp/pdf_ingest_debug.log
   - cd pdf-ingest
   - uvicorn app:app --reload --port 8000

C) Run the (project) diagnostic script
- ./pdf-ingest/run_diagnostic.sh
  - This script collects logs and runs some checks. Run it after reproducing the issue to capture logs.

D) Reproduce the request
- Example curl requests:

1) parse-now (example):
curl -X POST http://localhost:8000/api/v1/parse-now -F "file=@pdf-ingest/tests/cv.pdf"

2) confirm-save:
curl -X POST http://localhost:8000/api/v1/confirm-save \
  -H "Content-Type: application/json" \
  -d '{"email":"johndoe@example.com","name":"John Doe","rawText":"John Doe software engineer johndoe@example.com"}'

E) Run tests (optional, inside container or configured local DB):
- pytest pdf-ingest/tests/test_api_confirm_save.py -q

---

## 5. Logs and artifacts to collect (exact paths)

Collect the following after reproducing the error:

1. Container logs:
- docker compose logs pdf-ingest > diagnostics/web_container_logs.txt
- docker compose logs worker > diagnostics/worker_container_logs.txt (if worker is run as separate service)

2. New debug file (if you started with `PDF_INGEST_DEBUG_LOG=/tmp/pdf_ingest_debug.log`):
- In container: /tmp/pdf_ingest_debug.log
- If you mounted `./diagnostics` to `/tmp`, then copy `./diagnostics/pdf_ingest_debug.log`.

3. Existing diagnostic scripts output (the repository already contains previous diagnostics):
- diagnostics/diagnostic_*.log (copy to diagnostics/collected_diagnostics/)

4. run_diagnostic output file (script may write `/tmp/diag_web_logs.txt` — copy it):
- /tmp/diag_web_logs.txt (if present)

5. Worker logs (RQ):
- If RQ worker is separate: check its stdout/log output.

Important: preserve log timestamps; search the debug log for our injected messages:
- "Debug file handler attached to pdf-ingest logger"
- "confirm-save entering transaction for email="
- "Attempting SELECT FOR UPDATE for email="
- "Transaction failed during confirm-save"
- "enqueue_llm_cleanup: acquired sync session"
- "llm_refine_profile will open a new sync session" or "called with injected session"

These markers help jump to the relevant trace.

---

## 6. What to look for in the logs (symptoms & interpretation)

Search for:
- Full traceback that contains the exception source line inside `confirm_save` or `worker.llm_refine_profile`.
- SQLAlchemy exceptions:
  - IntegrityError: constraint violation during INSERT/UPDATE (race)
  - DBAPIError / OperationalError: connection issues, timeouts, deadlocks
  - InvalidRequestError / StatementError: session state errors (session already in transaction, closed session)
- Messages about `unhandled errors in a TaskGroup (1 sub-exception)` — focus on the inner sub-exception trace; our logs should surface the inner error (we log exc_info on DB errors).
- For concurrency/session misuse: messages showing the same session instance being used across multiple tasks or attempt to call `session.begin()` while session already in a transaction.
- Any `TaskGroup` code traces in worker or elsewhere (if worker uses asyncio TaskGroup) — our worker debug lines will show if the worker opened its own session or got injected session.

Likely causes to confirm or rule out:
- Shared AsyncSession across concurrent coroutines/tasks (invalid).
- Nested transactions or implicit autocommit while inside `async with session.begin()` causing conflicts.
- Race condition: two processes trying to insert same email simultaneously -> IntegrityError; our code has a retry path but logs will show the initial error details.
- Convex network errors causing worker TaskGroup exceptions (less likely to cause DB errors, but possible).

---

## 7. Immediate SQL upsert snippet (atomic, JSONB merge)

If you want to avoid `SELECT ... FOR UPDATE` race complexity and use a single atomic upsert that merges JSONB non-destructively, here is a tested pattern to run inside an `async with session.begin()` (or as a one-off SQLAlchemy text execute). Replace columns/names if different.

Postgres SQL (choose which side wins for meta merging — this example preserves existing meta keys when conflicts occur):

INSERT INTO profiles (email, name, summary, skills, experience, raw_text, confidence, meta)
VALUES (:email, :name, :summary, :skills::jsonb, :experience::jsonb, :raw_text, :confidence, :meta::jsonb)
ON CONFLICT (email) DO UPDATE
SET
  name = COALESCE(EXCLUDED.name, profiles.name),
  summary = COALESCE(EXCLUDED.summary, profiles.summary),
  skills = COALESCE(EXCLUDED.skills, profiles.skills),
  experience = COALESCE(EXCLUDED.experience, profiles.experience),
  raw_text = COALESCE(EXCLUDED.raw_text, profiles.raw_text),
  confidence = COALESCE(EXCLUDED.confidence, profiles.confidence),
  -- Merge JSONB: EXCLUDED.meta || profiles.meta -> existing keys (right) win
  meta = COALESCE(EXCLUDED.meta, '{}'::jsonb) || COALESCE(profiles.meta, '{}'::jsonb)
RETURNING id, created_at, updated_at;

Notes:
- `EXCLUDED.meta || profiles.meta` makes `profiles.meta` **win** on key conflicts (existing values preserved). If you want incoming values to override, use `profiles.meta || EXCLUDED.meta`.
- Use JSON serialization for `:meta`, `:skills`, `:experience` parameters.

SQLAlchemy Core (async) usage snippet:
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
DIAGNOSTIC:

PDF_INGEST_DEBUG_LOG=/tmp/pdf_ingest_debug.log LLM_MOCK=true ./pdf-ingest/run_diagnostic.sh

PDF_INGEST_DEBUG_LOG=/tmp/pdf_ingest_debug.log LLM_MOCK=true ./run_diagnostic.sh 

cd pdf-ingest && PDF_INGEST_DEBUG_LOG=/tmp/pdf_ingest_debug.log LLM_MOCK=true ./run_diagnostic.sh

python extract_log_excerpt.py

docker compose exec db psql -U postgres -d pdf_ingest \
  -c "SELECT id, profile_id, job_id, convex_write_status FROM llm_history ORDER BY run_time DESC LIMIT 10;"
