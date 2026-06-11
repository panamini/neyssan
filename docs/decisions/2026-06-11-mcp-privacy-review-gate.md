# PR27 - MCP Privacy Review Gate

Date: 2026-06-11
Status: implemented
Scope: pure TypeScript privacy review gate for Local MCP exposure readiness.

## Objective

Combine the PR20-PR26 Local MCP safety boundaries into one conservative gate that answers whether a Local MCP tool is safe enough to expose beyond internal/local dry-run surfaces.

## Delivered

- Pure TypeScript `mcpPrivacyReviewGate.ts`.
- Closed statuses: `blocked`, `review_required`, `ready_for_internal_review`.
- Closed reason codes with deterministic ordering.
- PR24 privacy-safe result assertions.
- PR25 visibility decision input.
- PR26 copy integration for user-facing copy.
- Focused Vitest coverage.

## Non-goals

- No ChatGPT App.
- No MCP server.
- No transport runtime.
- No real handlers.
- No UI.
- No Convex.
- No export, download, PDF, DOCX, send, submit, apply, or auto-apply.

## Gate Inputs

The gate accepts existing Local MCP design artifacts: visibility decision, privacy review/check, approval decision, audit event shells, PR21 handler boundary, PR22 remote transport preflight, and PR26 copy catalog entries.

Missing required inputs fail closed unless the caller explicitly disables the corresponding requirement.

## Decision Rules

- Default result is blocked.
- Missing visibility blocks.
- Disabled, admin-disabled, or privacy-blocked visibility blocks.
- Missing privacy review or privacy check blocks.
- Unsafe PR24 privacy check blocks.
- Missing approval returns review required when approval is required.
- Denied approval blocks.
- Missing audit blocks when audit is required.
- Missing or invalid handler boundary blocks when handler boundary is required.
- Remote transport is not required by default; when required, missing or blocked preflight blocks.
- Missing copy catalog returns review required when copy validation is required.

## Privacy First

Gate outputs contain only reason categories, PR26 copy, and bounded safe summaries.

They do not return raw arguments, source documents, private facts, `never_use` facts, source quote dumps, stack traces, user/session IDs, secrets, tokens, or origin/host payloads.

## Copy Integration

User-facing copy comes from PR26. The gate maps privacy blocks to `blocked_privacy`, approval states to approval copy, handler and transport states to their PR26 refusal copy, and the best state to `review_first`.

## Handler And Transport Boundaries

`ready_for_internal_review` does not mean executable, production-ready, ChatGPT App-ready, remote-approved, or safe to run.

The PR21 handler boundary remains design-only. PR22 remote transport remains a non-production design preflight only.

## Risks

- PR24 sentinel checks prove fixture absence, not complete semantic privacy.
- Future Local MCP tools must update registry, visibility, copy, and gate tests together.
- Future UI or transport work must treat this gate as one review input, not runtime permission.

## Tests

Run:

```txt
rtk npx vitest --run src/modules/local-mcp/__tests__/mcpPrivacyReviewGate.test.ts
rtk npx vitest --run src/modules/local-mcp/__tests__/*.test.ts
rtk npx tsc --noEmit
rtk git diff --check
```

## Rollback

Rollback is deletion-only:

- `docs/decisions/2026-06-11-mcp-privacy-review-gate.md`
- `my-app/src/modules/local-mcp/mcpPrivacyReviewGate.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpPrivacyReviewGate.test.ts`
