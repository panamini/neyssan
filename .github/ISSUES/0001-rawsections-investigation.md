# Follow-up: rawSections test migration investigation

Summary
This issue captures the investigation and steps taken to re-enable and migrate the legacy rawSections test for the ProfileReviewModal.

Background
- The UI changed to "immediate-apply" (Accept applies suggestion immediately), which broke legacy tests expecting a confirm-modal.
- The team adopted immediate-apply semantics and migrated tests where feasible.

Observed behaviour
- Re-enabled test: [`my-app/src/__tests__/ProfileReviewModal.rawSections.test.tsx`](my-app/src/__tests__/ProfileReviewModal.rawSections.test.tsx:1)
- The test intermittently hung waiting for the reviewer overlay to mount; runs showed durations up to ~279s locally.
- Local test-run summary: "Test Files 39 passed | 3 skipped (43) — Tests 124 passed | 8 skipped (133)"

Key findings
- Overlay visibility depends on reviewerVisible driven by parsed-profile/refine flows.
- Convex provider errors (useAction/useMutation) caused non-deterministic failures; stubbing in setupTests reduced errors.
- Even after stubbing, overlay mount remained flaky in JSDOM.

Files inspected/modified
- [`my-app/src/setupTests.ts`](my-app/src/setupTests.ts:1)
- [`my-app/src/__tests__/ProfileReviewModal.rawSections.test.tsx`](my-app/src/__tests__/ProfileReviewModal.rawSections.test.tsx:1)
- [`my-app/src/__tests__/ProfileReviewModal.save.test.tsx`](my-app/src/__tests__/ProfileReviewModal.save.test.tsx:1)
- [`my-app/src/components/ProfileReviewModal.tsx`](my-app/src/components/ProfileReviewModal.tsx:1)
- [`my-app/src/components/profile-review-modal/CVReviewerOverlay.tsx`](my-app/src/components/profile-review-modal/CVReviewerOverlay.tsx:1)

Changes made
- Migrated immediate-apply tests to assert updated draft after Accept is clicked.
- Added deterministic test-only mocks for parsing tests (LLM vs heuristic).
- Hardened `my-app/src/setupTests.ts` to stub convex/react hooks and polyfills.
- Added `my-app/src/__tests__/ProfileReviewModal.save.test.tsx` (passes locally).
- Preserved legacy rawSections test as skipped to avoid CI flakiness.

Debug logs (excerpts)
- "[convexClient] ConvexReactClient unavailable; using stub client."
- Vitest repeated lines showing the rawSections test waiting for overlay (e.g. "renders rawSections ... 279.34s")
- Final local run: "Test Files 39 passed | 3 skipped (43)
Tests 124 passed | 8 skipped (133)"

Attempts to stabilize
- Added console.debug instrumentation in test and light logging inside ProfileReviewModal.
- Stubbed convex/react hooks in `my-app/src/setupTests.ts`.
- Reworked selectors to use findBy*/waitFor for async rendering.
- Forced parsing behavior in parsing tests with test-only mocks.

Why flakiness remains
- Overlay mounting depends on async refine/parsing flows and Convex-driven state transitions not reliably reproduced in JSDOM unit tests.

Proposed next steps
1. Keep the legacy rawSections test skipped (done).
2. Add an integration or E2E test against a local/CI Convex instance to exercise refine flows end-to-end.
3. Or refactor ProfileReviewModal to expose deterministic initialization (prop or init hook) for unit tests.

Action requested
- Assign to frontend & parsing owners and set priority to medium.
- Decide between integration test vs refactor approach in next sprint.

References
- PR summary: [`docs/PR_PROFILE_REVIEW_IMMEDIATE_APPLY_SUMMARY.md`](docs/PR_PROFILE_REVIEW_IMMEDIATE_APPLY_SUMMARY.md:1)
- ADR: [`docs/adr/0003-immediate-apply-profile-review-modal.md`](docs/adr/0003-immediate-apply-profile-review-modal.md:1)
- Test file: [`my-app/src/__tests__/ProfileReviewModal.rawSections.test.tsx`](my-app/src/__tests__/ProfileReviewModal.rawSections.test.tsx:1)

Timeline
- Investigation performed locally; results: 124 passed, 8 skipped.

Attach logs and test run output to this issue when filing on GitHub.

END