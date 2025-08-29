# AI Task: Backend-Driven Persistence & Unified Profile Editor — Implementation Pack

Purpose
-------
This document contains everything required to create a new AI engineering task to implement the approved Option B: make `pdf-ingest` the single authoritative writer to Convex (backend-driven persistence) and unify the frontend profile UI into a single Profile Editor page (no modal as authority). Use this file as the single source of instructions, environment variables, file targets, code snippets, tests to add, and acceptance criteria for the task.

High-level summary
------------------
- Backend (pdf-ingest) will parse uploaded CVs, run LLM refinement, compute a merged canonical profile, and persist that canonical profile to Convex using a Convex Action and service token.
- Worker will continue to create deterministic placeholders in `LLMHistory` and update them. After a successful refine it will call Convex to upsert the canonical profile.
- Frontend will read canonical profile data from Convex and become read-only for the source of truth. The UI will provide a single Profile Editor page for uploading CV, reapplying AI refinement, and editing profile fields. All authoritative writes come from the backend (pdf-ingest → Convex). The frontend only triggers backend workflows and subscribes to Convex.

What this task delivers
-----------------------
- pdf-ingest helper to call Convex Action (with retries & idempotency).
- Worker integration to call the helper after LLM refine and to persist convex_write_status into LLMHistory.
- Convex Action + mutation stubs (TS) to accept the payload and upsert profile with idempotency.
- Frontend Profile Editor scaffold that always reads Convex canonical profile and triggers imports/refines.
- Tests: unit tests for worker-convex integration (mocked), E2E diagnostic updates.

Required environment variables
------------------------------
Add these to `pdf-ingest/.env` (and docker-compose env for web & worker):

- CONVEX_URL=<full base URL for Convex actions e.g. https://<project>.convex.cloud>
- CONVEX_ACTION_PATH=/api/actions/persistProfile
- CONVEX_SERVICE_TOKEN=<Convex service token, server side only>
- (optional) CONVEX_TIMEOUT_MS=10000
- (optional) CONVEX_RETRY_ATTEMPTS=4

Security note: Never expose `CONVEX_SERVICE_TOKEN` to frontend. Store in Docker secrets or CI secret store.

Files to add / modify (concrete)
--------------------------------
Backend (pdf-ingest)
- Add: `pdf-ingest/convex_persist.py` — small helper with:
  - `call_convex_action(action_path, payload)` — POST with Authorization Bearer token, JSON body.
  - retry logic with exponential backoff.
  - raises or returns parsed response.
- Modify: `pdf-ingest/worker.py`
  - After the LLM normalization and LLMHistory update, call `convex_persist.merge_and_persist_profile(profile.id, candidate, placeholder_id)`.
  - Update the LLMHistory row with:
    - convex_write_status: "success" | "failed"
    - convex_error (string or null)
    - convex_written_at timestamp
- Modify: `pdf-ingest/app.py`
  - Add `POST /api/v1/convex-persist-retry` to re-send a saved candidate (by `placeholderId`) to Convex.
  - Ensure `GET /api/v1/llm-history/{placeholderId}` exposes the new convex fields.

Convex (TS, inside `my-app/convex` or your Convex project)
- Add: `convex/actions/persistProfile.ts` — HTTP Action to validate the service token (or rely on Convex-native service token validation if available) and call mutation `upsertProfile`.
- Add: `convex/mutations/upsertProfile.ts` — upsert/merge canonical profile by `profileId` with idempotency key handling and normalization (coerce "Present" → null + current flag, dedupe arrays).
- Update: `my-app/convex/schema.ts` — ensure profile schema supports the fields:
  - profileId (external UUID)
  - idempotencyKeys: string[]
  - name, email, summary (string|null)
  - skills: string[]
  - experience: array of objects {title,company,startDate,endDate,current,description}
  - education: array of objects {degree,school,startDate,endDate,description}
  - achievements: string[]
  - updatedAt: number

Frontend (my-app)
- Create: `my-app/src/components/ProfileEditorUnified.tsx` (or adapt existing `ProfileEditor`/`ProfileForm`):
  - Single page UI that:
    - Loads canonical profile via Convex query (e.g., `api.profilesPublic.getByUser`).
    - Shows editor panes (left preview, right edit) and an "Upload CV" control that sends file to backend `/api/v1/parse-now` or `/api/v1/llm-refine`.
    - Shows LLMHistory status with `placeholderId` and `convex_write_status`.
  - Buttons:
    - Upload CV → calls backend endpoint to parse + confirm-save + llm-refine (existing endpoints).
    - Reapply AI refine → calls `/api/v1/llm-refine` with `profileId` and canonical fullRawText.
    - Manual edits → send to backend endpoint for user edits or call Convex mutation if you choose per-field writes (but prefer server-to-server writes as authority).
- Remove or repurpose `ProfileReviewModal` as uploader-only UI (no canonical authority).

Concrete payload & contract
---------------------------
Worker -> Convex Action payload (example JSON):

{
  "profileId": "36877f23-4ac0-46fa-9616-e4360ff34810",
  "idempotencyKey": "addb36f2-c08f-4e77-8c97-dbbc93b6d080",
  "source": "llm_refine",
  "version": 1,
  "profile": {
    "name": "Robert Cooper",
    "email": "email@email.com",
    "summary": "Safety conscious ...",
    "skills": ["Investigation skills","Safety compliance",...],
    "experience": [
      {"title":"Security Guard","company":"ADT Security","startDate":"2021-01","endDate":"2022-04","current":false,"description":"..."}
    ],
    "education": [ ... ],
    "achievements": ["Decreased theft ...","..."]
  }
}

Convex Action behavior:
- Validate `Authorization` header token equals expected server token or relies on Convex service token handling.
- Validate JSON shape.
- Call `mutation/upsertProfile` with the payload.
- Implement idempotency: if `idempotencyKey` already present for the `profileId`, treat as success no-op.

Worker-side logic (where to call)
---------------------------------
- At the end of `llm_refine_profile` in `pdf-ingest/worker.py` — after committing local DB updates and updating `LLMHistory.full_response`:
  1. Build `convex_payload` from normalized candidate.
  2. Call `convex_persist.call_convex_action(CONVEX_ACTION_PATH, convex_payload)`.
  3. On success update `LLMHistory.convex_write_status = "success"` and `convex_written_at`.
  4. On failure update `LLMHistory.convex_write_status = "failed"` and store `convex_error`.
  5. Optionally, enqueue a retry job with exponential backoff.

Retry strategy
--------------
- Retries: `0.5s`, `1s`, `2s`, `4s` (4 attempts).
- On final failure: log and mark `convex_error`. Provide API to retry via `/api/v1/convex-persist-retry`.

Normalization rules (must be applied before Convex write)
---------------------------------------------------------
- Summary: map `PROFILE` or `Profile` fields into `summary` field.
- Experience vs Education: prefer to avoid mixing:
  - If parsed item contains `degree`, `school`, `program`, treat as education; do not add to experience.
  - Experience descriptions that look like achievements (regex for percentages, "reduced/increased/achieved/award") should be moved into `achievements` (or extracted as separate items).
- Achievements:
  - If LLM returns broken fragments, reassemble by joining short fragments into sentences using punctuation heuristics. Keep sentence punctuation intact when possible.
- Dates:
  - Coerce human tokens "Present", "Now" → `null` for endDate and set `current: true`. Use `YYYY-MM` or ISO-style strings for non-null dates.
- Skills: dedupe and trim.

API endpoints (summary)
-----------------------
- Existing:
  - POST /api/v1/parse-now (parses file)
  - POST /api/v1/confirm-save (saves parsed profile to pdf-ingest DB)
  - POST /api/v1/llm-refine (enqueues llm refine job)
  - GET /api/v1/profiles/{id}/llm-history (list LLMHistory entries)

- New / modified:
  - POST /api/v1/convex-persist-retry { placeholderId } — worker/web will resend saved candidate to Convex Action.
  - Ensure GET /api/v1/llm-history/{placeholderId} returns the `convex_write_status` + `convex_error` fields visible for UI polling.

Convex: mutation & action skeleton (TO ADD)
-------------------------------------------
- Action: `convex/actions/persistProfile.ts` — HTTP action wrapper that validates token and calls `mutation/upsertProfile`.
- Mutation: `convex/mutations/upsertProfile.ts` — do idempotent upsert by `profileId`:
  - If `idempotencyKey` exists → return existing doc.
  - Else merge or replace appropriate fields and append `idempotencyKey` to `idempotencyKeys[]`.
  - Return profile _id and new version/timestamp.

Frontend: UI behavior & subscription
-----------------------------------
- ProfileEditorUnified page:
  - On mount: use Convex query to fetch `profilesPublic` for the user. Subscribe to changes if supported.
  - Upload CV: file input POSTS to `/api/v1/parse-now` -> confirm-save -> llm-refine. The response includes `{profileId, placeholderId}`; the page monitors `GET /api/v1/llm-history/{placeholderId}` (or subscribes to Convex) until `convex_write_status === success`, then refreshes the canonical profile from Convex.
  - Manual edits: either call `POST /api/v1/manual-update` (backend persists to Convex) or call a backend endpoint that merges user edits into canonical profile via the same Convex Action. Avoid direct frontend writes to the same Convex doc to keep backend authority.

Testing & diagnostics
---------------------
- Unit tests (backend):
  - `pdf-ingest/tests/test_convex_persist.py` — mock Convex Action; assert correct payload; idempotency handled.
  - `pdf-ingest/tests/test_worker_convex_integration.py` — simulate llm_refine_profile with mocked LLM and Convex client; assert LLMHistory convex_write_status update.
- Convex side:
  - Local test action that returns 200 yes/no.
- E2E diagnostic changes:
  - Update `pdf-ingest/run_diagnostic.sh` to assert:
    1. `POST /api/v1/llm-refine` returns placeholderId.
    2. Worker updated LLMHistory in-place for that placeholderId.
    3. Convex Action returned success and the Convex profile for profileId now exists and has expected fields.

Acceptance criteria (must pass before merge)
-------------------------------------------
- Uploading Robert Cooper CV results in:
  - `summary` derived from PROFILE.
  - All achievements persisted in Convex (no truncation).
  - Experience and education correctly separated and persisted with dates (Present → null + current flag).
  - `LLMHistory.convex_write_status` = "success" and `convex_written_at` set.
- UI:
  - Profile Editor shows canonical Convex data (after successful write).
  - Reapply AI refine triggers worker and updates Convex again.
- No server token exposure to client.

Implementation checklist (task_progress)
---------------------------------------
- [x] Remove duplicate file parsing logic from ProfileForm
- [x] Make ProfileReviewModal the single place responsible for Load CV parsing & saving (temporary)
- [x] Ensure opening modal from ProfileForm uses modal's picker (parsedProfile=null)
- [x] On modal close, refresh canonical profile from backend
- [ ] Update ProfileView "Load CV" behavior to open unified profile editor (not modal)
- [ ] Add tests for Load CV flow and persistence
- [ ] Add `pdf-ingest/convex_persist.py` helper (HTTP + retries)
- [ ] Update `pdf-ingest/worker.py` to call Convex helper and update LLMHistory convex fields
- [ ] Add `POST /api/v1/convex-persist-retry` endpoint in `pdf-ingest/app.py`
- [ ] Add Convex Action `persistProfile` and Mutation `upsertProfile` (TS)
- [ ] Create `ProfileEditorUnified` frontend and route `/profile/edit`
- [ ] Update diagnostics & run full pipeline test end-to-end

Estimated timeline
------------------
- Day 1: Implement `convex_persist.py` + worker integration + retry endpoint + unit tests for backend.
- Day 2: Add Convex Action & mutation stubs; test with staging Convex; integrate.
- Day 3: Implement ProfileEditorUnified UI and basic UX for uploads + reapply refine; run E2E diagnostic.
- Day 4: Fix edge cases (achievements reassembly, date variants) & QA with real CVs.
- Day 5: Finalize tests, CI, and deploy.

How I will proceed next
-----------------------
I'm ready to implement the first backend changes (create `pdf-ingest/convex_persist.py` and wire the worker to call it, and add the `convex_write_status` updates in `LLMHistory`) — but I need you to confirm two things before I start in ACT MODE:

1. Provide the Convex service token and action URL (or confirm that I should implement the code using environment variables and *mock* the Convex calls for now).
2. Confirm you want me to proceed now (I will run the code changes + run existing diagnostic script to validate the placeholder -> worker -> persistent flow; diagnostics will attempt to call Convex only if token & URL are present).

If you confirm and provide the environment guidance (real token or mock), I will switch to ACT MODE work and:

- Create `pdf-ingest/convex_persist.py`.
- Edit `pdf-ingest/worker.py` to call it and update `LLMHistory`.
- Add the `POST /api/v1/convex-persist-retry` endpoint.
- Run `./run_diagnostic.sh` and report the results (and paste the three check lines verifying Convex persist if available).
