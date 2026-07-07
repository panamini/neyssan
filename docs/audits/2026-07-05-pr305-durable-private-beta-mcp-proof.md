# PR305 durable private-beta MCP connector proof

Date: 2026-07-05
Updated: 2026-07-07
Branch: `codex/pr305-durable-private-beta-mcp-endpoint`
Base: `origin/application-os-foundation` at `d158768d28e418aeca5e176e504b8cf79fb1a8c1`
Classification: `LOCAL_PASS_WITH_LIMITATIONS`
Live connector state: `BLOCKED_ORIGIN_530`

## Scope

This is a private-beta MCP connector proof for the durable MCP URL:

`https://mcp.twoweeks.ai/mcp`

It does not grant public launch permission and does not open provider calls, write tools, refresh tokens, billing, account-link lifecycle expansion, production/shared database mutation, or public release behavior.

## Confidential-client configuration

ChatGPT connector OAuth for this endpoint now requires a confidential OAuth client using `client_secret_post`.

Runtime configuration must use digest-only secret storage:

- `MCP_OAUTH_PRODUCTION_CLIENT_IDS`: exact allowlisted ChatGPT OAuth client id.
- `MCP_PRODUCTION_PRIVATE_BETA_CLIENT_IDS`: same private-beta client allowlist; must include the exact client id above.
- `MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256`: lowercase SHA-256 hex digest of the raw client secret.

Do not store the raw client secret in the repo, Dockerfile, logs, PR text, or audit output.

The exact ChatGPT redirect URI remains:

`https://chatgpt.com/connector/oauth/b7v_6OncLEsg`

Wildcard redirect URIs are not allowed.

## Current local proof

Local synthetic Vite proof verifies the confidential-client behavior without using real secrets:

1. With no `MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256` env key, authorization-server metadata advertises `token_endpoint_auth_methods_supported: ["none"]`.
2. With a valid configured digest and matching private-beta client allowlist, metadata advertises `token_endpoint_auth_methods_supported: ["client_secret_post"]`.
3. With a malformed or empty configured digest, metadata does not downgrade to `["none"]`; the token endpoint requires `client_secret_post` and fails closed with `invalid_request` before quota, Convex, or token issuance.
4. The token endpoint keeps exact `client_id`, `redirect_uri`, `resource`, PKCE, authorization-code validation, and no-refresh-token behavior.
5. Missing or wrong `client_secret` returns a generic `invalid_request` and does not echo secrets, codes, states, tokens, or configured digests.

Focused Vitest coverage lives in:

- `my-app/src/modules/local-mcp/__tests__/mcpOAuthProductionRouteAdapter.test.ts`

## Live public endpoint status

The public metadata URL was checked on 2026-07-07:

`https://mcp.twoweeks.ai/.well-known/oauth-authorization-server`

Observed result:

- HTTP status: `530`
- Cloudflare error: `1033`

This means the durable public origin is not currently reachable from Cloudflare to the origin. ChatGPT connector activation is therefore not proven connected on the live endpoint in this run.

## Not yet proven

The following are not proven by this PR state:

- ChatGPT connector UI reaches `/oauth/token`.
- ChatGPT connector activation completes.
- ChatGPT `tools/list` works through the connector.
- ChatGPT `tools/call` works through the connector.

Do not report those as connected until the public endpoint returns metadata with `client_secret_post`, ChatGPT completes OAuth with the configured secret, and `tools/list` plus a read-only `tools/call` are observed through ChatGPT.

## Deployment note

For Docker or another process manager, inject the three confidential-client env vars at runtime with an env file, systemd `Environment=`, Docker `--env-file`, or Compose `env_file`.

Do not bake the raw secret or its digest into a Docker image.

## Rollback

Runtime rollback is to remove or unset `MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256` and restart the Vite/MCP process, which returns metadata to the public-client `["none"]` behavior.

Code rollback requires reverting the PR305 runtime hunks in:

- `my-app/vite.config.ts`
- `my-app/src/modules/local-mcp/mcpOAuthProductionRouteAdapter.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpOAuthProductionRouteAdapter.test.ts`
- `my-app/src/pages/McpOAuthContinuationPage.tsx`
- `my-app/src/pages/__tests__/McpOAuthContinuationPage.test.tsx`

Do not use destructive Git commands when unrelated work exists in the same worktree.
