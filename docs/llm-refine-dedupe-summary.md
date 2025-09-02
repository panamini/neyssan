# LLM Refine Deduplication & Telemetry Summary

## 1. Problem Statement
- The application experienced duplicate and repeated LLM refine jobs being created when a CV was loaded or when users triggered an explicit "Refine" action. This caused excessive LLM calls, UI freezes, and overwrites of accepted parse results.
- Symptoms: multiple llmJobs with identical rawHash values created within short windows; retry storms from workers; accepted history entries being overwritten by subsequent jobs.

## 2. Solution Implemented
Overview
- A two-tiered defense was implemented:
  1. Client-side coalescing (frontline) to prevent duplicate enqueues from the same client interaction.
  2. Server-side short-window dedupe + telemetry (defensive) to catch races or enqueues from other clients.

Client-side changes (front-end)
- Implemented an in-component coalescing cache using a ref to avoid double-enqueue when the file-load flow and a manual "Raffiner AI" click happen almost simultaneously.
- Key technique: pendingRefines cache keyed by `${profileId}:${shortHash(rawPreview)}`. While an enqueue is in-flight it stores a Promise; once settled it stores the final jobId string for quick reuse.
- Short, non-crypto hash function used to fingerprint the rawText preview for keying.
- File: [`my-app/src/components/ProfileReviewModal.tsx`](my-app/src/components/ProfileReviewModal.tsx:323)
- Rationale: prevents duplicate requests originating from racey UI flows without changing server schema or behavior.

Server-side changes (Convex)
- Added a short-window dedupe inside the server-side job creation path to defensively reuse a recently created job when the same profile + rawHash is seen within a configurable window.
- Dedupe policy: only reuse when both profileId and rawHash match and the existing job is in "queued" or "processing" state and was created within DEDUP_WINDOW_MS (10s).
- To avoid schema migrations, the short rawHash value is persisted inside the job's options under `__rawHash` (no structural change to llmJobs).
- Augmented HTTP action to include caller identity in options via `__requestedBy` for telemetry.
- Files: [`my-app/convex/jobs.ts`](my-app/convex/jobs.ts:14) and [`my-app/convex/http_actions.ts`](my-app/convex/http_actions.ts:271)
- Rationale: provides a safety net for races and for other clients/flows that may enqueue the same job; the added telemetry helps root-cause analysis.

Observability & lifecycle behavior
- start now logs shortHash and creation metadata to help correlate duplicates: `[start] creating job profile=... rawHash=...`
- appendHistory and markJobCompleted behavior already updated earlier in the project to preserve first accepted historyId and mark merged histories; those existing changes complement dedupe by preventing overwrites.
- Claiming logic (`claimJob`) enforces MAX_ATTEMPTS (3) and marks jobs failed when exceeded, preventing retry storms.

Files changed (quick reference)
- [`my-app/src/components/ProfileReviewModal.tsx`](my-app/src/components/ProfileReviewModal.tsx:323) — pendingRefines coalescing, shortHash helper, useRef import.
- [`my-app/convex/jobs.ts`](my-app/convex/jobs.ts:14) — rawHash computation, short-window dedupe scan, optionsWithTrace (`__rawHash`) persisted.
- [`my-app/convex/http_actions.ts`](my-app/convex/http_actions.ts:271) — llmRefineHandler attaches `__requestedBy` into options for caller telemetry.

How it works (end-to-end)
1. Client creates or ensures a saved profile and calls startRefine(profileId, rawText).
2. startRefine coalesces concurrent calls for the same profile+rawHash using the pendingRefines cache; only the first call performs enqueue_mutation / HTTP POST.
3. Server internal.jobs.start computes rawHash, scans recent jobs, and returns an existing jobId if a matching job exists within the dedupe window; otherwise inserts a new job and schedules the refine internal action.
4. Worker/refine claims job via internal.jobs.claimJob (attempts incremented), runs LLM call (or DEV_NO_LLM heuristics), appends history via appendHistory, and links via markJobCompleted (preserves first historyId).

How to validate
- Reproduce the race (load CV then click "Raffiner AI" quickly). Expect: one enqueue call (network/Convex logs) and a single job created for that profile+rawHash in Convex logs.
- Observe Convex logs for `[start] creating job` and for a potential dedupe hit `[start] dedupe hit - reusing recent job ...`.
- Check llmJobs entries for options.__rawHash and options.__requestedBy to trace request origin.

## 3. Future Improvements
Prioritized enhancements for robustness and performance:
- Add a dedicated DB field and index for rawHash + profileId + createdAt on llmJobs (schema migration). This enables efficient dedupe queries without scanning.
- Persist rawHash as a top-level column rather than embedding it in options (requires migration but improves clarity/queries).
- Expose dedupe metrics and alerts:
  - Track dedupe hit rate and fire alerts when hit rate exceeds a small threshold (e.g., 1%).
  - Monitor failed-enqueue and retry storm patterns.
- Consider returning an idempotency token from confirm-save that clients include when enqueueing; canonical idempotency is the most robust client-driven dedupe.
- Optionally support cross-profile dedupe only if business rules permit (rare; be careful not to reuse results across users).
- Implement a compact audit table or per-job event log to capture caller identity, IP, and rawHash for post-mortem debugging.
- If dedupe scanning is a performance concern, replace the scanning with an indexed query or a dedicated dedupe table written transactionally.
- Add unit/integration tests covering race scenarios for both client and server (simulate two concurrent startRefine calls and assert a single job created).

Closing notes
- The combination of client-side coalescing and server-side defensive dedupe plus added telemetry provides defense-in-depth: it eliminates the common double-enqueue case from the modal while protecting against other clients and race conditions.
- If you'd like, I can:
  - implement the indexed schema migration for rawHash,
  - add dedupe metrics/alerts, or
  - expand test coverage for concurrency scenarios.

-- End of summary