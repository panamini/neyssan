# PR59 Preflight Rerun After PR59-prep-8

Date: 2026-06-15

Status:

```txt
READY_TO_IMPLEMENT_NARROW_PR59
```

Scope: docs-only preflight report; no PR59 implementation.

Canonical roadmap:

```txt
docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md
```

## PR183 Merge Confirmation

Confirmed:

- PR183 is merged into `application-os-foundation`.
- GitHub PR: `https://github.com/panamini/neyssan/pull/183`
- Title: `PR59-prep-8: Production Stytch verifier/config and server-only account-link persistence boundary`
- Merge commit: `ea4697683a3da92314c12453846a18102b329fba`
- Merged at: `2026-06-15T15:33:44Z`
- Local `application-os-foundation` was synced with `git pull --ff-only` and the merge commit is an ancestor of `HEAD`.

The progress ledger needed an update from PR59-prep-8 current/open to PR183 merged.

## Files Inspected

- `AGENTS.md`
- `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `docs/decisions/2026-06-15-production-stytch-oauth-account-link-persistence-decision.md`
- `docs/plans/2026-06-15-pr59-read-only-twoweeks-data-adapter-preflight.md`
- `docs/plans/2026-06-15-pr59-read-only-twoweeks-data-adapter-preflight-after-prep-6.md`
- `docs/decisions/2026-06-12-auth-oauth-implementation-decision.md`
- `docs/decisions/2026-06-12-oauth-account-linking-read-only-mcp-decision.md`
- `docs/decisions/2026-06-12-stytch-account-linking-storage-decision.md`
- `docs/decisions/2026-06-12-real-data-privacy-consent-retention-audit-policy.md`
- `docs/decisions/2026-06-14-safe-convex-selector-projection-decision.md`
- `my-app/src/modules/local-mcp/mcpOAuthAccountLinkingBoundary.ts`
- `my-app/src/modules/local-mcp/mcpAccountLinkingStorageBoundary.ts`
- `my-app/src/modules/local-mcp/mcpSafeConvexSelectorProjectionBoundary.ts`
- `my-app/src/modules/local-mcp/mcpProductionStytchOAuthConfigBoundary.ts`
- `my-app/src/modules/local-mcp/mcpProductionAccountLinkPersistenceBoundary.ts`
- `my-app/src/modules/local-mcp/mcpConsentGate.ts`
- `my-app/src/modules/local-mcp/mcpRedactedAuditLog.ts`
- `my-app/src/modules/local-mcp/mcpRetentionDeletionBoundary.ts`
- `my-app/src/modules/local-mcp/mcpSchemaProjection.ts`
- `my-app/src/modules/local-mcp/mcpDescriptorRegistry.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpOAuthAccountLinkingBoundary.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpAccountLinkingStorageBoundary.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpSafeConvexSelectorProjectionBoundary.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpProductionStytchOAuthConfigBoundary.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpProductionAccountLinkPersistenceBoundary.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpSemanticPrivacyHarness.test.ts`
- `my-app/convex/mcpAccountLinks.ts`
- `my-app/convex/schema.ts`
- `my-app/convex/activeCvSnapshots.ts`
- `my-app/convex/profilesPublic.ts`
- `my-app/convex/jobsPublic.ts`
- `my-app/convex/proposalsPublic.ts`

External routing context was also read from `/Volumes/video/git/twoweeks-wiki` because `AGENTS.md` requires it for non-trivial roadmap/security work.

## Gate Checklist

| Gate | Result |
| --- | --- |
| PR183 merged and merge commit present | PASS |
| Ledger updated from PR59-prep-8 open to PR183 merged | PASS |
| Production Stytch verifier/config boundary exists | PASS |
| Local JWT/JWKS-only verification, no outbound HTTP or introspection | PASS |
| Exact issuer, audience/resource, approved client id, and Twoweeks scopes enforced | PASS |
| Generic OIDC-only scopes rejected | PASS |
| Malformed JWKS, `kid`, `alg`, signature, timing, and claims rejected | PASS |
| No token storage, refresh-token storage, raw claims, token echo, or Stytch subject in model-visible output | PASS |
| Descriptor-safe unknown-object parsing for production Stytch boundary | PASS |
| Server-only account-link persistence boundary exists | PASS |
| Convex `mcpAccountLinks` server-only boundary exists | PASS |
| `schema.ts` contains the `mcpAccountLinks` table needed for the boundary | PASS |
| Verified Stytch subject maps to existing Twoweeks/Convex owner identity server-side only | PASS |
| `twoweeksClerkId` remains server-only and is not model-visible | PASS |
| Missing, revoked, stale, ambiguous, client-mismatched, expired, malformed, or scope-insufficient links fail closed | PASS |
| Account-link boundary rejects tokens, raw claims, email, Convex IDs, raw data, debug payloads, and shadow payloads | PASS |
| Safe selector projection boundary still emits only the four approved opaque ref classes | PASS |
| Consent, redacted audit, retention/deletion, semantic privacy, OAuth verifier, account-link, and safe projection boundaries are present | PASS |
| Write, export, download, send, submit, apply, LLM/model, outbound HTTP, package, and tools runtime surfaces remain blocked | PASS |

## Current State Summary

PR181 was blocked because production Stytch OAuth/config and production server-only account-link persistence were missing.

PR183 resolves those blockers as boundary-only code/tests:

- `mcpProductionStytchOAuthConfigBoundary.ts` validates production-shaped Stytch Connected Apps access tokens through local JWT verification against server-provided JWKS.
- `mcpProductionAccountLinkPersistenceBoundary.ts` validates server-only account-link records and keeps owner identity out of model-visible output.
- `my-app/convex/mcpAccountLinks.ts` provides internal Convex create, resolve, and state-change functions for the account-link table.
- `my-app/convex/schema.ts` defines `mcpAccountLinks` with Stytch subject, Twoweeks `clerkId`, client id, granted scopes, grant/consent refs, state, timestamps, and audit reason code.

This preflight does not approve production connector behavior. It approves only the next narrow PR59 adapter implementation described below.

## Privacy And Security Result

The minimum safety boundary for a narrow read-only PR59 is now present:

- OAuth token verification is local-JWT-only and server-only.
- Account-link owner resolution is server-only.
- Consent, redacted audit, retention/deletion, and semantic privacy boundaries remain present.
- Safe selector projection emits only opaque refs and rejects raw/sensitive selector-shaped payloads.
- The tested outputs avoid model-visible `clerkId`, user id, email, Stytch subject, tokens, raw claims, Convex IDs, raw CV/job/proposal text, private facts, `never_use` facts, debug payloads, and structured shadow payloads.

## OAuth And Account-Link Result

The production Stytch boundary covers the required authorization checks for PR59:

- exact configured issuer;
- exact configured audience/resource, including array audiences only when the configured resource is present;
- exact approved `client_id` allowlist, with `azp` only corroborating when present;
- required Twoweeks scopes, including `twoweeks.mcp.read` and the approved data-class scopes;
- `RS256` only;
- local JWKS only;
- no token storage, refresh, revocation, introspection, callback, or outbound HTTP.

The account-link persistence boundary covers the required owner bridge:

```txt
verified Stytch access-token subject
-> server-only MCP account-link record
-> existing Twoweeks/Convex owner identity
```

`twoweeksClerkId` remains server-only. PR59 may consume it only inside server-side data selection/projection code and must never return it to the model, MCP client, descriptors, logs, audit payloads, or debug output.

## Safe Projection Result

`mcpSafeConvexSelectorProjectionBoundary.ts` still emits only:

```txt
applicationPackageRef
evidenceGraphRef
resumeVariantPlanRef
reviewCockpitRef
```

It still rejects raw/sensitive fields, Convex/document ID shaped refs, user IDs, email, debug/shadow data, arrays, cycles, accessors, symbols, non-enumerable properties, prototype-backed records, forbidden key names, and forbidden text patterns.

Existing app-facing Convex selectors remain unsafe for direct MCP use:

- `activeCvSnapshots.ts` is Clerk-authenticated and may derive labels from profile data such as email.
- `profilesPublic.ts` returns app-facing profile fields including `clerkId`, `email`, `raw_text`, metadata, and optional `cvDocument`.
- `jobsPublic.ts` returns app-facing job detail fields including `rawDescription`, `sourceText`, extraction spans, structured shadow/debug summaries, and mutation surfaces.
- `proposalsPublic.ts` returns full proposal `content`, section `content`, `userId`, and `metadata.sourceJobDescription`.

PR59 must not call these selectors directly from MCP.

## Runtime Result

PR59 can now implement a narrow read-only adapter using the merged boundaries.

Runtime wiring is still missing, but it is not required before the narrow PR59 adapter:

- no OAuth callback;
- no token exchange;
- no token refresh;
- no token revocation;
- no token storage;
- no production connector;
- no public MCP handler wiring;
- no `tools/list` runtime change;
- no `tools/call` runtime change.

Those remain later-prerequisite work for user-visible or ChatGPT-reachable runtime integration. PR59 must stay an internal read-only adapter and safe projection slice, not a production connector PR.

## Exact Decision

```txt
READY_TO_IMPLEMENT_NARROW_PR59
```

PR59 is ready only for the narrow implementation below.

## Exact Next PR

```txt
PR59 - Read-Only Twoweeks Data Adapter
```

Recommended branch:

```txt
codex/pr59-read-only-twoweeks-data-adapter
```

Recommended title:

```txt
PR59: Read-Only Twoweeks Data Adapter
```

## Narrow PR59 Implementation Plan

Allowed files:

```txt
my-app/src/modules/local-mcp/mcpReadOnlyTwoweeksDataAdapter.ts
my-app/src/modules/local-mcp/__tests__/mcpReadOnlyTwoweeksDataAdapter.test.ts
my-app/convex/mcpReadOnlyTwoweeksDataRefs.ts
my-app/convex/__tests__/mcpReadOnlyTwoweeksDataRefs.test.ts
docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md
```

Allowed only if a current call site proves the narrower file is the existing owner:

```txt
my-app/src/modules/local-mcp/mcpSafeConvexSelectorProjectionBoundary.ts
my-app/src/modules/local-mcp/__tests__/mcpSafeConvexSelectorProjectionBoundary.test.ts
my-app/convex/mcpAccountLinks.ts
my-app/convex/schema.ts
```

Forbidden files and areas:

```txt
my-app/convex/activeCvSnapshots.ts
my-app/convex/profilesPublic.ts
my-app/convex/jobsPublic.ts
my-app/convex/proposalsPublic.ts
my-app/package.json
my-app/package-lock.json
my-app/pnpm-lock.yaml
my-app/yarn.lock
```

Also forbidden:

- MCP endpoint or transport handlers;
- `tools/list` runtime;
- `tools/call` runtime;
- production connector behavior;
- OAuth callback, token exchange, refresh, revocation, or token storage;
- outbound HTTP;
- LLM/model calls;
- export, download, send, submit, or apply behavior;
- write actions;
- app-facing selector reuse.

Implementation scope:

- Require a successful production Stytch boundary result.
- Require a successful server-only account-link resolution.
- Require consent/audit/retention boundary checks appropriate to read-only real data.
- Read only the minimum existing Twoweeks/Convex data needed to decide availability of approved ref classes.
- Project only these opaque refs: `applicationPackageRef`, `evidenceGraphRef`, `resumeVariantPlanRef`, `reviewCockpitRef`.
- Return safe availability/status/count/category fields only.
- Return `onboarding_required`, `no_data_available`, or safe blocked reason codes when data is missing.
- Never return raw CV, raw job, profile, proposal, application package, generated artifact, private fact, `never_use` fact, source quote, raw selector result, or debug/shadow payload.

Tests:

- Auth missing/refused fails before data selection.
- Missing/revoked/stale/ambiguous/client-mismatched/scope-insufficient account link fails before data selection.
- Consent missing/expired/insufficient fails before data selection.
- Retention/deletion blocked state fails before projection.
- Each approved data class requires `twoweeks.mcp.read` plus its class scope.
- Wrong scope cannot produce another ref class.
- Empty user state returns safe no-data/onboarding status.
- Output never includes `clerkId`, Stytch subject, user id, email, session id, tokens, raw claims, Convex IDs, raw text, proposal content, private facts, `never_use` facts, debug payloads, or structured shadow payloads.
- Source guards reject forbidden imports and runtime surfaces.

Grep/source guards:

```txt
activeCvSnapshots
profilesPublic
jobsPublic
proposalsPublic
ctx.auth.getUserIdentity
fetch(
XMLHttpRequest
node:http
node:https
@stytch
openai
langchain
tools/list
tools/call
oauth/callback
tokenEndpoint
refreshToken
revocationEndpoint
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
debug
structuredShadow
export
download
send
submit
apply
```

Allowed exceptions must be negative tests, forbidden-term lists, or server-only implementation internals that are proven not model-visible.

Acceptance criteria:

- Changed files stay within the allowed PR59 file set.
- No package or lockfile changes.
- No app-facing selector modifications.
- No direct MCP calls to app-facing Convex selectors.
- No endpoint, handler, `tools/list`, `tools/call`, connector, OAuth callback, token exchange, token storage, outbound HTTP, LLM/model, write, export, download, send, submit, or apply behavior.
- Adapter returns only approved opaque refs and bounded safe status fields.
- Relevant Vitest scopes pass.
- TypeScript passes if touched code requires it.
- Fallow has no blocking changed-file issue.

## Forbidden Surfaces Untouched By This Preflight

This preflight changed no code and did not touch:

- `my-app/src/modules/local-mcp/**`
- `my-app/convex/**`
- package files or lockfiles
- MCP endpoint/transport handlers
- `tools/list` runtime
- `tools/call` runtime
- OAuth callback/runtime/token storage
- outbound HTTP
- LLM/model calls
- export/download/send/submit/apply behavior
- write actions

## Rollback Plan

Revert this preflight PR. It is docs-only and changes only this fresh preflight report plus the progress ledger. No code, runtime, package, OAuth, Convex, real-data, account-link persistence, handler, tools runtime, outbound HTTP, LLM/model, write-action, or export/download/send/submit/apply behavior is changed.

## Verification Commands And Results

Ran on branch `codex/pr59-preflight-rerun-after-prep-8` after the docs-only preflight commit.

```txt
rtk git status --short --branch
Result: PASS. Branch is `codex/pr59-preflight-rerun-after-prep-8`; no tracked changes after the preflight commit. Unrelated untracked docs remained present and were not staged:
- docs/plans/2026-06-12-agent-accelerated-gated-runbook.md
- docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract-old.md
- docs/plans/2026-06-12-v1.5-implementation-contracts.md
- docs/plans/automation.md
- docs/plans/runsh-refactor.md

rtk git log -1 --oneline
Result: PASS. Latest commit is the docs-only preflight commit: `docs: rerun pr59 preflight after prep 8`.

rtk git diff --check application-os-foundation...HEAD
Result: PASS. No whitespace errors.

rtk git diff --name-only application-os-foundation...HEAD
Result: PASS. Changed files:
- docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md
- docs/plans/2026-06-15-pr59-read-only-twoweeks-data-adapter-preflight-after-prep-8.md

rtk npx fallow audit --changed-since application-os-foundation --format compact
Result: PASS. Fallow reported no issues in changed files. It also reported inherited unused-dependency findings excluded by the audit gate; no fix was applied because this PR is docs-only.
```
