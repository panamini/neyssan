# PR25 - MCP Tool Visibility Policy

Date: 2026-06-11
Status: implemented
Scope: pure TypeScript policy for Local MCP tool visibility.

## Objective

Turn the PR23 visibility model into an executable policy over the existing PR18-PR24 Local MCP boundaries.

The policy answers one question: given a local tool and boundary state, should it be hidden, listed as disabled, listed as dry-run, approval-gated, privacy-blocked, admin-disabled, or ready for review.

## Delivered

- `mcpToolVisibilityPolicy.ts` with closed visibility states and reason codes.
- Deterministic evaluator for one Local MCP tool.
- Deterministic list builder for all current Local MCP tools.
- Assertion helper for policy output shape and safe summaries.
- PR24 privacy fixture assertion on returned decisions.
- Focused Vitest coverage.

## Non-goals

- no UI
- no ChatGPT App
- no MCP server
- no transport runtime
- no OAuth
- no real handlers
- no Convex
- no export/send/submit/apply

## Visibility states

The state set is closed:

- `hidden`
- `listed_disabled`
- `listed_dry_run`
- `listed_requires_approval`
- `listed_ready_for_review`
- `blocked_by_privacy`
- `disabled_by_admin`

Default state is hidden.

`listed_ready_for_review` does not mean executable, production-ready, ChatGPT App-ready, or approved for a real handler.

## Policy inputs

The policy accepts the Local MCP registry, PR18 descriptors, PR19 call envelope and validation, PR20 approval and audit shells, PR21 future handler boundary, PR22 remote transport config/preflight, PR24 privacy check, and explicit admin/listing flags.

Inputs are read-only and cloned or rebuilt where needed. The policy has no side effects.

## Decision rules

Admin disabled overrides everything.

Privacy block overrides dry-run listing, approval listing, and ready-for-review.

Remote transport blocked is documented as `listed_disabled` only when disabled listing is explicitly allowed; otherwise the policy returns `hidden`.

Dry-run listing requires explicit `allowDryRunListing`, valid descriptors, completed privacy review, and a safe PR24 privacy check.

Approval-required listing requires enough boundary context to know approval is missing.

Ready-for-review requires valid descriptor, safe privacy check, completed privacy review, approved approval when required, audit shell presence, PR21 future boundary presence, and PR22 non-production preflight when remote listing is requested.

## Privacy integration

Every returned decision uses a bounded safe summary:

- `Hidden by default.`
- `Tool disabled.`
- `Dry run only.`
- `Approval required.`
- `Blocked. Review privacy.`
- `Ready for review. No handler executed.`

The policy runs PR24 `assertLocalMcpPrivacySafeOutput` against each returned decision.

Reasons are deterministic, sorted, and do not include raw arguments, source docs, private facts, `never_use`, secrets, tokens, sessions, stack traces, or host/origin payloads.

## Handler/transport boundaries

PR21 handler boundary presence means only a future design boundary is present. It is not executable.

PR22 remote transport preflight can contribute blocked or non-production spike review state. It is not a transport runtime.

## Risks

- The policy proves sentinel absence, not full semantic privacy.
- Future tools must update the registry, projection, and policy tests together.
- A future UI must treat `listed_ready_for_review` as review-only, not callable.

## Tests

Run:

```txt
rtk npx vitest --run src/modules/local-mcp/__tests__/mcpToolVisibilityPolicy.test.ts
rtk npx vitest --run src/modules/local-mcp/__tests__/*.test.ts
rtk npx tsc --noEmit
rtk git diff --check
```

## Rollback

Rollback is deletion-only:

- delete `docs/decisions/2026-06-11-mcp-tool-visibility-policy.md`
- delete `my-app/src/modules/local-mcp/mcpToolVisibilityPolicy.ts`
- delete `my-app/src/modules/local-mcp/__tests__/mcpToolVisibilityPolicy.test.ts`
