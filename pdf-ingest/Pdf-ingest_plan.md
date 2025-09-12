# Handover: Backend-Driven Persistence & Unified Profile Editor

**Updated — includes automated DB remediation (Grok) + frontend/backend handover**

## Purpose

This document provides a complete handover so another engineer or LLM can continue implementing, validating, and maintaining the backend-driven persistence (pdf-ingest → Convex) and the unified Profile Editor frontend. It now includes automated idempotent Alembic/Postgres migration remediation.

It assumes:

* pdf-ingest DB schema may need remediation.
* Backend, worker, and Convex endpoints exist.
* Dry-run backfill shows zero rows requiring remediation (if already run).

---

## 1) Context & Background

* **Goal:** Make pdf-ingest the authoritative writer for canonical profiles.
  **Flow:**

1. User uploads CV → pdf-ingest parses into `NormalizedProfile`.
2. Frontend persists parsed profile to Postgres via pdf-ingest, then enqueues LLM refine.
3. RQ worker (pdf-ingest.llm\_refine\_profile) runs LLM refinement, writes `LLMHistory` placeholder, builds idempotent payload, calls Convex action `persistProfile`.
4. Convex mutation `upsertProfile` upserts canonical profile by `profileId` + `idempotencyKey`.
5. Worker updates `LLMHistory` with `convex_write_status`, `convex_error`, `convex_written_at`; frontend polls for completion and refreshes canonical profile from Convex.

* **Components & Locations:**

  * pdf-ingest (FastAPI): `app.py`, `worker.py`, `convex_persist.py`, `run_diagnostic.sh`
  * DB Models: `Profile`, `LLMHistory` (`models.py`)
  * Schemas & Pydantic: `schemas.py`
  * Worker entry: `worker_entry.py`
  * Convex (TypeScript): actions, mutations, schema
  * Frontend scaffold: `ProfileEditorUnified.tsx`
  * Infrastructure: Redis + RQ, Postgres, Docker Compose, Convex deployment (env vars `VITE_CONVEX_URL` / `NEXT_PUBLIC_CONVEX_URL`)

---

## 2) Automated DB Remediation (Grok Script)

**Purpose:** Idempotent Alembic/Postgres remediation in Docker Compose.

**Script:** `remediate_migrations-grok.sh`

**Steps it performs:**

1. Wait for DB readiness (pg\_isready)
2. Ensure `alembic_version` table exists; create if missing
3. Detect Alembic head revision from `alembic/versions/*.py`
4. Heuristically detect applied migrations by checking table existence
5. Stamp DB with detected revision if missing
6. Run `alembic upgrade head`
7. Verify final revision matches head
8. Quick schema verification: checks that tables from all migrations exist

**Recommendation:** Run **before any backfill or validation scripts** to ensure DB is fully migrated and consistent.

```bash
./remediate_migrations-grok.sh --compose docker-compose.yml --verbose
```

---

## 3) Completed Implementation

* Alembic migrations applied: `alembic_version = 0002_add_convex_fields_llm_history`
* Backend: `convex_persist.py`, `worker.py`, `app.py` — handles Convex calls, idempotency, retry, mark success/failure
* Convex: HTTP action `persistProfile`, mutation `upsertProfile` (idempotent)
* Testing: `run_diagnostic.sh` validates parse → confirm-save → LLM refine → worker → Convex persist

---

## 4) Remaining Work (Frontend + Validation)

### A) Frontend: ProfileEditorUnified

* Implement upload → confirm-save → poll `LLMHistory` → refresh canonical
* Reapply AI refine button → POST `/api/v1/llm-refine`
* Manual edits → merge endpoint `/api/v1/profiles/{profileId}/merge`
* Polling: exponential backoff, stop on `success` or `failed`, timeout after \~5 min
* UI states: idle, loading, uploading/parsing, polling, convex success/failure, editing with conflict handling

### B) Backend Improvements

* Optional: automatic Convex persist after `/merge`
* Confirm `/api/v1/profiles/{profileId}` can serve canonical profile for frontend
* Ensure merge endpoint returns updated version

### C) Unit Tests & CI

* Backend: `test_convex_persist.py`, `test_worker_convex_integration.py`, `test_api_convex_retry.py`
* Frontend: MSW tests for ProfileEditorUnified flows
* CI: Run pytest + diagnostics (`LLM_MOCK=true`)

### D) Diagnostics & Backfill

* `run_diagnostic.sh` → ensure end-to-end pipeline works in mock mode
* Backfill script: `scripts/backfill_convex_status.py` for missing `convex_write_status`

---

## 5) Operational Scripts / Runbook

* Restart worker: `docker-compose -f docker-compose.yml up --build -d worker`
* Tail logs: `docker-compose -f docker-compose.yml logs -f worker`
* Retry placeholder:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/convex-persist-retry \
     -H "Content-Type: application/json" \
     -d '{"placeholderId":"<ID>"}'
```

* Fetch LLMHistory: `curl http://127.0.0.1:8000/api/v1/llm-history/<ID> | jq`

---

## 6) Merge-Ready Criteria

* All unit tests pass (backend + frontend)
* `run_diagnostic.sh` succeeds in LLM\_MOCK mode
* Sample CV upload → `convex_write_status="success"` → canonical profile updated
* No server secrets in frontend
* PR includes commits + clear description + diagnostic instructions

---

## 7) Recommended Workflow for New Engineer / LLM

1. Run **Grok remediation script** to ensure DB is fully migrated.
2. Run backfill for any missing `convex_write_status`.
3. Finish frontend `ProfileEditorUnified` implementation.
4. Verify end-to-end flow with `run_diagnostic.sh`.
5. Implement backend unit tests and frontend tests (MSW).
6. Integrate CI steps.
7. Confirm acceptance criteria, merge PR.
