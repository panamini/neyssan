# PR87.17C0 - Login Return Convention For Local/Dev MCP OAuth Continuation

Date: 2026-06-26
Status: implemented convention
Scope: sign-in return boundary only

## Decision

The repository-owned login return convention is `mcp_oauth_return` on the active `/sign-in/*` route.

Normal sign-in keeps `/cv` as the default authenticated destination.

The only non-default destination accepted by `/sign-in/*` is:

```txt
/mcp/oauth/authorize/continue?mcp_oauth_intent=<opaque-base64url-ish-handle>
```

The continuation route is a fixed internal path reserved for the local/dev MCP OAuth authorization flow. PR87.17C may rely on this contract after PR87.17C0 is merged.

## Rejection Rules

`mcp_oauth_return` falls back to `/cv` when it is absent, duplicated, empty, too long, malformed, or points anywhere except the fixed MCP OAuth continuation path.

The resolver rejects:

- external URLs;
- protocol-relative URLs;
- absolute URLs;
- encoded external URLs;
- encoded protocol-relative URLs;
- malformed paths;
- fragments;
- arbitrary app paths;
- unknown continuation parameters;
- duplicated continuation handles;
- unsafe continuation handles.

## Implementation Boundary

This slice changes only the active `SignInPage` return target and its pure resolver.

It does not implement:

- OAuth authorization endpoint behavior;
- OAuth callback behavior;
- Convex reads or writes;
- MCP endpoint or runtime composition;
- account-link lifecycle;
- Vite routing changes;
- production flags.

## Active Code Path

- `/sign-in/*` is routed to `SignInPage`.
- `SignInPage` now resolves the destination from `mcp_oauth_return`.
- Authenticated users navigate to the resolved destination.
- Clerk `SignIn` receives the same resolved destination for both `forceRedirectUrl` and `fallbackRedirectUrl`.
- Invalid or missing return input resolves to `/cv`.
