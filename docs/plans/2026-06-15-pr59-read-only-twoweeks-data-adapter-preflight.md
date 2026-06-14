# PR59 Preflight Rerun - Read-Only Twoweeks Data Adapter

Date: 2026-06-15
Status: BLOCKED
Scope: preflight report only; no PR59 implementation

Canonical roadmap:

```txt
docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md
```

## 1. Current State

Merged prerequisites:

- PR175 - OAuth account-linking verifier boundary
- PR176 - Stytch account-linking storage decision
- PR177 - Account-linking storage boundary
- PR178 - Safe Convex selector projection decision

Open PRs against `application-os-foundation`:

```txt
none observed during preflight
```

PR59 is the next roadmap PR, but it remains preflight-first and requires explicit maintainer approval before any code.

## 2. Does PR59 require OAuth before any real read-only data adapter code?

Yes.

PR59 would touch real Twoweeks/Convex data. Real data access requires an actual request-to-user ownership path:

```txt
AI client bearer token
-> verified Stytch OAuth subject and client identity
-> server-only account link
-> existing Twoweeks/Convex owner identity
-> safe selector projection
```

Current repo state proves the shape of that path, but not a production path:

- PR175 is a fail-closed verifier boundary with fixture JWTs and injected JWKS keys.
- PR177 is a fixture/server-only account-linking storage boundary.
- No production Stytch issuer/audience/client/JWKS configuration is wired into a runtime.
- No production OAuth callback or token endpoint exists.
- No production account-link persistence exists.

Therefore PR59 cannot read real data yet.

## 3. Can PR59 be implemented safely as boundary-only with opaque refs and no real data access?

No.

Maintainer decision rejected boundary-only PR59 because it would not move the product meaningfully after PR53-PR58.

Boundary-only work remains allowed only as prep work before PR59. PR59 itself should not be implemented as fake-data or opaque-ref-only.

## 4. Are there existing auth-gated read-only selectors in the repo?

Yes, but they are app-facing Clerk selectors, not MCP-safe selectors.

Observed active selectors:

- `my-app/convex/activeCvSnapshots.ts`
  - `getCurrent`
  - `listOptions`
- `my-app/convex/profilesPublic.ts`
  - `get`
  - `getByProfileId`
  - `listMine`
- `my-app/convex/jobsPublic.ts`
  - `getById`
  - `listForUser`
- `my-app/convex/proposalsPublic.ts`
  - default proposal library query

They authenticate with Clerk app identity and/or expose app-facing shapes. They must not be called directly from MCP.

## 5. Which exact data classes would PR59 expose?

Only these four classes are approved for future projection consideration:

```txt
twoweeks.application_package.read
twoweeks.evidence_graph.read
twoweeks.resume_variant_plan.read
twoweeks.review_cockpit.read
```

They map to future refs:

```txt
applicationPackageRef
evidenceGraphRef
resumeVariantPlanRef
reviewCockpitRef
```

No other real-data class is approved.

## 6. Which exact files need to be read?

Already read for this preflight:

- `AGENTS.md`
- `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `docs/decisions/2026-06-12-oauth-account-linking-read-only-mcp-decision.md`
- `docs/decisions/2026-06-12-stytch-account-linking-storage-decision.md`
- `docs/decisions/2026-06-14-safe-convex-selector-projection-decision.md`
- `my-app/src/modules/local-mcp/mcpOAuthAccountLinkingBoundary.ts`
- `my-app/src/modules/local-mcp/mcpAccountLinkingStorageBoundary.ts`
- `my-app/src/modules/local-mcp/mcpDescriptorRegistry.ts`
- `my-app/src/modules/local-mcp/mcpSchemaProjection.ts`
- `my-app/convex/activeCvSnapshots.ts`
- `my-app/convex/profilesPublic.ts`
- `my-app/convex/jobsPublic.ts`
- `my-app/convex/proposalsPublic.ts`

Before any future PR59 code, also read the matching tests for every touched module.

## 7. Which exact files would be touched?

For PR59 implementation: none are approved yet.

Because this preflight is `BLOCKED`, no PR59 code touch set is approved. A future maintainer-approved PR-local brief must name exact files before implementation.

Candidate areas that would require separate approval:

- production OAuth/Stytch runtime configuration;
- production account-link persistence;
- MCP-safe selector projection code;
- tests for fail-closed auth/account-link/selector behavior;
- PR59 adapter code that produces safe refs only.

## 8. What remains forbidden?

Still forbidden without explicit unlocking PR:

- PR59 real-data implementation;
- boundary-only PR59;
- OAuth runtime;
- OAuth callback;
- token storage;
- production account-link persistence;
- direct calls to existing unsafe public Convex selectors from MCP;
- Convex real-data reads/writes from MCP;
- handlers;
- production connector behavior;
- tool execution;
- outbound HTTP;
- LLM/model calls;
- package/lockfile changes;
- export/download/send/submit/apply;
- write actions.

Forbidden model-visible fields remain:

- raw CV/resume text;
- raw job description text;
- raw proposal/cover-letter content;
- source text or source quotes;
- private facts;
- `never_use` facts;
- full generated artifacts;
- email;
- `clerkId`;
- `userId`;
- Stytch subject;
- OAuth token, refresh token, raw claims, or bearer token text;
- Convex document IDs as model-visible IDs;
- debug or structured shadow payloads.

## 9. Decision

```txt
BLOCKED
```

PR59 is not `READY_TO_IMPLEMENT_NARROW_PR59`.

Exact blockers:

1. Production Stytch OAuth verifier wiring is not present.
2. Production issuer/audience/resource/client/JWKS configuration is not approved in repo state.
3. Production account-link storage/persistence is not implemented.
4. Safe Convex selector projection is defined by decision only; no code boundary or selector tests exist yet.
5. No exact PR59 file touch set is approved.
6. Existing app-facing selectors expose raw/sensitive fields and cannot be called directly from MCP.

## 10. Recommended Next Step

Do not implement PR59 yet.

Recommended next maintainer decision:

```txt
Approve a narrow prep PR for MCP-safe selector projection boundary code, or explicitly approve PR59 to include that boundary work.
```

Until then, PR59 remains blocked.
