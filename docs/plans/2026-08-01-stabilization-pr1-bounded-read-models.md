# CHANGE CONTRACT

- ID: CC-20260801-neyssan-bounded-read-models
- Version: 5
- Operation: IMPLEMENT
- Authorization basis: direct implementation request in the stabilization delegation
- Risk: MEDIUM
- Status: AUTHORIZED_TO_IMPLEMENT

## 1. ATOMIC OUTCOME

Make the active Jobs inbox read path globally bounded and independent of full Job/CV payloads for both new and existing accounts while preserving the active visible-verdict semantics and preventing stale list tiers after scoring-profile/default-CV edits. The list projection carries only the structured verdict/score needed by list chips and filters; shadow writes synchronize that projection, and profile edits invalidate account readiness in O(1) so the existing finite cursor backfill recomputes affected list state before the UI resumes list reads. Establish—but do not yet activate—the lightweight CV ownership catalog used by PR2 hydration.

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
- List responses contain summaries/counters only; raw job detail stays in `getById`.
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

## 7. FAILURE MODES AND RECOVERY

- Missing catalog/owner rows: return an explicit read-model-not-ready state and use the authenticated finite backfill mechanism; never fall back to scanning full profiles from the list query.
- Backfill mutation rejection or exhausted client budget: expose an error with retry; never leave an unhandled rejection or silently continue a write storm.
- Profile edit while a backfill is in progress: atomically reset the persisted cursor state; idempotent catalog upserts allow the next finite run to restart safely.
- Extraction-shadow replacement/invalid output: synchronize the one Job and clear an obsolete usable verdict rather than retaining stale authority.
- Generated Convex artifacts unavailable after the repository-supported local workflow: stop publication and report the exact runtime boundary.
- Schema/type/test failure: correct only within this contract; issue a new contract version if scope changes.

## 8. BRANCH AND PR FRAMING

- Branch: `codex/neyssan-stabilization-read-models`
- Base: `origin/main` at `21fba4869740938087ca4b44fa18f62b3b12d5c0`
- Proposed PR title: `Bound Jobs inbox reads with additive lightweight projections`
- Reviewer focus: pagination semantics, owner isolation, finite/recoverable backfill, no full payload on the Jobs list path, lean CV ownership foundation, and legacy compatibility.
- v5 reviewer focus: structured verdict precedence with conflicting heuristic tier, shadow-to-catalog freshness, and bounded tier refresh after scoring/default-CV edits.

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
