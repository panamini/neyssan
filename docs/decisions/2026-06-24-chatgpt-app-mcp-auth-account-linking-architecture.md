# PR87.11 ChatGPT App MCP Auth And Account-Linking Architecture

Date: 2026-06-24
Branch: `codex/pr87-11-mcp-auth-account-linking-architecture`
Base: `application-os-foundation`
Status: Accepted for architecture only
Scope: docs-only decision for future ChatGPT Apps SDK MCP account linking

## Status Banner

This decision grants no runtime permission.

Production use is not granted.

PR88 private beta is not approved.

PR89 public launch is not approved.

This decision does not approve OAuth routes, callbacks, token exchange, token storage, provider configuration, production `/mcp`, production `tools/list`, production `tools/call`, real handlers, outbound HTTP, model calls, real-user-data access, live submit/apply, approved-answer copy, provider-verified submission, billing, or Apps SDK submission.

## Context

PR87.10 is merged into `origin/application-os-foundation` at commit `1f121b008296fb47cc13519595e9e0ac0c2e0637`, subject `PR87.10 MCP dev endpoint blocked reachability tests`. The PR87.10 change is limited to `my-app/src/modules/local-mcp/__tests__/localMcpDevEndpoint.test.ts`.

The active MCP/App SDK boundary remains blocked for production. The current `/mcp` surface is a dev-only Vite middleware path behind `LOCAL_MCP_DEV_ENDPOINT=1`, and the local handler returns fixture metadata or safe blocked errors. It is not a production ChatGPT connector.

This ADR decides the future auth and account-linking architecture needed before any first real-data MCP implementation can be proposed.

## Current Repository Evidence

This is active code:

- `my-app/src/main.tsx` uses `ClerkProvider` and `ConvexProviderWithClerk`.
- `my-app/convex/auth.config.ts` configures Convex auth against the Clerk issuer.
- Convex application data ownership uses `ctx.auth.getUserIdentity()` and `identity.subject` as the existing Clerk user key (`clerkId`).
- `my-app/src/modules/local-mcp/localMcpDevEndpoint.ts` is a local, flag-gated, fixture-only dev endpoint.
- `my-app/src/modules/local-mcp/localMcpToolsListFixture.ts` exposes fixture-only tool descriptors and marks them non-callable, non-runnable, and not network reachable.
- `my-app/src/modules/local-mcp/localMcpServerSkeleton.ts` is disabled and has no endpoint, listener, routes, tools, resources, OAuth, UI, outbound calls, LLM calls, export, or production behavior.
- `my-app/src/modules/local-mcp/mcpOAuthAccountLinkingBoundary.ts` and `my-app/src/modules/local-mcp/mcpProductionStytchOAuthConfigBoundary.ts` are boundary/config code only. They are not approval to enable a production connector.
- `my-app/convex/mcpAccountLinks.ts` models a server-only account-link record from an external provider subject to the existing Twoweeks Clerk user.

This is legacy but informative code and documentation:

- `docs/decisions/2026-06-12-oauth-account-linking-read-only-mcp-decision.md` rejected direct Clerk OAuth for the earlier phase because custom OAuth scopes were not available.
- `docs/decisions/2026-06-12-stytch-account-linking-storage-decision.md` selected a server-only account-link record because a Stytch subject is not the same identifier as a Convex Clerk `clerkId`.
- `docs/decisions/2026-06-15-production-stytch-oauth-account-link-persistence-decision.md` kept Stytch Connected Apps as the selected AI-client OAuth path while preserving Clerk for normal application login.

This looks obsolete/dead unless a current call site proves otherwise:

- `pdf-ingest/`
- spaCy or training-oriented parser paths
- backup component trees
- `*.bak` files

## External Requirements Checked

Current OpenAI Apps SDK auth guidance requires an OAuth 2.1-compatible model for authenticated MCP use:

- ChatGPT is the OAuth client.
- The Twoweeks MCP server is the OAuth protected resource and verifies bearer tokens on each request.
- An authorization server issues access tokens and exposes OAuth metadata.
- The protected resource exposes resource metadata and returns `WWW-Authenticate` challenges when auth is required.
- PKCE with S256 is required for public client authorization-code flows.
- The redirect URI for ChatGPT account linking is `https://chatgpt.com/connector/oauth/{callback_id}`.
- Tool-level auth challenges use MCP `_meta["mcp/www_authenticate"]`.

Current MCP authorization guidance requires:

- Bearer tokens in the `Authorization` header.
- Exact validation of issuer, audience/resource, expiration, scopes, and token integrity.
- Resource indicators where supported.
- No token passthrough to downstream services.
- Clear separation between the MCP client, resource server, and authorization server.

Current provider docs checked on 2026-06-24:

- Stytch Connected Apps supports OAuth 2.1-style connected applications, custom scopes/resources, existing-auth integration, and MCP-oriented authorization guidance.
- Clerk OAuth supports OAuth flows, DCR, public clients, consent, and PKCE, but its docs still state custom OAuth scopes are not generally available for the OAuth provider surface.
- WorkOS AuthKit Standalone Connect supports MCP auth and preserving an existing auth stack, including CIMD requirements.
- Auth0 Auth for MCP supports OAuth 2.1/OIDC, discovery, client registration, and resource-scoped tokens.

## Decision Summary

Twoweeks will keep Clerk as the primary application login and existing Convex ownership authority.

For the first real-data ChatGPT MCP connector, Twoweeks will use Stytch Connected Apps as the OAuth authorization-server bridge for ChatGPT account linking, subject to the implementation prerequisites in this ADR.

The Twoweeks MCP server will be the protected resource. It will validate Stytch-issued access tokens on every production MCP request, resolve the immutable Stytch principal through a server-only account-link record, and authorize data access against the existing Twoweeks Clerk user and Convex ownership model.

Direct Clerk OAuth is not selected for the first real-data MCP implementation because the current external requirement is a custom least-privilege scope, `twoweeks:applications:read`, and current Clerk docs do not yet prove support for custom OAuth scopes on the provider surface. Clerk can be reconsidered only if it can satisfy the full acceptance matrix in this ADR.

WorkOS AuthKit Standalone Connect and Auth0 Auth for MCP remain viable fallback providers, but adopting either would require a new provider decision and migration plan because the repo already contains Stytch-shaped boundary code and prior Stytch decisions.

## Roles And Trust Boundaries

ChatGPT:

- OAuth client.
- Initiates account linking.
- Sends access tokens to the MCP resource server.
- Must not be trusted as the source of Twoweeks user identity beyond validated OAuth token claims and resource-server authorization checks.

Stytch Connected Apps:

- Selected authorization-server bridge for the first implementation.
- Owns OAuth client management, consent, authorization code flow, token issuance, key material, and authorization-server metadata for MCP account linking.
- Does not replace Clerk for the normal Twoweeks web application login.

Twoweeks MCP server:

- OAuth protected resource.
- Validates the inbound access token for every MCP request.
- Serves protected-resource metadata.
- Enforces tool-level scopes and account-link ownership.
- Resolves an external principal to a Twoweeks user through server-only link records.
- Returns MCP `mcp/www_authenticate` challenges where tool-level auth is required.

Twoweeks application and Convex:

- Continue using Clerk identity as the primary user authority.
- Continue using existing `clerkId` ownership fields and indexes.
- Must never allow MCP request arguments to select or override the Twoweeks user, workspace, or owner.

## Provider Capability Matrix

| Provider path | Fit | Gaps / risk | Decision |
| --- | --- | --- | --- |
| Direct Clerk OAuth | Strong repo fit because Clerk already backs Twoweeks login and Convex auth. Current Clerk docs show OAuth, DCR, public clients, consent, and PKCE support. | Current docs still do not prove generally available custom OAuth scopes for the provider surface. The first MCP real-data scope must be a custom least-privilege Twoweeks scope. | Not selected for first real-data MCP. Reconsider only after Clerk proves custom scopes, resource/audience validation, ChatGPT redirect support, revocation/unlink behavior, test credentials, and all failure cases. |
| Stytch Connected Apps bridge | Aligns with prior repo decisions and existing boundary code. Current docs support connected apps, existing-auth integration, custom scopes/resources, MCP authorization guidance, and server-side token validation. | Needs an approved Stytch project/environment, exact issuer/audience/resource/JWKS, client registration mode proof, redirect registration, consent UX, unlink/deletion UX, and production test credentials. | Selected architecture for first implementation, with runtime still blocked until prerequisites are met. |
| WorkOS AuthKit Standalone Connect | Current docs support preserving an existing auth stack and MCP auth, including CIMD. | No current repo integration, provider/business decision, data model, or tested boundary code. | Viable fallback only through a new ADR. |
| Auth0 Auth for MCP | Current docs support OAuth 2.1/OIDC, discovery, client registration, and resource-scoped tokens. | Larger tenant/provider decision, migration or bridge design required, and no current repo boundary code. | Viable fallback only through a new ADR. |

## Canonical Resource Identifier

The protected resource identifier must be a stable HTTPS URI for the MCP resource server.

Because this PR does not approve deployment domains, the exact host remains deferred. The future implementation must use one exact canonical resource value per environment:

- non-production: `https://<non-production-mcp-host>/mcp`
- production: `https://<production-mcp-host>/mcp`

The resource value must match:

- protected-resource metadata `resource`;
- authorization-server resource indicators or audience configuration;
- token `aud` or equivalent resource claim;
- `WWW-Authenticate` challenges;
- tests, logs, and runbooks.

No future implementation may invent a production resource hostname inside code without a deployment decision.

## Discovery And Client Registration

The Twoweeks MCP resource server must expose OAuth protected-resource metadata for the canonical resource.

The authorization server must expose OAuth/OIDC metadata sufficient for ChatGPT account linking, including:

- issuer;
- authorization endpoint;
- token endpoint;
- JWKS or introspection mechanism;
- supported response types and grant types;
- PKCE methods including S256;
- supported scopes;
- client-registration mode;
- redirect URI constraints.

Client registration preference order:

1. Client Initiated Metadata Document (CIMD), if supported by the selected provider and accepted by ChatGPT.
2. Dynamic Client Registration (DCR), if CIMD is unavailable.
3. Predefined client registration, only after explicit ops/security approval and test evidence.

Client credentials, service accounts, API keys, shared secrets in ChatGPT prompts, and user-provided bearer tokens are not acceptable substitutes for account linking.

## Scope Model

The first external OAuth scope for real-data MCP is:

```txt
twoweeks:applications:read
```

This scope grants read-only access to the four future summary tools listed below after all runtime gates pass. It does not grant write actions, submission, application mutation, billing, exports, raw private data dumps, arbitrary Convex reads, or provider-side actions.

All four first real-data MCP summary tools require `twoweeks:applications:read`:

- `twoweeks.application_package.summarize`
- `twoweeks.evidence_graph.summarize`
- `twoweeks.resume_variant_plan.summarize`
- `twoweeks.review_cockpit.summarize`

Existing dotted internal boundary scopes such as `twoweeks.mcp.read` and `twoweeks.application_package.read` are not the externally approved PR87.11 scope contract. A future implementation PR must either migrate those constants/tests to `twoweeks:applications:read` or document an explicit compatibility mapping before enabling any runtime.

Future scope expansion requires a new ADR or an explicit update to this ADR.

## Tool Authentication Policy

Unauthenticated protocol discovery may expose only static, non-sensitive metadata that is safe for public connector discovery.

Production real-data `tools/call` must require:

- a valid bearer access token;
- the canonical resource/audience;
- the required OAuth scope;
- an active account link;
- consent and policy checks;
- server-side ownership checks against Convex data.

Production `tools/list` for user-specific tool availability must either be authenticated or limited to non-sensitive static descriptors that reveal no user state, subscription state, profile state, application state, or private workflow state.

The local dev fixture endpoint may remain no-auth only while it is explicitly dev-only, flag-gated, local-request-only, fixture-only, and not reachable as production ChatGPT infrastructure.

## Token Verification Contract

The future MCP resource server must verify access tokens on every request.

Required checks:

- token is provided only through the HTTP Authorization header using the Bearer scheme;
- token type is an access token, not an ID token or refresh token;
- signature validates against the provider JWKS or the token is active through an approved introspection mechanism;
- allowed algorithm set is explicit and rejects `none` and unexpected algorithms;
- `iss` exactly matches the approved provider/environment issuer;
- `aud` or equivalent resource claim exactly matches the canonical resource;
- `exp`, `nbf`, and clock-skew policy are enforced;
- required scope includes `twoweeks:applications:read`;
- subject exists and is stable for the provider;
- authorized client id is allowed for ChatGPT account linking;
- tenant/project/environment matches the configured environment;
- account link exists, is active, is unexpired, is not stale, and maps to exactly one Twoweeks user.

Failed verification must fail closed with no data access. Where protocol-appropriate, the server returns a `401` with `WWW-Authenticate`; for insufficient scope it returns an insufficient-scope challenge; for a valid token with no usable account link it returns a safe reauth/unlink-required error with no private data.

The resource server must not pass the ChatGPT access token through to Convex, Clerk, Stytch management APIs, ATS providers, outbound HTTP, model calls, or logs.

## Account-Linking Identity Model

The immutable external principal key is:

```txt
(issuer, subject)
```

For the selected Stytch path, the external principal is the Stytch token issuer and subject. It is not the same as the existing Clerk `clerkId`.

The server-only account-link record maps:

- provider name;
- issuer;
- subject;
- authorized OAuth client id;
- granted scopes;
- grant or consent reference where safe;
- linked Twoweeks Clerk user id;
- state (`active`, `revoked`, `stale`, or equivalent);
- created, updated, expiry, and last-used timestamps;
- audit reason codes.

The account-link record must not store raw access tokens, refresh tokens, authorization codes, full ID tokens, client secrets, session cookies, or raw provider profile payloads.

Email address, display name, avatar, and other profile fields are display aids only. They must not be durable identity keys and must not silently relink accounts.

One active external principal must map to one Twoweeks user. Ambiguous, duplicate, stale, revoked, expired, or conflicting links fail closed.

## Consent, Revocation, Unlink, Deletion

OAuth account linking is not the same as Twoweeks data consent.

Future implementation must include:

- explicit OAuth consent for `twoweeks:applications:read`;
- Twoweeks-side policy/consent gates before any real data access;
- a user-visible unlink or revoke path;
- server-side handling for revoked or stale provider grants;
- deletion or tombstone behavior for account links when required;
- audit events for link, unlink, stale, revoked, and failed-resolution states.

Revocation must prevent future data access even if a previously issued token is replayed and otherwise appears structurally valid.

## Token Storage Policy

Twoweeks must not persist inbound ChatGPT access tokens, refresh tokens, authorization codes, client secrets, session cookies, or full ID tokens for MCP account linking.

Allowed persistence is limited to server-only account-link metadata required for safe resolution, audit, revocation, and consent checks.

Logs must redact bearer tokens, authorization headers, codes, secrets, provider profile payloads, and raw user data. Structured logs may include non-sensitive reason codes, stable internal request ids, environment, provider, and coarse failure class.

## Environment Separation

Production and non-production must use separate:

- canonical resource identifiers;
- provider projects/environments or tenants;
- issuers;
- JWKS or introspection configuration;
- allowed client ids;
- redirect registrations;
- test users and credentials;
- logs and audit streams.

Non-production account links must not authorize production data. Production tokens must not validate against non-production issuer, resource, client, or key material.

## Failure-State Matrix

| State | Result |
| --- | --- |
| Missing bearer token | `401` with OAuth challenge, no data. |
| Malformed bearer header | `401`, no data. |
| Invalid signature or inactive introspection | `401`, no data. |
| Wrong issuer | `401`, no data. |
| Wrong resource/audience | `401`, no data. |
| Expired or not-yet-valid token | `401`, no data. |
| Missing `twoweeks:applications:read` | insufficient-scope challenge, no data. |
| Unknown client id | `401` or policy failure, no data. |
| Missing account link | reauth/account-link-required error, no data. |
| Duplicate account links | fail closed and emit audit reason, no data. |
| Revoked, stale, or expired link | reauth/unlink-required error, no data. |
| Link maps to deleted or disabled Twoweeks user | fail closed, no data. |
| Tool arguments attempt to override user/workspace | reject request, no data. |
| Provider metadata fetch fails | fail closed unless cached metadata remains valid under an explicit cache policy. |
| JWKS rotation mismatch | fail closed after bounded refresh attempt. |
| Consent missing or stale | consent-required error, no data. |

## Privacy, Logging, And Audit

The first real-data MCP tools may return only minimized summaries required for the user-visible tool purpose. They must not return raw broad profile dumps, full CVs, raw evidence graphs, hidden prompts, internal scoring payloads, secrets, tokens, or arbitrary Convex rows.

Audit records must be sufficient to answer:

- which Twoweeks user was resolved;
- which provider principal was used;
- which tool was called;
- which scope was checked;
- whether consent and account link were active;
- whether the request succeeded or failed;
- the failure reason class.

Audit records must not store bearer tokens or raw private content.

## Security Threats And Mitigations

Token passthrough:

- Mitigation: validate tokens at the MCP resource server and never pass them downstream.

Confused deputy / wrong audience:

- Mitigation: require exact canonical resource/audience validation.

Account takeover through email matching:

- Mitigation: use `(issuer, subject)` and server-only link records, never email as a durable key.

Prompt or tool-argument user override:

- Mitigation: derive owner only from validated token plus account link; reject user/workspace override arguments.

Scope creep:

- Mitigation: freeze first scope to `twoweeks:applications:read`; require new decision for expanded scopes.

Leaked token or auth header:

- Mitigation: no token persistence, auth-header redaction, no raw request logging.

Provider metadata spoofing:

- Mitigation: pin exact issuer/resource/environment and use approved metadata endpoints only.

Replay after unlink:

- Mitigation: require active server-side account link and revocation state on every request.

Local dev endpoint escape:

- Mitigation: keep local endpoint flag-gated, local-only, fixture-only, and not deployed as production.

## Consequences And Trade-Offs

Benefits:

- Preserves the existing Clerk and Convex user model.
- Avoids replacing the normal app login stack.
- Uses an OAuth bridge that can support custom MCP scopes and existing-auth integration.
- Keeps first MCP real-data access read-only and narrow.
- Creates a concrete test contract for future implementation.

Costs:

- Adds a provider bridge and server-only account-link resolution layer.
- Requires reconciliation between prior dotted internal scope constants and the PR87.11 external scope.
- Requires provider environment, metadata, consent, unlink, revocation, and test-credential work before runtime.

## Explicitly Deferred Work

Deferred to later PRs:

- production `/mcp` endpoint;
- protected-resource metadata route;
- authorization-server metadata integration;
- OAuth callback or account-link completion flow;
- token exchange;
- token validation runtime;
- account-link creation UI or server mutation;
- consent UI;
- unlink/revoke UI;
- production `tools/list`;
- production `tools/call`;
- real summary handlers;
- Convex real-data adapter exposure through MCP;
- provider test credentials;
- MCP Inspector, Developer Mode, API Playground, and mobile evidence;
- public domain, CSP, privacy policy, screenshots, app metadata, and submission materials;
- PR88 private beta;
- PR89 public launch.

## Implementation Prerequisites / Future Test Contract

Before a future implementation can enable any real-data MCP runtime, it must prove:

- exact canonical resource identifier per environment;
- exact Stytch issuer, audience/resource, JWKS/introspection, and allowed client ids;
- selected client registration mode with ChatGPT account-linking evidence;
- ChatGPT redirect URI registration;
- protected-resource metadata response;
- authorization-server metadata discovery;
- PKCE S256 behavior;
- `WWW-Authenticate` challenges and MCP `_meta["mcp/www_authenticate"]` behavior;
- access-token verification for issuer, audience/resource, expiry, not-before, signature/active state, algorithm, scope, subject, and client id;
- `twoweeks:applications:read` scope enforcement for all four first tools;
- migration or explicit mapping from existing dotted internal scope constants;
- active account-link resolution from `(issuer, subject)` to the existing Twoweeks Clerk user;
- duplicate, stale, revoked, expired, missing, and conflicting account-link failures;
- no token, code, secret, cookie, auth header, or raw provider payload persistence;
- no token passthrough to downstream systems;
- no user/workspace override from tool arguments;
- consent, unlink, revocation, deletion, and audit behavior;
- redacted logs and failure reason codes;
- negative tests for wrong issuer, wrong audience, missing scope, expired token, invalid signature, unknown client, missing link, duplicate link, revoked link, stale link, and user override attempt;
- rollback steps that disable runtime without leaving account links in an unsafe state.

## Non-Permissions

This ADR does not allow:

- adding or deploying production `/mcp`;
- exposing production `tools/list`;
- exposing production `tools/call`;
- adding OAuth callbacks, token exchange, token storage, or provider secrets;
- enabling real data access through MCP;
- enabling write actions, submit/apply, provider submission, billing, exports, or model calls;
- adding outbound HTTP through MCP;
- changing production deployment configuration;
- submitting to ChatGPT review;
- opening PR88 or PR89.

## Rollback

Rollback for this PR is deletion of this ADR and any blocker-register link to it.

No runtime rollback is needed because this PR changes no runtime behavior.

## References

- OpenAI Apps SDK auth: `https://developers.openai.com/apps-sdk/build/auth`
- OpenAI Apps SDK MCP server: `https://developers.openai.com/apps-sdk/build/mcp-server`
- OpenAI Apps SDK testing: `https://developers.openai.com/apps-sdk/deploy/testing`
- MCP authorization draft: `https://modelcontextprotocol.io/specification/draft/basic/authorization`
- MCP security best practices: `https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices`
- Stytch Connected Apps overview: `https://stytch.com/docs/connected-apps/overview`
- Stytch MCP auth overview: `https://stytch.com/docs/connected-apps/guides/mcp-auth-overview`
- Stytch custom scopes: `https://stytch.com/docs/connected-apps/oauth-learn-more/oauth-scopes`
- Stytch existing-auth integration: `https://stytch.com/docs/connected-apps/guides/integrate-with-existing-system`
- Clerk OAuth provider docs: `https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth`
- Clerk scoped access docs: `https://clerk.com/docs/guides/configure/auth-strategies/oauth/scoped-access`
- WorkOS MCP auth: `https://workos.com/docs/authkit/mcp`
- WorkOS Standalone Connect: `https://workos.com/docs/authkit/connect/standalone`
- Auth0 Auth for MCP overview: `https://auth0.com/ai/docs/mcp/intro/overview`
