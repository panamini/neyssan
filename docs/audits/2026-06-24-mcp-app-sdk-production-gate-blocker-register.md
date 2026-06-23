# PR87.9 MCP/App SDK Production Gate Blocker Register

Date: 2026-06-24
Branch: `codex/pr87-9-mcp-production-gate-register`
Base: `application-os-foundation`
Scope: docs-only MCP/App SDK production gate blocker register

## Status banner

This PR is docs-only.

This PR grants no runtime permission.

This PR grants no production permission.

This PR grants no PR88 private beta permission.

This PR grants no PR89 public launch permission.

No package, Convex, runtime, source, config, test, production, cover-letter, billing, OAuth, provider, or Apps SDK exposure change is approved here.

## Current repo state

The active MCP/App SDK boundary remains blocked for production:

- The local MCP server skeleton is disabled/local-only, with no endpoint, listener, routes, listed tools, callable tools, resources, OAuth, outbound HTTP, LLM calls, export/download/send/submit/apply, or production behavior. Evidence: `my-app/src/modules/local-mcp/localMcpServerSkeleton.ts:1-31`, `my-app/src/modules/local-mcp/localMcpServerSkeleton.ts:89-129`.
- The dev `/mcp` request handler is guarded by an explicit enabled flag, returns disabled when not enabled, requires a local request, and refuses real `tools/call` execution. Evidence: `my-app/src/modules/local-mcp/localMcpDevEndpoint.ts:33-46`, `my-app/src/modules/local-mcp/localMcpDevEndpoint.ts:69-95`, `my-app/src/modules/local-mcp/localMcpDevEndpoint.ts:117-124`, `my-app/src/modules/local-mcp/localMcpDevEndpoint.ts:186-205`.
- Vite registers the local MCP middleware only when `LOCAL_MCP_DEV_ENDPOINT=1`; this is dev middleware, not a production transport. Evidence: `my-app/vite.config.ts:13-25`, `docs/plans/2026-06-21-pr87-production-deployment-gate.md:105-111`.
- PR80B manual handoff remains the safe delivery boundary while ATS authorization is pending. Live submit/apply remains blocked, approved-answer production behavior remains blocked, and `provider_verified_submitted` remains unreachable. Evidence: `/Volumes/video/git/twoweeks-wiki/wiki/product/manual-application-handoff.md:16-24`, `/Volumes/video/git/twoweeks-wiki/wiki/product/manual-application-handoff.md:69-79`.
- PR87.8 returned `PR87_8_GATE_STILL_BLOCKED`; production MCP endpoints, production `tools/list`, production `tools/call`, OAuth/account linking, real handlers, outbound HTTP/model calls through MCP, live submit/apply, approved-answer copy, reachable `provider_verified_submitted`, production billing, PR88, and PR89 remain blocked. Evidence: `/Volumes/video/git/twoweeks-wiki/wiki/product/chatgpt-app-sdk-roadmap.md:20-24`, `/Volumes/video/git/twoweeks-wiki/wiki/sources/2026-06-23-release-orchestration-staging-pr87-8-checkpoint.md:40-49`.

## Official Apps SDK readiness categories

Official OpenAI Apps SDK guidance treats these categories as separate readiness gates:

- Server/transport: an MCP server defines tools, enforces auth, returns data, and must be reachable over HTTP for development and HTTPS for ChatGPT use. Sources: `https://developers.openai.com/apps-sdk/build/mcp-server`, `https://developers.openai.com/api/docs/guides/developer-mode`.
- Tools/resources: descriptors need accurate names, schemas, output schemas, annotations, `_meta` boundaries, and optional UI resource metadata/CSP. Sources: `https://developers.openai.com/apps-sdk/build/mcp-server`, `https://developers.openai.com/apps-sdk/app-submission-guidelines`.
- Authentication/account linking: user-specific data or write actions should authenticate users; OAuth 2.1 requires protected resource metadata, auth-server metadata, PKCE, scopes, audience/resource validation, and per-request token verification. Source: `https://developers.openai.com/apps-sdk/build/auth`.
- User data/privacy: inputs and responses must be minimized; sensitive data, credentials, raw broad context, and unnecessary telemetry must not leak through tool inputs or outputs. Source: `https://developers.openai.com/apps-sdk/app-submission-guidelines`.
- Testing: readiness includes handler unit tests, auth tests when applicable, MCP Inspector `List Tools` / `Call Tool`, Developer Mode golden prompts, API Playground checks, mobile/layout checks when applicable, and regression records. Source: `https://developers.openai.com/apps-sdk/deploy/testing`.
- Submission: public distribution requires a public MCP server URL, no local/testing endpoint, CSP, app metadata, screenshots, test prompts, privacy policy, and review permissions. Source: `https://developers.openai.com/apps-sdk/deploy/submission`.
- Security: tool labels must match side effects, write actions must be explicit, external-state changes require clear labels and confirmation expectations, and third-party integrations require authorized access. Sources: `https://developers.openai.com/apps-sdk/build/mcp-server`, `https://developers.openai.com/apps-sdk/app-submission-guidelines`.
- Rollback/operations: published app metadata is a versioned contract while tool calls still hit the live endpoint; breaking changes require rollback or a new reviewed version. Source: `https://developers.openai.com/apps-sdk/deploy/submission`.

## Blocker table

| Gate | Current state | Required before unblock | Evidence | Allowed next PR type | Still blocked? |
| --- | --- | --- | --- | --- | --- |
| Production `/mcp` | No production MCP endpoint. Existing path is dev-only and flag-gated. | Approved transport/hosting decision, HTTPS endpoint, auth/privacy/ops gates, deployment proof, rollback proof. | `my-app/vite.config.ts:13-25`; `docs/plans/2026-06-21-pr87-production-deployment-gate.md:105-111` | blocked endpoint guard hardening or dev-only transport smoke | Yes |
| `tools/list` | Only fixture/dev response exists behind local dev endpoint. | Approved tool allowlist, accurate schemas/annotations, privacy review, Inspector and Developer Mode evidence. | `my-app/src/modules/local-mcp/localMcpDevEndpoint.ts:117-122`; `docs/decisions/2026-06-12-chatgpt-app-mcp-server-architecture-boundary.md:350-369` | test-only reachability proof | Yes |
| `tools/call` | Dev endpoint returns a safe error and runs no handlers. | Approved call runtime, auth, consent, audit, input validation, idempotency, handler readiness, negative prompt tests. | `my-app/src/modules/local-mcp/localMcpDevEndpoint.ts:123-124`; `docs/decisions/2026-06-12-chatgpt-app-mcp-server-architecture-boundary.md:300-348` | test-only blocked proof | Yes |
| OAuth runtime | No OAuth runtime is approved for MCP/App SDK production. | Auth architecture decision covering OAuth 2.1, resource metadata, scopes, token validation, account linking, test credentials, reauth, and failure handling. | `docs/decisions/2026-06-12-chatgpt-app-mcp-server-architecture-boundary.md:32-56`; `docs/decisions/2026-06-12-dependency-package-server-skeleton-approval-checkpoint.md:332-391` | auth architecture decision | Yes |
| Real handlers | No real MCP tool handlers are production-approved. | Handler execution policy, product ownership, auth/approval/audit/privacy gates, retry/idempotency behavior, and test plan. | `my-app/src/modules/local-mcp/localMcpServerSkeleton.ts:16-31`; `docs/decisions/2026-06-12-chatgpt-app-mcp-server-architecture-boundary.md:300-348` | architecture/docs-only handler boundary | Yes |
| Outbound HTTP | No MCP outbound HTTP path is approved. | Egress allowlist, SSRF controls, timeout/body limits, redirect policy, private-network denial, redacted logging, and tests. | `docs/decisions/2026-06-12-dependency-package-server-skeleton-approval-checkpoint.md:276-310` | security/privacy checklist | Yes |
| Model calls | No MCP model-call path is approved. | Budget/rate-limit policy, model allowlist, token caps, timeout/cancel/retry controls, and observability without raw sensitive logs. | `docs/decisions/2026-06-12-dependency-package-server-skeleton-approval-checkpoint.md:312-330` | security/privacy checklist | Yes |
| Live submit/apply | Blocked; PR80B keeps submission user-owned. | Separate provider authorization, legal/product approval, user confirmation, provider audit proof, and explicit launch gate. | `/Volumes/video/git/twoweeks-wiki/wiki/product/manual-application-handoff.md:41-50`, `/Volumes/video/git/twoweeks-wiki/wiki/product/manual-application-handoff.md:73-79` | manual handoff boundary hardening only | Yes |
| Approved-answer copy | Blocked until Apps SDK roadmap opens it with authoritative approved-answer source model. | Approved source model, data lineage, digest/audit proof, UX copy review, and launch gate. | `/Volumes/video/git/twoweeks-wiki/wiki/product/manual-application-handoff.md:22-24`, `/Volumes/video/git/twoweeks-wiki/wiki/product/manual-application-handoff.md:73-75` | docs-only decision | Yes |
| Provider-verified submission | `provider_verified_submitted` remains unreachable. | Official provider receipt verification design, provider authorization, audit and privacy review, and explicit product approval. | `/Volumes/video/git/twoweeks-wiki/wiki/product/manual-application-handoff.md:24`, `/Volumes/video/git/twoweeks-wiki/wiki/product/manual-application-handoff.md:54-63` | docs-only decision | Yes |
| Billing | Production billing remains blocked. | Product/commercial decision, Stripe/live key boundary, entitlement model, testing, compliance, rollback, and Apps SDK commerce review. | `/Volumes/video/git/twoweeks-wiki/wiki/product/chatgpt-app-sdk-roadmap.md:24`; `docs/plans/2026-06-21-pr87-production-deployment-gate.md:95-103` | billing architecture only, outside PR87.9 | Yes |
| PR88 private beta | Blocked. | Reviewed launch-readiness gate after the production MCP/App SDK blocker register is cleared. | `/Volumes/video/git/twoweeks-wiki/wiki/product/chatgpt-app-sdk-roadmap.md:61-65` | launch-readiness checklist | Yes |
| PR89 public launch | Blocked. | Successful private beta signal plus separate public launch decision. | `/Volumes/video/git/twoweeks-wiki/wiki/product/chatgpt-app-sdk-roadmap.md:67-70` | submission-readiness checklist | Yes |

## Explicit blocked surfaces

The following remain blocked after PR87.9:

- production `/mcp`
- `tools/list`
- `tools/call`
- OAuth runtime
- real handlers
- outbound HTTP
- model calls
- live submit/apply
- approved-answer copy
- provider-verified submission
- billing
- PR88
- PR89

## Recommended next slices after PR87.9

These are candidate next PR types only. This document does not approve them.

1. Test-only reachability proof for the blocked local/dev path, with no production endpoint and no real handler execution.
2. Auth architecture decision covering OAuth/account-linking requirements without runtime implementation.
3. Blocked endpoint guard hardening if reviewers identify a concrete guard gap.
4. Dev-only transport smoke that proves local fixture behavior without enabling production.
5. Privacy/security checklist for data minimization, prompt injection, egress, logging, consent, and audit.
6. Submission-readiness checklist for Developer Mode, Inspector, public-domain, CSP, privacy policy, screenshots, test prompts, versioning, and rollback prerequisites.

## Rollback

Delete this markdown file:

```txt
docs/audits/2026-06-24-mcp-app-sdk-production-gate-blocker-register.md
```

No runtime rollback is needed because PR87.9 changes no runtime behavior.

## Non-permissions

PR87.9 must not be interpreted as approval to implement, expose, enable, deploy, test in production, submit, privately beta, publicly launch, or bill for MCP/App SDK behavior.

PR87.9 does not allow:

- adding, changing, or deploying a production `/mcp` endpoint;
- exposing production `tools/list`;
- exposing production `tools/call`;
- adding OAuth runtime, token storage, auth metadata routes, callbacks, or scopes;
- adding real MCP handlers or handler registries;
- reading real user data through MCP;
- adding outbound HTTP, scraping, browsing, webhooks, callbacks, or arbitrary URL behavior;
- adding OpenAI SDK calls, model calls, streaming, prompt loops, or token-consuming behavior;
- enabling live submit/apply, provider submission, approved-answer production behavior, or `provider_verified_submitted`;
- adding billing or entitlement behavior;
- changing package files, lockfiles, Convex flags, source code, tests, deployment config, production config, or cover-letter code;
- opening PR88 or PR89.

Any future PR that attempts one of these surfaces needs its own explicit approval and must stop if a required gate is missing, stale, unknown, or failing.
