# PR59-prep-7 - Production Stytch OAuth/config and account-link persistence decision

Date: 2026-06-15

Status:

```txt
APPROVE_NARROW_PR59_PREP_8
```

Next PR:

```txt
PR59-prep-8 - Production Stytch verifier/config and server-only account-link persistence boundary
```

Nature:

```txt
code/tests boundary implementation only, no PR59 adapter, no real data reads, no Convex MCP reads, no tool execution, no write/export/send/apply.
```

Fresh PR59 preflight required after PR59-prep-8.

---

## Sources reviewed

- Current roadmap: `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`
- Progress ledger: `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- Fresh PR59 preflight after PR59-prep-6: `docs/plans/2026-06-15-pr59-read-only-twoweeks-data-adapter-preflight-after-prep-6.md`
- Prior PR59 preflight: `docs/plans/2026-06-15-pr59-read-only-twoweeks-data-adapter-preflight.md`
- OAuth/account-linking decisions:
  - `docs/decisions/2026-06-12-auth-oauth-implementation-decision.md`
  - `docs/decisions/2026-06-12-oauth-account-linking-read-only-mcp-decision.md`
  - `docs/decisions/2026-06-12-stytch-account-linking-storage-decision.md`
- Privacy/consent/audit/retention decision: `docs/decisions/2026-06-12-real-data-privacy-consent-retention-audit-policy.md`
- Safe selector projection decision: `docs/decisions/2026-06-14-safe-convex-selector-projection-decision.md`
- Current fixture/local boundaries under `my-app/src/modules/local-mcp/`
- App-facing Convex selectors inspected only: `activeCvSnapshots.ts`, `profilesPublic.ts`, `jobsPublic.ts`, `proposalsPublic.ts`
- Stytch Connected Apps docs:
  - `https://stytch.com/docs/connected-apps/overview`
  - `https://stytch.com/docs/api-reference/consumer/api/connected-apps/tokens/connected-app-access-token-object`
  - `https://stytch.com/docs/connected-apps/oauth-learn-more/oauth-scopes`
  - `https://stytch.com/docs/connected-apps/guides/integrate-with-existing-system`
- OpenAI Apps SDK auth docs: `https://developers.openai.com/apps-sdk/build/auth`
- MCP authorization spec: `https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization`

---

## Decision

PR181 returned `BLOCKED` because PR59 still lacks production Stytch OAuth/config and server-only account-link persistence decisions.

The remaining ambiguity is now resolved enough to allow a narrow implementation PR before PR59:

```txt
Decision:
APPROVE_NARROW_PR59_PREP_8

Next PR:
PR59-prep-8 - Production Stytch verifier/config and server-only account-link persistence boundary

Fresh PR59 preflight required after PR59-prep-8.
```

This does not approve PR59. PR59 remains blocked until PR59-prep-8 is merged and a fresh PR59 preflight returns `READY_TO_IMPLEMENT_NARROW_PR59`.

---

## Provider/auth model

Stytch Connected Apps remains the selected AI-client OAuth/MCP provider.

Clerk remains normal Twoweeks app auth for existing app sessions and ownership records.

Stytch Connected Apps can sit in front of an existing auth system while Stytch handles OAuth client management, consent, and token issuance. That is compatible with the current Twoweeks model where Clerk continues to own normal app login/account identity.

Stytch `sub` must never be treated as Convex `clerkId`.

The approved owner mapping is:

```txt
verified Stytch access-token subject
-> server-only MCP account-link record
-> existing Twoweeks/Convex owner identity
```

The model-visible layer may receive only the already approved opaque refs:

```txt
applicationPackageRef
evidenceGraphRef
resumeVariantPlanRef
reviewCockpitRef
```

---

## Production OAuth verification

Access-token model:

- Stytch Connected Apps access tokens are locally verifiable JWTs.
- The verifier must validate signatures using the configured Stytch project JWKS.
- The accepted signing algorithm is `RS256` only unless a future explicit security decision expands it.
- The verifier must fail closed on missing `kid`, unknown `kid`, malformed JWKS, empty JWKS, unsupported `alg`, invalid signature, missing `sub`, missing `iss`, missing `aud`, missing `client_id`, missing `scope`, expired token, future `nbf`, or malformed claims.

Issuer model:

- The issuer is an exact server-only configured value for the production Stytch environment.
- It must match the Stytch Connected Apps token `iss` exactly.
- Allowed examples are the configured Stytch custom domain issuer or the Stytch project issuer form documented by Stytch.
- No substring, suffix, regex, or environment-default issuer matching is allowed.

Audience/resource validation model:

- The token must be minted for the Twoweeks MCP resource.
- The verifier must require an exact configured audience/resource value in `aud`.
- If Stytch configuration supports a custom access-token audience for the MCP resource, that value is preferred.
- A client-id-only audience is not enough unless a later explicit decision records why Stytch cannot issue a resource-bound audience for this integration.
- Missing, mismatched, array-without-match, or non-string/non-string-array `aud` fails closed.

Client identity validation model:

- The token must include `client_id`.
- `client_id` must exactly match a server-only allowlist of approved AI clients.
- The first approved production client is ChatGPT/OpenAI Apps SDK.
- Additional clients require explicit allowlist updates.
- `azp` may be treated only as an optional corroborating claim; it must not replace `client_id`.

Required Twoweeks scopes:

```txt
twoweeks.mcp.read
twoweeks.application_package.read
twoweeks.evidence_graph.read
twoweeks.resume_variant_plan.read
twoweeks.review_cockpit.read
```

Scope behavior:

- `twoweeks.mcp.read` is required for any MCP read boundary.
- Each data class requires its matching data scope.
- For PR59-prep-8 tests, the verifier/config boundary must prove all five approved scopes can be required and enforced.
- A token lacking the requested class scope fails closed.
- Unknown extra scopes do not grant access.
- OIDC scopes such as `openid`, `profile`, and `email` do not grant Twoweeks data access.
- `offline_access` must not be requested or accepted as a reason to store refresh tokens in PR59-prep-8.

JWKS verification model:

- JWKS must be provided through server-only config or an injected trusted key set.
- PR59-prep-8 must not add runtime JWKS fetching or any outbound HTTP.
- Key material and verifier config must never be model-visible.
- The verifier must not log tokens, raw claims, Stytch subject, `clerkId`, email, or Convex IDs.

Token introspection:

- Token introspection is forbidden in PR59-prep-8.
- Remote introspection and any outbound Stytch/API call require a separate explicit approval.
- The only approved verification path for PR59-prep-8 is local JWT verification.

Outbound HTTP:

- Outbound HTTP remains forbidden in PR59-prep-8.
- No `fetch`, SDK network call, callback exchange, token refresh, revocation call, or introspection call is allowed.

---

## OAuth runtime surfaces

PR59-prep-8 may include only verifier/config boundary code needed to validate production-shaped Stytch Connected Apps access tokens and produce a server-only authorization decision.

Still blocked in PR59-prep-8:

- OAuth callback route
- authorization-code exchange
- token endpoint integration
- refresh-token handling
- token revocation endpoint integration
- token storage
- session creation
- production MCP endpoint auth wiring
- tools/list runtime changes
- tools/call runtime changes
- production connector behavior
- route or handler work

No route/handler work is allowed in PR59-prep-8.

If a route/handler becomes necessary, PR59-prep-8 must stop and record a new explicit decision instead of implementing it.

---

## Account-link persistence

PR59-prep-8 should implement production-ready server-only account-link persistence boundary code. It must not be fixture-only, and it must not read user CV/job/proposal data.

Approved owner mapping:

```txt
verified Stytch subject
-> active server-only account-link record scoped to client_id and granted scopes
-> existing Twoweeks/Convex owner identity
```

Persisted account links may include `clerkId` server-side only. `clerkId` must never be returned to the model, MCP client, tool result, descriptor, public handler, logs, redacted audit payloads, or debug output.

Exact account-link record shape:

```txt
kind: "local_mcp_account_link_record"
version: 1
provider: "stytch"
providerSubject: string
twoweeksClerkId: string
clientId: string
grantedReadScopes: string[]
grantRef: string
consentRef: string
state: "active" | "revoked" | "stale"
createdAt: number
updatedAt: number
lastVerifiedAt: number
revokedAt?: number
staleAt?: number
auditReasonCode: string
```

Storage requirements:

- The record is server-only.
- The record is not model-visible.
- The record must be queryable only by server-side/internal code.
- The record must be unique for `(provider, providerSubject, clientId)` among non-revoked records.
- Ambiguous active matches fail closed.
- Missing, revoked, stale, expired, malformed, client-mismatched, or scope-insufficient records fail closed.
- `grantRef` and `consentRef` are required so consent/audit/retention can reason about the link.
- No OAuth access token, refresh token, raw JWT, raw claims object, session ID, email, raw CV/job/proposal text, private fact, `never_use` fact, source quote, debug payload, structured shadow payload, or Convex data ID may be stored in this account-link record.

Revocation/stale behavior:

- `revoked` denies access immediately.
- `stale` denies access until re-established by a later approved flow.
- State transitions must be auditable with redacted reason codes.
- No automatic real-data read may occur as part of revocation or stale handling.

Audit requirements:

- Audit events must be redacted and bounded.
- Audit events may include event type, client category, scope category, link state, and redacted reason code.
- Audit events must not include Stytch subject, `clerkId`, email, userId, sessionId, token, raw claims, Convex IDs, raw CV/job/proposal text, private facts, `never_use` facts, debug payloads, or structured shadow payloads.

Retention/deletion requirements:

- Account-link records must be revocable and deletable by a later approved production flow.
- PR59-prep-8 may define/delete only the server-only boundary for account-link persistence; it must not expose user-facing deletion UI or handlers.
- Deletion must not require reading or exporting user CV/job/proposal data.

---

## Privacy/security constraints

No model-visible output may contain:

- email
- `clerkId`
- `userId`
- `sessionId`
- Stytch subject
- OAuth access token
- refresh token
- bearer token
- raw claims
- Convex IDs
- raw CV/resume text
- raw job text
- proposal or cover-letter full content
- source text or source quotes
- private facts
- `never_use` facts
- full generated artifacts
- debug payloads
- structured shadow payloads

Consent, audit, retention, account-link, OAuth verification, and safe selector projection boundaries remain required before any real read.

Write/export/send/apply remains blocked.

PR59-prep-8 must not create any user-visible approval, submit, send, apply, export, download, mutation, or write-action path.

---

## Exact next implementation PR

Next PR number/title:

```txt
PR59-prep-8 - Production Stytch verifier/config and server-only account-link persistence boundary
```

Branch:

```txt
codex/pr59-prep-8-production-stytch-account-link-boundary
```

Allowed files:

```txt
my-app/src/modules/local-mcp/mcpProductionStytchOAuthConfigBoundary.ts
my-app/src/modules/local-mcp/mcpProductionAccountLinkPersistenceBoundary.ts
my-app/src/modules/local-mcp/__tests__/mcpProductionStytchOAuthConfigBoundary.test.ts
my-app/src/modules/local-mcp/__tests__/mcpProductionAccountLinkPersistenceBoundary.test.ts
my-app/convex/schema.ts
my-app/convex/mcpAccountLinks.ts
docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md
```

`my-app/convex/schema.ts` and `my-app/convex/mcpAccountLinks.ts` are allowed only for the server-only account-link table/boundary. They must not read or project CV, job, proposal, profile, application, or generated artifact data.

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

- MCP endpoint/transport handlers
- tools/list runtime
- tools/call runtime
- production connector behavior
- OAuth callback/token exchange/refresh/revocation runtime
- token storage
- outbound HTTP
- LLM/model calls
- export/download/send/submit/apply behavior
- write actions
- real user data reads
- app-facing selector reuse

Implementation scope:

- Add production Stytch verifier/config boundary validation.
- Enforce exact issuer, audience/resource, client id, scopes, JWKS, and algorithm requirements.
- Use local JWT verification only.
- Add production account-link record validation and server-only persistence boundary.
- Add account-link lookup decisions that fail closed for missing/revoked/stale/ambiguous/client-mismatch/scope-insufficient records.
- Keep all returned decisions redacted and non-model-visible by default.
- Update the ledger.

Tests to add/update:

- Verifier/config tests for valid config and token.
- Rejection tests for wrong issuer, wrong audience/resource, wrong client id, missing `sub`, missing scopes, expired token, future `nbf`, unsupported `alg`, unknown `kid`, malformed JWKS, malformed claims, and invalid signature.
- Scope tests proving the five approved Twoweeks scopes are enforced.
- Account-link tests for active, missing, revoked, stale, ambiguous, client-mismatched, malformed, and scope-insufficient records.
- Privacy tests proving no token, raw claims, Stytch subject, `clerkId`, email, userId, sessionId, Convex ID, raw CV/job/proposal text, private fact, `never_use` fact, debug payload, or structured shadow payload is emitted.
- Source guards proving forbidden runtime surfaces are not imported or modified.

Source guards:

- No imports from app-facing Convex selectors.
- No `fetch`, `XMLHttpRequest`, Stytch remote SDK call, OpenAI/LLM import, handler registration, route registration, tools/list runtime edit, tools/call runtime edit, export/send/apply code path, or package/lockfile change.
- No log/error path that includes bearer tokens, raw claims, Stytch subject, `clerkId`, email, userId, sessionId, or Convex IDs.

Commands to run:

```txt
rtk git diff --check application-os-foundation...HEAD
rtk git diff --name-only application-os-foundation...HEAD
cd my-app && rtk npx vitest --run src/modules/local-mcp/__tests__/mcpProductionStytchOAuthConfigBoundary.test.ts src/modules/local-mcp/__tests__/mcpProductionAccountLinkPersistenceBoundary.test.ts
cd my-app && rtk npx vitest --run src/modules/local-mcp/__tests__/
cd my-app && rtk npx tsc --noEmit
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Acceptance criteria:

- Changed files match the approved PR59-prep-8 file set.
- No package or lockfile changes.
- No outbound HTTP.
- No OAuth callback, token exchange, refresh, revocation, or token storage.
- No handlers, tools/list runtime, tools/call runtime, production connector behavior, or PR59 adapter.
- No real user data reads.
- No model-visible sensitive identifiers or raw content.
- Tests and TypeScript pass.
- Fallow has no blocking changed-file issue.
- PR59 remains blocked and a fresh PR59 preflight is still the next gate.

Rollback plan:

Revert PR59-prep-8. It should remove only boundary code/tests, optional server-only account-link table/boundary code, and ledger changes. Because PR59-prep-8 must not read real data, wire runtime handlers, store OAuth tokens, or expose write/export/send/apply behavior, rollback should not require data migration beyond removing an unused account-link table if it was introduced before production use.

---

## PR59 readiness

PR59 is not ready.

Do not start PR59 from this decision.

After PR59-prep-8 is implemented and merged, run a fresh PR59 preflight.

PR59 can start only if that future preflight returns:

```txt
READY_TO_IMPLEMENT_NARROW_PR59
```

Until then, PR59 remains blocked.
