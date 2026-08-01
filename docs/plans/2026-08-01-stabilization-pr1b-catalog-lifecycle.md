# CHANGE CONTRACT

- ID: CC-20260801-STABILIZATION-PR1B-CATALOG-LIFECYCLE
- Version: 3
- Program: CP-20260801-neyssan-stabilization v3
- Operation: IMPLEMENT
- Risk: HIGH
- Status: LOCAL_CANDIDATE_FROZEN

## 1. Atomic outcome

Complete only the two operation-aware Profile catalog synchronization invariants on top of frozen PR #375:

1. Resume scoring backfill writes synchronize authoritative Profile data with `profileCatalog` recency/order in the same transaction.
2. Synchronizing an unchanged canonical Profile does not advance catalog revision or restart a ready Jobs materialization, while real ownership or catalog-membership changes still invalidate it.

### Reclassification

The account/Profile deletion lifecycle is removed from PR1B. Review cycle 1/2 established that a Profile-local 32-row page becomes unbounded when the active Clerk account-deletion mutation loops across many Profiles. That behavior is reclassified to dependent PR1C: globally bounded account deletion across many Profiles and Jobs, immediate projection invisibility, and complete scheduled cleanup. PR1C is not designed or implemented in this turn.

### Non-goals

- No schema, index, public/internal API, validator, protocol, or output change.
- No Profile/account deletion behavior, Job catalog cleanup, or summary-query gating.
- No proposal code or aggregates.
- No Jobs UI/query/pagination/sort/search/filter semantics.
- No CV hydration, tailoring, cleanup, refactor, PR1C implementation, merge, deploy, shared data, provider call, or browser work.

## 2. Sources and baseline

- Direct authority: controller scope-reduction directive after PR1B review cycle 1/2.
- Parent artifact: PR #375, frozen head `92ab3a612b5b9f6b733e5d582b40b2b79c5e49ea`, base `main` at `21fba4869740938087ca4b44fa18f62b3b12d5c0`.
- Local branch: `codex/neyssan-stabilization-catalog-lifecycle`, exact HEAD `92ab3a612b5b9f6b733e5d582b40b2b79c5e49ea`.
- Reviewed v2 candidate fingerprint: `402b2b0d5d6b92de918cf43bab1566dae04aca7fc3119308570d3848aaec7af9`.
- Reviewed v2 tracked patch fingerprint: `6b56a41d316de4c3e9068ff3ddb514bcd67f3e652ad2c00b7b414ab9072f6a27`.
- Review cycle 1/2 verdict: one P2 account-wide boundedness finding, accepted as PR1C reclassification rather than a PR1B fix.

## 3. Exact allowlist

| Path | Purpose |
| --- | --- |
| `docs/plans/2026-08-01-stabilization-pr1b-catalog-lifecycle.md` | Contract and evidence ledger |
| `my-app/convex/jobsPublic.ts` | Route scoring backfill through synchronized Profile writer |
| `my-app/convex/lib/profileCatalog.ts` | No-op comparison and ownership/membership revision invalidation |
| `my-app/convex/__tests__/jobsPublic.test.ts` | Retained scoring synchronization RED |
| `my-app/convex/lib/__tests__/catalogBackfill.test.ts` | Retained no-op and membership invalidation RED |

All other paths are forbidden. In particular, `schema.ts`, `catalogsPublic.ts`, `jobCatalog.ts`, deletion tests/helpers, generated API files, proposal paths, and UI paths must be byte-identical to parent head `92ab3a612b5b9f6b733e5d582b40b2b79c5e49ea`.

## 4. Change design

- Replace the direct scoring `ctx.db.patch` call with the existing `patchProfileWithCatalog` helper. No payload, return, or validation changes.
- Compare the current lightweight Profile projection with the stored catalog row before writing.
- Patch changed same-owner projection fields without advancing Jobs materialization revision.
- Inserted membership, removed membership, and owner transfer still advance the affected owner revision or revisions.
- Preserve existing finite ready/backfill behavior and all parent PR1A content.

## 5. RED-first evidence retained from v2

- Scoring synchronization RED: the named `jobsPublic.setResumeForJob` test failed because `patchProfileWithCatalog` had zero calls.
- No-op invalidation RED: the named catalog backfill test observed revision `5`, expected `4`, after synchronizing an unchanged Profile.
- The same invalidation test also requires removal from primary-eligible membership to delete the catalog row and advance revision from `4` to `5`.

## 6. Acceptance

- Both retained RED-derived tests pass on the reduced candidate.
- Existing relevant Profile/Jobs writer guards remain green.
- TypeScript, targeted lint, diff-check, and sensitive scan pass or retain only exact parent-head baseline findings.
- The final worktree changes exactly the five allowlisted paths.
- No deletion/index/gating hunk or deletion-specific test remains.
- Stop on an uncommitted candidate for final review cycle 2/2. No publication or remote action.

## 7. Evidence ledger

- Contract v3 was frozen against exact reviewed v2 source/index identity before any product scope-reduction edit.
- PR1C is recorded only as a dependency boundary; no design or implementation work for it is included.
- Scope reduction restored `schema.ts`, `catalogsPublic.ts`, `jobCatalog.ts`, `catalogSummaries.test.ts`, and `writerCatalogSync.test.ts` byte-for-byte to parent HEAD. The final candidate contains exactly the five allowed paths.
- Both named RED-derived tests pass: 2/2 with one worker. The affected batch passes 6 files / 98 tests with one worker.
- TypeScript passes with no errors. `profileCatalog.ts` passes targeted ESLint. `jobsPublic.ts` retains only the three parent-head baseline findings outside the changed call (`no-unused-vars`, `no-base-to-string`, and `no-unnecessary-type-assertion`).
- `git diff --check` and the added-line sensitive-pattern scan pass. No stage, commit, push, PR, Fallow, browser, remote action, merge, deploy, provider call, or shared-data mutation occurred.
