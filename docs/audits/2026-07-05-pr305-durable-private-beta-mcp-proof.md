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

## Team secret source

The canonical raw client secret is stored in the Infisical EU Cloud project `twoweeks`, environment `dev`, as the shared secret `MCP_OAUTH_PRODUCTION_CLIENT_SECRET`. The committed `.infisical.json` contains only the non-secret project binding, default environment, and EU domain.

Each collaborator authenticates the Infisical CLI with an individual account. The local CLI session is stored in the operating-system keyring and is revocable; it is not the OAuth client secret. After authentication, run:

```text
./run.sh mcp-secret-sync
./run.sh mcp-check
```

`mcp-secret-sync` retrieves the raw value in process memory, validates its shape, computes SHA-256, clears the raw shell variable, and atomically replaces only `MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256` in the mode-`600` root `.env.local`. It prints neither the raw secret nor the digest. Do not run a direct `infisical secrets get --plain` command in recorded terminals, agent conversations, logs, or support artifacts.

If the ChatGPT confidential-client secret is rotated, store the replacement in Infisical first, enter that same raw value once in ChatGPT's secure client-secret field, run `mcp-secret-sync`, and fully restart the private-beta runtime. A digest cannot be reversed to recover the raw secret.

The exact ChatGPT redirect URI remains:

`https://chatgpt.com/connector/oauth/b7v_6OncLEsg`

Wildcard redirect URIs are not allowed.

## Current local proof

Local synthetic Vite proof verifies the confidential-client behavior without using real secrets:

1. With no `MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256` env key, authorization-server metadata still advertises exactly `token_endpoint_auth_methods_supported: ["client_secret_post"]`, while token exchange fails closed with `invalid_request` before quota, Convex, or token issuance.
2. With a valid configured digest and matching private-beta client allowlist, metadata advertises exactly `token_endpoint_auth_methods_supported: ["client_secret_post"]`; `client_secret_basic` remains unsupported.
3. With a malformed or empty configured digest, metadata does not downgrade to `["none"]`; token exchange fails closed at the same boundary.
4. The token endpoint keeps exact `client_id`, `redirect_uri`, `resource`, PKCE, authorization-code validation, and no-refresh-token behavior.
5. Missing or wrong `client_secret` returns a generic `invalid_request` and does not echo secrets, codes, states, tokens, or configured digests.

Focused Vitest coverage lives in:

- `my-app/src/modules/local-mcp/__tests__/mcpOAuthProductionRouteAdapter.test.ts`

## Live ChatGPT proof

The fresh private connector `twoweeks-mcp-pr305-final-0710` was proven connected on 2026-07-10 through the durable endpoint and named Cloudflare tunnel.

Observed proof ladder:

- authorization-server metadata returned `200` and advertised `client_secret_post`;
- a prior sanitized live diagnostic directly observed ChatGPT complete confidential OAuth and `POST /oauth/token` return `200`;
- the fresh final connector reached the connected state, which behaviorally requires a successful token exchange, although its backend token request was not captured directly in the browser trace;
- MCP `initialize` returned `200` and `notifications/initialized` returned `202`;
- `tools/list` returned `200` with the read-only `search` and `fetch` tools;
- one safe read-only `tools/call` using `search` completed successfully in ChatGPT without a connector or reconnection error.

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
- Infisical EU Cloud owns the recoverable raw OAuth client secret; root `.env.local` owns only its derived SHA-256 digest;
- `./run.sh mcp-secret-sync` refreshes that digest from the linked Infisical project without printing either value;
- `my-app/.env.local` owns client-facing `VITE_*` values only;
- `./run.sh mcp-check` validates canonical keys and formats without printing values;
- `./run.sh mcp-check` also proves every canonical server key is defined in the root `.env.local` and rejects those keys in root `.env`, `my-app/.env`, or `my-app/.env.local`;
- for the signed-in browser return, `run.sh` derives the Clerk publishable browser key in memory from the exact Clerk issuer using Clerk's documented key format; it neither prints nor persists the derived value;
- `./run.sh reload-env` reruns the same fail-closed check before restarting a tracked private-beta runtime, so the in-memory Clerk key is recreated on every Vite restart;
- `./run.sh mcp-private-beta` starts the exact local-Convex private-beta origin and named tunnel on port `5196`;
- Cloudflare receives the existing named-tunnel credentials through its mode-`400` file mounted read-only, not a command-line token;
- `.dockerignore` excludes all dotenv files from the Docker build context.

## Deployment note

The MCP OAuth server runs in the host Vite process, not the parser container. Load its server values through the root `.env.local` and `run.sh`; use Infisical only as the team source for the raw OAuth client secret, and do not inject it into the parser image.

Do not bake the raw secret or its digest into a Docker image.

## Rollback

Emergency runtime shutdown is to remove or unset `MCP_OAUTH_PRODUCTION_CLIENT_SECRET_SHA256` and restart the Vite/MCP process. Metadata remains confidential-client `client_secret_post`, but token exchange fails closed; it never downgrades to public-client `none`.

Code rollback requires reverting the PR305 runtime hunks in:

- `my-app/vite.config.ts`
- `my-app/src/modules/local-mcp/mcpOAuthProductionRouteAdapter.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpOAuthProductionRouteAdapter.test.ts`
- `my-app/src/pages/McpOAuthContinuationPage.tsx`
- `my-app/src/pages/__tests__/McpOAuthContinuationPage.test.tsx`

Do not use destructive Git commands when unrelated work exists in the same worktree.
