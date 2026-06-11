# PR16 Local MCP Beta

## Decision

PR16 is a local MCP-shaped adapter only.

It adds a deterministic TypeScript adapter around the existing Internal Tool Contracts so a local request can flow through a static local registry, approval policy, dry-run dispatcher, and stable local response.

## Allowed Local Tools

Only these Internal Tool Contract IDs are exposed:

- `application_package.summarize`
- `evidence_graph.summarize`
- `resume_variant_plan.summarize`
- `review_cockpit.summarize`

The local-facing IDs use the `local_mcp.*` prefix and map back to those exact internal contract IDs.

## Authz Policy

The adapter denies normal policy failures through response objects, not exceptions.

- unknown tool: `unknown_tool`
- missing user: `missing_user`
- non-allowlisted or blocked tool: `tool_not_allowlisted`
- required approval missing: `approval_required`
- malformed request: `invalid_request`

All four exposed contracts are medium risk for the local adapter and require explicit approved approval metadata.

## Why This Is Not A Real MCP Server

It does not implement network transport.

It does not connect to ChatGPT or any external host.

It does not execute real product actions.

There is no server process, route, socket, stream, auth provider, persistence, background job, Convex function, or external integration in this PR.

## Explicit Non-Goals

- network transport
- HTTP, WebSocket, SSE, or Streamable HTTP
- OAuth or auth provider integration
- Remote MCP
- ChatGPT App
- OpenAI or Claude integration
- external API calls
- browser automation
- persistence
- Convex schema or functions
- UI routes or pages
- generated prompts
- export or import flows
- package dependency changes
- real product action execution

## Rollback

Rollback is deletion-only:

- delete `my-app/src/modules/local-mcp/`
- delete `docs/decisions/2026-06-11-local-mcp-beta.md`
- rerun the targeted Vitest suites and `tsc --noEmit`

## Future PR17 Readiness

PR17 can build from this boundary by adding a separately reviewed transport or integration layer only after the local contract, authorization, and dry-run response shapes are stable.

That future work should keep the local registry allowlist explicit and add new approvals before any real action handler is considered.
