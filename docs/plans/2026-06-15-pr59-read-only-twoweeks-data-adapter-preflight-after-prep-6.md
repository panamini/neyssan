# PR59 Preflight Rerun After PR59-prep-6

Date: 2026-06-15
Status: BLOCKED
Scope: docs-only preflight report; no PR59 implementation

Canonical roadmap:

```txt
docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md
```

## Merged Prerequisites Through PR180

PR180 is merged:

```txt
PR180 - PR59-prep-6 - MCP-safe selector projection boundary
GitHub PR: https://github.com/panamini/neyssan/pull/180
Merge commit: 038fe02522dd7e81a3a0278c1781317d0ac61459
Merged head: 550609b4b8180ff9d9b7d36b6110610bbde25824
Merged at: 2026-06-15T02:53:07Z
```

The MCP-safe selector projection boundary is now present:

```txt
my-app/src/modules/local-mcp/mcpSafeConvexSelectorProjectionBoundary.ts
```

PR180 resolves the prior safe selector projection boundary blocker only. It does not implement PR59, does not call Convex, does not read real Twoweeks data, and does not add production OAuth/account-linking runtime behavior.

## Inspection Summary

Files inspected for this preflight:

- `AGENTS.md`
- `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `docs/plans/2026-06-15-pr59-read-only-twoweeks-data-adapter-preflight.md`
- `docs/decisions/2026-06-14-safe-convex-selector-projection-decision.md`
- `docs/decisions/2026-06-12-auth-oauth-implementation-decision.md`
- `docs/decisions/2026-06-12-oauth-account-linking-read-only-mcp-decision.md`
- `docs/decisions/2026-06-12-stytch-account-linking-storage-decision.md`
- `my-app/src/modules/local-mcp/mcpOAuthAccountLinkingBoundary.ts`
- `my-app/src/modules/local-mcp/mcpAccountLinkingStorageBoundary.ts`
- `my-app/src/modules/local-mcp/mcpSafeConvexSelectorProjectionBoundary.ts`
- `my-app/src/modules/local-mcp/mcpConsentGate.ts`
- `my-app/src/modules/local-mcp/mcpRedactedAuditLog.ts`
- `my-app/src/modules/local-mcp/mcpRetentionDeletionBoundary.ts`
- `my-app/src/modules/local-mcp/mcpSchemaProjection.ts`
- `my-app/src/modules/local-mcp/mcpDescriptorRegistry.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpOAuthAccountLinkingBoundary.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpAccountLinkingStorageBoundary.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpSafeConvexSelectorProjectionBoundary.test.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpSemanticPrivacyHarness.test.ts`
- `my-app/convex/activeCvSnapshots.ts`
- `my-app/convex/profilesPublic.ts`
- `my-app/convex/jobsPublic.ts`
- `my-app/convex/proposalsPublic.ts`

Confirmed current state:

- PR180 added a pure fixture-only selector projection boundary.
- The projection boundary rejects unsafe selector-shaped payloads, malformed records, non-plain/prototype-backed records, accessor/non-enumerable/symbol-backed records, debug or structured-shadow payloads, raw/sensitive fields, and Convex/document-id-shaped model-visible refs.
- The projection boundary can emit only these four opaque ref classes:
  - `applicationPackageRef`
  - `evidenceGraphRef`
  - `resumeVariantPlanRef`
  - `reviewCockpitRef`
- The OAuth verifier boundary remains a fail-closed Stytch-shaped verifier boundary with fixture/injected JWKS config.
- The account-linking storage boundary remains fixture-only/server-only shape validation and does not implement production persistence.
- Consent, audit, retention/deletion, schema projection, and descriptor registry boundaries remain local/fixture-only and do not authorize real data reads.
- Existing app-facing Convex selectors still use app-facing Clerk identity and expose unsafe MCP fields.

## Preflight Questions

1. Is PR180 merged and is the MCP-safe selector projection boundary now present?

Yes. PR180 is merged, and `mcpSafeConvexSelectorProjectionBoundary.ts` is present.

2. Does the selector projection boundary safely reject risky selector-shaped payloads and emit only approved opaque ref classes?

Yes for the fixture-only boundary. It emits only `applicationPackageRef`, `evidenceGraphRef`, `resumeVariantPlanRef`, and `reviewCockpitRef`.

3. Are production Stytch OAuth verifier/runtime wiring and issuer/audience/resource/client/JWKS configuration present and approved?

No. The current verifier accepts injected config and fixture JWTs; no production runtime wiring or approved environment configuration is present.

4. Is production OAuth callback/token handling present and approved?

No. OAuth callback, token handling, token exchange, token refresh, token revocation, and token storage remain absent and forbidden.

5. Is production account-link persistence implemented and approved?

No. The account-linking storage boundary validates a server-only fixture record shape, but there is no production persistence implementation.

6. Is there a safe request-to-user ownership path from AI client bearer token to MCP-safe selector projection?

No. The shape is partially proven by boundaries, but the production path is not present:

```txt
AI client bearer token
-> verified Stytch OAuth subject and client identity
-> server-only account link
-> existing Twoweeks/Convex owner identity
-> MCP-safe selector projection
```

The missing production runtime/config and persistence pieces prevent this chain from authorizing real data reads.

7. Is there an approved exact PR59 file touch set?

No. Because this preflight is `BLOCKED`, no PR59 implementation touch set is approved.

8. Are existing app-facing Convex selectors still unsafe for direct MCP use?

Yes. The inspected selectors expose or depend on app-facing raw/sensitive surfaces, including `raw_text`, `rawDescription`, `sourceText`, `sourceJobDescription`, proposal `content`, section `content`, `clerkId`, `userId`, email, Convex document IDs, debug/shadow fields, and app-facing Clerk identity.

9. Can PR59 now safely read real Twoweeks/Convex data?

No.

10. Should PR59 be marked `READY_TO_IMPLEMENT_NARROW_PR59` or still `BLOCKED`?

```txt
BLOCKED
```

## Decision

PR59 remains blocked.

PR180 resolved the selector projection boundary blocker, but the production request-to-user ownership path is still incomplete. Real Twoweeks/Convex reads through MCP remain unsafe until production Stytch OAuth runtime/config and production server-only account-link persistence are approved and implemented.

## Exact Blockers

1. Production Stytch OAuth runtime wiring is not present.
2. Approved production issuer, audience/resource, client identity, required scope, and JWKS configuration are not present.
3. Production OAuth callback/token handling remains absent and forbidden.
4. Production server-only account-link persistence is not implemented.
5. No approved exact PR59 implementation file touch set exists.
6. Existing app-facing Convex selectors are still unsafe for direct MCP use.
7. The full production path from AI client bearer token to verified Twoweeks/Convex owner identity to MCP-safe projection is not implemented.

## Approved PR59 Touch Set

None.

Because this preflight returns `BLOCKED`, PR59 must not start and no PR59 code files are approved for implementation.

## Approved Future Data And Ref Classes

The only future data/ref classes that remain approved for consideration are:

```txt
twoweeks.application_package.read -> applicationPackageRef
twoweeks.evidence_graph.read -> evidenceGraphRef
twoweeks.resume_variant_plan.read -> resumeVariantPlanRef
twoweeks.review_cockpit.read -> reviewCockpitRef
```

No other data class or ref class is approved.

## Forbidden Surfaces Confirmation

This preflight does not change or authorize:

- PR59 implementation;
- real data reads;
- Convex reads from MCP;
- Convex writes;
- direct MCP use of existing app-facing Convex selectors;
- OAuth runtime;
- OAuth callback;
- OAuth token exchange, refresh, revocation, or storage;
- production account-link persistence;
- handlers;
- `tools/list` runtime;
- `tools/call` runtime;
- production connector behavior;
- outbound HTTP;
- LLM/model calls;
- package or lockfile changes;
- export/download/send/submit/apply behavior;
- write actions.

Forbidden model-visible fields remain:

- raw CV/resume text;
- raw job description text;
- raw proposal or cover-letter content;
- source text or source quotes;
- private facts;
- `never_use` facts;
- full generated artifacts;
- email;
- `clerkId`;
- `userId`;
- `sessionId`;
- Stytch subject;
- OAuth token, refresh token, raw claims, or bearer token text;
- Convex document IDs as model-visible IDs;
- debug payloads;
- structured shadow payloads.

## Exact Next PR Recommendation

Do not implement PR59 next.

Recommended next PR:

```txt
PR59-prep-7 - Production Stytch OAuth/config and account-link persistence decision
```

Scope:

- docs-only decision or narrowly scoped pre-implementation plan;
- confirm exact production Stytch issuer/audience/resource/client/JWKS/scope configuration;
- confirm whether access tokens are locally verifiable JWTs or require a separately approved outbound introspection path;
- approve the production server-only account-link persistence model;
- name exact future implementation files and tests before any code exists;
- keep real data reads, Convex reads, handlers, production connector behavior, outbound HTTP, token storage, package changes, and write/export/send/apply actions blocked.

PR59 can be reconsidered only after that decision and any required production runtime/persistence prep PRs are merged, and a later preflight returns `READY_TO_IMPLEMENT_NARROW_PR59`.
