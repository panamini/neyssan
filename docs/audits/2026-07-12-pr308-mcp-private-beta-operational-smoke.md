# PR308 MCP private-beta operational smoke

Change Contract: `CC-20260712-pr308-mcp-operational-smoke-v2`

## Outcome

`./run.sh mcp-smoke` performs a read-only, no-credential check of the public private-beta boundary. It validates exact OAuth authorization-server metadata, protected-resource metadata, the unauthenticated `initialize` and `notifications/initialized` lifecycle required for mixed-auth discovery, the full HTTP and MCP-body Bearer challenge on an unauthenticated `tools/call`, and a token request without a resource that must fail with `invalid_target`.

The command skips all dotenv and local secret-file loading, including under `bash -x`. It sends no OAuth code, client secret, bearer token, refresh token, user identifier, private document text, or provider input. It never follows redirects, never prints response bodies, keeps a timeout through body consumption, and rejects JSON bodies over 64 KiB.

## Boundary

- No OAuth, MCP tool, scope, redirect, policy, account-link, Convex, or provider behavior changes.
- No login, valid authorization-code exchange, token issuance, `tools/list`, `tools/call`, user-data access, writes, model calls, billing, or public launch.
- HTTP is accepted only for loopback test fixtures; operational origins require HTTPS.

## Verification

- Isolated Node tests use a loopback fixture server and assert exact request paths, Streamable HTTP accept headers, initialize shape/version, exact JSON media types and metadata scopes, parsed Bearer challenge fields, absence of authorization/cookie headers, bounded bodies, and redacted failures.
- The existing doctor trap and metadata-race tests are aligned with the active `READ_ONLY_COMMAND` and `lstatSync` paths.
- The combined root Node suite passes 181/181 with an explicit zero exit status.
- Local Bash and Bash 3.2 syntax checks pass.
- The live no-credential invocation passes against `https://mcp.twoweeks.ai`.
