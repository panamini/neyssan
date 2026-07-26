# PR71 Implementation Brief

## PR

- Current PR: PR71 - Human Approval Workflow for Generated Artifacts.
- Base branch: `application-os-foundation`.
- Head branch: `codex/pr71-human-approval-workflow-generated-artifacts`.
- PR70 merge confirmed: PR #196 merged at `2026-06-17T04:57:58Z`, merge commit `84e22971951f618b3b86ab3ae57d1294e1177485`.

## Repo State

- `application-os-foundation` and `origin/application-os-foundation` both resolve to `84e22971951f618b3b86ab3ae57d1294e1177485`.
- Local PR71 branch starts with no diff from `application-os-foundation`.
- Working tree was clean before this brief.
- `stash@{0}: pre-pr61-untracked-docs-quarantine` exists and is not restored, inspected, deleted, or committed.

## Controlling Roadmap Section

- Canonical roadmap: `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`.
- Current item: Phase 9, PR71 - Human Approval Workflow for Generated Artifacts.
- Required scope: approval state, diff/review, reject/edit path, redacted audit event.

## Allowed Scope

- Add deterministic local MCP human approval workflow boundary logic.
- Support resume variant preview, cover letter preview, and application package/message preview artifacts.
- Represent safe workflow states: `human_review_required`, `approved_for_preview`, `rejected`, `edit_requested`, `blocked`.
- Accept only explicit safe human decision enums for approve preview, reject preview, or request enum-only edits.
- Return safe diff/review metadata and redacted audit metadata only.
- Keep model-visible and component-visible outputs safe-summary-only through PR65 policy.
- Update the roadmap progress ledger to record PR70 merged and PR71 active.

## Forbidden Scope

- No PR72 artifact revision loop or regeneration.
- No export/download policy, resume export, cover letter/application package export, send, submit, apply, or write actions.
- No LLM/model calls, outbound HTTP, runtime/UI/server/tool wiring, production connector behavior, `window.openai`, iframe/widget integration, schema changes, package or lockfile changes, Convex writes, or persistence.
- No raw CV/resume/job/proposal/application/cover-letter text, source quotes, private facts, `never_use` facts, full generated artifacts, identity/session/token/account data, Convex document IDs, raw tool args, raw `_meta`, or raw audit entries in outputs.

## Proposed Files To Touch

- `my-app/src/modules/local-mcp/mcpGeneratedArtifactHumanApprovalWorkflow.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpGeneratedArtifactHumanApprovalWorkflow.test.ts`
- `my-app/src/modules/local-mcp/mcpComponentDataPolicy.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpComponentDataPolicy.test.ts`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `docs/plans/2026-06-17-pr71-human-approval-workflow-generated-artifacts-brief.md`

## Files Forbidden To Touch

- Package and lockfiles.
- Convex schema, mutations, actions, and generated runtime files.
- UI, route, server, tool registry, `tools/list`, `tools/call`, bridge, iframe, or widget files.
- PR68, PR69, and PR70 implementation files unless a strict integration blocker appears.

## Expected Tests

- Focused PR71 workflow tests.
- Targeted PR65 component data policy tests for every new safe key/string/kind/ref/capability allowance.
- Nearby PR67 component UX, PR68 generated artifact boundary, PR69 resume preview, and PR70 cover letter/application message preview tests.
- Full local MCP Vitest suite.
- `rtk npx tsc --noEmit`.
- `rtk npx convex codegen`.
- `rtk npx fallow audit --changed-since application-os-foundation --format compact`.
- `rtk git diff --check application-os-foundation...HEAD`.

## Expected Source Guards

- Reject runtime, browser, React, iframe, tool registration, `tools/list`, `tools/call`, network, model, Convex write, export/download/send/submit/apply, PR72 revision loop, regeneration, prompt template, package/lockfile, and schema changes.
- Scan raw source for forbidden imports/package/schema paths.
- Scan stripped source for runtime/browser/model/network/write/export tokens.

## Acceptance Criteria

- Safe approve-preview decision sets only `approvedForPreview: true`.
- `approvedForExport`, `approvedForDownload`, `approvedForSend`, `approvedForSubmit`, and `approvedForApply` remain `false`.
- Reject/edit are state-only and do not regenerate or persist anything.
- Edit requests use safe enum-only intent, no free-form text.
- Stale, malformed, contradictory, model-only, unknown, hostile-proxy, symbol-key, and unsafe inputs fail closed without throwing.
- Diff/review and audit outputs contain only safe metadata and never full generated artifact content.
- Model-visible and component-visible surfaces pass component data policy.

## Rollback Plan

- Revert the new PR71 module and test file.
- Revert the narrow PR71 additions to component data policy and its tests.
- Revert the ledger and this brief.

## Status

READY_TO_IMPLEMENT
