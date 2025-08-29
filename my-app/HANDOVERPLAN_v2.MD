
## 1. Purpose

This document provides a fully deterministic, step-by-step plan to remediate the `pdf-ingest` database, resolve migration failures, fix application-level bugs, and safely start the full application stack. It is designed to be executed by another LLM or developer without any improvisation.

---

## 2. Phase 1: Pre-flight and Environment Setup

* **Step 2.1: Verify Docker is Running**

  ```bash
  docker info
  ```

  Expected: outputs system-wide info without errors.

* **Step 2.2: Clean Up Old Docker Resources**

  ```bash
  docker-compose -f pdf-ingest/docker-compose.yml down --volumes --remove-orphans || true
  ```

  Expected: all containers, volumes, and networks removed.

---

## 3. Phase 2: Database Remediation

* **Step 3.1: Start Core Database Service**

  ```bash
  docker-compose -f pdf-ingest/docker-compose.yml up -d db
  ```

  Expected: `db` service status `Up`.

* **Step 3.2: Execute the Grok-Hardened Remediation Script**

  ```bash
  ./remediate_migrations-grok.sh \
    --compose pdf-ingest/docker-compose.yml \
    --db-service db \
    --alembic-service alembic \
    --db-user postgres \
    --db-name pdf_ingest \
    --versions-dir pdf-ingest/alembic/versions
  ```

  **Note:** This script is fully idempotent and hardened for edge cases: empty schemas, missing `alembic_version`, and unstamped databases. Safe to run multiple times.

* **Step 3.3: Verify Final Database State**

  ```bash
  docker-compose -f pdf-ingest/docker-compose.yml exec -T db psql -U postgres -d pdf_ingest -t -A -c "SELECT version_num FROM alembic_version LIMIT 1;"
  docker-compose -f pdf-ingest/docker-compose.yml run --rm --no-TTY web alembic heads
  ```

  Expected: outputs match.

---

## 4. Phase 3: Full Stack Startup

* **Step 4.1: Apply Application Code Fixes**

  * **Backend CORS Temporary Fix**

    ```python
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    ```
  * **Backend Temporary Confidence Default**

    ```python
    class NormalizedProfile(BaseModel):
        confidence: float = Field(1.0, ge=0.0, le=1.0)
    ```
  * **Frontend Payload Fixes**: Ensure full profile payload is saved onBlur.
  * **Frontend .env**

    ```
    VITE_PDF_INGEST_URL=http://127.0.0.1:8000
    ```

* **Step 4.2: Start All Services**

  ```bash
  ./run-all.sh --force --log-file=pdf-ingest/diagnostics/run-all-after-remediation-$(date +%Y%m%d%H%M%S).log
  ```

* **Step 4.3: Verify Stack Health**

  ```bash
  curl -v http://127.0.0.1:8000/api/v1/health
  curl -i -X OPTIONS 'http://127.0.0.1:8000/api/v1/confirm-save' \
    -H 'Origin: http://localhost:5173' \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: content-type, authorization'
  curl -i -X POST 'http://127.0.0.1:8000/api/v1/confirm-save' \
    -H 'Content-Type: application/json' \
    -d '{"name":"Test User","email":"test@example.com","summary":"sample","confidence":0.85}'
  ```

  Expected: all responses `200 OK` or `204 No Content`.

---

## 5. Phase 4: End-to-End Flow Verification

* Manual CV upload and profile editing → no CORS errors, `confirm-save` succeeds, UI updates.
* Convex data flow → worker logs show successful `persistProfile` calls.

---

## 6. Phase 5: Revert Temporary Changes

* **Step 6.1: Revert CORS**

  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:5173","http://127.0.0.1:5173"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

* **Step 6.2: Revert Confidence Default**

  ```python
  class NormalizedProfile(BaseModel):
      confidence: float = Field(..., ge=0.0, le=1.0)
  ```

---

## 7. Checklist

* [ ] Docker is running
* [ ] Old Docker resources cleaned
* [ ] `db` service running
* [ ] Grok-hardened remediation script ran successfully
* [ ] Database revision matches Alembic head
* [ ] Application code fixes applied
* [ ] All services start successfully
* [ ] Backend health check passes
* [ ] CORS preflight check passes
* [ ] Confirm-save POST check passes
* [ ] CV upload/profile editing work
* [ ] Convex actions called successfully
* [ ] Frontend UI updates correctly
* [ ] Temporary CORS configuration reverted
* [ ] Temporary confidence default reverted



DIAGNOSTIC COMAND:
PDF_INGEST_DEBUG_LOG=/tmp/pdf_ingest_debug.log LLM_MOCK=true ./pdf-ingest/run_diagnostic.sh

python extract_log_excerpt.py
