# PR87.17C2 - MCP OAuth Pre-Auth Ownership Decision

Date: 2026-06-26
Status: proposed for PR87.17C2 review
Scope: architecture decision only for `CLERK_OWNER_CONTEXT_GAP`
Decision marker: `TWO_PHASE_PREAUTH_INTENT_REQUIRED`

## Status Banner

This decision grants no runtime permission.

This decision does not add route wiring, React UI, Stytch consent, token exchange, authorization-code issuance, account-link creation, Convex schema changes, Convex mutations, production behavior, staging flag changes, PR88, PR89, cover-letter work, package changes, or lockfile changes.

## Problem

ChatGPT can start the MCP OAuth authorization-code flow before the user has an authenticated Twoweeks session. The inbound authorization request still has to preserve `client_id`, `redirect_uri`, `resource`, `scope`, `state`, and PKCE values across user authentication.

The current Twoweeks OAuth continuation chain is intentionally owner-bound. PR87.17A requires a trusted Twoweeks owner in the normalized authorization handoff. PR87.17B stores authorization intents with `twoweeksClerkId`. PR87.17C1 prepares and resumes continuation only when the same trusted owner is present.

Therefore a route that receives an unauthenticated OAuth authorization request cannot safely call the current PR87.17A/PR87.17B/PR87.17C1 chain without first inventing an ownerless or claimable intent model. That is an architecture/security decision, not a small route-wiring bug.

## Current Facts

This is active code.

- `my-app/src/main.tsx` mounts Clerk and `ConvexProviderWithClerk`; current app identity is Clerk-backed.
- `my-app/convex/auth.config.ts` configures Convex auth against Clerk.
- `my-app/src/modules/local-mcp/mcpOAuthAuthorizationRequestBoundary.ts` defines `McpOAuthAuthorizationTrustedOwnerV1` with `twoweeksClerkId` and includes `trustedOwner` in the server-only handoff.
- `my-app/convex/mcpOAuthAuthorizationIntents.ts` validates and stores `trustedOwner.twoweeksClerkId`, rejects consume when the stored owner differs, uses digest-only handles, and expires pending intents.
- `my-app/src/pages/sign-in-return.ts` defines only the fixed `/mcp/oauth/authorize/continue?mcp_oauth_intent=<handle>` return convention and falls back to `/cv` for unsafe input.
- `my-app/src/modules/local-mcp/mcpOAuthLoginReturnContinuationBoundary.ts` requires `trustedOwner` for both prepare and resume, checks same-owner handoff continuity, and maps mismatched owner/intent to a generic failure.
- `my-app/src/App.tsx` already reserves the fixed continuation route, but the placeholder page does not consume storage, call providers, issue codes/tokens, or create account links.

Durable checkpoint evidence:

- PR265 / PR87.17A recorded the server-only OAuth authorization-request boundary and explicitly did not add OAuth callback/code exchange, consent UI, token persistence, public account-link API, endpoint/Vite wiring, real provider network calls, or production MCP behavior.
- PR267 / PR87.17B recorded owner-bound one-time authorization-intent storage and explicitly did not add any route, login UI, OAuth callback, provider network calls, public Convex function, production behavior, PR88, or PR89.
- PR268 / PR87.17C0 recorded the sign-in return convention only: default `/cv`, fixed MCP continuation path, opaque `mcp_oauth_intent`, and no provider integration or Convex behavior.
- PR269 / PR87.17C1 recorded server-only prepare/resume continuation behavior only: CSPRNG raw handles, SHA-256 digest storage semantics, one-time owner-bound resume, and no route wiring, Clerk/Stytch calls, token/code/account-link behavior, or production OAuth runtime.

External requirements checked on 2026-06-26:

- OpenAI Apps SDK authentication expects ChatGPT to act as the MCP OAuth client, use authorization-code flow with PKCE S256, append `resource` to authorization and token requests, and send bearer tokens to the MCP server after token exchange: <https://developers.openai.com/apps-sdk/build/auth>.
- MCP authorization requires protected resource metadata, OAuth 2.1-style authorization, `resource` in authorization and token requests, bearer-token use, audience/resource validation, token theft controls, PKCE, and open-redirect defenses: <https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization>.
- Stytch Connected Apps can work with an existing auth system, but the existing-auth path still relies on an existing user session or a JWT from the current auth system before Stytch consent/token issuance can safely complete: <https://stytch.com/docs/connected-apps/guides/integrate-with-existing-system> and <https://stytch.com/docs/connected-apps/build-login-flow/login-flow>.

## Options

### A. Require Twoweeks sign-in before accepting the ChatGPT OAuth request

The authorization endpoint refuses to persist anything until a trusted Clerk owner exists.

Pros:

- Preserves the current owner-bound storage model.
- Avoids claimable ownerless records.
- Keeps account-link ownership simple.

Cons:

- Does not preserve the first inbound ChatGPT OAuth request unless the request is kept somewhere else.
- Can force the user to restart account linking after sign-in.
- Risks poor ChatGPT linking UX if the initial request is lost.

Decision:

Not selected as the primary path because it does not solve request preservation for the external OAuth flow.

### B. Add a two-phase pre-auth intent

Phase 1 stores a short-lived, ownerless `pre_auth_pending` authorization request after validation, without consent, account-link, code, token, or owner. Phase 2 binds that record to a trusted Clerk owner after sign-in and converts it to `owner_bound_pending`, after which existing owner-bound PR87.17B/PR87.17C1 semantics may continue.

Pros:

- Preserves ChatGPT OAuth request state across Twoweeks sign-in.
- Avoids inventing owner data before Clerk proves the owner.
- Keeps provider consent, account-link creation, authorization-code issuance, and token exchange blocked until owner binding succeeds.
- Gives future route implementation a precise security contract.

Cons:

- Requires a new storage contract and threat model.
- Introduces handle-theft, claiming, cleanup, and oracle risks that must be tested fail-closed.
- Requires careful separation between pre-auth and owner-bound states.

Decision:

Selected as the recommended path: `TWO_PHASE_PREAUTH_INTENT_REQUIRED`.

### C. Reject pre-auth continuation and require restart after sign-in

The unauthenticated route rejects the request and instructs the user to sign in first, then restart ChatGPT OAuth linking.

Pros:

- Smallest runtime model.
- No ownerless storage.
- No claim flow.

Cons:

- Poor linking UX.
- Does not meet the expected authorization-code flow shape where the request that ChatGPT starts must be preserved through user authentication.
- Still needs explicit failure UX and restart semantics.

Decision:

Valid fallback if the two-phase model is rejected, but not selected.

### D. Delegate to Stytch existing-auth consent without Twoweeks pre-auth storage

Use the Stytch Connected Apps existing-auth flow directly after Twoweeks has a logged-in user/session or a trusted auth token from the existing identity system.

Pros:

- Matches Stytch's existing-auth integration model.
- Keeps Stytch responsible for OAuth client management, user consent, and token issuance once Twoweeks has identified the user.

Cons:

- Does not by itself preserve an unauthenticated ChatGPT authorization request before Twoweeks knows the Clerk owner.
- Still requires Twoweeks to decide how the inbound request reaches the logged-in consent step.
- Cannot replace Twoweeks owner binding or account-link guardrails.

Decision:

Use only after Twoweeks owner binding. It is a phase-2 provider/consent path, not a replacement for the pre-auth ownership decision.

## Security Analysis

Owner confusion risk:

- A pre-auth record must contain no `twoweeksClerkId`, email, Clerk subject, Stytch subject, account-link id, or inferred owner.
- Only a server-side operation running after Clerk authentication may bind the trusted owner.
- The bound owner must be derived from current Clerk/Convex auth context, never from query parameters, OAuth `login_hint`, email, ChatGPT request arguments, or model-visible data.

Handle theft risk:

- The raw pre-auth handle must be high entropy, one-time, and short-lived.
- Storage should persist only a digest of the handle unless a future implementation proves a stronger need.
- A stolen pre-auth handle must not be enough to create consent, issue a code/token, or create/link an account.

OAuth state and PKCE preservation:

- The pre-auth record may store only the validated OAuth request fields required to reconstruct/continue the authorization flow.
- `state`, `code_challenge`, `code_challenge_method`, `resource`, `client_id`, `redirect_uri`, and approved scopes must be preserved exactly after validation.
- The PKCE method must remain `S256`.

Replay prevention:

- Both pre-auth and owner-bound handles must be one-time consumable.
- Consumed, expired, duplicated, malformed, or mismatched records must fail closed with generic responses.

Intent claiming risk:

- Claiming must convert exactly one unowned `pre_auth_pending` record into one `owner_bound_pending` record.
- Claiming must require the raw handle and current trusted Clerk owner.
- A pre-auth record must not be claimable after expiry, after consumption, after status transition, or across incompatible environment/resource configuration.

Existence oracle risk:

- Missing, expired, already consumed, mismatched, malformed, and forbidden handles should collapse into safe generic errors.
- Logs must avoid raw handle, owner id, email, token, state, redirect URI query, and sensitive optional parameter values.

Email identity risk:

- Email, `login_hint`, `id_token_hint`, or Stytch/ChatGPT profile data must not be treated as Twoweeks owner authority.
- Email may only be provider context after owner binding and only if a later provider slice approves it.

Session fixation risk:

- Sign-in return must remain restricted to the fixed continuation path.
- Owner binding must use the post-login Clerk session, not a pre-login session id or caller-supplied owner.

Open redirect risk:

- The current `mcp_oauth_return` allowlist must remain fixed to `/mcp/oauth/authorize/continue`.
- OAuth `redirect_uri` must remain separately validated against approved ChatGPT/provider redirect URIs.
- No arbitrary `returnTo`, external URL, fragment, protocol-relative URL, or encoded external redirect may be introduced.

Stale intent cleanup:

- Pre-auth records need short TTL, bounded cleanup, and status transitions that cannot resurrect expired records.
- Cleanup must not expose whether a specific owner or email exists.

Account-link creation guardrails:

- Pre-auth records cannot call Stytch consent, create account links, issue authorization codes, exchange tokens, persist tokens, or read real application data.
- Only `owner_bound_pending` can enter the future provider consent/account-link path.
- Account-link creation still requires a later reviewed slice and must bind the Stytch/provider subject to the trusted Twoweeks Clerk owner server-side.

## Decision

Recommend `TWO_PHASE_PREAUTH_INTENT_REQUIRED`.

Future route wiring may create only a pre-auth OAuth request intent before Twoweeks knows the owner. That pre-auth intent stores the validated OAuth authorization request and no owner. It cannot be consumed into provider consent, cannot create an account link, cannot issue an authorization code, cannot exchange or store tokens, cannot read real user data, and cannot enable production MCP.

After Clerk sign-in, a server-side operation may bind the current trusted `twoweeksClerkId` and convert the record to owner-bound pending state. Only the owner-bound pending state can continue to Stytch consent/provider handling or PR87.17B/PR87.17C1-style owner-bound continuation in a later approved slice.

## Required Future Slices

- PR87.17C3: define and test the pre-auth OAuth request intent storage contract.
- PR87.17C4: define and test the owner-binding continuation adapter after sign-in.
- PR87.17D: add local/dev route adapter using the approved two-phase model.
- Later: Stytch consent UI / provider page.
- Later: non-production end-to-end OAuth smoke.
- Production, PR88, and PR89 remain blocked.

## Explicit Non-Permissions

This PR does not allow:

- adding a route;
- wiring the existing route to storage;
- adding UI beyond existing placeholders;
- changing Convex schema;
- adding Convex mutations;
- adding Stytch integration;
- issuing or exchanging authorization codes;
- storing tokens;
- creating account links;
- changing production or staging flags;
- adding MCP production behavior;
- touching cover-letter code;
- modifying package manifests or lockfiles;
- opening PR88 or PR89.

## Acceptance Criteria For Later Implementation

The next implementation slice must not invent ownership behavior. It must state which state it is operating on:

- `pre_auth_pending`: validated request only, no owner, no provider consent, no account-link, no code/token, short TTL, one-time handle.
- `owner_bound_pending`: current trusted Clerk owner has claimed the pre-auth record server-side, allowing future owner-bound continuation.

Any route implementation that tries to call the current PR87.17B/PR87.17C1 owner-bound chain before a trusted owner exists must stop with `PREAUTH_OWNERSHIP_DECISION_REQUIRED`.

## Rollback

Delete this file:

```txt
docs/decisions/2026-06-26-mcp-oauth-preauth-ownership-decision.md
```

No runtime rollback is required because this decision changes no application code, schema, config, package files, flags, or production behavior.
