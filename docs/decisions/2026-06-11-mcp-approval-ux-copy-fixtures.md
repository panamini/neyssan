# PR26 - MCP Approval UX Copy Fixtures

Date: 2026-06-11
Status: implemented
Scope: pure TypeScript copy fixtures and tests for Local MCP approval/refusal UX.

## Objective

Create an executable copy catalog for future Local MCP approval, refusal, privacy, visibility, and transport UX surfaces.

## Delivered

- Closed copy catalog with stable exact strings.
- Fixture outputs for every copy key.
- Mapping from PR19 call error codes to copy keys.
- Mapping from PR22 transport block reasons to copy keys.
- Mapping from PR25 visibility states to copy keys.
- Style and privacy tests for every copy output.

## Non-goals

- No ChatGPT App.
- No MCP server.
- No transport runtime.
- No real handlers.
- No UI.
- No Convex.
- No export/send/submit/apply.

## Copy Catalog

The catalog uses short, boring copy only. It covers approval required, approval denied, expired approval, privacy review, visibility states, transport blocks, handler boundary states, and safe generic failures.

Copy fixtures do not show anything to users yet. Messages are for future UI surfaces and tests.

## Mapping Rules

- PR19 error codes map to one copy key each.
- PR22 transport block reasons map to one copy key each.
- PR25 visibility states map to one copy key each.
- `listed_ready_for_review` maps to `review_first`, which is non-executable copy.

## Style Rules

- Word counts split on whitespace.
- Button copy is three words or fewer and does not end with a period.
- Only `Approve this tool?` may use a question mark.
- Default user-facing copy avoids export/send/submit/apply and executable readiness language.

## Privacy Integration

Every catalog entry and every fixture output passes PR24 `assertLocalMcpPrivacySafeOutput`.
Unsafe sentinel-bearing copy is rejected before a fixture output returns.

## Risks

- This is not wired to UI yet, so future surfaces still need their own integration tests.
- The copy catalog intentionally duplicates current union members for exhaustiveness checks; new union values should fail TypeScript mapping coverage.

## Tests

- `rtk npx vitest --run src/modules/local-mcp/__tests__/mcpApprovalUxCopyFixtures.test.ts`
- `rtk npx vitest --run src/modules/local-mcp/__tests__/*.test.ts`
- `rtk npx tsc --noEmit`

## Rollback

Rollback is deletion-only:

- `docs/decisions/2026-06-11-mcp-approval-ux-copy-fixtures.md`
- `my-app/src/modules/local-mcp/mcpApprovalUxCopyFixtures.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpApprovalUxCopyFixtures.test.ts`
