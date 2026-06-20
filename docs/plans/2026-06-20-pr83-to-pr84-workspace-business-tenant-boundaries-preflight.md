# PR83-to-PR84 Workspace / Business Tenant Boundaries Preflight

Date: 2026-06-20

Base branch: `application-os-foundation`

Preflight branch: `codex/pr83-to-pr84-workspace-business-tenant-boundaries-preflight`

Type: docs-only governance/security preflight

## Merge Baseline

Confirmed PR83 merge state:

```txt
PR: #216 - PR83: Observability and Incident Response
Head SHA: 6375528bb54a235775288b48a0371ed93fdc9dc3
Merge commit: 6de9d609f910f3e8a4f2872bbd7e16a067e87a49
Merged at: 2026-06-20T16:41:48Z
Synced application-os-foundation HEAD: 6de9d609f910f3e8a4f2872bbd7e16a067e87a49
Working tree before preflight branch: clean
```

PR83 added bounded operational taxonomy, safe operational event helpers, safe operational status helpers, an incident-response runbook, and tests/source guards over existing MCP/manual-handoff/live-safety/account-link/egress/write-action surfaces.

PR83 did not add provider integration, PR80-live, answer-copy, OAuth/token flows, token storage, provider revocation, browser automation, a public dashboard, an external observability vendor, package changes, lockfile changes, schema changes, or UI changes.

## Senior Findings

### P0 - No Real Workspace, Team, Tenant, Role, Billing, Or Entitlement Model Exists

Confirmed in `my-app/convex/schema.ts`: there are no schema tables, fields, or indexes for `workspace`, `tenant`, `organization`, `team`, `membership`, `role`, `admin`, `member`, `billing`, `subscription`, or `entitlement`.

Impact: PR84 cannot safely implement broad workspace boundaries, team roles, invitations, admin/member permissions, billing enforcement, or tenant migrations without inventing a new product model. That remains out of scope.

### P1 - The Active Boundary Is Clerk Subject To User Profile Ownership

Confirmed active owner model:

- `users.clerkId` and `activeCvSnapshots.clerkId` are Clerk-subject scoped.
- `userProfiles.clerkId` is the practical owner field for profile rows.
- `jobs.userId`, `proposals.userId`, `candidateSourceDocuments.userId`, `candidateFacts.userId`, `candidateImportBatches.userId`, `applicationContexts.userId`, `applicationRuns.userId`, `applicationArtifacts.userId`, and `applicationPackages.userId` are profile-owner scoped.
- `manualApplicationHandoffs.ownerProfileId`, handoff events, and handoff rate limits are owner-profile scoped.
- `mcpAccountLinks.twoweeksClerkId` maps the Stytch provider subject to the Twoweeks owner subject server-side.

Impact: the safe PR84 target is owner/profile business-boundary hardening, not workspace runtime.

### P1 - Profile Claim And Save Paths Need Focused Boundary Tests Before Broadening Trust

Confirmed relevant source:

- `my-app/convex/profilesPublic.ts` requires auth for `get`, `getByProfileId`, and `listMine`.
- `getByProfileId` returns an owned row, blocks rows owned by another Clerk subject, and can return an unclaimed row.
- `my-app/convex/profiles.ts` supports authenticated patching and also has a public `saveProfile` mutation that upserts by external `profileId`.

Impact: PR84 should test and harden unclaimed-profile claim behavior, cross-owner profile access, and `saveProfile` ownership expectations before any business-boundary claims are made.

### P1 - Application Package And Manual Handoff Ownership Is Present But Must Stay Coupled

Confirmed relevant source:

- `my-app/convex/applicationContextBuilder.ts` rejects job/profile ownership mismatch before persisting application context records.
- `my-app/convex/applicationPackages.ts` provides internal list/read helpers by package id, user id, and application context id.
- `my-app/convex/manualApplicationHandoff.ts` requires authenticated owner jobs, verifies package `userId`, validates related `applicationContexts` by owner, and reads delivery artifacts by owner/context.

Impact: PR84 should add cross-owner negative tests around context/package/handoff access so future public queries cannot accidentally use package ids or context ids without owner scoping.

### P2 - Existing Operational And Account-Link Hardening Is Observational, Not Authorization Runtime

Confirmed relevant source:

- PR83 operational helpers classify and redact operational status/events only.
- `my-app/convex/mcpAccountLinks.ts` fails closed for unsafe identifiers, non-unique active links, revoked/stale/expired links, insufficient scopes, and provider-subject/owner collisions.

Impact: PR84 may rely on these surfaces for safe reporting and tests, but must not introduce live provider calls, token storage, provider revocation, or OAuth/token exchange.

## Active Boundary Inventory

| Surface | Current authority | Current boundary | PR84 note |
| --- | --- | --- | --- |
| `users` | active Convex schema | `clerkId` | user-level auth support only |
| `activeCvSnapshots` | active Convex schema | `clerkId` | source for canonical profile helpers |
| `userProfiles` | active Convex schema | optional `clerkId`, external `profileId` | main PR84 target for owner/profile hardening |
| `jobs` | active Convex schema and public mutations | `userId: Id<"userProfiles">` | linked-profile owner checks already exist |
| `proposals` | active Convex schema | `userId: Id<"userProfiles">` | owner-scoped storage, not workspace-scoped |
| candidate evidence tables | active Convex schema | `userId` indexes | add cross-owner test coverage if touched |
| application context/run/artifact/package tables | active Convex schema | `userId` and `user/context` indexes | verify every exposed path keeps owner coupling |
| manual handoff tables | active Convex schema | `ownerProfileId` | current manual-handoff owner guard is active |
| `mcpAccountLinks` | active Convex schema and internal functions | Stytch `providerSubject` to `twoweeksClerkId` | server-only mapping, not workspace membership |
| `liveExternalActionExecutions` | active Convex schema | provider-neutral idempotency/execution metadata | PR80-live remains blocked |
| `structured_match_reviews` | active Convex schema | `reviewerId`, `jobId`, `profileId` | internal review/audit surface, not admin/member roles |
| `metrics` / `alerts` | active schema, legacy/informative for PR83 | metric/status rows | no public dashboard or vendor |

## Confirmed Absences

The current active schema does not define:

- workspace records;
- tenant records;
- organization records;
- team records;
- membership records;
- role or permission records;
- admin/member role assignments;
- invitation flow records;
- billing, plan, subscription, entitlement, or quota-plan records.

Search results outside schema mostly refer to prose, UI/editor language, sample job text, tests, or internal viewer allowlists. They do not constitute a workspace or tenant model.

## PR84 Narrow Scope

PR84 may implement only narrow owner/profile business-boundary hardening over existing surfaces:

- make the single-user/current-profile model explicit in source guards and tests;
- harden profile claim rules for owned vs unclaimed profile rows;
- harden `saveProfile`/`patch` behavior if tests confirm a cross-owner or unauthenticated write gap;
- add cross-owner negative tests for jobs, profile reads/writes, application contexts/packages/artifacts, manual handoff, candidate evidence, and MCP owner resolution where current tests are missing;
- ensure all safe refusals and operational outputs stay bounded and redacted;
- keep Stytch provider subjects separate from Twoweeks owner ids.

PR84 must preserve the current single-user owner/profile model unless a later explicit product decision creates a workspace model.

## PR84 Forbidden Scope

PR84 must not introduce:

- workspace, tenant, organization, team, membership, role, admin/member, invitation, billing, subscription, or entitlement schema;
- workspace creation, switching, dashboards, or role-management UI;
- public metrics dashboards or external observability vendors;
- provider API/client/credentials;
- OAuth callback, token exchange, token storage, refresh-token flow, or provider revocation;
- browser automation or external HTTP;
- PR80-live behavior;
- approved answer-copy implementation;
- package or lockfile changes;
- PR85 billing/plan/entitlement work.

## Files To Read Before PR84 Implementation

Required source files:

- `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `my-app/convex/schema.ts`
- `my-app/convex/profiles.ts`
- `my-app/convex/profilesPublic.ts`
- `my-app/convex/lib/userProfiles.ts`
- `my-app/convex/jobsPublic.ts`
- `my-app/convex/applicationContextBuilder.ts`
- `my-app/convex/applicationPackages.ts`
- `my-app/convex/lib/applicationPackages.ts`
- `my-app/convex/manualApplicationHandoff.ts`
- `my-app/convex/lib/manualApplicationHandoff.ts`
- `my-app/convex/mcpAccountLinks.ts`
- `my-app/src/modules/local-mcp/mcpOperationalErrorTaxonomy.ts`
- `my-app/src/modules/local-mcp/mcpOperationalEvents.ts`
- `my-app/src/modules/local-mcp/mcpOperationalStatus.ts`

Required tests and guards:

- `my-app/convex/__tests__/profiles.patch.test.ts`
- `my-app/convex/__tests__/profilesPublic.test.ts`
- `my-app/convex/__tests__/jobsPublic.test.ts`
- `my-app/convex/__tests__/jobsPublic.linkedProfileMutations.test.ts`
- `my-app/convex/__tests__/candidateEvidence.test.ts`
- `my-app/convex/__tests__/applicationPackages.test.ts`
- `my-app/convex/__tests__/manualApplicationHandoff.test.ts`
- `my-app/convex/__tests__/mcpAccountLinks.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpOperationalErrorTaxonomy.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpOperationalEvents.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpOperationalStatus.test.ts`

## PR84 Candidate Modification Set

If implementation is needed, modify only the smallest confirmed subset of:

- `my-app/convex/profiles.ts`
- `my-app/convex/profilesPublic.ts`
- `my-app/convex/jobsPublic.ts`
- `my-app/convex/applicationContextBuilder.ts`
- `my-app/convex/applicationPackages.ts`
- `my-app/convex/manualApplicationHandoff.ts`
- `my-app/convex/mcpAccountLinks.ts`
- focused tests listed above
- focused source guards if the PR adds them

Do not touch schema, UI, package files, lockfiles, provider/OAuth/token code, browser automation, PR80-live, answer-copy, or PR85 files in PR84 unless a later explicit decision changes scope.

## Required PR84 Verification

Minimum local verification:

```txt
focused profile boundary tests
focused jobs linked-profile tests
focused application context/package/artifact ownership tests
focused manual handoff ownership tests
focused MCP account-link ownership tests
source guards proving no workspace/tenant/role/billing implementation
source guards proving no provider/OAuth/token/PR80-live/answer-copy behavior
rtk npx tsc --noEmit --pretty false
rtk git diff --check
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Inherited repo-wide lint/build failures remain out of scope unless PR84 introduces a new failure.

## Rollback Plan

This docs-only preflight can be reverted by reverting the merge commit.

A future narrow PR84 should remain rollback-safe because it should avoid schema migrations, package changes, lockfile changes, provider integrations, workspace runtime, role runtime, billing runtime, and UI rollout.

## Decision

Final decision: `READY_TO_IMPLEMENT_NARROW_PR84`
