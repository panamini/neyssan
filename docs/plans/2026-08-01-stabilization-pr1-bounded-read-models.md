# CHANGE CONTRACT

- ID: CC-20260801-neyssan-bounded-read-models
- Version: 4
- Operation: IMPLEMENT
- Authorization basis: direct implementation request in the stabilization delegation
- Risk: MEDIUM
- Status: AUTHORIZED_TO_IMPLEMENT

## 1. ATOMIC OUTCOME

Make the active Jobs inbox read path globally bounded and independent of full Job/CV payloads for both new and existing accounts by adding additive catalog/owner projections, a finite authenticated backfill mechanism with explicit UI recovery, and an owner-indexed Jobs page query with no per-profile or per-job fan-out. Establish—but do not yet activate—the lightweight CV ownership catalog used by PR2 hydration.

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
- The bounded path is additive and can be rolled back without deleting data.

### Assumptions

- Observed: `origin/main` and `HEAD` are `21fba4869740938087ca4b44fa18f62b3b12d5c0`; worktree was clean and detached before branch creation.
- Observed: the current Jobs UI calls `jobsPublic.listForUser` and the current helper reads whole `userProfiles` rows.
- Observed: a per-profile fallback remains globally unbounded and reads full `cvDocument` payloads, so it is forbidden on the active list path.
- Observed: `lib/userProfiles.ts:listProfilesForClerk` and `jobsPublic.ts:requireJobForLinkedProfile` resolve active authorization from Clerk subject directly to `userProfiles.clerkId`. `schema.ts:users` stores Clerk identity, but neither `jobs` nor `userProfiles` has a `v.id("users")` owner field and no active Jobs authorization call site joins through that table. The additive external account key therefore preserves the live authorization boundary without inventing a second identity join.
- Decision: compatibility for existing accounts is provided by explicit, authenticated, cursor-bounded catalog/owner backfill code. The backfill may read legacy profile rows only in finite batches; the Jobs list query never does.
- Decision: the list query reads one owner-indexed Jobs page of at most 36 and must not query proposals, proposal shadows, or job extraction shadows per item. Rich data remains in `getById`.
- Decision: client backfill has one in-flight request per mounted hook and authenticated owner key, server-persisted cursors, a finite per-call batch and finite client budget, handled errors, and explicit loading/error/retry state. An owner change invalidates the previous generation before another request; StrictMode/remount overlap remains idempotent through Convex transactions, projection upserts, and persisted progress.
- Decision: PR1 closes the Jobs P0 and synchronizes a lean CV ownership catalog only. PR2 switches CV startup to catalog-first exact hydration; PR1 must not claim that active CV startup is closed.
- Decision: the synthetic 500/100/200 test is structural/unit evidence unless local Convex logs are separately captured. Memory-warning absence is claimed only for an actually executed local Convex run and inspected log interval.
- Unverified: remote CI behavior until publication; local Convex generation and runtime checks must pass before publication.

## 4. BASELINE

- Repository root: `/Users/pana/.codex/worktrees/672c/neyssan-new`
- Branch state: `codex/neyssan-stabilization-read-models`
- Base/head before edits: `21fba4869740938087ca4b44fa18f62b3b12d5c0`
- Worktree status before edits: clean, detached; `origin/HEAD -> origin/main` observed.
- Stable anchors: `jobsPublic.listForUser`, `listProjectedJobsForProfiles`, `schema.jobs`, `schema.userProfiles`, `useJobsQuery`.
- Existing in-scope diff: none; parent dirty artifact explicitly forbidden and not accessed.

## 5. SCOPE

### Allowed files

- `my-app/convex/schema.ts` — additive catalog/owner fields and indexes.
- `my-app/convex/lib/profileCatalog.ts` — projection read/write helper.
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

## 7. FAILURE MODES AND RECOVERY

- Missing catalog/owner rows: return an explicit read-model-not-ready state and use the authenticated finite backfill mechanism; never fall back to scanning full profiles from the list query.
- Backfill mutation rejection or exhausted client budget: expose an error with retry; never leave an unhandled rejection or silently continue a write storm.
- Generated Convex artifacts unavailable after the repository-supported local workflow: stop publication and report the exact runtime boundary.
- Schema/type/test failure: correct only within this contract; issue a new contract version if scope changes.

## 8. BRANCH AND PR FRAMING

- Branch: `codex/neyssan-stabilization-read-models`
- Base: `origin/main` at `21fba4869740938087ca4b44fa18f62b3b12d5c0`
- Proposed PR title: `Bound Jobs inbox reads with additive lightweight projections`
- Reviewer focus: pagination semantics, owner isolation, finite/recoverable backfill, no full payload on the Jobs list path, lean CV ownership foundation, and legacy compatibility.

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
