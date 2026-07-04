# PR305 durable private-beta MCP connector proof

Date: 2026-07-05
Branch: `codex/pr305-durable-private-beta-mcp-endpoint`
Base: `origin/application-os-foundation` at `d158768d28e418aeca5e176e504b8cf79fb1a8c1`
Classification: `LOCAL_PASS_WITH_LIMITATIONS`

## Scope

This is a proof-only changeset for the durable private-beta MCP connector boundary.

Durable MCP URL: `https://mcp.twoweeks.ai/mcp`

Cloudflare named tunnel:

- name: `neyssan-mcp-pr305-twoweeks-ai`
- id: `935a2064-9473-41bc-bd73-174660892847`
- DNS route: `mcp.twoweeks.ai`

Connector configuration used for the private/dev ChatGPT connector:

- app name: `twoweeks-mcp-pr305-durable`
- URL: `https://mcp.twoweeks.ai/mcp`
- OAuth client id: `local-chatgpt-client`
- client secret: empty
- token endpoint auth method: `none`
- default scope: `twoweeks:applications:read`

## Guardrails

This proof does not grant public launch permission.

This proof does not call providers, model APIs, billing, write tools, refresh tokens, account-link lifecycle expansion, production Convex, or a shared database.

This proof does not expose raw CV/profile/job/proposal text, user emails, Clerk identifiers, OAuth codes, access tokens, state values, redirect secrets, provider secrets, prompt text, file bytes, or Cloudflare tokens.

## Environment corrections discovered

The first live authorize attempt reached `https://mcp.twoweeks.ai/oauth/authorize` but failed safely with `pre_auth_create_failed`.

Direct local probing reproduced the cause as a local Convex admin-auth configuration error: Vite had been started with a fixture admin key. Restarting Vite with the local backend admin key from `~/.convex/convex-backend-state/.../config.json` fixed pre-auth creation.

The first MCP calls after token exchange returned `403` because the Vite process was started with `MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECTS="*"`. The private-beta gate does not support wildcards. Restarting Vite without a subject allowlist kept the gate constrained by approved client id plus resource and allowed the proof to continue.

## Proof ladder

All proof requests went through `https://mcp.twoweeks.ai`, backed by local Vite on `127.0.0.1:5187` and local Convex on `127.0.0.1:3210`.

1. Local route reachability: pass.
   - Protected-resource metadata returned `200`.
   - Resource was `https://mcp.twoweeks.ai/mcp`.
   - Scope was `twoweeks:applications:read`.

2. OAuth authorize and continuation: pass.
   - `/oauth/authorize` returned `303` to `/sign-in`.
   - Browser-bound continuation cookie was set.
   - Authenticated continuation returned the safe ready envelope.
   - Redirect target was a ChatGPT connector OAuth callback.
   - State round trip succeeded.
   - Authorization code was issued.

3. OAuth token exchange: pass.
   - `/oauth/token` returned `200`.
   - Bearer access token was issued.
   - Scope was `twoweeks:applications:read`.
   - No refresh token was issued.

4. MCP initialize: pass.
   - `/mcp` returned `200`.
   - Protocol version was `2025-11-25`.

5. MCP tools/list: pass.
   - `/mcp` returned `200`.
   - Four read-only tools were listed:
     - `twoweeks.application_package.summarize`
     - `twoweeks.evidence_graph.summarize`
     - `twoweeks.resume_variant_plan.summarize`
     - `twoweeks.review_cockpit.summarize`

6. MCP tools/call application package summary: pass.
   - Tool: `twoweeks.application_package.summarize`
   - Safe ref: `mcp-safe-ref:application-package:latest`
   - Result status: `OK`
   - Summary kind: `mcp_application_package_summary_result`
   - Application package status: `available`
   - Response text: `Read-only summary status: OK.`

## ChatGPT UI limitation

The ChatGPT private/dev connector entry was created and displayed the durable URL plus OAuth support. The ChatGPT settings UI later opened an add-connector modal whose visible connect action was disabled, so the final manual ChatGPT callback was not completed through the ChatGPT UI.

This did not block the local/private-beta proof ladder because the same durable hostname, ChatGPT callback shape, OAuth code flow, token endpoint, and MCP bearer calls were proven live through the tunnel.

## Result

`LOCAL_PASS_WITH_LIMITATIONS`

The required local/private-beta route, OAuth, token, MCP initialize, tools/list, and real Convex read-side application-package summary path are proven through the durable `mcp.twoweeks.ai` tunnel.

Remaining limitation: ChatGPT's own connector settings modal did not allow the final UI-driven connect action during this run.

## Rollback

Remove this markdown file. No runtime rollback is required because this PR changes no product code.
