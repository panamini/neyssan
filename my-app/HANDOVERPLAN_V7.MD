Absolutely — here’s a **comprehensive, fully updated handover plan** for a new LLM to take over this project. I’ve structured it step by step so the new LLM can pick up from where you are without improvisation.

---

# **PDF-Ingest Project Handover Plan for New LLM**

## **1. Project Objective**

The goal is to maintain and operate the **PDF-Ingest pipeline**, which handles the following workflow:

1. Users submit profiles via `parse-now` / `confirm-save`.
2. Profiles are stored in **Postgres**.
3. Jobs for LLM refinement are enqueued into **RQ** worker queue.
4. LLM (Mistral API) processes profile data.
5. Refined profiles are persisted into **Convex** canonical store.
6. Frontend consumes canonical profiles and shows results.

---

## **2. Tools & Technologies**

* **Docker & Docker Compose**: Containerized environment.
* **FastAPI**: Backend API serving endpoints.
* **Postgres**: Relational database for profiles.
* **Redis**: Queue backend for RQ.
* **RQ Worker**: Asynchronous job processing for LLM refinements.
* **Mistral / OpenAI API**: LLM model for parsing and enrichment.
* **Convex**: Canonical profile store.
* **Alembic**: Database migrations.
* **Python 3.11** with SQLAlchemy, AsyncSession.

---

## **3. Key Files and Changes**

| File                                 | Purpose / Changes                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `pdf-ingest/docker-compose.yml`      | Main docker-compose orchestration of db, redis, web, and worker.                    |
| `pdf-ingest/app.py`                  | FastAPI backend; contains `confirm_save` route and other profile APIs.              |
| `pdf-ingest/alembic/versions/...`    | Migration files. `c24169e5416a_merge_multiple_heads.py` is the merged Alembic head. |
| `pdf-ingest/.env`                    | Environment variables for db, redis, and external APIs.                             |
| `pdf-ingest/worker.log`              | Logs showing end-to-end workflow: LLM calls, Convex persistence, job completion.    |
| `my-app/remediate_migration_grok.sh` | Script for remediating Alembic migration conflicts.                                 |

**Key Actions Taken:**

* Alembic duplicate head merged with `c24169e5416a_merge_multiple_heads`.
* Schema verified: `profiles` table exists and contains all required columns.
* LLM jobs enqueue logic validated, but some profiles show empty LLM responses in `llm_history`.
* Placeholder profiles are created when email or external id is missing.

---

## **4. Commands Executed So Far**

**Database & Migration**

```bash
docker compose run --rm web alembic upgrade head
docker compose run --rm web alembic merge -m "merge multiple heads" 0000_create_profiles_full 0003_add_profile_columns
```

**Testing Confirm-Save / Parse-Now**

```bash
curl -X POST -H "Content-Type: application/json" -d '{"profile_id":"727ca5ef-1cdd-435d-ac34-d4872e99da3f"}' http://localhost:8000/api/v1/confirm-save
```

**Verify Profile Persistence**

```bash
docker compose exec -T db psql -U postgres -d pdf_ingest -c "SELECT * FROM profiles;"
docker compose exec -T db psql -U postgres -d pdf_ingest -c "SELECT * FROM llm_history;"
```

**Logs**

```bash
docker compose -f pdf-ingest/docker-compose.yml logs -f web worker
```

---

## **5. Observed Issues**

1. **Placeholder profiles**

   * Triggered when `email` and external id missing.
   * Creates unnecessary LLM jobs.
2. **Empty LLM responses**

   * `llm_history` contains rows with empty or schema-like placeholders.
   * Leads to low-confidence persisted profiles.
3. **Frontend Canonical Profile**

   * Currently showing "Loading canonical profile…" and no parsed content.
   * Likely frontend route misconfiguration or missing API call for canonical profile.
4. **Convex `written: False`**

   * Some updates are no-op. Could be expected but needs monitoring.

---

## **6. Recommendations / Next Actions**

**Immediate**

* Add backend validation in `confirm_save`:

  * Require at least email or external id to create persistent profile.
  * Draft profiles should not enqueue LLM jobs.
* Validate LLM output before persisting: require non-empty name/summary/skills.
* Capture raw LLM responses in separate diagnostic log for troubleshooting.

**Medium-term**

* Frontend: ensure correct route/API calls to fetch canonical profile.
* Add a review queue UI for low-confidence LLM results.
* Tune LLM prompts and fallback strategies for better parsing results.

**Diagnostics**

```bash
# Check placeholder profiles
docker compose exec -T db psql -U postgres -d pdf_ingest -c "SELECT id,email,name FROM profiles WHERE email LIKE '<missing-%';"

# Inspect recent LLM jobs
docker compose exec -T db psql -U postgres -d pdf_ingest -c "SELECT * FROM llm_history ORDER BY created_at DESC LIMIT 50;"
```

---

## **7. Next Steps Before Handover**

1. Ensure all pending LLM jobs are paused / draft profiles will not enqueue further processing.
2. Verify frontend route for canonical profile.
3. Update `confirm_save` handler with safe draft logic.
4. Re-run `run-all.sh` for full end-to-end test.
5. Provide new LLM with:

   * Project directory (`pdf-ingest/`),
   * Database connection credentials,
   * Worker log,
   * Alembic migrations,
   * Confirm-save handler and sample payloads.

---

## **8. Expected Knowledge for LLM**

* Understand FastAPI route decorators and async DB session.
* Know how to enqueue RQ jobs with correct payload.
* Be aware of placeholder profiles vs persistent profiles.
* Ability to inspect worker logs and LLM responses.
* Knowledge of schema constraints in Postgres.

---

This handover ensures the new LLM can **pick up from exactly where the project stands**, understand all problems, see the pending tasks, and safely resume development or monitoring.

---

I can also **write an explicit, single-page checklist for the LLM** with step-by-step actions to execute the next tasks, including draft logic implementation and diagnostics.

Do you want me to do that?

---

# **PDF-Ingest LLM Handover Checklist (Actionable)**

### **1. Environment Setup**

* Confirm Docker & Docker Compose running:

  ```bash
  docker compose up -d
  docker compose ps
  ```
* Ensure containers are healthy: `db`, `redis`, `web`, `worker`.

---

### **2. Database Verification**

* Check `profiles` table:

  ```bash
  docker compose exec -T db psql -U postgres -d pdf_ingest -c "SELECT * FROM profiles LIMIT 10;"
  ```
* Check `llm_history` table:

  ```bash
  docker compose exec -T db psql -U postgres -d pdf_ingest -c "SELECT * FROM llm_history ORDER BY created_at DESC LIMIT 10;"
  ```

---

### **3. Confirm-Save Endpoint**

* Use API to save a profile:

  ```bash
  curl -X POST -H "Content-Type: application/json" \
       -d '{"profile_id":"<profile_uuid>"}' \
       http://localhost:8000/api/v1/confirm-save
  ```
* Expect JSON with `id`, `created_at`, `updated_at`, and `status: saved`.

---

### **4. Pause LLM Job Processing**

* Ensure no new jobs are enqueued while reviewing:

  * Stop worker container if needed:

    ```bash
    docker compose stop worker
    ```
* Identify draft profiles to avoid unnecessary LLM runs:

  ```bash
  docker compose exec -T db psql -U postgres -d pdf_ingest -c \
    "SELECT id,email,name FROM profiles WHERE email LIKE '<missing-%';"
  ```

---

### **5. Review Worker Logs**

* Tail logs to confirm prior job processing:

  ```bash
  docker compose logs -f worker
  ```
* Look for:

  * LLM calls (`HTTP 200 OK`)
  * Convex writes (`written: True/False`)
  * Empty or placeholder responses in `LLM_RESP_SNIPPET`

---

### **6. Confirm-Save Handler Update**

* File: `pdf-ingest/app.py` → `confirm_save` route
* Minimal safe change:

  * If payload lacks email **and** external id → treat as draft
  * Return draft id, **do not enqueue LLM worker**
* Example logic:

  ```python
  if not payload.get("email") and not payload.get("external_id"):
      return {"id": draft_id, "status": "draft"}
  ```

---

### **7. LLM Output Validation**

* Before Convex persist:

  * Require non-empty `name`, `summary`, or `skills`.
  * If missing → either retry or mark for human review.

---

### **8. Diagnostics**

* Recent placeholder profiles:

  ```bash
  docker compose exec -T db psql -U postgres -d pdf_ingest -c \
    "SELECT id,email,name FROM profiles WHERE email LIKE '<missing-%' ORDER BY created_at DESC LIMIT 100;"
  ```
* Recent LLM history:

  ```bash
  docker compose exec -T db psql -U postgres -d pdf_ingest -c \
    "SELECT * FROM llm_history ORDER BY created_at DESC LIMIT 50;"
  ```
* Convex action success/failure logs: inspect `convex_write_status` and `convex_error`.

---

### **9. Next Action After Fixes**

* Restart worker if paused:

  ```bash
  docker compose start worker
  ```
* Run end-to-end test:

  ```bash
  ./run-all.sh
  ```
* Confirm:

  * Profiles saved with proper content
  * LLM jobs complete
  * Convex canonical profiles are updated
  * Frontend shows parsed profile content

---

### **10. Notes / Observations**

* Placeholder profiles = `email=None` or missing external id
* Empty LLM outputs need logging for diagnostics
* Frontend canonical profile route may require verification

---

This checklist is **ready to hand to the new LLM** to continue work safely, review issues, and implement draft/profile validation without breaking anything.

---

If you want, I can **also draft the exact prompt for the LLM** that instructs it to follow this checklist automatically and safely. Do you want me to do that next?
