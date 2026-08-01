# CHANGE CONTRACT

- ID: CC-20260801-neyssan-bounded-read-models
- Version: 7
- Operation: IMPLEMENT
- Authorization basis: direct implementation request in the stabilization delegation
- Risk: HIGH
- Status: AUTHORIZED_TO_IMPLEMENT

## 1. ATOMIC OUTCOME

Make the active Jobs inbox read path globally bounded and independent of full Job/CV payloads for both new and existing accounts while preserving the active visible-verdict semantics, preventing stale list tiers after scoring-profile/default-CV edits, and keeping every page accessible through an explicit bounded Load more control. Keep Job/proposal projections tenant-safe by deleting orphaned Job rows and accepting, reassigning, deleting, or refreshing proposal Job links only after server-side linked-profile ownership validation. Establish—but do not yet activate—the lightweight CV ownership catalog used by PR2 hydration.

### Non-goals

- No production migration, deployment, merge, or shared-data mutation.
- No removal of legacy profile ownership fields or destructive rewrite of existing rows.
- No active CV startup/hydration switch, proposal lineage, or favicon behavior; those belong to dependent slices.

## 2. SOURCES OF TRUTH

- User stabilization program and complete plan supplied in the delegation.
- Repository instructions in `AGENTS.md` and `/Users/pana/.codex/RTK.md`.
- Current active paths: `convex/jobsPublic.ts`, `convex/schema.ts`, `convex/lib/userProfiles.ts`, `src/hooks/useJobsQuery.ts`.
- Wiki: Job Library inbox boundary and canonical CV/proposal linkage notes.

## 3. INVARIANTS, ASSUMPTIONS, DECISIONS

### Must remain true

- Existing `jobs.userId` and `userProfiles` data remain valid and readable.
- Job ownership is authenticated server-side; client-provided owner identifiers are never trusted.
- Every public proposal Job link is normalized and checked against an authenticated linked profile before proposal persistence or Job-catalog counter refresh.
- List responses contain summaries/counters only; raw job detail stays in `getById`.
- The first active page remains at most 36 rows, while subsequent 36-row pages remain explicitly reachable without replacing the detail query.
- A usable structured `matchReview.verdict` remains authoritative over the heuristic `matchRead`/`matchTier` for list chips and filters.
- Profile writes never recompute an unbounded set of Jobs in one mutation.
- The bounded path is additive and can be rolled back without deleting data.

### Assumptions

- Observed: PR #374 remains open and ready-for-review with exact base `main` at `21fba4869740938087ca4b44fa18f62b3b12d5c0` and head `d56e38a9fd567186e7aac8a498108926f0a4c9ab`; the same child worktree is clean on `codex/neyssan-stabilization-read-models`.
- Observed: the current Jobs UI calls `jobsPublic.listForUser` and the current helper reads whole `userProfiles` rows.
- Observed: a per-profile fallback remains globally unbounded and reads full `cvDocument` payloads, so it is forbidden on the active list path.
- Observed: `lib/userProfiles.ts:listProfilesForClerk` and `jobsPublic.ts:requireJobForLinkedProfile` resolve active authorization from Clerk subject directly to `userProfiles.clerkId`. `schema.ts:users` stores Clerk identity, but neither `jobs` nor `userProfiles` has a `v.id("users")` owner field and no active Jobs authorization call site joins through that table. The additive external account key therefore preserves the live authorization boundary without inventing a second identity join.
- Decision: compatibility for existing accounts is provided by explicit, authenticated, cursor-bounded catalog/owner backfill code. The backfill may read legacy profile rows only in finite batches; the Jobs list query never does.
- Decision: the list query reads one owner-indexed Jobs page of at most 36 and must not query proposals, proposal shadows, or job extraction shadows per item. Rich data remains in `getById`.
- Decision: `jobCatalog` stores only optional structured verdict/score scalars. The full structured review remains detail-only. Catalog synchronization derives these scalars from at most one latest authoritative extraction-shadow row during a Job write/backfill; `storeJobExtractionShadow` then synchronizes the one affected Job.
- Decision: scoring/default-CV writes reset the authenticated account read-model state in one indexed operation. The UI already skips list reads while that state is not ready, and the existing finite cursor backfill recomputes all account Job projections in bounded pages. Metadata-only profile writes and unattached variant creation do not trigger this recomputation; attaching a variant synchronizes its one Job directly.
- Decision: client backfill has one in-flight request per mounted hook and authenticated owner key, server-persisted cursors, a finite per-call batch and finite client budget, handled errors, and explicit loading/error/retry state. An owner change invalidates the previous generation before another request; StrictMode/remount overlap remains idempotent through Convex transactions, projection upserts, and persisted progress.
- Decision: PR1 closes the Jobs P0 and synchronizes a lean CV ownership catalog only. PR2 switches CV startup to catalog-first exact hydration; PR1 must not claim that active CV startup is closed.
- Decision: the synthetic 500/100/200 test is structural/unit evidence unless local Convex logs are separately captured. Memory-warning absence is claimed only for an actually executed local Convex run and inspected log interval.
- Observed regression: the published PR1 head returns `matchReview: null` from `toJobListItem`, even though the prior active projection derived structured review from `job_extraction_shadow`; a conflicting `possible_lead` review with `weak` tier therefore changes visible list behavior. This is `LOCAL_FAIL` until corrected.
- Observed regression: scoring/default-CV writes update `profileCatalog` but do not invalidate or recompute `jobCatalog.matchTier`; the UI can therefore resume with a stale projected tier. This is `LOCAL_FAIL` until corrected.
- At v5 issuance, corrected local tests, fresh isolated Convex scale/log evidence, and remote CI behavior were unverified; the v5 ledger below records the completed local evidence, while remote CI/review remain pending until publication.

## 4. BASELINE

- Repository root: `/Users/pana/.codex/worktrees/672c/neyssan-new`
- Branch state: `codex/neyssan-stabilization-read-models`
- Base: `origin/main` / PR base at `21fba4869740938087ca4b44fa18f62b3b12d5c0`.
- Head before v5 edits: `d56e38a9fd567186e7aac8a498108926f0a4c9ab`.
- Worktree status before v5 edits: clean on `codex/neyssan-stabilization-read-models`; repeated complete Changeset state fingerprint `5658f10ded9e70625391acde94f83d0f06541e42c9a4c3c58924a8d53591ff6e`.
- Stable anchors: `jobsPublic.storeJobExtractionShadow`, `jobsPublic.ensureJobsReadModelPage`, `jobCatalog.syncJobCatalogById`, `jobCatalog.toJobListItem`, `profileCatalog.syncProfileCatalogById`, `JobsWorkspace.matchesListFilters`, `visibleJobVerdict.resolveVisibleJobVerdict`.
- Target hashes before v5: `jobCatalog.ts` `f7c2e034...`, `profileCatalog.ts` `847d9b0a...`, `jobsPublic.ts` `429787c7...`, `schema.ts` `27c7b8aa...`, scale test `0fe5a35c...`, JobsPage test `8ac5317d...`.
- Applicable instruction hashes: `AGENTS.md` `d3190393...`; `/Users/pana/.codex/RTK.md` `7ae285e1...`.
- Existing in-scope diff: PR1 commit `d56e38a9...`; no uncommitted or staged changes before this v5 amendment. Parent dirty artifact remains forbidden and was not accessed.

## 5. SCOPE

### Allowed files

- `my-app/convex/schema.ts` — additive catalog/owner fields and indexes.
- `my-app/convex/lib/jobCatalog.ts` — lightweight structured-verdict projection and bounded synchronization.
- `my-app/convex/lib/profileCatalog.ts` — projection read/write helper and O(1) account readiness invalidation.
- `my-app/convex/users.ts`, `my-app/convex/profiles.ts`, `my-app/convex/jobsPublic.ts` — synchronize writes, expose finite backfill, and expose bounded page query.
- Active profile/job/proposal write call sites proven by search to require projection synchronization.
- `my-app/src/hooks/useJobsQuery.ts` — consume bounded page query.
- `my-app/src/components/jobs/JobsList.tsx`, `my-app/src/components/jobs/JobsWorkspace.tsx`, and focused UI tests — expose and verify accessible bounded pagination.
- `my-app/convex/createProposalPublic.ts`, `my-app/convex/updateProposalPublic.ts`, `my-app/convex/deleteProposalPublic.ts`, `my-app/convex/saveJobAndProposal.ts`, and one shared `my-app/convex/lib/` helper — enforce authenticated Job-link ownership and synchronize old/new proposal counters.
- Focused tests and generated Convex artifacts required by the schema/toolchain.
- This contract document.

### Conditional files

- Additional current profile-write call sites only if a focused search proves they create/update catalog-owned profiles without a shared helper.
- Current Job/proposal write call sites only where required to keep the lightweight Job catalog and linked-document counters synchronized.
- `src/components/jobs/JobsWorkspace.tsx` and focused hook/UI tests for explicit backfill loading/error/retry behavior.

### Forbidden scope

- `/Users/pana/.codex/worktrees/4c51/neyssan-new` and any parent artifact.
- `twoweeks-wiki` mutation, production migrations, provider/model calls, deployment, merge, unrelated cleanup, legacy parser paths.

## 6. ACCEPTANCE AND EVIDENCE MATRIX

| ID | Criterion | Evidence | Expected |
| --- | --- | --- | --- |
| AC-1 | Bounded first-page query exists and is authenticated | focused Convex unit test + diff | exactly one globally paginated owner-index Jobs read; max 36 records; cursor metadata; unauthenticated rejected |
| AC-2 | Existing and new accounts use a CV-free Jobs list path | negative focused test + scale regression + structural inspection | no `userProfiles`, proposals, proposal shadows, or extraction-shadow reads; no `cvDocument` response; no legacy list fallback |
| AC-3 | Owner/catalog writes and finite legacy backfill are additive and complete | write-site inventory + focused tests | old `userId` remains; active profile writes synchronize lean catalog; authenticated cursor-bounded backfill synchronizes legacy catalog/job ownership without execution against shared data |
| AC-4 | Client backfill is finite, deduplicated, and recoverable | focused hook test/typecheck | one in-flight call; bounded attempts; handled failure; visible loading/error/retry; list remains skipped until ready |
| AC-5 | Client uses bounded query without changing detail query | focused hook test/typecheck | list uses paginated results; `getById` remains detail-only |
| AC-6 | Synthetic scale is bounded at 500 jobs / 100 CV variants / 200 proposals | instrumented store regression | heavy fixtures are present in the executed store; first page <=36; only jobCatalog touched; no full CV payloads |
| AC-7 | Local runtime evidence is labeled truthfully | local Convex execution/log inspection if available | no memory-warning claim from structural tests alone |
| AC-8 | Final artifact is clean and scoped | diff/check/status | no unexpected paths, sensitive data, or whitespace errors |
| AC-9 | Structured visible verdict survives the lightweight list projection | backend projection regression + existing Jobs UI conflict regression | `possible_lead`/68 projected against a `weak` tier remains `Worth a shot`; list query still touches only one `jobCatalog` page |
| AC-10 | Scoring/default-CV edits cannot expose stale list tiers | invalidation/recompute regression + isolated runtime exercise | profile write performs one account-state invalidation, list is gated while stale, bounded backfill recomputes the changed attached/default profile tier |
| AC-11 | Every active Job remains reachable after the bounded first page | hook + rendered Jobs regression with more than 36 rows | first request is 36; a keyboard-accessible Load more control requests the next bounded page, shows loading state, and disappears when exhausted |
| AC-12 | Permanent archived-Job deletion cannot orphan its projection | authenticated mutation regression | the matching `jobCatalog.by_job_id` row and archived Job are deleted in one mutation after ownership validation |
| AC-13 | Public proposal counters remain exact across create, reassignment, and delete | focused handler regressions | saved proposal create increments the owned Job; reassignment refreshes old and new Jobs; delete refreshes has-docs/no-docs state |
| AC-14 | Public proposal Job links fail closed across tenants | focused create/update/delete and public save regressions | malformed, missing, or foreign Job IDs are rejected before proposal write/delete/catalog refresh; no foreign catalog row is mutated |
| AC-15 | A Job without an explicit CV uses the account's current primary/default CV | focused multi-CV regression | an older linked profile cannot override the current primary profile's default resume when computing the projected tier |
| AC-16 | A missing explicit CV attachment fails closed | focused deleted-CV regression | an unresolved `lastResumeId` produces `profile_missing`/`unknown`; it never falls back to the owner/default profile |

## 7. FAILURE MODES AND RECOVERY

- Missing catalog/owner rows: return an explicit read-model-not-ready state and use the authenticated finite backfill mechanism; never fall back to scanning full profiles from the list query.
- Backfill mutation rejection or exhausted client budget: expose an error with retry; never leave an unhandled rejection or silently continue a write storm.
- Profile edit while a backfill is in progress: atomically reset the persisted cursor state; idempotent catalog upserts allow the next finite run to restart safely.
- Extraction-shadow replacement/invalid output: synchronize the one Job and clear an obsolete usable verdict rather than retaining stale authority.
- Generated Convex artifacts unavailable after the repository-supported local workflow: stop publication and report the exact runtime boundary.
- Schema/type/test failure: correct only within this contract; issue a new contract version if scope changes.
- Proposal row with inconsistent top-level and metadata Job IDs: fail closed before mutation or counter refresh; recovery requires reopening from an owned Job context.

## 8. BRANCH AND PR FRAMING

- Branch: `codex/neyssan-stabilization-read-models`
- Base: `origin/main` at `21fba4869740938087ca4b44fa18f62b3b12d5c0`
- Proposed PR title: `Bound Jobs inbox reads with additive lightweight projections`
- Reviewer focus: pagination semantics, owner isolation, finite/recoverable backfill, no full payload on the Jobs list path, lean CV ownership foundation, and legacy compatibility.
- v5 reviewer focus: structured verdict precedence with conflicting heuristic tier, shadow-to-catalog freshness, and bounded tier refresh after scoring/default-CV edits.
- v6 reviewer focus: access to pages after the first 36, archived projection cleanup, and tenant-safe proposal Job-link/counter synchronization across every public write surface.
- v7 reviewer focus: exact parity with the active resume-source resolver for current-primary defaults and fail-closed missing explicit attachments.

## 9. VERIFICATION LEDGER

- Convex code generation: PASS against the repository-supported local deployment.
- Focused Jobs/backend/UI suite: PASS, 6 files and 187 tests.
- Full Convex suite: PASS, 32 files and 508 tests. Existing best-effort MCP failure logs remain test-harness stderr; assertions pass.
- TypeScript (`tsc --noEmit`): PASS.
- New helper/hook targeted lint: PASS. Test files are ignored by the repository lint configuration.
- Affected-file lint: repository baseline remains at 43 errors and 13 warnings in pre-existing lines; no finding is on a new projection or synchronization line.
- Build: blocked by the pre-existing application-context, source-CV, synthetic-proof, and ProposalForge type failures present at the baseline; no new build failure remains.
- Synthetic scale proof: PASS as structural/unit evidence. The executed instrumented store contains 500 heavy Jobs, 100 heavy CV profiles, 200 proposals, and 500 shadows; the list handler touches only `jobCatalog`, requests at most 36 rows, and returns no `cvDocument` or `rawDescription` payload.
- Local Convex runtime scale evidence: PASS on isolated instance `neyssan-pr1-scale-isolated` at temporary ports 3230/3231. A snapshot export counted 100 heavy `userProfiles`, 500 heavy `jobs`, 500 `jobCatalog` rows, 200 proposals, and 500 extraction shadows. Backfill completed in 201 finite calls (100 profile-selection calls, 100 Job batches, one completion call) in 8.7 seconds. The first list page returned 36 rows, 20,367 bytes, and no `cvDocument`/`rawDescription` in 48 ms client-observed / 30 ms Convex-observed. The captured two-line Convex function-log interval records `jobsPublic:listPageForUser` success and contains zero memory-warning, error, failure, or unexpected-failure matches. The owned backend stopped, its mode-600 ephemeral admin config was deleted, and no production/shared data was touched.
- Runtime-discovered regression: the first implementation attempted profile and Job pagination in one mutation, which real Convex rejects. The corrected state machine selects one profile in one call and processes its bounded Job page in the next; a focused regression now forbids a second paginated query in a single invocation.
- Fallow read-only audit against `21fba4869740938087ca4b44fa18f62b3b12d5c0`: no introduced dead code or duplication; three introduced moderate-complexity findings in the two catalog projection builders and bounded Job synchronization helper. Disposition: retain for PR1 because these functions centralize defensive normalization, exact bounded hydration, and atomic projection writes; splitting them would not reduce query fan-out or the failure surface. Fallow remains advisory.
- Publication gate: PASS locally after post-runtime tests, stable diff fingerprints, sensitive-data review, Changeset self-review, and read-only Fallow. Remote CI/review remain unverified; no merge, deployment, or production/shared migration is authorized.

## 10. V5 CORRECTION GATE

- Authorization evidence: controller instruction to issue CC v5 and correct PR #374 on the same branch/PR only.
- Starting status: `LOCAL_FAIL` on published head `d56e38a9...`; v4 publication evidence is historical and cannot verify the v5 correction artifact.
- Required fresh evidence before a follow-up commit/push: RED-to-green focused regressions, affected/full tests, type/lint/diff-check, isolated 500/100/200 Convex execution with a captured bounded-list log interval, exact full diff and sensitive-data review, Changeset self-review, and Fallow read-only.
- Publication boundary: one follow-up commit/push to the existing PR1 branch/PR only if every required v5 gate passes; no PR2, merge, deployment, production/shared data mutation, or production migration.

### V5 evidence ledger

- RED evidence: the lightweight list returned `matchReview: null`, profile catalog writes did not invalidate `accountReadModels`, and no scoring fingerprint existed; the focused regressions failed on all three conditions before implementation.
- Focused affected suite: PASS, 7 files and 196 tests. The structured-review conflict test now verifies both the visible chip and filter authority; profile regressions cover heuristic and authoritative-normalized CV evidence invalidation without metadata-only restarts.
- Convex application suite: PASS, 33 files and 514 tests.
- Broader `convex` tree: 1,941 passed / 4 pre-existing parser failures / 1 skipped. The failures are the unchanged education-language split, location false-positive, dual-degree split, and name-guard baselines; no PR1 file is in those failures.
- TypeScript (`tsc --noEmit`): PASS. Build reaches only the previously recorded application-context, source-CV, synthetic-proof, and ProposalForge baseline errors; the three v5 `jobCatalog` typing errors found during implementation were corrected before this ledger.
- Targeted lint: both catalog helpers PASS with zero warnings. Affected-file lint retains 34 errors / 8 warnings in pre-existing `jobsPublic.ts`, `users.ts`, and `JobsWorkspace.tsx` lines; no v5 line is reported.
- Fresh isolated Convex proof on the final source: PASS at `/tmp/neyssan-pr1-convex.5Pyi2z` on the owned temporary instance/ports 3230/3231. Snapshot counts are 100 heavy `userProfiles`, 500 heavy `jobs`, 500 `jobCatalog` rows, 200 proposals, and 500 valid extraction shadows. Initial backfill completed in 201 calls / 10.810 seconds. Editing the synthetic attached/default CV changed readiness to `backfilling`; the finite refresh completed in 201 calls / 13.889 seconds and changed Job 0 from `weak` to `strong` while projecting only `{ verdict: "possible_lead", score: 70 }`.
- Final bounded list observation: 36 rows, 21,519 bytes, 25 ms client-observed / 10 ms Convex-observed, 36 lightweight structured reviews, and no `cvDocument` or `rawDescription`. The exact captured two-line function-log interval contains the successful `jobsPublic:listPageForUser` execution and zero memory-warning/error/failure matches. The isolated backend stopped, port 3230 closed, the temporary admin configuration was deleted, and the generated local URL was removed from `.env.local`.
- Fresh Fallow read-only review: the base audit reports no introduced dead code or duplication and retains the catalog projection/synchronization complexity advisories. Worktree health initially flagged the expanded fingerprint serializer as critical; normalization was split into small helpers and the rerun removed that finding. Remaining touched-helper advisories are `buildProfileCatalogProjection` (moderate), `buildJobCatalogProjection` (high), and `syncJobCatalogById` (moderate). Disposition: retain these centralized, directly tested projection boundaries; no automated Fallow fix was applied.
- Final Changeset self-review: exact 12-path diff and untracked test inspected; `git diff --check` passed; strong credential/private-key scan returned no matches; ignored runtime artifacts remain outside the publication set. Two consecutive complete pre-stage fingerprints matched at state `db8b823a3ebf00eaa0f537e323c863fb68696722ce094d9b6c4ccf21365ec7df`; the contract-only evidence update is followed by a fresh repeated fingerprint before staging.
- V5 local status: `LOCAL_PASS`. Remote CI and review remain required before any merge-readiness claim; no PR2, merge, deployment, or production/shared migration is authorized.

## 11. V6 CORRECTION GATE

- Authorization evidence: controller instruction to issue CC v6, correct the unresolved PR #374 review findings on the same branch/PR, and request review only on the new exact head.
- Starting status: `LOCAL_FAIL` on published head `2f62ae2200e103471232703abda906a14f0ae03b`; the first 36 active Jobs are the only reachable page, archived Job deletion leaves `jobCatalog` rows, public proposal deletion leaves stale counters, and public proposal create/update paths can refresh a foreign Job catalog from client metadata.
- Base remains `origin/main` at `21fba4869740938087ca4b44fa18f62b3b12d5c0`; branch remains `codex/neyssan-stabilization-read-models`; initial v6 complete state fingerprint is `f76c468d25e4bbfc9e3217a2d849ff041e8bec3188067268a34ab5745414f87d`.
- Initial target hashes in the order listed by the v6 scope inventory: hook `ceb2473c...`, workspace `4e7038c3...`, list `9f69b1be...`, Jobs backend `cab9c33b...`, proposal create `85eb9a89...`, proposal update `bb489d18...`, proposal delete `785d5d36...`, public save `40c6259c...`, Job catalog `8d5239a2...`, Jobs backend test `b86e7a85...`, hook test `ab6eaea9...`, Jobs UI test `5cc3f8d6...`, contract `a8d97e06...`.
- Direct active-call-site audit: `createProposalPublic.default`, `updateProposalPublic.default`, `deleteProposalPublic.default`, and `saveJobAndProposal.default` are the public proposal mutation surfaces that persist/delete linked proposals; `proposals.createProposal`, `proposals.updateProposal`, `proposals.deleteProposal`, and `saveJobAndProposal.saveJobAndProposal` are internal mutations and remain outside the public ownership boundary.
- Required fresh evidence before follow-up publication: RED-to-green pagination, orphan-cleanup, counter, and foreign-ID regressions; focused/full tests; TypeScript/lint/diff checks; a fresh isolated 500 Jobs / 100 CV variants / 200 proposals / 500 shadows Convex execution and bounded-list log interval; exact full diff and sensitive-data review; Changeset self-review; Fallow read-only.
- Publication boundary: one follow-up commit and non-force push to existing PR #374 only after all local gates pass. Reply to and resolve the five named threads only with final-head evidence, then post exactly one top-level `@codex` review request for that head. No PR2, merge, deployment, production/shared data mutation, or production migration is authorized.

### V6 evidence ledger

- RED evidence: the hook discarded Convex pagination state/loadMore; archived deletion left the indexed catalog row; proposal deletion did not refresh document counters; public create/update accepted foreign `metadata.jobId` values and refreshed the referenced catalog without linked-profile ownership proof. Focused regressions failed on those exact boundaries before implementation.
- Focused final suite: PASS, 5 files and 185 tests. Coverage includes 36-row initial pagination and cumulative pages above 36, loading/exhausted button state, archived Job/catalog deletion, owned create/reassignment/delete counter refresh, malformed/foreign Job fail-closed behavior, and existing proposal metadata compatibility.
- ProposalForge mock compatibility: PR1's `usePaginatedQuery` import exposed incomplete local `convex/react` mocks. All 25 affected ProposalForge factories now supply the same exhausted lightweight pagination result. Crash-safe one-file runs pass 8 tests across `length-guidance`, `save-to-library`, `generated-style-sync`, and `output-draft-guard`; the former missing-export failure is eliminated. Four additional one-file runs reach unchanged UI assertions instead of failing at import. `ProposalForge.tsx` and those four test files are byte-unchanged between exact base `21fba486...` and published head `2f62ae22...`; an exact-base execution attempt stopped earlier because that clean checkout lacks generated Convex API files, so this disposition is unchanged-hunk/call-path proof rather than a claimed passing base runtime.
- Convex application suite after the backend corrections: PASS, 34 files and 522 tests. It was not redundantly rerun after the subsequent test-only mock additions.
- Global Vitest proof class: `rtk npm test -- --run` is not a conclusive product gate in this environment. It reported two structured-upload fixture assertions, one environment-sensitive MCP `run.sh` assertion, then exhausted the Node heap near 4 GB and closed the worker channel. The two structured-upload files were rerun directly and fail at exact base `21fba486...` on the same missing-fixture assertions (`fixturePipelineDiagnostics` line 279 and `rawPdfExtraction` line 192). The MCP partition passes 224/225 and its sole failure is the local runtime refusing legacy/foreign stack state before the expected Clerk-key message. No further monolithic run was attempted.
- Crash-safe execution: no orphaned Node/Vitest process was found for this worktree after interruption. Grouping four ProposalForge files still reproduced the 4 GB harness OOM; subsequent evidence uses one file per process with one worker so memory is reclaimed between runs.
- TypeScript (`tsc --noEmit -p tsconfig.app.json`): 14 errors in the same six published-PR baseline files (`applicationContextPersistence`, `sourceCvTailoringReview`, `sourceCvCandidateFactAdapter`, `sourceCvPlanOrchestrator`, `mcpControlledSyntheticProof`, and `ProposalForge` resume fields). No v6 implementation file is implicated.
- Targeted source ESLint: PASS for the hook, Jobs list, proposal ownership helper, public proposal create/update/delete/save paths, and focused source tests; Convex tests and ProposalForge tests are ignored by repository lint configuration. Targeted stylelint for `product-jobs.css`: PASS. `git diff --check`: PASS.
- Fresh isolated Convex proof on final backend source: PASS at `/tmp/neyssan-pr1-convex.Wwzqdh` on owned temporary ports 3230/3231. The synthetic store contained 100 heavy `userProfiles`, 500 heavy Jobs, 500 `jobCatalog` rows, 200 proposals, and 500 extraction shadows. Initial backfill completed in 201 calls / 5.943 seconds; a profile edit invalidated readiness and the finite 201-call refresh completed in 5.476 seconds, changing the exercised tier from `weak` to `strong` while preserving lightweight `{ verdict: "possible_lead", score: 70 }` review authority.
- Final bounded runtime observation: first page 36 rows, 21,519 bytes, 28 ms client-observed / 11 ms captured Convex query, no `cvDocument` or `rawDescription`, and 36 lightweight structured reviews. The captured two-line log interval contains zero memory-warning or unexpected-failure matches. The isolated backend stopped, port 3230 closed, ephemeral admin configuration was deleted, and no shared/production data was touched.
- Final Changeset self-review: exact 38-file tracked diff plus the two intended untracked ownership files inspected; the 25 ProposalForge paths contain the same one-line mock compatibility addition; `git diff --check` passes; strong credential/private-key scan over every v6 path returns no matches; no runtime proof artifact is in the publication set.
- Fallow read-only: changed-file audit could not create its temporary worktree and returned exit code 2, so no audit-pass claim is made. The fallback `fallow health --top 20 --explain` completed and surfaced repository-wide complexity hotspots, including the pre-existing `JobsPageContent` function; no finding identifies the small v6 helpers or pagination callback as a new defect, and no automated fix was applied.
- Pre-stage complete Changeset fingerprint repeated identically at state `db22d8ea94409fbc0a12230d31e9d8008077f3681619a717c257ac6b2b555a51` across 40 publication paths with no hidden index flags. The contract-only ledger update is followed by one final repeated fingerprint before staging.
- V6 local status before staging: `LOCAL_PASS`. Exact staged review remains required before commit. Remote final-head CI and Codex review remain required before any ready-to-merge claim.

## 12. V7 CORRECTION GATE

- Authorization evidence: controller instruction to correct the two remaining P1 resume-source findings on the same PR before requesting Codex review.
- Starting head: `ef4b2a45df04858662cded6245f2eb3d64e2ef87` on `codex/neyssan-stabilization-read-models`; base remains exact `21fba4869740938087ca4b44fa18f62b3b12d5c0`.
- Active failures: a Job without `lastResumeId` derives its tier from the older `jobs.userId` profile instead of the account's current primary/default CV; an unresolved explicit `lastResumeId` silently falls back to that owner profile instead of failing closed.
- Scope: `my-app/convex/lib/jobCatalog.ts`, its focused regression file, and this contract only. No PR2, merge, deployment, shared-data mutation, or production migration.
- Required evidence: both regressions RED then green together; directly affected single-process Jobs/jobCatalog tests; TypeScript, targeted lint, diff check, Changeset self-review, read-only Fallow, exact staged/full-diff/sensitive review.
- Publication boundary: one non-force follow-up push to PR #374 only after local gates pass. Then reply to and resolve the two remaining P1 threads with exact-head evidence, verify all seven threads, and post exactly one top-level `@codex review` for the final head.

### V7 evidence ledger

- Focused resolver and directly affected Jobs batch: PASS, 4 files and 73 tests in one worker. The two new regressions cover an older linked CV versus the current primary default and a deleted explicit attachment; both now use the shared active `resolveMatchReadSourceProfile` semantics.
- TypeScript remains at the documented PR baseline: 14 errors in six unchanged non-v7 files; neither v7 source nor its test is implicated. Targeted ESLint and `git diff --check`: PASS.
- Changeset self-review: the exact three-file v7 diff preserves owner derivation, adds one bounded owner-index primary lookup plus at most one bounded exact-resume lookup, keeps the explicit-attachment fail-closed rule, and introduces no response payload or schema change.
- Fallow read-only audit was attempted with `audit --changed-since` and again could not create its temporary base worktree (exit 2); no audit-pass claim or automated fix is made. The advisory limitation matches v6 and does not replace the focused correctness evidence.
- V7 local status before exact staged/sensitive review: `LOCAL_PASS`. Remote final-head CI and Codex review remain mandatory before any merge-readiness claim.
