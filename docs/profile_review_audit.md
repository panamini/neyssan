Profile Review / Edit Flow Audit

Summary
- The app implements a full client-side review and save flow: local parse -> reviewer UI -> hardened parse (Convex action) -> canonical save (Convex mutation).
- I validated the trace end-to-end in code: upload handler, reviewer orchestration, autosave, and canonical persistence are present and correctly wired.

Trace (step-by-step) with code references
1) Client CV ingestion (fast feedback)
- File input and parsing: see [`my-app/src/components/CVLoader.tsx:32`]. This calls `parsePdfArrayBuffer` and sends the parsed object to the parent via `onFileParsed`.
- The parsed object is cached into sessionStorage at [`my-app/src/components/CVLoader.tsx:43`].

2) UI immediate display and reviewer sections
- `ProfileReviewModal` accepts parsed input and populates suggestions + reviewer sections in `handleCvParsed`: [`my-app/src/components/ProfileReviewModal.tsx:831` -> setSuggestions/setReviewerSections at 836–853].
- Reviewer overlay UI and section editing are handled in the same component; edits call `handleReviewerEdit` which merges into the draft and triggers a save: [`my-app/src/components/ProfileReviewModal.tsx:705` -> `handleReviewerEdit`].

3) Hardened parse (action -> HTTP -> client fallback)
- Preferred path: Convex public action `formatCompleteCV` via Convex client action hook at [`my-app/src/components/ProfileReviewModal.tsx:75`], action wrapper `callFormatCompleteCV` at [`my-app/src/components/ProfileReviewModal.tsx:252`].
- HTTP fallback (uses Clerk token + CONVEX_SITE_URL): see the HTTP POST path at [`my-app/src/components/ProfileReviewModal.tsx:285`].
- Client fallback parser: `clientFormatCompleteCV` used as last resort at [`my-app/src/components/ProfileReviewModal.tsx:310`].
- The action implementation and Zod schema are in [`my-app/convex/actions/formatCompleteCV.ts:373`].

4) Canonical persistence
- The modal builds `profileObj` and calls the idempotent mutation `upsertProfile` via `saveProfileMutation` at [`my-app/src/components/ProfileReviewModal.tsx:654`].
- Server-side mutation `upsertProfile` normalizes/coerces fields and performs idempotent patch/insert into `userProfiles`: see [`my-app/convex/mutations/upsertProfile.ts:19`] (normalization logic starts at line 86 and DB logic at 107–171).
- Alternative public mutation used by other editors: `profilesPublic` at [`my-app/convex/profilesPublic.ts:147`], which patches the user-specific `userProfiles` row and is used by `ProfileEditor` (`my-app/src/components/ProfileEditor.tsx:30`).

Autosave and concurrency
- `ProfileReviewModal` implements autosave after 1 second idle: see the autosave useEffect at [`my-app/src/components/ProfileReviewModal.tsx:750`]. Autosave calls `handleSave(false)` and will produce many persistence calls in active editing sessions.
- `handleSave` constructs ids and idempotency keys locally: `profileId = savedProfileId ?? crypto.randomUUID()` and `idempotencyKey = crypto.randomUUID()` (see [`my-app/src/components/ProfileReviewModal.tsx:651–653`]).
- The server `upsertProfile` respects `idempotencyKey` to avoid duplicate writes: see idempotency check at [`my-app/convex/mutations/upsertProfile.ts:116–119`].

Field mappings and potential mismatches
- Frontend uses `rawText` in some places and `raw_text` in `profilesPublic` / `users` server helpers. The `ProfileReviewModal` sends `raw_text` in the profile payload to `upsertProfile` (see [`my-app/src/components/ProfileReviewModal.tsx:645`]) while other parts of the codebase use `rawText` — this is handled in mutation normalizers but is worth noting.
- The `upsertProfile` mutation expects `profile` as v.any() and includes server-side coercion (dedupeStrings, coerceExperience, coerceEducation) at [`my-app/convex/mutations/upsertProfile.ts:30` / 47 / 67].

Auth and environment notes
- Convex client action availability is preferred; if not present the HTTP fallback requires `getToken` from Clerk and uses `CONVEX_SITE_URL` (see `authenticatedFetch` at [`my-app/src/components/ProfileReviewModal.tsx:234`]).
- The worker enqueues and processes heavier refine jobs and calls `formatCompleteCV` in DEV_NO_LLM mode: see [`my-app/worker/llmWorker.ts:170` -> action call at 182–186].

Risks and recommendations (MVP-scoped)
1) Autosave frequency vs cost
- Autosave at 1s may create many write ops to Convex; consider increasing debounce to 2–3s or batching edits for the MVP to reduce costs.
  - Location: [`my-app/src/components/ProfileReviewModal.tsx:750`].

2) Consistent field naming
- Standardize `rawText` vs `raw_text` across client and server layers to avoid confusion. Although `upsertProfile` normalizes fields, consistent naming reduces accidental data loss.

3) Unify public mutation paths (optional)
- `ProfileReviewModal` uses `upsertProfile` while `ProfileEditor` uses `profilesPublic`. Both are valid but different shapes: consider documenting the distinction in README or unifying to a single public API for clarity.
  - `ProfileReviewModal` save: [`my-app/src/components/ProfileReviewModal.tsx:654`].
  - `ProfileEditor` save: [`my-app/src/components/ProfileEditor.tsx:30` -> profilesPublic usage].

4) Improve error visibility for autosave
- Autosave errors are swallowed in the effect; surface errors with a subtle UI indicator to help users know when saves fail.
  - Autosave code: [`my-app/src/components/ProfileReviewModal.tsx:750`].

5) Test idempotency edge cases
- When autosave and manual Save / reviewer edits overlap, ensure `idempotencyKey` and merging logic in `upsertProfile` avoids lost updates. The mutation merges conservatively (prefers incoming non-null values) at [`my-app/convex/mutations/upsertProfile.ts:121–137`].

Suggested tests to run now (manual + automated)
- Manual E2E:
  1) Start Convex dev (`npx convex dev`) so actions are accessible.
  2) Run the app, open `ProfileReviewModal`, upload a sample CV via [`my-app/src/components/CVLoader.tsx:32`], observe immediate suggestions, click "Raffiner AI" to enqueue refine, apply suggestions, and hit Save — confirm `upsertProfile` returned convexId: see save result handling at [`my-app/src/components/ProfileReviewModal.tsx:663–672`].
  3) Repeat without `npx convex dev` to validate HTTP fallback path and client fallback parsing.

- Unit tests:
  - Run action tests: [`my-app/convex/actions/__tests__/formatCompleteCV.test.ts:3`].
  - Run mutation tests if present for `upsertProfile` (no direct unit shown here but integration tests should be added for idempotent behavior).

Deliverables I can produce next (choose one)
- A) Implement a small debounce increase for autosave (e.g., 1s -> 2.5s) and add a save-error toast path. I will update `my-app/src/components/ProfileReviewModal.tsx`.
- B) Add a short README entry documenting the two public save paths (`upsertProfile` vs `profilesPublic`) and recommended usage.
- C) Write a small test plan or sample postman-like payloads to test `upsertProfile` and profilesPublic endpoints.

Which would you like me to do next? (A/B/C)