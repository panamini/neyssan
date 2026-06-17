# PR72 Implementation Brief

## PR

- Current PR: PR72 - Artifact Revision Loop.
- Base branch: `application-os-foundation`.
- Head branch: `codex/pr72-artifact-revision-loop`.
- PR71 merge confirmed: PR #197 merged at `2026-06-17T15:42:41Z`, merge commit `eb3261b2ca26da044fe51c69f4e2c51294e8d3d5`.

## Repo State

- `application-os-foundation` and `origin/application-os-foundation` both resolve to `eb3261b2ca26da044fe51c69f4e2c51294e8d3d5`.
- Local PR72 branch was created from synced `application-os-foundation`.
- Working tree was clean before implementation.
- `stash@{0}: pre-pr61-untracked-docs-quarantine` exists and was not restored, inspected, deleted, or committed.

## Controlling Roadmap Section

- Canonical roadmap: `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`.
- Current item: Phase 9, PR72 - Artifact Revision Loop.
- Required scope: controlled artifact revision iterations after PR71 edit-request state.

## Allowed Scope

- Add deterministic local MCP artifact revision loop boundary logic.
- Support revised artifact summaries for `resume_variant`, `cover_letter`, and `application_package`.
- Accept only PR71 safe edit-request summaries with enum-only revision intents.
- Construct a new restricted generated artifact revision internally through the PR68 boundary.
- Return only safe revision summary metadata to model-visible and component-visible surfaces.
- Keep revised previews human-review-required and not approved for preview, export, download, send, submit, or apply.
- Add safe revision counters, lineage refs, and redacted non-persistent revision audit metadata.
- Update PR65 component data policy only for exact PR72 safe enum/key/kind support.
- Update the roadmap progress ledger to record PR71 merged and PR72 active.

## Forbidden Scope

- No PR73 export/download policy.
- No resume export, cover letter export, application package export, send, submit, apply, or write actions.
- No runtime/UI/server/tool wiring, production connector behavior, `window.openai`, iframe/widget integration, Convex schema/write changes, outbound HTTP, LLM/model calls, package changes, or lockfile changes.
- No raw CV/resume/job/proposal/application/cover-letter text, source quotes, private facts, `never_use` facts, full generated artifacts, identity/session/token/account data, Convex document IDs, raw tool args, raw `_meta`, or raw audit entries in returned outputs.

## Proposed Files To Touch

- `docs/plans/2026-06-17-pr72-artifact-revision-loop-brief.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `my-app/src/modules/local-mcp/mcpGeneratedArtifactRevisionLoop.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpGeneratedArtifactRevisionLoop.test.ts`
- `my-app/src/modules/local-mcp/mcpComponentDataPolicy.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpComponentDataPolicy.test.ts`

## Files Forbidden To Touch

- Package and lockfiles.
- Convex schema, mutations, actions, and generated runtime files.
- UI, route, server, tool registry, `tools/list`, `tools/call`, bridge, iframe, or widget files.
- PR68, PR69, PR70, and PR71 implementation files unless a strict integration blocker appears.

## Expected Tests

- Focused PR72 revision loop tests.
- Direct PR65 component data policy tests for each new PR72 safe key/string/kind allowance.
- Nearby PR71 human approval workflow, PR70 cover letter/application message preview, PR69 resume variant preview, PR68 generated artifact boundary, PR65 component data policy, and PR67 UX tests.
- Full local MCP Vitest suite.
- `rtk npx tsc --noEmit`.
- `rtk npx convex codegen`.
- `rtk npx fallow audit --changed-since application-os-foundation --format compact`.
- `rtk git diff --check application-os-foundation...HEAD`.

## Expected Source Guards

- Reject runtime, browser, React, iframe, tool registration, `tools/list`, `tools/call`, network, model, Convex write, export/download/send/submit/apply, PR73 export behavior, prompt templates, package/lockfile, and schema changes.
- Scan raw source for forbidden imports/package/schema paths.
- Scan stripped source for runtime/browser/model/network/write/export tokens.

## Acceptance Criteria

- PR72 accepts only PR71 `request_edit` safe-summary state.
- Revision intents are safe enums only: `shorter`, `more_formal`, `focus_on_requirements`, `preserve_never_use`.
- Stale, approved, rejected, malformed, contradictory, hostile-proxy, symbol-key, and unsafe inputs fail closed without throwing.
- New restricted revised artifact is created internally through PR68-compatible shape.
- Returned surfaces expose only safe revision summary, safe refs, counts, categories, flags, and redacted audit metadata.
- Full previous and revised generated text never appears in model-visible, component-visible, `_meta`, content, props, bridge payload, state snapshot, model-context update, refusal, or serialized result surfaces.
- All export/download/send/submit/apply approvals remain false.

## Rollback Plan

- Revert the PR72 module and test file.
- Revert the narrow PR72 additions to component data policy and its tests.
- Revert the ledger and this brief.
- No data migration, package change, schema change, or runtime cleanup is required.

## Status

READY_TO_IMPLEMENT
