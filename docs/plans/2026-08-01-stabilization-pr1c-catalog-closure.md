# CHANGE CONTRACT

- ID: CC-20260801-STABILIZATION-PR1C-CATALOG-CLOSURE
- Version: 2
- Program: CP-20260801-neyssan-stabilization v4
- Operation: IMPLEMENT
- Risk: HIGH
- Status: LOCAL_CANDIDATE_FROZEN

## 1. Atomic outcome

Close the catalog foundation with exactly two invariants on top of frozen PR #376:

1. Jobs materialization traverses an owner's Profile catalog through stable ordering, so a same-owner projection update cannot move an unvisited Profile before a saved cursor and omit its legacy Jobs.
2. Clerk account deletion is globally bounded and resumable across many Profiles and Jobs, hides Profile and Job summaries immediately, removes all owned Profiles, Jobs, catalog projections, and backfill state before completion, and its durable tombstone prevents every active shared Profile creation root from resurrecting the account.

No additional catalog leaf is permitted. Failure to converge within two review/fix cycles blocks the stabilization program.

## 2. Exact baseline

- Parent: PR #376, frozen head `59262851d1b399bd5837c21b702895310d2034e0`.
- Local branch: `codex/neyssan-stabilization-catalog-closure`.
- Remaining exact-head review evidence: mutable `by_owner_primary` ordering can skip an unvisited Profile during Jobs materialization.
- Reclassified deletion evidence: the existing account deletion loops over every Profile, while Profile deletion leaves owned Job projections behind.

## 3. Exact allowlist

| Path | Purpose |
| --- | --- |
| `docs/plans/2026-08-01-stabilization-pr1c-catalog-closure.md` | Frozen contract and evidence ledger |
| `my-app/convex/schema.ts` | Add stable Profile traversal index and deletion lifecycle state |
| `my-app/convex/catalogsPublic.ts` | Stable traversal and immediate summary fail-closed gate |
| `my-app/convex/lib/accountDeletion.ts` | Shared fail-closed Profile-write tombstone guard |
| `my-app/convex/lib/profileCatalog.ts` | Bounded deletion page helper |
| `my-app/convex/lib/userProfiles.ts` | Guard the Jobs canonical Profile creation root |
| `my-app/convex/users.ts` | Globally bounded scheduled account deletion controller |
| `my-app/convex/lib/__tests__/catalogBackfill.test.ts` | One RED reproduction per claimed bug class |

All other paths are forbidden, including generated files, proposal paths, Jobs UI/query semantics, CV hydration/tailoring, and the original 11-file artifact.

## 4. Design boundary

- Add `profileCatalog.by_owner_profile_id` ordered by stable `profileIdString`; persist the last processed string boundary instead of an index-specific cursor. Existing cursor-only states restart idempotently. Keep `by_owner_primary` for primary-display ordering.
- Add one account-deletion lifecycle row keyed by Clerk ID. Its existence makes catalog summary queries return an empty result before any asynchronous cleanup completes.
- Each deletion invocation performs at most one fixed-size page of work and schedules exactly one zero-delay continuation when work remains.
- Cleanup order is catalog projections, then Jobs per Profile, then Profile, then backfill state. The lifecycle tombstone remains as the terminal fail-closed marker.
- Replays are idempotent. No cursor is persisted across rows being deleted; every continuation takes the next bounded prefix from stable indexed ownership.

## 5. RED classes

1. Start Jobs materialization, move an unvisited Profile by changing `updatedAt`, and prove its legacy Job is missing under mutable traversal.
2. Seed more Profiles and Jobs than one invocation may process, invoke account deletion once, and prove immediate summary invisibility, bounded per-call deletes, scheduled continuation, and eventual complete cleanup under replay.
3. Seed terminal deletion tombstones and prove both shared Profile creation roots reject without inserting a Profile or catalog projection.

## 6. Acceptance

- All three RED-derived tests pass.
- Existing catalog/writer focused suites pass.
- TypeScript, targeted lint, diff checks, and sensitive-data scan pass or retain only exact parent-head findings.
- Final diff contains exactly the eight allowlisted paths.
- Exact-artifact review and Fallow remain read-only. The owner-authorized v2 closure is the final review-fix cycle.
- No merge, deploy, production/shared-data mutation, provider call, or browser work.

## 7. Evidence ledger

- Contract frozen before product/test implementation.
- Stable-cursor RED omitted `job_1` after `profile_b.updatedAt` moved it before the saved Jobs-phase cursor.
- Account-deletion RED failed in the existing unbounded `listProfilesForClerk(...).collect()` path before it could schedule continuation or hide remaining Job summaries.
- Both RED-derived scenarios now pass in the five-test catalog materialization file.
- Focused catalog/Jobs writer verification passes: 3 files / 57 tests. TypeScript and `git diff --check` pass.
- Pre-review deployment audit replaced cross-index cursor reuse with a stable `profileIdString` boundary; legacy cursor-only states safely replay from the beginning.
- Review cycle 1/2 found that a legacy state with `currentProfileId` could still derive a new stable boundary and skip lexically earlier Profiles. The dedicated RED processed one Job instead of first returning a zero-work restart.
- The sole cycle-2 fix versions the Jobs traversal and resets every legacy Jobs/ready state before deriving a stable boundary.
- Final exact review found one P1 inside the deletion invariant: a delayed Clerk create/update event could recreate data after terminal `done`, while a deletion replay returned early. The RED reproduced `delete -> late write -> replay`.
- The terminal tombstone made Clerk webhook recreation a no-op, and every deletion replay rechecks bounded owned rows even after `done`; the later ready-PR review below proved the guard still needed to move to both shared creation roots.
- Explicit owner override authorized one final in-scope closure after exact review found that a historical orphan Job could survive once its owner projection was deleted. The RED completed with one authoritative Job still present.
- Owner-scoped cleanup now processes at most four Job projections and deletes each proven-owned or Profile-orphaned Job before its projection, preserving the global maximum of eight row deletions. A projection pointing to an existing foreign Profile never authorizes Job deletion.
- The orphan RED is green and includes a stale projection targeting an existing foreign Profile; the foreign Job and Profile remain untouched while the orphaned owned Job is removed.
- Focused verification is 3 files / 59 tests; TypeScript, changed-source lint, diff-check, and the added-line sensitive-pattern scan pass. The sensitive scan returns the expected no-match exit status.
- The ready-PR exact-head review found one final P1 inside the existing deletion invariant: `insertProfileWithCatalog` and `ensureCanonicalProfileForClerk` could recreate a Profile after terminal deletion. The corrected harness proved both roots fulfilled despite `done` tombstones.
- Owner authorization amended the contract to v2 for this exact finding only. A shared tombstone guard now covers catalogued Profile creation (`profiles.patch`, `profiles.saveProfile`, `profiles.upsert`, and `users.createOrUpdateUser`) plus the Jobs canonical Profile creation root. The RED scenario passes with no Profile or projection inserted. No further review-fix cycle is permitted.
- Final owner-authorized verification passes 80/80 focused catalog/Profile/Jobs tests, TypeScript, changed-source ESLint, and `git diff --check`; the sensitive-pattern scan has no matches. Exact-artifact review found no introduced P0/P1. Fallow remains advisory-fail on inherited repository debt and the existing `catalogsPublic.ts` complexity finding, with no introduced dead code, duplication, or import cycle from this closure.
