# PR308 MCP private-beta operational smoke

Change Contract: `CC-20260712-pr308-mcp-operational-smoke-v1`

## Outcome

`./run.sh mcp-smoke` performs a read-only, no-credential check of the public private-beta boundary. It validates exact OAuth authorization-server metadata, protected-resource metadata, the unauthenticated `initialize` response required for mixed-auth discovery, the Bearer challenge on an unauthenticated `tools/call`, and a token request without a resource that must fail with `invalid_target`.

The command sends no OAuth code, client secret, bearer token, refresh token, user identifier, private document text, or provider input. It never follows redirects, never prints response bodies, keeps a timeout through body consumption, and rejects JSON bodies over 64 KiB.

## Boundary

- No OAuth, MCP tool, scope, redirect, policy, account-link, Convex, or provider behavior changes.
- No login, valid authorization-code exchange, token issuance, `tools/list`, `tools/call`, user-data access, writes, model calls, billing, or public launch.
- HTTP is accepted only for loopback test fixtures; operational origins require HTTPS.

## Verification

- Isolated Node tests use a loopback fixture server and assert exact request bodies plus redacted failures.
- `run.sh` syntax and dispatch are checked separately.
- A live invocation is optional operational evidence and must remain no-credential/read-only.
