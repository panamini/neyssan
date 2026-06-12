# PR53 - Auth/OAuth Implementation Decision

Date: 2026-06-12
Status: proposed decision
Scope: docs-only decision before any auth or OAuth implementation

## 1. Objective

PR53 decides the next Auth/OAuth boundary for the Twoweeks ChatGPT App / MCP path.

PR53 does not implement auth.
PR53 does not implement OAuth.
PR53 does not add callbacks, token storage, sessions, account linking, connector setup, real-data access, or tool execution.

Question answered:

```txt
Can Twoweeks start Auth/OAuth implementation now, and what must be true before any future OAuth code exists?
```

## 2. Decision summary

Twoweeks will not implement OAuth in PR53.

The current local developer path may remain fake-data-only and local-dev-only without OAuth because it exposes no real user data and runs no real handlers.

Any future PR that exposes customer-specific data, real user data, production ChatGPT connector behavior, or write actions must require an explicit Auth/OAuth implementation plan before code exists.

OAuth is required before any future real-data or write-capable MCP/App SDK surface.

OAuth is not required for the existing fixture-only local developer demo as long as all of these remain true:

- fake data only;
- local-dev-only;
- disabled unless explicitly flagged;
- no production connector;
- no real user identity;
- no real handlers;
- no Convex real-data reads or writes;
- no export, download, send, submit, or apply behavior.

## 3. Current baseline after PR52

The current path is:

- package-only MCP SDK dependency already installed but not imported by local MCP modules;
- disabled local MCP server skeleton;
- fixture-only descriptor registry;
- fixture-only `tools/list` simulation;
- fixture-only `tools/call` simulation;
- golden safety tests;
- disabled local dev transport adapter;
- dev-only `/mcp` endpoint behind `LOCAL_MCP_DEV_ENDPOINT=1`;
- fake-data-only local developer fake ChatGPT flow demo.

The current path still has:

- no OAuth;
- no auth callback;
- no token storage;
- no account linking;
- no production ChatGPT connector;
- no real user data;
- no real handlers;
- no write actions;
- no production behavior.

## 4. Sources reviewed

Repository sources:

- `AGENTS.md`
- `docs/decisions/2026-06-12-chatgpt-app-mcp-server-architecture-boundary.md`
- `docs/decisions/2026-06-12-real-data-privacy-consent-retention-audit-policy.md`
- `docs/audits/2026-06-12-apps-sdk-runtime-threat-model.md`
- `docs/decisions/2026-06-12-dependency-package-server-skeleton-approval-checkpoint.md`
- `my-app/src/modules/local-mcp/localMcpDevEndpoint.ts`
- `my-app/src/modules/local-mcp/localMcpFakeChatGptFlowDemo.ts`

Prior controlling constraints:

- PR36: future server boundary must fail closed and cannot bypass auth/privacy/approval/audit gates.
- PR37: real data remains prohibited until explicit privacy, consent, retention, deletion, redaction, audit, and auth gates exist.
- PR39: OAuth token leakage, spoofing, elevation of privilege, and public endpoint abuse remain blocked threats.
- PR40: OAuth endpoints and runtime auth remain forbidden unless a later PR explicitly approves them.
- PR51: dev-only `/mcp` endpoint is local-only, explicitly flagged, fixture-only, and refuses handler execution.
- PR52: fake ChatGPT flow remains fake-data-only and proves no production connector or write action exists.

Official references already reviewed in prior PRs and still controlling:

- OpenAI Apps SDK Authenticate users: `https://developers.openai.com/apps-sdk/build/auth`
- OpenAI Apps SDK Security & Privacy: `https://developers.openai.com/apps-sdk/guides/security-privacy`
- MCP authorization specification, latest 2025-11-25: `https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization`

## 5. Explicit non-permissions

PR53 does not allow:

- auth implementation;
- OAuth callback route;
- OAuth discovery route;
- protected resource metadata route;
- dynamic client registration;
- token issuance;
- token exchange;
- token refresh;
- token revocation;
- token storage;
- session binding implementation;
- account linking;
- Clerk/Auth provider integration for MCP;
- ChatGPT connector setup;
- Developer Mode connector changes;
- production `/mcp` exposure;
- real user data;
- Convex real-data reads or writes;
- real handlers;
- `tools/call` handler execution;
- export, download, send, submit, or apply behavior;
- outbound HTTP for auth or discovery;
- LLM/model calls;
- package or lockfile changes.

## 6. OAuth requirement decision

OAuth is required before any future MCP/App SDK surface can access:

- customer-specific data;
- real CV/resume/job/application data;
- real user IDs or account context;
- private facts;
- `never_use` policy facts;
- generated artifacts tied to a user;
- persistent audit records for a user;
- write actions;
- production ChatGPT connector behavior.

OAuth is also required before any future PR introduces:

- public or remotely reachable `/mcp` endpoint;
- ChatGPT connector setup;
- account linking;
- bearer-token validation;
- auth-gated `tools/list`;
- auth-gated `tools/call`;
- user-specific component/widget data.

## 7. Future Auth/OAuth implementation gates

A future OAuth implementation PR must stop unless all gates below are satisfied in writing before code exists.

Required scope gates:

- exact auth use case;
- exact data classes unlocked;
- exact tools affected;
- exact endpoint inventory;
- exact non-goals;
- rollback and kill-switch plan.

Required protocol gates:

- OAuth 2.1 / MCP authorization model selected;
- PKCE requirement stated;
- token audience validation design;
- protected resource metadata design;
- client registration policy;
- redirect/callback URI policy;
- scope model;
- revocation model;
- expiration and refresh model;
- error and denial behavior.

Required security gates:

- token storage policy;
- token redaction policy;
- no tokens in model-visible output;
- no tokens in component-visible output;
- no tokens in logs or audit payloads;
- CSRF/state/nonce policy;
- origin and host validation;
- session binding;
- replay protection;
- rate limits;
- malformed request behavior;
- audit event shape.

Required privacy gates:

- data minimization by scope;
- consent copy and denial copy;
- retention and deletion plan;
- private fact and `never_use` tests;
- raw source text prohibition unless separately approved;
- component `_meta` data classification.

Required test gates:

- unit tests for token validation failure modes;
- denial and revocation tests;
- redaction tests for tokens and session IDs;
- prompt-injection tests against auth context confusion;
- negative tests for write-action prompts;
- no-token-in-output tests;
- no-token-in-log/audit tests;
- local/dev fixture tests must stay fake-data-only.

## 8. Tool behavior decision

Descriptor exposure remains separate from execution permission.

Even after a future OAuth implementation exists:

- auth success must not imply handler execution approval;
- auth success must not imply privacy approval;
- auth success must not imply write-action approval;
- `ready_for_internal_review` must not imply runtime execution approval;
- failed or unknown auth state must fail closed;
- user denial must return safe refusal copy only.

For write actions, future OAuth is necessary but not sufficient. Write actions still require a dedicated future write-action decision with consent, preview, approval, audit, idempotency, and rollback.

## 9. Current local developer exception

The current dev-only `/mcp` endpoint and fake ChatGPT flow are allowed to remain no-auth only because they are fixture-only and fake-data-only.

This exception is invalidated immediately if a future PR adds any of the following:

- real user identity;
- real user data;
- Convex reads or writes;
- real handler execution;
- production connector setup;
- remotely reachable endpoint;
- persistent audit tied to a user;
- export/download/send/submit/apply behavior.

If any invalidating condition is proposed, OAuth/auth planning must happen before implementation.

## 10. Final decision

PR53 chooses deferral, not implementation.

```txt
Auth/OAuth implementation remains blocked.
Fake-data local developer flows may remain no-auth.
Real-data, production connector, or write-capable flows require a future OAuth implementation PR with explicit gates.
```

## 11. Verification expectations for PR53

PR53 must verify:

- docs-only diff;
- no source code changes;
- no package or lockfile changes;
- no OAuth callback route;
- no token storage;
- no real-data path;
- no tool execution path;
- no production connector behavior;
- no export/download/send/submit/apply behavior.
