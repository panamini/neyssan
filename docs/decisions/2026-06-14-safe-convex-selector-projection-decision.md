# PR59-prep-5 - Safe Convex Selector Projection Decision

Date: 2026-06-14
Status: READY_TO_IMPLEMENT
Scope: docs-only decision before PR59 preflight rerun

Canonical roadmap:

```txt
docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md
```

## 1. Current PR

PR59-prep-5 - Safe Convex selector projection decision.

Base branch:

```txt
application-os-foundation
```

Branch:

```txt
codex/pr59-prep-safe-convex-selector-projection-decision
```

## 2. Roadmap Control

This decision is controlled by the roadmap section:

```txt
Phase 7 - Read-only real data
PR59 - Read-Only Twoweeks Data Adapter
```

PR59 remains preflight-first. This PR does not implement PR59.

## 3. Merged Decisions That Narrow This PR

- PR53 keeps OAuth runtime blocked.
- PR59 boundary-only real-data substitute was rejected by maintainer decision.
- PR174 selected Stytch Connected Apps for MCP OAuth/account-linking direction.
- PR175 added only a fail-closed OAuth verifier boundary.
- PR176 decided Stytch `sub` is not a Convex `clerkId`; explicit server-only account-linking is required.
- PR177 added only a fixture/server-only account-linking storage boundary.

Therefore PR59 still cannot read real data until safe selector projections are approved and the PR59 preflight is rerun.

## 4. Files Read

- `AGENTS.md`
- `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `docs/decisions/2026-06-12-stytch-account-linking-storage-decision.md`
- `docs/decisions/2026-06-12-tool-contract-mapping-local-fixtures-to-mcp-descriptors.md`
- `my-app/src/modules/local-mcp/mcpDescriptorRegistry.ts`
- `my-app/src/modules/local-mcp/mcpSchemaProjection.ts`
- `my-app/src/modules/local-mcp/mcpAccountLinkingStorageBoundary.ts`
- `my-app/convex/activeCvSnapshots.ts`
- `my-app/convex/profilesPublic.ts`
- `my-app/convex/jobsPublic.ts`
- `my-app/convex/proposalsPublic.ts`

## 5. Files Touched In This PR

- `docs/decisions/2026-06-14-safe-convex-selector-projection-decision.md`
  - Records the safe selector projection decision.
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
  - Records PR177 as merged and PR59-prep-5 as current.

## 6. Files Forbidden In This PR

- `my-app/convex/**`
- `my-app/src/modules/local-mcp/**`
- `my-app/package.json`
- package lockfiles
- Vite `/mcp` endpoint files
- `tools/list` or `tools/call` runtime files
- OAuth callback/runtime/token storage files
- handler, connector, export, download, send, submit, or apply files

## 7. Observed Selector Risks

Existing Convex selectors are app-facing, not MCP-safe projection selectors.

Confirmed risky fields:

- `activeCvSnapshots.ts`
  - `buildProfileSnapshot` falls back to `profile.email` for title.
  - Current queries are authenticated by Clerk identity, not Stytch account-linking.
- `profilesPublic.ts`
  - `projectProfileDoc` returns `clerkId`, `email`, `raw_text`, metadata, and optional `cvDocument`.
- `jobsPublic.ts`
  - `buildJobProjection` returns `rawDescription`.
  - `reviewItems` include `sourceText`.
  - detail query returns extraction spans and structured shadow summaries.
- `proposalsPublic.ts`
  - proposal library query returns full proposal `content`, section `content`, `userId`, and `metadata.sourceJobDescription`.

These selectors must not be called directly from MCP.

## 8. Safe Projection Decision

PR59 must use dedicated MCP-safe projections, not existing app-facing public selectors.

The safe selector projection layer must:

- accept only a server-resolved Twoweeks/Convex owner identity from the account-link boundary;
- return only model-safe summary fields and opaque refs;
- keep Convex document IDs, Clerk IDs, emails, Stytch subjects, tokens, raw claims, and raw source text server-only;
- avoid `ctx.auth.getUserIdentity()` as the MCP ownership source;
- fail closed on missing, revoked, stale, ambiguous, or scope-mismatched account link;
- fail closed when a requested data class does not have the required read scope;
- return `onboarding_required` or `no_data_available` when the user has no usable profile, jobs, proposals, or package state;
- never fabricate missing data.

## 9. Exact Data Classes Approved For Projection

The approved first read-only data classes are exactly the four MCP descriptor classes already present:

```txt
twoweeks.application_package.read
twoweeks.evidence_graph.read
twoweeks.resume_variant_plan.read
twoweeks.review_cockpit.read
```

They map to these future tool refs:

```txt
applicationPackageRef
evidenceGraphRef
resumeVariantPlanRef
reviewCockpitRef
```

No other data class is approved by this decision.

## 10. Allowed Projection Fields

All classes may include only:

- opaque `refId`;
- `kind`;
- bounded `label`;
- lifecycle/status enum;
- bounded timestamps such as `updatedAt`;
- bounded counts;
- bounded reason/category enums;
- safe warning codes;
- scope state;
- data availability state.

`application_package` may include:

- package readiness state;
- linked job/proposal/resume presence booleans;
- bounded job/company/title labels when already user-visible in Twoweeks;
- missing input categories;
- safe next review category.

`evidence_graph` may include:

- evidence coverage counts;
- approved/missing category counts;
- provenance health categories;
- private/never-use presence as booleans or counts only, not facts.

`resume_variant_plan` may include:

- plan status;
- target role/title label;
- section coverage categories;
- change category counts;
- warning codes;
- artifact availability state.

`review_cockpit` may include:

- review gate status;
- consent/auth/audit/retention boundary state categories;
- pending review category labels;
- blocked action codes.

## 11. Forbidden Projection Fields

Safe projections must not return:

- raw CV/resume text;
- raw job description text;
- raw proposal or cover letter content;
- section content from generated artifacts;
- raw source documents;
- source quotes or `sourceText`;
- private facts;
- `never_use` facts;
- full generated artifacts;
- emails;
- `clerkId`;
- `userId`;
- Stytch subject;
- account-link records;
- OAuth token, refresh token, raw claims, or bearer token text;
- Convex document IDs as model-visible IDs;
- debug payloads;
- structured shadow payloads;
- extraction spans over raw text;
- `_meta` hidden raw data;
- export/download/send/submit/apply state that implies approval.

## 12. Future Implementation Boundary

The next code that implements this decision may only add a projection boundary or narrow selectors that:

- read by server-owned Twoweeks/Convex `clerkId` only after account-linking succeeds;
- project into safe refs and bounded summaries;
- include source guards proving forbidden fields are absent;
- include fixture tests for redaction and fail-closed cases;
- do not expose real MCP handlers or production connector behavior.

This decision does not approve PR59 implementation yet.

## 13. Expected Tests For Future Code

Future selector/projection code must test:

- missing account link denied before selector access;
- revoked/stale/ambiguous link denied before selector access;
- missing required scope denied;
- each data class rejects the wrong scope;
- no raw profile fields leak;
- no raw job fields leak;
- no proposal content/source job description leaks;
- no `clerkId`, `userId`, email, Stytch subject, token, or raw claims leak;
- no handler/runtime/export/send/apply imports;
- no direct call to existing unsafe public selectors from MCP projection code.

## 14. Grep/Source Guards For Future Code

Future code must include guards for:

```txt
raw_text
rawDescription
sourceText
sourceJobDescription
content
cvDocument
clerkId
userId
email
providerSubject
rawClaims
token
bearer
structuredShadow
ctx.auth.getUserIdentity
tools/list
tools/call
fetch(
http
https
openai
llm
export
download
send
submit
apply
```

Allowed exceptions must be in negative tests or forbidden-term lists only.

## 15. Acceptance Criteria

This docs-only PR is accepted when:

- PR177 is recorded as merged in the ledger;
- PR59-prep-5 is recorded as the current step;
- the four approved data classes are named exactly;
- direct use of existing public selectors for MCP is rejected;
- allowed and forbidden projection fields are explicit;
- PR59 remains blocked pending preflight rerun;
- no code, package, lockfile, Convex runtime, OAuth runtime, handler, connector, or real data behavior changes.

## 16. Rollback Plan

Revert this docs-only PR or restore the two touched docs files:

```bash
rtk git restore -- docs/decisions/2026-06-14-safe-convex-selector-projection-decision.md docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md
```

## 17. Final Decision

PR59-prep-5 is READY_TO_IMPLEMENT as a docs-only safe selector projection decision.

PR59 remains BLOCKED pending:

1. merge of this decision;
2. PR59 preflight rerun;
3. explicit maintainer approval of the exact PR59 implementation scope.

Exact next step after this PR:

```txt
PR59 preflight rerun only. Do not implement PR59 real data until the preflight returns READY_TO_IMPLEMENT_NARROW_PR59.
```
