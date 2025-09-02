# MVP Wiring Guide — Convex CV-to-Proposal Core Loop

Purpose

- This document maps the existing frontend components, Convex actions, and mutations that implement the core MVP loop (CV ingestion -> structured profile -> user validation -> proposal generation).
- It is intended as a short runbook for a solo developer to validate the core loop and make minimal fixes.

Scope

- Focus: confirm and run the core loop; do NOT add embeddings/vector DBs, complex UI, or extra infra.

Core loop (high level)

1. Client parses CV locally for fast feedback.
2. Client requests a hardened parse from Convex action [`my-app/convex/actions/formatCompleteCV.ts:373`].
3. User reviews and edits suggested fields in the UI.
4. Client calls idempotent mutation [`my-app/convex/mutations/upsertProfile.ts:19`] to persist canonical profile.
5. A proposal-generation Convex action (not yet present or to be reused) consumes profile + jobDescription, calls LLM via existing adapters, and saves proposal.

Files — quick map

- Frontend CV ingestion and UX:
  - [`my-app/src/components/CVLoader.tsx:32`] — reads file, runs `parsePdfArrayBuffer`, calls parent callback with parsed object.
  - [`my-app/src/components/ProfileReviewModal.tsx:252`] — main reviewer modal that orchestrates call to `formatCompleteCV`, displays suggestions and reviewer overlay, and saves via `upsertProfile`.
  - [`my-app/src/components/ProfileEditor.tsx:61`] — alternative profile editor using public mutation `profilesPublic`.

- Backend Convex pieces:
  - [`my-app/convex/actions/formatCompleteCV.ts:373`] — Convex action returning Zod-validated `RefinedContent`.
  - [`my-app/convex/actions/persistProfile.ts:27`] — HTTP action endpoint delegating to `upsertProfile`.
  - [`my-app/convex/mutations/upsertProfile.ts:19`] — idempotent upsert for `userProfiles` table.

- Worker & refine flow:
  - [`my-app/worker/llmWorker.ts:170`] — worker uses `formatCompleteCV` for DEV_NO_LLM and processes refine jobs.

- LLM adapter and prompt infra to reuse for proposals:
  - [`my-app/convex/langchain/models/mistral_adapter.ts:1`], [`my-app/convex/langchain/models/gpt4_adapter.ts:1`]
  - [`my-app/convex/langchain/chains/chain_factory.ts:1`]
  - [`my-app/convex/langchain/prompts/manager.ts:1`]

Data shapes and expectations

- Client constructs a `profileObj` before save (see [`my-app/src/components/ProfileReviewModal.tsx:635`]):
  - name | email (string, empty string if missing) | summary | skills[] | experience[] | education[] | achievements[] | raw_text | metadata
- `upsertProfile` normalizes/coerces fields server-side; it expects `profileId` and `idempotencyKey` supplied by client.
- `formatCompleteCV` returns `{ status: 'ok', result: RefinedContent }` where `RefinedContent` matches Zod schema in [`my-app/convex/actions/formatCompleteCV.ts:22`].

Parse paths and fallbacks (important)

- The reviewer uses three parse paths in order:
  1. Convex client action (`formatCompleteCV`) via websocket RPC — preferred (no CORS).
  2. HTTP fallback to `${CONVEX_SITE_URL}/formatCompleteCV` — uses Clerk token for auth.
  3. Lightweight client-side parse (`clientFormatCompleteCV`) as last resort.
- See the action + fallback logic in [`my-app/src/components/ProfileReviewModal.tsx:252`].

How to run the core loop locally (developer runbook)

1. Setup env:
   - VITE_CONVEX_URL (Convex site URL)
   - CONVEX_SERVICE_TOKEN (optional; used by server-to-server /persistProfile)
   - LLM keys (if running worker): e.g., MISTRAL_API_KEY or OPENAI_API_KEY depending on adapter
   - DEV_NO_LLM=1 (optional to run heuristics-only parsing)
2. Start Convex dev: npx convex dev
3. Start frontend: (from my-app) npm/yarn/pnpm dev (project uses Vite)
4. If using worker-based long-running refine, start the worker: node my-app/worker/llmWorker.ts or follow repo worker start instructions.
5. In the app:
   - Open reviewer modal (ProfileReviewModal)
   - Click Load CV and upload a sample PDF (or reuse cached)
   - Observe immediate parsed suggestions (from `CVLoader`) then click Raffiner AI to enqueue hardened parse/refine.
   - After refine completes, open reviewer overlay and "Use remaining" or accept per-field suggestions.
   - Save — the UI will call [`my-app/convex/mutations/upsertProfile.ts:19`] and return a convexId.

Example payloads

- formatCompleteCV action call:
  - POST /action or action call with body: { rawText: "<full CV text>" }
  - Returns: { status: "ok", result: RefinedContent }

- upsertProfile mutation call args:
  - { profileId: "<uuid>", idempotencyKey: "<uuid>", source: "frontend_confirm_save", version: 1, profile: { name, email, summary, skills, experience, education, achievements, raw_text, metadata } }

Minimal fixes and hardening suggestions (MVP-scoped)

- Ensure Convex dev is runnable and `formatCompleteCV` is exported as a public action. If the action name changes, update references in [`my-app/src/components/ProfileReviewModal.tsx:75`].
- Add a short README entry documenting the three parse paths and how to run each.
- Add lightweight telemetry in `formatCompleteCV` and proposal actions (token/latency) using existing `my-app/config/llmTelemetry.ts` for cost awareness.
- Confirm that `profilesPublic` and `upsertProfile` are consistent: the editor uses `profilesPublic` while ReviewModal uses `upsertProfile`. Decide if both are required or unify to one public-facing mutation.
- Confirm worker start/stop process and whether long-running refine is expected in prod; if not, surface a note in README.

Proposal generation — next steps

- The project includes LLM adapters and chain factories. To implement the proposal action:
  1. Create Convex action `runGenerateProposal` that:
     - Accepts { profileId, jobDescription, options? }.
     - Loads profile from DB (`userProfiles`) via Convex query.
     - Optionally extract job keywords (small LLM call or regex).
     - Invoke chains via `my-app/convex/langchain/chains/chain_factory.ts` with selected model adapter (mistral_adapter or gpt4_adapter).
     - Return the LLM response and save via `upsertProposal` mutation.
  2. Implement `upsertProposal` mutation following `upsertProfile` pattern (idempotent).
  3. Wire frontend [`my-app/src/components/ProposalInputForm.tsx:1`] to call the action and show result in [`my-app/src/components/ProposalDisplay.tsx:1`].

Quick tests to run after wiring

- Unit: run `my-app/convex/actions/__tests__/formatCompleteCV.test.ts` to ensure parse behavior unchanged.
- Manual E2E: upload sample CV -> refine -> save -> generate proposal with short job description -> verify proposal saved and visible.

Contact and references

- Parser action: [`my-app/convex/actions/formatCompleteCV.ts:373`]
- Upsert: [`my-app/convex/mutations/upsertProfile.ts:19`]
- Reviewer UI: [`my-app/src/components/ProfileReviewModal.tsx:252`]
- CV loader: [`my-app/src/components/CVLoader.tsx:32`]

Appendix — short checklist for MVP launch

- [ ] Confirm Convex actions exported and reachable via `npx convex dev`
- [ ] Confirm Clerk convex token template works locally for HTTP fallback
- [ ] Add runGenerateProposal action + upsertProposal mutation (if you plan to persist proposals)
- [ ] Add README and minimal telemetry hooks
- [ ] Run manual E2E and record a sample CV + job description used for demos

End of wiring guide.