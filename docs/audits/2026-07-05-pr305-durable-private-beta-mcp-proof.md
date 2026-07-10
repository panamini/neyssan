# PR305 durable private-beta MCP connector proof

Date: 2026-07-05
Updated: 2026-07-10
Branch: `codex/pr305-durable-private-beta-mcp-endpoint`
Base: `origin/application-os-foundation` at `d158768d28e418aeca5e176e504b8cf79fb1a8c1`
Classification: `PRIVATE_BETA_CONNECTED_READ_ONLY_PROOF`
Live connector state: `CHATGPT_TOKEN_TOOLS_LIST_AND_READ_ONLY_TOOLS_CALL_PROVEN`

## Scope

This is a private-beta MCP connector proof for the durable MCP URL:

`https://mcp.twoweeks.ai/mcp`

It does not grant public launch permission and does not open provider calls, write tools, refresh tokens, billing, account-link lifecycle expansion, production/shared database mutation, or public release behavior.

## Confidential-client configuration

ChatGPT connector OAuth for this endpoint now requires a confidential OAuth client using `client_secret_post`.

Runtime configuration must use digest-only secret storage:

- `MCP_OAUTH_PRODUCTION_RUNTIME`, `MCP_OAUTH_PRODUCTION_APPROVED`, and `MCP_OAUTH_PRODUCTION_ROUTE_WIRING`: exact strict activation flags.
- `MCP_OAUTH_PRODUCTION_CLIENT_IDS`: exact allowlisted ChatGPT OAuth client id.
- `MCP_OAUTH_PRODUCTION_PRIVATE_BETA_ENABLED`: enables the private-beta client gate.
- `MCP_OAUTH_PRODUCTION_PRIVATE_BETA_CLIENT_IDS`: same private-beta client allowlist; must include the exact client id above.
- `MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES`: exact `https://mcp.twoweeks.ai/mcp` resource allowlist.
- `MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256`: lowercase SHA-256 hex digest of the raw client secret.

Do not store the raw client secret in the repo, Dockerfile, logs, PR text, or audit output.

The exact ChatGPT redirect URI remains:

`https://chatgpt.com/connector/oauth/b7v_6OncLEsg`

Wildcard redirect URIs are not allowed.

## Current local proof

Local synthetic Vite proof verifies the confidential-client behavior without using real secrets:

1. With no `MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256` env key, authorization-server metadata advertises `token_endpoint_auth_methods_supported: ["none"]`.
2. With a valid configured digest and matching private-beta client allowlist, metadata advertises exactly `token_endpoint_auth_methods_supported: ["client_secret_post"]`; `client_secret_basic` remains unsupported.
3. With a malformed or empty configured digest, metadata does not downgrade to `["none"]`; the token endpoint requires `client_secret_post` and fails closed with `invalid_request` before quota, Convex, or token issuance.
4. The token endpoint keeps exact `client_id`, `redirect_uri`, `resource`, PKCE, authorization-code validation, and no-refresh-token behavior.
5. Missing or wrong `client_secret` returns a generic `invalid_request` and does not echo secrets, codes, states, tokens, or configured digests.

Focused Vitest coverage lives in:

- `my-app/src/modules/local-mcp/__tests__/mcpOAuthProductionRouteAdapter.test.ts`

## Live ChatGPT proof

The private connector `twoweeks-mcp-pr305-rotated-0710` was proven connected on 2026-07-10 through the durable endpoint and named Cloudflare tunnel.

Observed proof ladder:

- authorization-server metadata returned `200` and advertised `client_secret_post`;
- ChatGPT completed confidential OAuth and `POST /oauth/token` returned `200`;
- MCP `initialize` returned `200` and `notifications/initialized` returned `202`;
- `tools/list` returned `200` with the read-only `search` and `fetch` tools;
- one safe read-only `tools/call` using `search` returned `200` and ChatGPT rendered four safe catalog results.

The first `tools/call` attempt returned `400`; ChatGPT reinitialized the MCP session and the retry returned `200`. This remains a residual behavior to monitor, not a failed proof.

The public metadata URL was also checked:

`https://mcp.twoweeks.ai/.well-known/oauth-authorization-server`

Observed result:

- HTTP status: `200`
- `token_endpoint_auth_methods_supported`: `["client_secret_post"]`

The protected-resource metadata URL was also re-checked:

`https://mcp.twoweeks.ai/.well-known/oauth-protected-resource/mcp`

Observed result:

- HTTP status: `200`
- `resource`: `https://mcp.twoweeks.ai/mcp`

This proves the private connector path through token exchange, tool discovery, and one read-only tool execution. It does not authorize provider calls, writes, refresh tokens, billing, shared database mutation, account-link expansion, or public launch.

## Root cause and durable startup

The final blocker was configuration drift, not ChatGPT callback handling. The runtime had stale `MCP_PRODUCTION_PRIVATE_BETA_*` aliases while active code requires `MCP_OAUTH_PRODUCTION_PRIVATE_BETA_*`. Vite configuration reads server-only values from `process.env`, so placing them only in `my-app/.env.local` did not configure the server plugin.

The durable local contract is:

- root `.env.local`, ignored by Git and mode `600`, owns server-only MCP, Convex admin, and tunnel values;
- `my-app/.env.local` owns client-facing `VITE_*` values only;
- `./run.sh mcp-check` validates canonical keys and formats without printing values;
- `./run.sh mcp-private-beta` starts the exact local-Convex private-beta origin and named tunnel on port `5196`;
- Cloudflare receives the existing named-tunnel credentials through its mode-`400` file mounted read-only, not a command-line token;
- `.dockerignore` excludes all dotenv files from the Docker build context.

## Deployment note

The MCP OAuth server runs in the host Vite process, not the parser container. Load its server values through the root `.env.local` and `run.sh`; do not inject them into the parser image.

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
