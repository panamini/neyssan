# MCP Roadmap Checkpoint

Date: 2026-06-23
Base branch: `application-os-foundation`
Checkpoint base SHA: `2ceb98d071b51e87a368dc3d01f33d7ce147f724`
Status: `PAUSED_UNTIL_CURRENT_RELEASE_TROUBLES_SETTLE`

## Purpose

We had a long release-trouble sequence around cover-letter finalization, Playwright, lint boundaries, PR restacking, GPT premium finalization, and flags-off smoke tests.

This document exists so MCP work does not get lost while we finish stabilizing the current release.

Rules for this checkpoint:

- Do not restart MCP implementation work until the current release/canary situation is quiet.
- Do not mix MCP work with lint cleanup.
- Do not mix MCP work with cover-letter prompt/canary/quality-repair changes.
- Do not enable write-capable MCP tools in the first MCP unlock.
- Keep the first MCP follow-up PR docs/spec-only unless there is a very small reviewed blocker.

## Current repo evidence

### Existing project roadmap

`PROJECT_ROADMAP-v0.md` exists, but it is old and broader than MCP. It mainly describes app, extension, profile ingestion, proposals UI, tests, and deployment work from 2025-08-20.

Use this new file as the active MCP-specific checkpoint.

### Existing MCP code surface

Current repo has an MCP client placeholder:

- `my-app/src/services/mcp-client.ts`
- `my-app/src/types/mcp-client.d.ts`

Current state of that code:

- `McpClient` exposes only `callTool<T>(name, params)`.
- `createMcpClient()` does not connect to a real MCP server yet.
- The implementation currently calls `mockToolCall(...)`.
- Response schemas exist for draft tool names such as `fetch_html`, `check_url_support`, `detect_platform`, `save_proposal`, and `scrape_job`.

Conclusion:

```text
There is no production-ready MCP server/runtime in this checkpoint.
There is only a placeholder client surface and roadmap memory.
```

## Current product/release state before resuming MCP

Already merged into `application-os-foundation`:

- PR242 — lint config boundary.
- PR243 — proposal body composer prompt contract / release gate superseding PR236.
- PR230 — premium cover-letter provenance/finalization.
- PR231 — better legacy cover-letter prompt routing.
- PR232 — Mistral premium prompt V2, merged but default-off.
- PR233 — quality shadow repair, merged but default-off.
- PR245 — GPT premium finalization hardening.

Current flag posture:

```text
Mistral V2 canary: small internal only
Quality repair: OFF / NO-GO
Full production GO: not yet
```

MCP work should resume only after this posture is explicitly stable.

## MCP status summary

```text
MCP product status: NOT READY
MCP implementation status: PLACEHOLDER CLIENT ONLY
MCP auth status: UNDECIDED / NEEDS PROVIDER-SCOPE CONFIRMATION
MCP first safe unlock: READ-ONLY, DOCS-FIRST
MCP write tools: BLOCKED
MCP production exposure: BLOCKED
```

## Exit criteria before touching MCP again

- [ ] PR245 post-merge flags-off smoke remains clean after a short stabilization window.
- [ ] Mistral V2 internal canary is either completed successfully or explicitly parked.
- [ ] Quality repair remains OFF unless a separate reviewed decision changes that.
- [ ] No open release-gate blocker is active.
- [ ] No Playwright/CI rerun is still pending.
- [ ] No broad lint cleanup is in progress.

When all are true, MCP can restart with Phase 1 below.

## Phase 1 — Reconfirm MCP product scope

Goal: decide exactly what MCP v0 is allowed to expose.

Checklist:

- [ ] Confirm target client: ChatGPT MCP, local developer MCP, or both.
- [ ] Confirm transport for v0: remote HTTP/SSE, stdio, or local-only skeleton.
- [ ] Confirm v0 is read-only.
- [ ] Confirm no write/mutation tools in v0.
- [ ] Confirm no payment, billing, deployment, or OAuth side effects in v0.
- [ ] Define the user-visible MCP promise in one paragraph.
- [ ] Define what data is allowed to leave the app boundary.
- [ ] Define what data must stay private/server-side.
- [ ] Decide whether the first PR is only an ADR/spec freeze.

Recommended first PR:

```text
PR-MCP-0 — MCP scope checkpoint / ADR only
```

Acceptance:

- One docs file or ADR only.
- No runtime code.
- No dependency changes.
- No auth implementation.
- No tool implementation.

## Phase 2 — Auth and authorization decision

Goal: avoid building an MCP server before scopes/token rules are clear.

Current prior decision memory:

- Stytch Connected Apps looked like the safer first unlock because custom connected-app scopes were confirmed in docs.
- WorkOS Standalone Connect remains attractive only if WorkOS confirms custom Twoweeks OAuth scopes for Connect/MCP.
- Clerk remains the app login layer; MCP OAuth/token issuance must not break Clerk login.

Checklist:

- [ ] Confirm provider: Stytch, WorkOS, or other.
- [ ] Confirm custom scopes are supported for Twoweeks MCP.
- [ ] Define v0 scopes, likely:
  - `twoweeks.mcp.read`
  - future only: `twoweeks.mcp.write`
- [ ] Define token audience/resource.
- [ ] Define JWKS/token verification path.
- [ ] Define revoke/consent behavior.
- [ ] Define protected resource metadata endpoint if remote MCP requires it.
- [ ] Define failure behavior for missing/invalid/expired token.

Recommended second PR:

```text
PR-MCP-1 — Auth provider decision ADR
```

Acceptance:

- Provider decision is documented.
- Exact scopes are documented.
- No package install unless separately approved.
- No runtime server exposure yet.

## Phase 3 — MCP protocol/runtime skeleton

Goal: create a minimal server only after scope/auth is accepted.

Checklist:

- [ ] Decide exact MCP protocol version target.
- [ ] Implement strict JSON-RPC parsing.
- [ ] Implement `initialize` response only with approved capabilities.
- [ ] Do not advertise tools/resources/prompts until implemented and tested.
- [ ] Add invalid JSON / invalid request / unknown method tests.
- [ ] Add deterministic request/response fixtures.
- [ ] Add no-real-data fixture mode.
- [ ] Add security logging without leaking user content.

Recommended third PR:

```text
PR-MCP-2 — Local-only MCP skeleton, no tools, no real data
```

Acceptance:

- Local-only.
- No production exposure.
- No real user data.
- No write tools.
- Tests pass with fixtures.

## Phase 4 — Read-only tool candidates

Goal: add only safe read-only tools after skeleton is accepted.

Candidate tool families to verify against current code before implementation:

- Application package summary.
- Evidence graph summary.
- Resume variant plan summary.
- Review cockpit summary.
- Read-only ChatGPT E2E harness.

Checklist:

- [ ] Verify each candidate exists in current code before adding it to MCP.
- [ ] Define one input schema per tool.
- [ ] Define one output schema per tool.
- [ ] Add fixture-only tests first.
- [ ] Add permission checks per tool.
- [ ] Add redaction policy.
- [ ] Add rate limit policy.
- [ ] Add audit log policy.
- [ ] Prove each tool is read-only.

Do not implement all tools at once.

Recommended split:

```text
PR-MCP-3A — one read-only tool, fixture-backed
PR-MCP-3B — second read-only tool, fixture-backed
PR-MCP-3C — ChatGPT read-only E2E smoke, fixture-backed
```

## Phase 5 — Replace placeholder client behavior

Current `mcp-client.ts` still uses a mock tool call. Do not wire it to a real server until the server and auth are ready.

Checklist:

- [ ] Decide whether frontend still needs an MCP client at all.
- [ ] If yes, replace `mockToolCall` with a real, authenticated call only after auth PR is accepted.
- [ ] If no, remove or quarantine the placeholder client in a separate cleanup PR.
- [ ] Keep response validation schemas if still useful.
- [ ] Add tests for connection errors, tool-not-found, invalid params, and invalid response.

Acceptance:

- No mock path is mistaken for production behavior.
- No hidden MCP client writes.
- No unauthenticated MCP calls.

## Phase 6 — Deployment and monitoring

Goal: only after read-only tools are stable.

Checklist:

- [ ] Decide deployment target.
- [ ] Add environment variable checklist.
- [ ] Add CORS/origin policy if remote.
- [ ] Add per-user rate limits.
- [ ] Add logs/metrics without sensitive content.
- [ ] Add incident rollback plan.
- [ ] Add off switch.
- [ ] Run ChatGPT connection smoke.
- [ ] Run no-auth, invalid-auth, expired-token tests.

Production exposure remains blocked until all checks pass.

## Explicit non-goals for the next MCP pass

- [ ] No lint baseline.
- [ ] No broad refactor.
- [ ] No write tools.
- [ ] No real-data ChatGPT tool before auth is proven.
- [ ] No OAuth provider switch inside runtime skeleton PR.
- [ ] No Mistral V2 or quality repair work in MCP PRs.
- [ ] No deployment flag enablement.

## Next action when current troubles are over

Run this exact planning prompt before coding:

```text
You are a senior engineer. Prepare PR-MCP-0 only.
Read docs/plans/2026-06-23-mcp-roadmap-checkpoint.md and PROJECT_ROADMAP-v0.md first.
Do not modify runtime code.
Do not install packages.
Do not open MCP server work yet.
Produce an ADR/docs-only PR that freezes MCP v0 scope, transport, auth assumptions, read-only constraints, and the first 3 implementation PRs.
Status must be READY_TO_REVIEW or BLOCKED_ON_DECISION.
```

## Current recommendation

Stop MCP work for now.

Resume only with `PR-MCP-0` after the cover-letter release/canary situation is stable and the team explicitly decides to restart MCP work.
