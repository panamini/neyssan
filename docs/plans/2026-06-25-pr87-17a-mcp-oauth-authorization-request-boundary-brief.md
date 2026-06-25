# PR87.17A - MCP OAuth Authorization Request Boundary Brief

## Purpose

Add a pure, non-production OAuth authorization-request boundary for the future MCP account-linking authorization page.

The boundary parses an incoming authorization-page URL, validates the local request shape, binds the provider-pending request to a separately trusted Twoweeks owner, and returns a server-only handoff for a future short-lived intent store and Stytch consent page.

It does not grant authorization, create an account link, call providers, persist intent, register routes, or wire runtime behavior.

## PR87.17A Boundary

This slice only defines the local authorization-request parser and server-only handoff contract needed before a future authorization page can be wired.

## External Contract Notes

- OpenAI Apps SDK auth guidance expects ChatGPT OAuth requests to carry `resource`, use authorization-code flow, and require PKCE `S256`.
- MCP authorization requires the OAuth `resource` parameter to identify the canonical MCP protected resource.
- Stytch Connected Apps existing-auth guidance expects the application-hosted authorization page to preserve the exact OAuth query parameters while a user signs in, then return to the authorization page for provider processing.
- Stytch MCP guidance shows the authorization request carrying `client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`, `code_challenge`, and `code_challenge_method=S256`.

## Client ID Policy

PR87.17A uses an explicit non-production `predefined_allowlist` policy in configuration.

Supporting repo evidence:

- `localMcpDevAuthConfig.ts` already requires `allowedClientIds`.
- `mcpStytchBearerVerifierBoundary.ts` and `mcpAuthRequestOrchestrator.ts` already require allowed client IDs for token/resource-server authorization.
- PR264 lifecycle config already requires `allowedClientIds`.

This does not select a production client-registration mode. The handoff marks provider validation as `pending` and explicitly records that client registration, provider redirect validation, consent, authorization code, token issuance, Stytch subject resolution, and account-link creation have not happened.

## Scope Policy

- Required scope: `twoweeks:applications:read`.
- Legacy dotted scopes are rejected.
- Write scopes and unapproved extra scopes are rejected.
- Optional OIDC scopes default to none and are accepted only when explicitly configured.

## Redirect And Resource Policy

- Authorization page origin and path must match the configured boundary exactly.
- Redirect URI must exactly match one configured URI; no wildcard, prefix, suffix, credentialed, fragment, or lookalike matching is allowed.
- Resource must exactly equal the configured canonical MCP resource.

## Sensitive Values

The handoff keeps `state`, PKCE challenge, optional `id_token_hint`, optional `login_hint`, redirect URI, client ID, and trusted owner inside `serverOnly`.

Failure outputs are generic and do not echo the raw URL, query string, state, PKCE challenge, ID token hint, client ID, redirect URI, trusted owner, or email-like values.

## Non-Permissions

PR87.17A does not add:

- public `/oauth/authorize`;
- any OAuth route;
- React authorization page;
- Stytch or Clerk SDK integration;
- OAuth callback;
- authorization-code exchange;
- token endpoint behavior;
- account-link mutation wiring;
- Convex query, mutation, schema, or index changes;
- Vite middleware;
- network calls;
- storage;
- production MCP;
- staging/production flags;
- cover-letter changes;
- PR88 or PR89.

## Rollback

Revert this PR.

No provider, token, account-link, schema, deployment, staging, production, or user-data rollback is required because this slice is pure and unwired.
