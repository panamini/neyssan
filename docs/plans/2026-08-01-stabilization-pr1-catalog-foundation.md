# CHANGE CONTRACT

- ID: CC-20260801-STABILIZATION-PR1-CATALOGS
- Version: 2
- Operation: IMPLEMENT
- Authorization basis: direct implementation request after accepting closure-audit recommendation B
- Authorization evidence: controller directive to close PR #374 and rebuild only reconstruction PR1 from exact current `origin/main`, reconciled with program contract `CP-20260801-neyssan-stabilization v2`
- Risk: HIGH
- Status: AUTHORIZED_TO_IMPLEMENT

## 1. ATOMIC OUTCOME

Add tenant-owned, lightweight primary-eligible Profile and Job catalog projections plus a finite, idempotent compatibility materializer. New authenticated backend summary reads must take at most 36 rows from those projections and never load embedded `cvDocument` or full Job payloads. Server-owned global pagination/sort/search/filter semantics remain PR3-owned.

### Non-goals

- No Jobs UI or CV startup switch.
- No proposal counters, proposal ledger, or proposal create/update/delete changes.
- No cursor continuation contract or global Jobs sort/search/filter behavior; PR3 owns those semantics and UI consumption.
- No CV hydration, tailoring, proposal lineage, merge, deploy, or shared-data migration.
- No publication in this implementation turn; stop on a frozen local candidate for a separate exact-artifact `review-changeset` turn.

## 2. SOURCES OF TRUTH

- Current user request: reconstruction PR1 directive in task `019fba3c-d3ae-7713-9d74-93cabece4a67`.
- Program authority: `CP-20260801-neyssan-stabilization v2`, `PROGRAM_EXECUTE`, strict DAG `PR1 -> PR2 -> PR3`, one active leaf, delegation depth 1, and at most two review/fix cycles per PR.
- Original stabilization plan: `/Users/pana/.codex/attachments/8aaf8498-38eb-4bef-8155-b033f7bb0437/pasted-text.txt`.
- Repository instructions: root `AGENTS.md`, `/Users/pana/.codex/RTK.md`, and the targeted Twoweeks wiki routing/durable pages required by `AGENTS.md`.
- Existing public contract: `lib/userProfiles.listProfilesForClerk` defines normal-profile-first primary selection; reviewed `source-cv-variant:v1:*` rows cannot become primary.
- Closure audit: PR #374 at base `21fba4869740938087ca4b44fa18f62b3b12d5c0`, head `5724a9dee8941efd3dd85753bfb482482a446925`, was closed as superseded without changing main/deployed state.
- Conflicts or uncertainty: none. This contract deliberately leaves UI consumption and proposal-derived fields to later dependent PRs.

## 3. INVARIANTS, ASSUMPTIONS, DECISIONS

### Must remain true

- `userProfiles` and `jobs` remain authoritative detail records; projections are additive and recoverable.
- `ownerClerkId` is copied from the authenticated Clerk subject already used by active ownership checks. The existing `users` table is not the authoritative owner relation for Jobs; Jobs currently link to `userProfiles` via `jobs.userId`.
- A generic primary-eligible Profile or Job writer with an established owner synchronizes the matching projection in the same mutation transaction. Reviewed tailoring variants are deliberately excluded from the PR1 Profile catalog; tailoring-only Job fields are not projected.
- Existing owned rows are materialized through persisted finite phase/cursor state; replay is idempotent and concurrent live writes converge through indexed upserts and Convex transaction retries.
- Normal primary selection matches `listProfilesForClerk`: reviewed source variants are excluded before recency, then `updatedAt`, creation time, and id order apply deterministically.
- Summary queries touch only catalog tables and cap each read at 36. PR1 does not claim globally ordered continuation semantics.

### Assumptions

- Observed: active generic Profile persistence flows call `profiles.patch`, `profilesPublic`'s default update, and internal `users.createOrUpdateUser`; active generic Job mutations are centralized in `jobsPublic.ts`.
- Observed: `llm.startRefineByString` can create an ownerless placeholder and `sourceCvTailoringReview` creates reviewed variants. Both are outside the primary-eligible catalog semantic owner boundary until a generic owner-bearing Profile write occurs.
- Observed: legacy standalone `mutations/upsertProfile.ts` is referenced only by a local script; `mutations/updateUserProfile.ts` has no active application call site. They are legacy but informative and are outside this slice.
- Inferred: future UI consumers can migrate independently to these authenticated catalog queries without altering this projection foundation.
- Unverified: production row distribution. No production/shared migration is authorized or required.

### Decisions requiring approval

- None. The user explicitly approved this bounded reconstruction and exact publication rail.

## 4. BASELINE

- Repository root: `/Users/pana/.codex/worktrees/672c/neyssan-new` (resolved Git root `/Volumes/video/codex-worktrees/672c/neyssan-new`).
- Git workspace: clean linked worktree.
- Branch state: `codex/neyssan-stabilization-catalog-foundation`, tracking `origin/main`.
- HEAD and candidate base: `21fba4869740938087ca4b44fa18f62b3b12d5c0`; `origin/main` and remote default branch `main` were freshly observed at the same SHA.
- Worktree status summary: no tracked or untracked changes before this contract.
- Applicable instructions read: root `AGENTS.md`, `/Users/pana/.codex/RTK.md`, Changeset skill and all required references, Twoweeks wiki schema/routing plus targeted current Jobs/CV pages.
- Target fingerprints before edit: `schema.ts` `b13473cc`; `lib/userProfiles.ts` `93012f25`; `jobsPublic.ts` `0a70c5ad`; `profiles.ts` `a3ec345b`; `profilesPublic.ts` `077deae9`; `users.ts` `bd6a1851`; `llm.ts` `7c4ccfb3`; `sourceCvTailoringReview.ts` `7c1181ba`.
- Stable anchors: `userProfiles`/`jobs` schema tables; `listProfilesForClerk`; active Profile insert/patch paths; active Job insert/patch/delete paths; `listForUser` remains unchanged.
- Existing in-scope diff captured: none.

## 5. CURRENT STATE OBSERVED

- `profilesPublic.listMine` projects away `cvDocument` only after reading full `userProfiles` rows; this is not a payload-free storage boundary.
- `jobsPublic.listForUser` collects full Profiles and per-profile Jobs, then computes list projections; it is not globally bounded at the storage boundary.
- There is no direct account-owner Job index or lightweight catalog table on main.
- Current Profile primary selection excludes reviewed source variants and sorts remaining Profiles by recency.
- Active Profile and Job writes update authoritative rows only, so any additive projection must be synchronized or recoverable by compatibility materialization.

## 6. SCOPE

### Allowed files

| Path or pattern | Reason |
| --- | --- |
| `docs/plans/2026-08-01-stabilization-pr1-catalog-foundation.md` | Versioned contract and evidence ledger |
| `my-app/convex/schema.ts` | Additive catalog/state tables and indexes |
| `my-app/convex/lib/profileCatalog.ts` | Lightweight primary-eligible Profile projection, canonical selection, sync, and backfill helpers |
| `my-app/convex/lib/jobCatalog.ts` | Lightweight Job projection, owner sync, and bounded summary read helper |
| `my-app/convex/catalogsPublic.ts` | Authenticated catalog reads and finite compatibility materialization |
| `my-app/convex/lib/userProfiles.ts` | Share canonical variant/primary semantics and synchronize canonical Profile creation/update |
| `my-app/convex/profiles.ts` | Synchronize active Profile writes |
| `my-app/convex/profilesPublic.ts` | Synchronize active public Profile update |
| `my-app/convex/users.ts` | Synchronize active user/Profile create, update, and delete paths |
| `my-app/convex/jobsPublic.ts` | Synchronize centralized active Job writes; existing list APIs stay unchanged |
| `my-app/convex/**/__tests__/*Catalog*.test.ts` | Focused RED and scale regressions |

### Conditional files

| Path or pattern | Allowed only when |
| --- | --- |
| Existing focused Convex test files for the writer modules above | Their mocks require compatibility updates caused solely by same-transaction catalog sync |
| `my-app/convex/_generated/api.d.ts` | Repository-supported Convex generation changes the tracked generated API surface |

### Explicitly included pre-existing changes

| Path/hunk | Authorization/evidence |
| --- | --- |
| none | clean exact-base branch |

### Forbidden scope

- All proposal creation/update/delete/aggregate/ledger code and tests.
- Jobs/CV React hooks, components, sorting, filtering, search, hydration, or tailoring behavior.
- `my-app/convex/llm.ts`, `my-app/convex/lib/jobs/sourceCvTailoringReview.ts`, and all source-CV hydration/tailoring paths.
- Server-owned global pagination, continuation, search, filter, or non-default sorting contracts (PR3-owned).
- Production/shared data, migrations, credentials, provider calls, merge, or deploy.
- Any content from `/Users/pana/.codex/worktrees/4c51/neyssan-new` or broad PR #374 commits.

## 7. CHANGE DESIGN

### Required behavior

- Add one unique Profile catalog row per owner-bearing, primary-eligible authoritative Profile and one unique Job catalog row per owned Job, both carrying direct `ownerClerkId`.
- Keep Profile summaries small: identifiers, display label/default selection metadata, canonical variant discriminator, and deterministic recency fields only.
- Keep Job summaries small: direct list metadata only; exclude raw description, extracted arrays, review payloads, shadows, Profile/CV content, and proposal-derived fields.
- Expose authenticated bounded summary reads with a hard cap of 36; continuation/global ordering is intentionally absent in PR1.
- Persist a per-owner, versioned backfill phase/cursor. Each call does bounded work, replay is safe, and completion is explicit.
- Same-transaction active writer synchronization wins over or commutes with a concurrent backfill replay.

### Fixed implementation constraints

- Additive schema only; no destructive migration and no raised Convex read limits.
- Indexed upsert/read paths; no owner-wide full-row collect in summary reads.
- No proposal or shadow fan-out.
- Do not replace `jobsPublic.listForUser`, `jobsPublic.listArchivedForUser`, or UI consumers in this PR.

### Implementation discretion

- Local helper names, exact bounded batch sizes below 36, and test fixture mechanics may vary if all acceptance criteria stay binary and reviewable.

## 8. ACCEPTANCE AND EVIDENCE MATRIX

| ID | Binary criterion | Evidence class | Command/inspection | Expected | Required |
| --- | --- | --- | --- | --- | --- |
| AC-1 | New owned Profile/Job catalog schema and indexes are additive | structural | schema diff + TypeScript | no existing field/table break | yes |
| AC-2 | Canonical primary/default selection promotes new or metadata-updated normal CVs and excludes newer reviewed variants | behavioral | focused Profile catalog RED tests | deterministic expected Profile id/default fields | yes |
| AC-3 | Active owner-bearing Profile/Job writers synchronize projections; delete removes projection | structural + behavioral | exact call-site audit + focused writer/helper tests | no active unsynchronized in-scope writer | yes |
| AC-4 | Old owned rows materialize finitely and replay idempotently; an interleaved live write converges | behavioral | focused backfill tests | ready state, unique rows, live values retained | yes |
| AC-5 | Profile and Job summary reads are bounded to 36 and touch catalog tables only | negative + behavioral | instrumented query tests | no `userProfiles`, `jobs`, `proposals`, or shadow read | yes |
| AC-6 | Synthetic 100 heavy CV / 500 Job fixture remains bounded and returns a 36-row page without full payloads | scale structural/runtime where safely available | focused scale test; isolated local Convex proof if repository-supported without shared data | bounded reads; no unexpected failure/memory warning in observed interval | yes |
| AC-7 | Existing Jobs UI APIs and proposal behavior are unchanged | diff inspection | exact full diff | no forbidden path or behavior | yes |
| AC-8 | Focused/affected tests, typecheck, targeted lint, and diff-check pass or only exact baseline failures remain | verification | repository commands recorded below | conclusive evidence | yes |

## 9. FAILURE MODES AND LIMITS

- Risk: a missed active writer leaves projection drift. Detection: repository-wide write call-site audit and targeted writer tests. Mitigation: shared same-transaction helpers plus finite replay.
- Risk: backfill loops or replays overwrite a concurrent write. Detection: cursor/idempotency/interleaving tests. Mitigation: indexed upsert from current authoritative rows and persisted finite phases.
- Risk: a “summary” query still loads full source rows. Detection: instrumented storage-boundary tests with heavy rows present and forbidden-table assertions.
- Provider-call budget is zero. Browser QA is prohibited for PR1 and reserved for final integrated PR3.

## 10. RECOVERY / ROLLBACK

Before publication, preserve this frozen candidate for context-separated review. A later authorized inverse patch or small revert commit can remove additive callers/tables; authoritative `userProfiles` and `jobs` remain untouched. No data deletion is part of recovery.

## 11. BRANCH AND PR FRAMING

- Branch: `codex/neyssan-stabilization-catalog-foundation`.
- Base: observed `origin/main` at `21fba4869740938087ca4b44fa18f62b3b12d5c0`.
- Future proposed PR title after separate review authorization: `stabilize bounded profile and job catalog foundations`
- PR summary: additive owner-keyed projections, synchronized active writers, finite compatibility materializer, and bounded payload-free backend reads.
- Reviewer focus: tenant ownership, writer completeness, primary semantics, finite replay, and storage-boundary scale proof.

## 12. APPROVAL

- Approval required: yes; already supplied by the direct controller directive.
- Exact version approved by the process correction: `CC-20260801-STABILIZATION-PR1-CATALOGS v2` under program `CP-20260801-neyssan-stabilization v2`.
- Smallest unresolved decision: none.

## Evidence ledger

- Freeze before implementation: branch `codex/neyssan-stabilization-catalog-foundation`, HEAD/base `21fba4869740938087ca4b44fa18f62b3b12d5c0`, with this contract as the only changed path; no product edit, stage, commit, push, or PR occurred.
- Required RED classes before any product edit:
  1. owned lightweight catalog summaries are storage-boundary bounded and payload-free;
  2. primary-eligible Profile projection preserves canonical normal/default/variant ordering under creation and metadata-only promotion;
  3. old owned rows materialize finitely/idempotently and converge with an interleaved live write;
  4. generic owner-bearing Profile/Job writes synchronize unique tenant-owned projections and delete removes the Job projection.
- Publication gate for this turn: prohibited. Stop after focused GREEN evidence and frozen candidate fingerprint.
- RED evidence retained on exact base `21fba4869740938087ca4b44fa18f62b3b12d5c0` (all commands used one Vitest worker):
  - primary semantics: `profileCatalog.test.ts` failed because `../profileCatalog` did not exist;
  - bounded 500 Job / 100 heavy CV summaries: `catalogSummaries.test.ts` failed because `../../catalogsPublic` did not exist;
  - finite/idempotent compatibility materialization: `catalogBackfill.test.ts` failed because `../../catalogsPublic` did not exist;
  - same-transaction writer synchronization: `writerCatalogSync.test.ts` failed with `expected [ 'userProfiles', 'jobs' ] to include 'profileCatalog'` after correcting an initial invalid fixture URL. This is the exact current-path behavior, not a harness failure.
- Pre-review scope enforcement: a proposed `isReviewedVariant` schema/index expansion was rejected and removed before candidate freeze. CC v2 remains unchanged: reviewed variants are absent from the PR1 Profile projection.
- GREEN focused evidence, one worker per file: `profileCatalog`, `catalogSummaries`, `catalogBackfill`, and `writerCatalogSync` each pass 1/1. The backfill fixture contains 100 heavy eligible Profiles and 500 heavy Jobs; the summary-boundary store additionally contains 200 heavy proposals. Summary reads touched only `profileCatalog` and `jobCatalog`, returned 36 rows, and exposed no `cvDocument`/raw Job payload.
- GREEN affected batch: 5 files / 95 tests across `profiles.patch`, `profilesPublic`, linked-profile Job mutations, source-CV tailoring guard rails, and `jobsPublic`.
- TypeScript: `rtk npx tsc --noEmit --pretty false` passed.
- Targeted lint: the three new runtime modules pass individually. The combined existing-file lint remains non-zero only at unchanged baseline lines (`jobsPublic.ts` 478/1924/2325, `profiles.ts` 47, `users.ts` 115-116); all new lint findings introduced during implementation were removed.
- Diff check: `rtk git diff --check` passed. Sensitive-pattern scan over new contract/runtime/tests found no credential-like material.
- No provider call, browser QA, shared data, stage, commit, push, PR, merge, or deploy occurred.
- Review cycle 1/2 admitted one P1: a terminal `ready` state ignored a later Profile ownership claim even though catalog revision advanced, leaving pre-existing Jobs unmaterialized.
- Fix pass 1 retained RED: the focused post-ready claim test failed with `expected 'ready' to be 'running'` at `catalogBackfill.test.ts:159`; 1 failed / 1 skipped.
- Fix pass 1 focused GREEN after the bounded state-transition correction: the same named test passed; 1 passed / 1 skipped. No schema, API, or output contract changed.
- Fix pass 1 final focused catalog batch: 4 files / 5 tests passed with one worker. The affected writer guard batch passed 5 files / 95 tests with one worker.
- Fix pass 1 TypeScript passed. Targeted lint reported zero messages for `catalogsPublic.ts`; the focused test path is repository-ignored and produced only ESLint's ignore warning. The unchanged baseline lint findings already recorded for `jobsPublic.ts`, `profiles.ts`, and `users.ts` remain outside this three-path fix pass.
