# PR36 - MCP Server Architecture Boundary ADR
Date: 2026-06-12
Status: architecture decision record
Scope: docs-only, no runtime implementation

## 1. Objective

PR36 defines a future MCP server architecture boundary for Twoweeks.

PR36 turns PR35's "smallest safe next step" into an ADR.

PR36 does not implement a server.

PR36 does not approve runtime integration.

PR36 does not approve ChatGPT connection.

## 2. Decision summary

Twoweeks will not move directly from local fixtures to an Apps SDK runtime.

Before any runtime code, Twoweeks must define a future MCP server as a gated adapter layer between ChatGPT/MCP and existing local-only tool contracts.

The future MCP server, if approved later, must be isolated from product handlers, fail closed by default, expose only explicitly allowlisted descriptors, and route all future calls through approval, audit, privacy, auth, handler-readiness, and data-minimization gates.

Descriptor exposure must never imply execution permission.

PR36 does not approve implementation of that server.

## 3. Explicit non-permissions

PR36 does not allow:

- Apps SDK install
- MCP SDK install
- OpenAI SDK install
- SDK import
- `/mcp` endpoint
- `tools/list` runtime
- `tools/call` runtime
- `call_tool` runtime
- Streamable HTTP transport
- SSE transport
- public tunnel
- Cloudflare Tunnel
- ChatGPT connector setup
- Developer Mode setup
- auth implementation
- UI components
- widget resources
- iframe rendering
- Convex changes
- real handlers
- real user data
- export/download/send/submit/apply
- production behavior

## 4. Sources reviewed

Repository sources:

- `AGENTS.md` - defines `v1` as the active baseline, docs placement, RTK usage, and docs-only verification expectations.
- `docs/plans/2026-06-12-chatgpt-apps-sdk-non-production-exploration-plan.md` - PR35 recommends this ADR as the smallest safe next step and keeps runtime blocked.
- `docs/audits/2026-06-12-chatgpt-app-prototype-readiness-checkpoint.md` - PR34 confirms planning readiness only, not runtime or ChatGPT readiness.
- `docs/plans/2026-06-11-chatgpt-app-non-production-prototype-plan.md` - PR28 keeps the prototype path Plan-only and forbids Build/Deploy surfaces.
- `docs/plans/2026-06-11-chatgpt-app-local-only-manifest-draft.md` - PR29 defines static manifest planning rules and hidden, non-runnable candidate tools.
- `docs/audits/2026-06-11-chatgpt-app-end-to-end-safety-audit.md` - PR30 confirms no approved execution path exists across PR18-PR29.
- `docs/decisions/2026-06-11-mcp-schema-projection.md` - PR18 provides local descriptor design input but no `tools/list` runtime.
- `docs/decisions/2026-06-11-mcp-call-envelope-error-contract.md` - PR19 provides a non-executable local call envelope and safe error taxonomy.
- `docs/decisions/2026-06-11-mcp-approval-audit-boundary.md` - PR20 defines approval and audit shells as design input only.
- `docs/decisions/2026-06-11-mcp-real-handler-boundary-design.md` - PR21 defines future handler gates while keeping real handlers forbidden.
- `docs/decisions/2026-06-11-mcp-remote-transport-spike.md` - PR22 models disabled, non-production transport preflight without a listener.
- `docs/decisions/2026-06-11-mcp-privacy-redaction-fixtures.md` - PR24 defines sentinel fixture checks and states they are not semantic privacy.
- `docs/decisions/2026-06-11-mcp-tool-visibility-policy.md` - PR25 defines hidden-by-default visibility and review-only listed states.
- `docs/decisions/2026-06-11-mcp-approval-ux-copy-fixtures.md` - PR26 pins safe approval/refusal/status copy.
- `docs/decisions/2026-06-11-mcp-privacy-review-gate.md` - PR27 defines fail-closed, review-only privacy gate semantics.
- `my-app/src/modules/local-mcp/chatGptAppPrototypeScaffold.ts` - active fixture scaffold that enforces local-only, non-runnable, no-handler, no-transport, no-OAuth, no-UI constraints.
- `my-app/src/modules/local-mcp/chatGptAppPrototypeScaffoldGoldenFixtures.ts` - golden fixtures proving current scaffold shape stability only.
- `my-app/src/modules/local-mcp/mcpPrivacyReviewGate.ts` - active review gate with `blocked`, `review_required`, and `ready_for_internal_review` states only.
- `my-app/src/modules/local-mcp/privacyRedactionFixtures.ts` - active sentinel fixtures for generic safe outputs.
- `my-app/src/modules/local-mcp/mcpApprovalUxCopyFixtures.ts` - active fixed copy catalog for safe review states.

Official documentation reviewed on 2026-06-12:

- `https://developers.openai.com/apps-sdk/concepts/mcp-server` - confirms Apps SDK MCP servers list tools, call tools, and can return optional components/resources.
- `https://developers.openai.com/apps-sdk/build/mcp-server` - confirms future server work involves tool registration, schemas, structured content, and server-side auth/security responsibilities.
- `https://developers.openai.com/apps-sdk/deploy/connect-chatgpt` - confirms ChatGPT connector setup requires Developer Mode and a reachable HTTPS public `/mcp` endpoint.
- `https://developers.openai.com/apps-sdk/deploy/testing` - confirms testing uses MCP Inspector, List Tools, Call Tool, ChatGPT developer mode, golden prompts, auth checks, and component checks.
- `https://developers.openai.com/apps-sdk/guides/security-privacy` - confirms least privilege, explicit consent, prompt-injection assumptions, validation, audit logs, retention, deletion, redaction, OAuth, and operational security expectations.
- `https://developers.openai.com/apps-sdk/app-submission-guidelines` - confirms accurate tool names/descriptions, correct `readOnlyHint`, `destructiveHint`, and `openWorldHint`, minimal inputs, auditable side effects, and transparent auth.
- `https://modelcontextprotocol.io/specification/2025-11-25` - confirms the latest MCP spec uses JSON-RPC, host/client/server architecture, capability negotiation, and explicit consent/trust principles.
- `https://modelcontextprotocol.io/specification/2025-11-25/server/tools` - confirms `tools/list`, `tools/call`, tool schemas, structured content, output schema, annotations, and human-in-the-loop guidance.
- `https://modelcontextprotocol.io/specification/2025-11-25/basic/transports` - confirms stdio and Streamable HTTP, optional SSE streams, origin validation, auth expectations, and session ID handling.
- `https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization` - confirms MCP auth expectations around OAuth 2.1, protected resource metadata, discovery, token audience validation, secure token storage, HTTPS, and PKCE.

## 5. Current baseline after PR35

The current baseline after PR35 is:

- local-only
- fixture-only
- review-only
- non-runnable
- non-callable
- no MCP server
- no `/mcp`
- no `tools/list`
- no `tools/call`
- no transport runtime
- no OAuth
- no UI
- no ChatGPT connector
- no real handlers
- no real user data
- no production path

This is active code only for the fixture scaffold and local safety review chain.

## 6. Future MCP server boundary

The future MCP server must be an adapter, not the product core.

It must not own business logic.

It must not bypass local safety gates.

It must only expose allowlisted tools.

It must fail closed when policy, auth, privacy, approval, audit, or handler state is unknown.

It must distinguish descriptor exposure from execution permission.

It must be disabled by default until explicitly approved.

It must not directly call job application, export, download, send, submit, or apply flows without future dedicated approval.

The adapter boundary must sit outside product handlers and translate between future MCP protocol objects and already-reviewed Twoweeks local contracts.

## 7. Future transport boundary

No transport is approved in PR36.

Future transport choice must be explicit.

Streamable HTTP and any public endpoint require a separate decision.

SSE, if considered, requires separate justification.

Public tunnels, ngrok, and Cloudflare Tunnel remain forbidden until later approval.

Origin, host, TLS, session, rate limit, logging, and abuse controls must be decided before implementation.

`/mcp` must remain forbidden until a future explicit implementation PR.

## 8. Future tool exposure boundary

No `tools/list` runtime exists in PR36.

Future exposed tools must come from an allowlist.

Hidden tools must remain hidden.

Tool descriptions must not overpromise capabilities.

Metadata must clearly separate review-only, read-only, destructive, and open-world semantics.

Any tool exposed to ChatGPT must have a written justification.

PR18 descriptors may be reused as design input but are not automatically MCP descriptors.

PR31 scaffold cards and PR33 golden fixtures are review artifacts, not live tool registrations.

## 9. Future call boundary

No `tools/call` runtime exists in PR36.

No `call_tool` runtime exists in PR36.

No real handlers exist in PR36.

Future calls must pass auth, privacy, approval, audit, input validation, idempotency, and handler-readiness gates.

`ready_for_internal_review` is not execution approval.

Failed or unknown gate state must block execution.

Write actions must require explicit confirmation and audit.

Export/download/send/submit/apply remain blocked until separately approved.

## 10. Future data boundary

No real user data exists in PR36.

Future server work must define model-visible, component-visible, server-only, and audit-only data classes.

Future server work must avoid raw source text unless explicitly approved.

Future server work must define minimization, retention, deletion, redaction, and logging policy.

Secrets, tokens, session IDs, raw resumes, raw cover letters, raw job data, private facts, and `never_use` facts must not leak into generic tool output.

Career context, CV content, cover letter content, job descriptions, and application history must be treated as sensitive user data.

## 11. Future auth boundary

No OAuth exists in PR36.

Any user-specific data or write action requires a future auth decision.

OAuth 2.1 and MCP authorization expectations must be reviewed before implementation.

Token storage, scopes, revocation, account linking, test credentials, and failure handling must be decided before any runtime PR.

Auth hints or client metadata must never be trusted as authorization.

## 12. Future approval and audit boundary

Approval and audit shell from PR20 may be design input only.

Future runtime must have enforceable audit, not just planned audit.

User consent must be explicit for sensitive or write actions.

Irreversible or outbound actions require confirmation.

Audit logs must be privacy-safe and redacted.

Audit must separate model-visible summaries from private operational logs.

## 13. Future privacy boundary

PR24 sentinel fixtures are not semantic privacy.

PR27.1 review gate is not runtime privacy approval.

Golden fixtures prove shape stability, not privacy safety.

Future runtime needs semantic privacy review, prompt-injection testing, and leak tests.

Future runtime must define safe summaries and forbidden output classes.

Future runtime must treat prompt injection as expected, not exceptional.

## 14. Future UI/resource boundary

No UI resources exist in PR36.

No iframe exists in PR36.

No widget resources exist in PR36.

Future UI is optional, not required.

If future UI is approved, component intent, state, auth context, accessibility, CSP/resource policy, and data visibility must be decided first.

UI must not become a hidden data exfiltration path.

## 15. Future dependency boundary

No dependency changes exist in PR36.

Apps SDK/MCP SDK dependencies require explicit maintainer approval.

Package and lockfile changes must happen only in a future dedicated approval PR.

No package install may be hidden inside a docs PR.

No SDK import may appear before dependency approval.

## 16. Vocabulary

- MCP server: future protocol-facing adapter that may eventually expose allowlisted tool descriptors and receive tool-call requests, if approved later.
- Tool listing: future `tools/list` capability that would advertise allowed tools and metadata. Listing is exposure only, not execution approval.
- Tool calling: future `tools/call` or `call_tool` capability that would request execution. Calling remains forbidden until explicit implementation approval.
- Transport: future network layer used by an MCP client to reach the server. No transport is approved by PR36.
- Handler: product-side implementation that performs real work. No handler is approved by PR36.
- Approval gate: future enforceable check that confirms user or maintainer approval before sensitive or write behavior.
- Privacy gate: future enforceable check that prevents raw or sensitive data leakage.
- Audit gate: future enforceable check that records privacy-safe evidence of allowed actions.
- Fail closed: when any required gate is missing, unknown, stale, unavailable, or failing, the system must refuse exposure or execution instead of continuing.

## 17. Explicit non-decisions

PR36 intentionally does not decide:

- exact server framework
- exact SDK package
- exact transport
- endpoint path implementation
- hosting provider
- OAuth provider
- UI/component strategy
- state persistence strategy
- production deployment
- submission strategy
- first live tool list
- first callable handler

## 18. Runtime blockers

Runtime remains blocked by:

- server boundary not implemented
- transport boundary not approved
- auth boundary not approved
- handler boundary not approved
- data boundary not approved
- privacy boundary not production-reviewed
- approval boundary not enforceable
- audit boundary not enforceable
- UI/resource boundary not approved
- dependency boundary not approved
- deployment boundary not approved
- ChatGPT connector not approved

## 19. Architecture risks

- Static descriptors may be mistaken for live tools.
- `ready_for_internal_review` may be mistaken for execution approval.
- Server skeleton may accidentally create runtime permission.
- Public endpoint may be exposed before auth/privacy approval.
- Tool descriptions may overpromise.
- Read-only annotations may be wrong.
- Open-world tools may hide side effects.
- Logs may leak user data.
- Prompt injection is expected, not exceptional.
- Docs-only decisions may be mistaken for implementation approval.
- Future write actions around CV, cover letter, job search, export, submit, send, or apply flows may create legal, privacy, or user-trust risk.

## 20. Minimum gates before implementation

All of these are required before implementation:

- Approved MCP server boundary ADR
- Approved transport/public endpoint ADR
- Approved auth/OAuth ADR
- Approved real-user-data policy
- Approved handler execution policy
- Approved approval/audit runtime policy
- Approved privacy/threat model update
- Approved tool descriptor mapping
- Approved dependency/package change checkpoint
- Approved local-only test strategy
- Explicit maintainer approval to install dependencies
- Explicit maintainer approval to add runtime code
- Explicit maintainer approval to expose `/mcp`
- Explicit maintainer approval to connect to ChatGPT

## 21. Future verification checklist

Before any implementation PR, reviewers must be able to verify:

- exactly which tools may be listed;
- exactly which tools remain hidden;
- why each listed tool is safe to expose;
- whether each tool is read-only, destructive, or open-world;
- what data is model-visible, component-visible, server-only, and audit-only;
- what user consent is required;
- what auth or OAuth model applies;
- what approval gate is enforced;
- what audit event is written;
- what privacy redaction is applied;
- what happens when a gate fails;
- what happens when a gate is unknown;
- what logs are retained;
- what deletion and retention policy applies;
- what prompts test tool selection and prompt injection;
- what prevents export/download/send/submit/apply from executing without explicit approval.

## 22. Recommended next PR

PR37: Real-data, privacy, consent, retention, and audit policy - docs only.

PR37 should come before tool-contract mapping or a server skeleton because Twoweeks' app value depends on CV, cover letter, job, and career context.

Those domains are sensitive user-data domains.

Privacy and audit rules must exist before any runtime or descriptor mapping can be trusted.

PR36 does not create PR37.

## 23. PR36 verdict

PR36 defines the future MCP server architecture boundary.

PR36 allows continued planning only.

PR36 does not approve implementation.

PR36 does not approve package installation.

PR36 does not approve SDK imports.

PR36 does not approve MCP server creation.

PR36 does not approve `/mcp`.

PR36 does not approve `tools/list`.

PR36 does not approve `tools/call`.

PR36 does not approve ChatGPT connection.

PR36 does not approve runtime integration.

PR36 does not approve production.

## 24. Rollback

Rollback is deletion-only:

```txt
docs/decisions/2026-06-12-chatgpt-app-mcp-server-architecture-boundary.md
```
