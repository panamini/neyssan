# Prompt: CV Ingestion Implementation Plan (Drop-in for coding LLM)

You are acting as one of the top 10 software engineers in the world. Update my project roadmap and give me the best possible plan, step by step, for the profile ingestion feature.

Context:
- I already finished the first part of profile ingestion (`ProfileView`, `ProfileForm`, etc. in the `components` folder).
- What is missing: a “Load my CV/Resume” button in `ProfileForm` that lets the user upload a PDF, which is then recognized and parsed by AI.
- The scraping server seems outdated or maybe useless. I don’t need security/privacy right now, I just want a working ingestion flow.

Your job:
1. Review my current roadmap (below) and update it with the missing CV upload flow.
2. Propose the exact next steps (technical plan) to implement PDF ingestion and parsing into the `userProfiles` table.
3. Decide if we should integrate or completely drop the old scraping server.
4. For each step, give me precise file-level instructions (which file to edit/add, which schema/validators to define, how to connect backend to frontend).
5. Optimize for speed of implementation: produce a robust but minimal version first (MVP), then enhancements later.
6. End your answer with a short actionable checklist I can follow.

Roadmap so far (summarized):
- Implement Convex `ingestProfile` endpoint with Zod validation
- Integrate scraping server → ingest endpoint
- Build CV & LinkedIn parsers (heuristics + optional LLM cleanup)
- Add privacy/security layer
- Automate ingestion on signup (Clerk webhook)
- Add tests (unit + E2E)
- Monitoring and rate-limiting

Update this roadmap to prioritize PDF CV ingestion first, then decide the role of scraping-server.

---

# Acceptance criteria — "Load my CV / Upload PDF" (MVP)

1. UI behavior
   - A "Load my CV" button appears inside `ProfileForm` next to existing fields.
   - Clicking opens a native file picker limited to PDF files (.pdf). Drag-and-drop support is optional for MVP.
   - While parsing/uploading, show a transient spinner and a non-blocking toast: "Ingesting CV — this may take a few seconds."

2. Client-side validation
   - Reject files > 10 MB with a clear message: "File too large (max 10 MB)."
   - Reject non-PDF files with a clear message: "Please upload a PDF resume."

3. Upload & API contract
   - Frontend POSTs the PDF (multipart/form-data) to the Convex HTTP action `/ingestProfile` (or a proxy endpoint) with an Authorization token from the current session.
   - API returns 200 + JSON { profileId: "<convex-id>", normalizedFields: { name, email, summary, experiences: [...], skills: [...] } } on success.
   - On failure the API returns informative error JSON (400 for validation, 500 for server errors).

4. Server-side parsing & validation
   - Server extracts text, runs parsing heuristics (and optional LLM cleanup), maps to a Zod schema, and validates the resulting object.
   - Persist the validated object into `userProfiles` in Convex; store an optional `rawText` field if needed (must be explicitly included).
   - Server returns the saved profile id and the normalized fields in the response.

5. Integration with client state
   - After successful response, the client:
     - Updates the local ProfileForm fields from the returned normalizedFields.
     - Shows a success toast: "CV ingested — profile updated."
     - Enables the "Save" button (if disabled) and allows the user to edit normalized fields before final save.

6. Minimum security/privacy & telemetry (MVP, minimal)
   - Do not log raw resume text to stdout or external logs.
   - Redact personal identifiers in error messages.
   - Track an event (ingest_profile.success / ingest_profile.failure) with minimal metadata (userId, size, success/failure, no PII).

7. Test cases (QA)
   - Upload a valid 1–2 page PDF résumé -> should store and populate fields within 10s.
   - Upload >10MB -> client rejects and shows message immediately.
   - Upload a non-PDF -> client rejects.
   - Malformed PDF (no text) -> server returns a useful error; client surfaces it.
   - Network failure -> client shows retryable error state.

---

# File-level implementation notes (MVP)

Frontend:
- File: `my-app/src/components/ProfileForm.tsx`
  - Add a `Load my CV` button and a hidden `<input type="file" accept="application/pdf" />`.
  - Implement handler: read file metadata, check size/type, then POST via `fetch` to `/convex/ingestProfile` or the Convex HTTP endpoint defined in `my-app/convex/http.ts`.
  - On success: call existing local update handler to populate form fields with returned `normalizedFields`.
  - Show spinner/toast states via existing toast components.

- Optional: `my-app/src/services/scraping/cv-parser.ts`
  - Add a client-side helper that extracts first-pass metadata (filename/date) if needed.

Backend / Convex:
- File: `my-app/convex/ingestProfile.ts`
  - Implement a Convex HTTP action that accepts multipart/form-data or base64 payloads.
  - Extract PDF bytes, convert to text (use a lightweight parser library or an external helper — for MVP you can use an LLM via existing langchain integration if available).
  - Normalize into an object matching a Zod schema / Convex validators.
  - Persist to `userProfiles` table (update `my-app/convex/schema.ts` if a new shape/index is needed).
  - Return saved id and `normalizedFields`.

- File: `my-app/convex/schema.ts`
  - Ensure `userProfiles` table has fields:
    - userId: v.id("users")
    - name: v.optional(v.string())
    - email: v.optional(v.string())
    - summary: v.optional(v.string())
    - experiences: v.optional(v.array(v.object({ company: v.string(), title: v.string(), startDate: v.union(v.string(), v.null()), endDate: v.union(v.string(), v.null()), description: v.optional(v.string()) })))
    - skills: v.optional(v.array(v.string()))
    - rawText: v.optional(v.string())

Scraping-server decision (MVP)
- For immediate MVP: keep scraping-server out of the loop. Focus on PDF ingestion first (fastest path to useful profiles).
- After MVP: re-evaluate scraping-server for LinkedIn capture only if the extension needs to send structured LinkedIn data; otherwise keep it archived or refactor it into a microservice that POSTs to the ingest endpoint.

Acceptance criteria for "drop or keep" scraping-server decision
- Keep scraping-server if:
  - It already reliably extracts structured fields from LinkedIn and can be quickly authenticated to call ingest endpoint.
- Drop/refactor if:
  - It's outdated and would take >1 day to patch. Prefer adding a small lightweight LinkedIn extractor inside the extension or a simpler serverless function.

---

# Short actionable checklist (copy/paste)

- [x] Reviewed roadmap & docs
- [ ] Add "Load my CV" button to `my-app/src/components/ProfileForm.tsx`
- [ ] Implement client-side file validation (PDF + size)
- [ ] Create Convex HTTP action `my-app/convex/ingestProfile.ts`
- [ ] Add/verify schema for `userProfiles` in `my-app/convex/schema.ts`
- [ ] Wire frontend POST → ingestProfile and update ProfileForm from response
- [ ] Add server-side parser (heuristics ± LLM cleanup)
- [ ] Add minimal telemetry + redact logs
- [ ] QA test cases & add to TESTING_PLAN.md
- [ ] Reassess scraping-server; archive or integrate

---

# Notes for the implementer

- Prioritize speed: implement a working end-to-end flow even if initial parsing is imperfect. Heuristics + LLM cleanup can be iterated later.
- Use TypeScript and Zod on the client; use Convex server validators (`v.*`) for the database schema.
- Keep raw PDF text out of logs and avoid sending PII to external telemetry.
- After MVP, add more robust normalization (dates, title canonicalization, skill mapping) and unit tests.
