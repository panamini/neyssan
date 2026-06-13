# PR59-prep - OAuth/account-linking unlock decision for read-only MCP data

Date: 2026-06-14
Status: BLOCKED
Scope: docs-only decision before PR59 real read-only data implementation

## 1. Objective

This decision defines the smallest acceptable OAuth/account-linking unlock before PR59 can expose real read-only Twoweeks data to a ChatGPT/MCP surface.

This PR does not implement OAuth.
This PR does not implement a callback.
This PR does not store tokens.
This PR does not add account-linking code.
This PR does not read real Twoweeks data.
This PR does not touch Convex, handlers, transport, package files, or runtime behavior.

Maintainer decision recorded here:

```txt
Do not implement boundary-only PR59.
Do not implement real-data PR59 before OAuth/account-linking.
Create this docs-only OAuth/account-linking unlock decision before any PR59 code.
```

## 2. Decision summary

Twoweeks should use Clerk as the preferred OAuth/OIDC identity provider only if the configured Clerk OAuth application can satisfy the MCP/OpenAI requirements and least-privilege Twoweeks read scopes.

The selected protocol shape is:

```txt
OAuth 2.1 authorization code + PKCE
ChatGPT as OAuth client
Twoweeks MCP server as OAuth resource server
Clerk as authorization server / IdP
ChatGPT sends Authorization: Bearer <access-token>
Twoweeks validates the bearer token on every request
verified Clerk sub maps to existing Twoweeks/Convex clerkId
```

The decision is BLOCKED because Clerk currently documents that custom OAuth scopes are not yet generally available. Clerk generic identity scopes are not sufficient for least-privilege Twoweeks read-only data access.

The next code PR is not PR59. After the missing provider/config decisions are resolved, the next code PR may only implement a fail-closed OAuth/account-linking verifier boundary with fixture JWTs and injected keys. That code PR must still avoid real data access.

## 3. Sources reviewed

Repository sources:

- `AGENTS.md`
- `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `docs/decisions/2026-06-12-auth-oauth-implementation-decision.md`
- `docs/decisions/2026-06-12-real-data-privacy-consent-retention-audit-policy.md`
- `docs/decisions/2026-06-12-chatgpt-app-mcp-server-architecture-boundary.md`
- `docs/audits/2026-06-12-apps-sdk-runtime-threat-model.md`
- `docs/decisions/2026-06-12-dependency-package-server-skeleton-approval-checkpoint.md`
- `my-app/convex/auth.config.ts`

Official sources checked on 2026-06-14:

- OpenAI Apps SDK Authenticate users: `https://developers.openai.com/apps-sdk/build/auth`
- OpenAI Apps SDK Security and Privacy: `https://developers.openai.com/apps-sdk/guides/security-privacy`
- OpenAI Apps SDK Troubleshooting: `https://developers.openai.com/apps-sdk/deploy/troubleshooting`
- MCP authorization specification, 2025-11-25: `https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization`
- Clerk OAuth SSO / IdP guide: `https://clerk.com/docs/guides/configure/auth-strategies/oauth/single-sign-on`
- Clerk OAuth implementation guide: `https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth`
- Clerk OAuth scoped access guide: `https://clerk.com/docs/guides/configure/auth-strategies/oauth/scoped-access`

Relevant current repo fact:

```txt
my-app/convex/auth.config.ts currently configures Clerk as the Convex auth provider, and active Convex user ownership commonly uses identity.subject as clerkId.
```

## 4. IdP choice

Chosen if unblocked:

```txt
Clerk as OAuth/OIDC identity provider.
```

Reason:

- Twoweeks already uses Clerk identity for the app.
- Convex user ownership already maps to Clerk `identity.subject`.
- Clerk documents support for using Clerk as an OAuth 2.0/OIDC IdP for third-party clients and specifically names MCP servers or AI tools as a supported use case.

Blocker:

```txt
Clerk custom OAuth scopes are not generally available according to current Clerk docs.
```

If Clerk cannot issue, expose, and allow Twoweeks to validate least-privilege Twoweeks read scopes, Clerk cannot satisfy this MCP/OpenAI requirement for PR59 real data. In that case, maintainers must either obtain Clerk early access/custom scope support, approve an equivalent least-privilege claim model, or choose a different OAuth provider for the MCP surface.

## 5. OAuth flow

Selected:

```txt
OAuth 2.1 authorization code + PKCE.
```

Requirements:

- PKCE must use `S256`.
- ChatGPT initiates the OAuth flow when a protected tool requires authorization.
- User authentication and consent happen at Clerk.
- ChatGPT exchanges the code for an access token.
- Twoweeks must not receive authorization codes in this first unlock PR.
- Twoweeks must not implement a callback in this first unlock PR.

## 6. Token transport

Selected:

```txt
Authorization: Bearer <access-token>
```

ChatGPT sends the bearer token to the future Twoweeks MCP resource server on protected requests.

Twoweeks must treat the token as server-only credential material:

- never model-visible;
- never component-visible;
- never returned in errors;
- never logged;
- never persisted;
- never copied into audit payloads.

## 7. Server verification

The future Twoweeks resource server must verify all of these before any real read-only data access:

- issuer matches the approved Clerk OAuth issuer for the active environment;
- audience/resource matches the Twoweeks MCP resource identifier;
- `exp` is present and not expired;
- `nbf`, when present, is satisfied;
- required Twoweeks read-only scopes are present;
- `sub` is present, non-empty, and maps to a Clerk user;
- approved client identity is present, using `client_id`, `azp`, or the provider-approved equivalent;
- token signature is valid if the token is a JWT;
- token introspection says active if Clerk issues opaque access tokens.

The first implementation PR may not perform outbound HTTP. Therefore, if Clerk access tokens cannot be verified locally as JWTs through injected JWKS/key material in tests and configured JWKS in production, the verifier boundary remains blocked until a separate outbound HTTP/introspection decision is approved.

## 8. Account mapping

Selected:

```txt
verified Clerk sub -> existing Twoweeks/Convex clerkId
```

Rules:

- `sub` must be treated as the Clerk user id.
- The server-only auth result may contain `clerkId`.
- `clerkId` must not appear in model-visible output, component-visible output, logs, or audit payloads.
- Auth success does not imply privacy approval, handler execution, tool execution, real-data permission, or write-action permission.
- Unknown, missing, malformed, unverified, or unmapped subjects fail closed.

## 9. Registration mode

Preferred for the first unlock if unblocked:

```txt
pre-registered OAuth client
```

Reason:

- It is the smallest operational model for a known ChatGPT connector.
- Clerk documents OAuth applications created in the Clerk Dashboard with Client ID, Client Secret, discovery URL, authorize URL, token URL, and redirect URI configuration.
- It avoids depending on DCR or CIMD until those are explicitly proven against the configured Clerk instance.

Blocked alternatives:

- DCR remains blocked until maintainers confirm Clerk exposes a suitable `registration_endpoint` for this ChatGPT/MCP use case and that ChatGPT registration succeeds.
- CIMD remains blocked until maintainers confirm Clerk supports `client_id_metadata_document_supported` and can fetch and validate ChatGPT's client metadata document.

Required missing configuration:

- exact ChatGPT connector registration mode;
- exact Clerk OAuth application Client ID;
- exact client authentication expectations for ChatGPT;
- whether `azp`, `client_id`, or another claim identifies the approved ChatGPT client in the access token or introspection response.

## 10. Redirect URI

Decision:

```txt
To verify from ChatGPT app configuration.
```

Rules:

- Do not invent the redirect URI.
- Use the exact ChatGPT/OpenAI-provided redirect URI for the specific connector/app.
- Configure that exact URI in the Clerk OAuth application.
- Record environment-specific redirect URIs before any runtime implementation.

## 11. Scopes

Minimum Twoweeks read-only scopes that would satisfy least privilege:

```txt
twoweeks.mcp.read
twoweeks.application_package.read
twoweeks.evidence_graph.read
twoweeks.resume_variant_plan.read
twoweeks.review_cockpit.read
```

The implementation may collapse the four resource-specific scopes to only `twoweeks.mcp.read` only if maintainers explicitly approve that coarser scope as still least-privilege for the first read-only MCP data slice.

Current blocker:

```txt
Clerk generic scopes are insufficient.
```

Clerk identity/user-info scopes can identify the user, but they do not express Twoweeks resource authorization for read-only application package, evidence graph, resume variant plan, or review cockpit data. Using only generic identity scopes for PR59 real data would violate scope minimization and would make authorization depend on app-side interpretation rather than provider-issued resource permission.

This decision remains BLOCKED until one of these is true:

- Clerk custom OAuth scopes are available and configured for the Twoweeks read scopes above;
- Clerk provides an equivalent provider-supported claim/permission model that Twoweeks can verify fail-closed;
- maintainers choose another OAuth provider that can issue least-privilege Twoweeks resource scopes.

## 12. Token storage

Selected:

```txt
No Twoweeks token storage for the first unlock.
```

Rules:

- ChatGPT and Clerk hold OAuth tokens.
- Twoweeks validates the bearer token per request.
- Twoweeks does not store access tokens.
- Twoweeks does not store refresh tokens.
- Twoweeks does not implement token refresh.
- Twoweeks does not implement token revocation.
- Twoweeks does not write token-derived session records.
- Twoweeks does not log token values or token hashes.

Future persistent connector sessions require a separate retention/deletion/audit decision.

## 13. Implementation path after blockers clear

The next code PR after this decision may only implement:

```txt
fail-closed OAuth/account-linking verifier boundary
fixture JWTs
injected key/JWKS verification
static config validation
safe denial copy
token and subject redaction tests
```

That PR must not implement:

- real data access;
- Convex real-data reads or writes;
- handlers;
- production connector;
- tool execution;
- `/mcp` production runtime;
- OAuth callback;
- OAuth token endpoint;
- token storage;
- outbound HTTP;
- LLM calls;
- export/download/send/submit/apply;
- package or lockfile changes.

The first verifier boundary should prove only that a bearer token can be accepted or denied safely and that an accepted token maps to a server-only `clerkId` auth result. It must not use that auth result to read data.

## 14. Required fail-closed tests for the future verifier PR

The future code PR must include tests proving denial for:

- missing bearer token;
- malformed bearer token;
- unsupported authorization scheme;
- invalid signature;
- missing issuer;
- wrong issuer;
- missing audience/resource;
- wrong audience/resource;
- expired token;
- future `nbf`;
- missing required scope;
- insufficient scope;
- missing `sub`;
- empty `sub`;
- missing approved client identity;
- wrong client identity;
- token material in input, output, error, audit-safe summary, or logs.

It must also include source guards proving the implementation does not import or call:

- Convex APIs;
- real data selectors;
- handlers;
- fetch or outbound HTTP;
- package/runtime connector code;
- export/download/send/submit/apply code;
- LLM/model APIs.

## 15. Explicit non-permissions

This decision does not allow:

- OAuth runtime code;
- OAuth callback;
- OAuth discovery endpoint;
- protected resource metadata endpoint;
- token storage;
- account-linking implementation;
- real data reads;
- Convex reads or writes;
- handlers;
- production connector;
- tool execution;
- outbound HTTP;
- LLM calls;
- export/download/send/submit/apply;
- package or lockfile changes.

It also does not allow boundary-only PR59 or real-data PR59.

## 16. Missing decisions/configuration

The blockers are:

1. Confirm whether Clerk can issue least-privilege custom Twoweeks OAuth scopes for the current instance.
2. If Clerk custom scopes are not available, choose an approved alternative:
   - Clerk early access/custom scope support;
   - provider-supported equivalent claims/permissions;
   - different OAuth provider for the MCP surface.
3. Confirm the exact ChatGPT/OpenAI redirect URI.
4. Confirm the exact registration mode and ChatGPT connector config:
   - pre-registered client;
   - DCR;
   - CIMD.
5. Confirm exact Clerk OAuth application Client ID and approved client identity claim.
6. Confirm issuer/discovery/JWKS URL for the target environment.
7. Confirm token audience/resource claim value for the Twoweeks MCP resource.
8. Confirm access token format:
   - locally verifiable JWT; or
   - opaque token requiring introspection.
9. If introspection is required, approve a separate outbound HTTP and secret-handling decision before implementation.
10. Confirm exact scope strings to require in the first verifier boundary.

## 17. Verification for this docs-only PR

Run:

```bash
rtk git diff --check application-os-foundation...HEAD
rtk git diff --name-only application-os-foundation...HEAD
rtk npx fallow audit --changed-since application-os-foundation --format compact
```

Expected changed files:

```txt
docs/decisions/2026-06-12-oauth-account-linking-read-only-mcp-decision.md
docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md
```

Manual verification:

- Confirm this PR is docs-only.
- Confirm no `my-app/**` files changed.
- Confirm no package or lockfile changed.
- Confirm PR59 remains blocked.
- Confirm the decision is clearly BLOCKED.

## 18. Verdict

```txt
BLOCKED
```

PR59 real-data implementation remains blocked.

Boundary-only PR59 remains rejected by maintainer decision.

The next action is maintainer/provider configuration review, not code.

If blockers are cleared later, the next PR should be a narrow OAuth/account-linking verifier boundary code PR, not PR59 real-data access.
