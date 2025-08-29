# Handover & Next Steps Plan (Detailed Update)

Date: 2025-08-26  
Author: Cline (updated for handoff)

Purpose
-------
This document is an actionable, step-by-step handover for the current blocking issues: (1) frontend stuck on "Loading canonical profile..." and (2) file uploads / confirm-save failing due to CORS + validation errors. It's written so another developer or an LLM can pick up the work, run diagnostics, apply fixes, and verify the result.

High-level summary
------------------
Goal: Make `pdf-ingest` the authoritative writer for canonical user profiles and ensure the frontend (`my-app`) can:
- upload PDFs to the backend,
- persist canonical profiles via `confirm-save`,
- enqueue LLM refinements when needed,
- and display canonical profile data (via Convex) in the frontend.

Current blocking issues
-----------------------
1. CORS preflight / response problem: Browser reports
   "No 'Access-Control-Allow-Origin' header is present on the requested resource" for requests from
   `http://localhost:5173` -> `http://localhost:8000/api/v1/confirm-save`. This blocks POSTs and file uploads.
2. Backend 422 (Unprocessable Entity): The `confirm-save` endpoint requires a `confidence` field on the `NormalizedProfile` Pydantic model. Frontend `onBlur` saves submit minimal payloads (e.g., `{ name: "..." }`) and thus miss required fields, causing 422s.
3. UI symptom: Canonical profile display shows "Loading canonical profile..." because the frontend's Convex subscription may not be receiving updates (Convex dev server may not be running) OR the canonical profile exists but writes are blocked by the backend issues. Tests pass with MSW mocked data but the live stack is blocked.

Files you will interact with
----------------------------
- Backend (pdf-ingest)
  - `pdf-ingest/app.py` (FastAPI app; CORS config + endpoints)
  - `pdf-ingest/docker-compose.yml` (how `pdf-ingest` runs in development)
  - `pdf-ingest/Dockerfile.python311`, `.env` (container context)
  - `pdf-ingest/convex_persist.py`, `pdf-ingest/worker.py` (persist / worker logic)
  - `pdf-ingest/tests/*` (unit tests that can guide expected behaviour)
- Frontend (my-app)
  - `my-app/src/components/ProfileEditorUnified.tsx` (upload, confirm-save, onBlur debounced saves, polling)
  - `my-app/.env` and `VITE_PDF_INGEST_URL` (frontend base URL to call backend)
- Convex (my-app/convex)
  - `my-app/convex/profilesPublic.ts` (public wrapper exposing profile queries)
  - `my-app/convex/*` (Convex dev server runtime)

Root causes (concise)
---------------------
1. FastAPI CORS middleware is not effectively allowing the browser preflight (OPTIONS) response or the response is missing CORS headers due to:
   - an exception thrown before the `CORSMiddleware` adds headers, OR
   - a mismatch between the origin used by the browser and the `allow_origins` entries (host/port mismatch), OR
   - docker networking / container binding differences that make `127.0.0.1` vs `host.docker.internal` matter.
   Important nuance: When `allow_credentials=True`, `allow_origins` must be explicit (cannot be "*"). If the request includes credentials, the server must echo an explicit origin in `Access-Control-Allow-Origin`.

2. Frontend saves triggered onBlur send partial objects (only the edited field). The backend Pydantic model `NormalizedProfile` sets `confidence` as a required field: `confidence: float = Field(..., ge=0.0, le=1.0)`. Missing this field => 422. Debounced saves only include a single field; they must either include a complete valid profile or the endpoint must accept partial patch payloads.

Diagnostics to run (commands)
-----------------------------
Run these from your host machine (not in the browser) to isolate the server response to preflight:

1. Confirm server reachable:
   - curl health
     curl -v http://127.0.0.1:8000/api/v1/health

2. Send a manual OPTIONS preflight (this replicates browser preflight):
   - Replace origin with the exact origin shown in browser (http://localhost:5173 or http://127.0.0.1:5173)
     curl -i -X OPTIONS 'http://127.0.0.1:8000/api/v1/confirm-save' \
       -H 'Origin: http://localhost:5173' \
       -H 'Access-Control-Request-Method: POST' \
       -H 'Access-Control-Request-Headers: content-type, authorization'

   Expected:
   - HTTP/1.1 200 (or 204)
   - Response headers include:
     Access-Control-Allow-Origin: http://localhost:5173
     Access-Control-Allow-Methods: POST, OPTIONS, ...
     Access-Control-Allow-Headers: content-type, authorization
     Access-Control-Allow-Credentials: true  (if configured)

3. Simulate a POST (without browser restrictions) with required fields:
   curl -i -X POST 'http://127.0.0.1:8000/api/v1/confirm-save' \
     -H 'Content-Type: application/json' \
     -d '{"name":"Test User","email":"test@example.com","summary":"x","confidence":0.9}'

   Expected: 200 OK + JSON payload with saved profile id.

4. If the server is running in Docker and not responding on 127.0.0.1:8000, check:
   docker ps
   docker-compose -f pdf-ingest/docker-compose.yml logs --tail=200

5. If you need to debug inside a container:
   docker-compose -f pdf-ingest/docker-compose.yml exec web sh
   # inside the container:
   curl -s -D - http://localhost:8000/api/v1/health

Backend changes to consider (detailed)
-------------------------------------
1. Short-term dev override (fast, low risk): Make CORS permissive for development to confirm networking is the problem.
   - Modify `pdf-ingest/app.py` while testing:
     - Use allow_origins=["*"] and allow_credentials=False temporarily (only during dev verification).
     OR
     - Use allow_origin_regex to match `http://localhost(:[0-9]+)?` if you must keep credentials true.
   Example:
   ```
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],           # dev only: accept all origins
       allow_credentials=False,      # if you use credentials, set to True and provide explicit allow_origins instead
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```
   Notes:
   - Do NOT leave `allow_origins=["*"]` with `allow_credentials=True` in production.
   - Once verified, revert to explicit origins or use `allow_origin_regex`.

2. Better dev-safe config that supports credentials:
   ```
   app.add_middleware(
     CORSMiddleware,
     allow_origins=["http://localhost:5173","http://127.0.0.1:5173","http://localhost:5174",...],
     allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
     allow_credentials=True,
     allow_methods=["*"],
     allow_headers=["*"],
     expose_headers=["*"],
   )
   ```
   (Note: `allow_origin_regex` can't be combined with `allow_origins` in older FastAPI/Starlette versions; use one approach.)

3. Ensure CORSMiddleware is registered before any other middleware that might raise exceptions during OPTIONS handling. (In FastAPI, `app.add_middleware(...)` order matters relative to custom middleware.)

4. Add explicit logging for OPTIONS and exceptions before `call_next()` to detect errors thrown before CORS headers are added:
   - The file already has `@app.middleware("http") async def log_requests(...):` — ensure it logs all request methods, headers, and catches exceptions, then re-raise after logging. If an exception is raised before the middleware runs, add platform-level logging.

5. Check for errors in endpoints that could cause the server to return a stacktrace (500) to the preflight request path. Preflight should not hit endpoint body code but some configurations cause path/route code to run — ensure no route-level dependency raises on OPTIONS.

Frontend changes to consider (detailed)
-------------------------------------
1. Ensure `VITE_PDF_INGEST_URL` is set to the real reachable URL from the browser. Example in `my-app/.env`:
   VITE_PDF_INGEST_URL=http://127.0.0.1:8000

   Use 127.0.0.1 if server runs on host; if Docker uses host.docker.internal on macOS, set that accordingly.

2. Fix the `debouncedSave` payload in `my-app/src/components/ProfileEditorUnified.tsx`:
   - Problem: onBlur currently sends `{ name: "..." }` or `{ summary: "..." }`, then the backend expects the full `NormalizedProfile` (including `confidence`).
   - Approaches:
     A) Change `confirm-save` endpoint to accept partial patch semantics (preferred long-term).
     B) Short-term: have the frontend build a complete payload to send on each save. This requires reading the current canonical profile and merging the edited field(s) into it before sending confirm-save. Also compute `confidence`.
   - Implementation (frontend):
     - Replace onBlur handlers to construct a full payload:
       ```
       const payload = {
         name: mergedName,
         email: profile?.email,
         summary: mergedSummary,
         skills: profile?.skills ?? [],
         experience: profile?.experience ?? [],
         rawText: profile?.rawText ?? "",
         confidence: calculateConfidence(mergedProfile),
         metadata: profile?.metadata ?? {},
       }
       debouncedSave(payload);
       ```
     - Keep debounce to avoid spamming.

3. Keep `calculateConfidence(payload)` and ensure it returns a number 0..1. Use conservative default (e.g., 1.0) if missing. You can add fallback:
   ```
   const calculateConfidence = (data) => {
     if (typeof data.confidence === 'number') return data.confidence;
     // compute heuristically...
     return Math.max(0, Math.min(1, computedScore));
   };
   ```

4. Consider converting `confirm-save` calls to `fetch` with `mode: "cors"` (default) and `credentials: "include"` only if backend sets cookies and you need credentials. If you set `credentials: 'include'`, ensure the backend CORS has `allow_credentials=True` and explicit origin.

Verification plan (step-by-step)
--------------------------------
1. Quick local check (no Docker)
   - From repo root:
     cd pdf-ingest
     uvicorn app:app --reload --port 8000
   - In another terminal:
     curl -v http://127.0.0.1:8000/api/v1/health
   - Run the preflight `OPTIONS` test:
     curl -i -X OPTIONS 'http://127.0.0.1:8000/api/v1/confirm-save' \
       -H 'Origin: http://localhost:5173' \
       -H 'Access-Control-Request-Method: POST' \
       -H 'Access-Control-Request-Headers: content-type'

   - If OPTIONS returns 200 + correct `Access-Control-*` headers:
     - Test POST:
       curl -i -X POST 'http://127.0.0.1:8000/api/v1/confirm-save' \
         -H 'Content-Type: application/json' \
         -d '{"name":"T","email":"t@x.com","summary":"x","confidence":0.9}'

2. If using Docker (`./run-all.sh`):
   - Restart the stack: ./run-all.sh --force --clean
   - Wait for logs to show `uvicorn` running and listening on 0.0.0.0:8000
   - Run `curl` preflight + POST from host. If no response, `docker ps` logs.

3. Browser verification:
   - Start frontend: `cd my-app && npm run dev` (if not started by run-all.sh)
   - Open DevTools -> Network -> filter for `/api/v1/confirm-save`
   - Perform a save or file upload flow:
     - Confirm that an OPTIONS request is issued first and returns with Access-Control-Allow-Origin header
     - Then confirm POST succeeds (200) and returns profile id.
   - If POST fails with 422, open request payload and confirm `confidence` included.

4. Convex/Canonical profile:
   - Start Convex dev server: `cd my-app/convex && npx convex dev`
   - Check Convex logs show `profilesPublic.get` registered.
   - Ensure `useQuery(api.profilesPublic.get)` returns a profile (open console logs).
   - If Convex is not running, the canonical view will remain "Loading canonical profile..." even after backend fixes.

Detailed step-by-step fix checklist (executable)
-----------------------------------------------
1) Short test (10 min)
   - Run backend locally (uvicorn) and confirm OPTIONS preflight headers via curl.
   - If that succeeds, go to step 2.

2) Backend: make CORS diagnostic changes (15–20 min)
   - Temporarily change cors in `pdf-ingest/app.py` to permissive mode for dev:
     - either `allow_origins=["*"]` + `allow_credentials=False`, OR use a regex to match localhost ports.
   - Add extra logging for request method/origin and for exceptions thrown during request handling (the file already contains logger; ensure exceptions logged).
   - Restart backend (uvicorn or docker) and re-run curl preflight.

3) Frontend: patch `ProfileEditorUnified.tsx` (20–30 min)
   - Implement the merged full-payload save on onBlur instead of sending partial objects.
   - Ensure `calculateConfidence` returns a number 0..1.
   - Keep debounce.
   - Example change: when user edits `name`, merge with `profile`:
     ```
     const payload = { ...profile, name: newName, confidence: calculateConfidence({...profile, name:newName}) }
     debouncedSave(payload)
     ```
   - Save and restart frontend (Vite picks up changes).

4) Verify in browser (10–15 min)
   - Use DevTools Network and Console:
     - Confirm OPTIONS returns Access-Control-Allow-Origin.
     - Confirm POST confirm-save has full JSON body including confidence.
     - Confirm POST returns 200 and profile id.
     - Confirm frontend now shows canonical JSON (profile) in the left pane.
   - If still failing, capture:
     - Browser console logs (copy/paste)
     - Network request/response headers + response body for failing requests
     - `./run-all.sh` logs (stdout/stderr) and `docker-compose` logs

5) Finalize CORS config (10 min)
   - Revert permissive CORS to explicit origins:
     - Use explicit origins list: `["http://localhost:5173","http://127.0.0.1:5173","http://localhost:5174",...]`
     - If using credentials, keep `allow_credentials=True`.
   - Commit changes and push feature branch.

Developer notes / debugging tips
--------------------------------
- When `allow_credentials=True` you cannot set `allow_origins=["*"]`. The browser will reject `Access-Control-Allow-Origin: *` if credentials are involved.
- If using Docker on macOS, `127.0.0.1:8000` from the host maps to container only if ports are published. If requests are coming from the browser in the host, `127.0.0.1` is usually correct. If the browser is inside a different network (e.g., remote dev machine), use `host.docker.internal`.
- OPTIONS preflight should not run route body code. If OPTIONS triggers exceptions, inspect Starlette/FastAPI middleware order or route-level dependencies that run for OPTIONS. Try adding a simple `@app.options("/api/v1/confirm-save")` handler returning 200 for debug.
- If you see `net::ERR_CONNECTION_REFUSED` the server is not listening on that address/port from the browser’s perspective.
- Keep `app.middleware("http")` logging in place to capture `Origin` header for every request.

Exact curl snippets (copy-paste)
--------------------------------
1) Health:
   curl -v http://127.0.0.1:8000/api/v1/health

2) Preflight check (IMPORTANT):
   curl -i -X OPTIONS 'http://127.0.0.1:8000/api/v1/confirm-save' \
     -H 'Origin: http://localhost:5173' \
     -H 'Access-Control-Request-Method: POST' \
     -H 'Access-Control-Request-Headers: content-type, authorization'

3) Sample confirm-save POST:
   curl -i -X POST 'http://127.0.0.1:8000/api/v1/confirm-save' \
     -H 'Content-Type: application/json' \
     -d '{"name":"Test User","email":"test@example.com","summary":"sample","confidence":0.85}'

4) For POST with credentials (only if cookies/token required):
   curl -i -X OPTIONS 'http://127.0.0.1:8000/api/v1/confirm-save' \
     -H 'Origin: http://localhost:5173' \
     -H 'Access-Control-Request-Method: POST' \
     -H 'Access-Control-Request-Headers: content-type, authorization' \
     -b "cookie_name=value"
   # Then:
   curl -i -X POST 'http://127.0.0.1:8000/api/v1/confirm-save' \
     -H 'Content-Type: application/json' \
     -H 'Cookie: cookie_name=value' \
     -d '{"name":"Test User","email":"test@example.com","summary":"sample","confidence":0.85}'

Expected timeline (estimate)
----------------------------
- Diagnostics and quick confirmation: 10–20 minutes
- Backend CORS adjustments & logging: 15–30 minutes
- Frontend payload/merge patch & small refactor: 20–40 minutes
- Full verification (browser + Convex dev server): 15–30 minutes
Total: ~1 hour (depends on Docker rebuild time and whether backend runs locally vs inside container).

Branch + commit recommendations
-------------------------------
- Create a short-lived branch for the fix:
  git checkout -b fix/pdf-ingest-cors-and-save-payload
- Commit small incremental changes:
  - backend: "dev: relax CORS for local testing + add request logging"
  - frontend: "fix: send full profile payload including confidence on onBlur saves"
- After verifying, revert permissive CORS and replace with explicit dev origins. Commit final change:
  - "chore: set explicit CORS allow_origins for local dev"

Handoff checklist (what to pass to the next LLM/dev)
----------------------------------------------------
1. Reproduce locally using the `curl` preflight and POST commands above; attach responses.
2. If preflight returns no `Access-Control-Allow-Origin` header, check:
   - `pdf-ingest/app.py` middleware order and try temporarily allowing all origins.
   - Container logs for exceptions during startup or when OPTIONS requests arrive.
3. Patch `ProfileEditorUnified.tsx` to send a merged, complete `NormalizedProfile` payload (including computed `confidence`) from `onBlur` saves.
4. Verify the Convex dev server is running and that `profilesPublic.get` is registered.
5. Capture browser DevTools Network trace and `./run-all.sh` logs; paste them to the ticket/PR.

Appendix — Quick recommended small patches
-------------------------------------------
1. Frontend (example change at `my-app/src/components/ProfileEditorUnified.tsx`):
   - Replace the onBlur handlers to build a full payload:
     ```
     const mergedProfile = {
       name: profile?.name || null,
       email: profile?.email || null,
       summary: profile?.summary || null,
       skills: profile?.skills || [],
       experience: profile?.experience || [],
       rawText: profile?.rawText || null,
       metadata: profile?.metadata || {},
       // override with edited field
       name: newName, // when editing name
       confidence: calculateConfidence({...profile, name: newName}),
     };
     debouncedSave(mergedProfile);
     ```

2. Backend (temporary dev CORS at `pdf-ingest/app.py`):
   - For fast debug:
     ```
     app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],
       allow_credentials=False,
       allow_methods=["*"],
       allow_headers=["*"],
       expose_headers=["*"],
     )
     ```
   - After verifying in the browser, replace with explicit origins and `allow_credentials=True` if needed.

Contact points / logs to paste for next handoff
------------------------------------------------
- Browser DevTools console output + Network trace for failing requests
- `curl -i -X OPTIONS ...` raw output
- `curl -i -X POST ...` raw output
- `./run-all.sh` stdout/stderr and `docker-compose -f pdf-ingest/docker-compose.yml logs --tail=200`
- Convex dev server output (`npx convex dev`) showing registered functions

---

If you want, I will now:
- Implement the frontend patch that builds/merges a full payload for onBlur saves, and
- Temporarily relax CORS in `pdf-ingest/app.py` so you can quickly verify in the browser.
Either option requires a toggle to ACT MODE (which you've already done) and your approval to proceed. If you approve, I will make the changes and run the quick verification steps (curl OPTIONS + POST) and report results.
