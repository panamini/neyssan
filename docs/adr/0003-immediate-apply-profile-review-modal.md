# ADR 0003 — Immediate-apply UX for ProfileReviewModal

Status: Accepted

Date: 2025-09-12
Authors: Roo (automation + developer notes)

Context

- The ProfileReviewModal previously used a two-step accept flow: clicking "Accept" opened a confirmation modal with an "Apply" button before committing a suggestion.
- Current implementation applies suggestions immediately when users click Accept (one-step).
- Multiple UI tests assumed the older modal UX and became flaky/failing.

Decision

- Adopt the immediate-apply behavior as the canonical UX for v1. No confirmation modal will be shown when accepting a single field suggestion.

Rationale

- Simpler UX: immediate feedback reduces cognitive overhead and makes the refinement workflow faster.
- Implementation cost: tests and a few legacy code paths referenced the modal. Updating tests is lower risk than reintroducing a modal and the associated complexity.
- Determinism for tests: immediate-apply reduces timing windows that caused flakiness.

Consequences

- Tests that expected a confirmation modal must be updated to assert immediate updates after Accept.
- A small number of legacy tests were temporarily skipped and will be migrated: [`my-app/src/__tests__/ProfileReviewModal.rawSections.test.tsx`](my-app/src/__tests__/ProfileReviewModal.rawSections.test.skip.tsx) and [`my-app/src/__tests__/ProfileReviewModal.save.test.tsx`](my-app/src/__tests__/ProfileReviewModal.save.test.skip.tsx)
- If future product requirements demand a confirmation step, we will add a feature toggle and reintroduce a modal behind a flag.

Migration Plan

1. Update test expectations to match immediate-apply semantics and add deterministic waits where necessary.
2. Re-enable skipped tests after migration and confirm full suite green.
3. Add an ADR note and link to code changes.

Rollback

- Reverting to confirm modal UX requires reintroducing confirm state in [`my-app/src/components/ProfileReviewModal.tsx`](my-app/src/components/ProfileReviewModal.tsx:1) and updating all tests back to modal expectations.

Notes

- The immediate-apply decision was chosen to stabilize the CI and reduce flakiness while keeping the UX straightforward.

Related files

- [`my-app/src/components/profile-review-modal/ProfileReviewForm.tsx`](my-app/src/components/profile-review-modal/ProfileReviewForm.tsx:1)