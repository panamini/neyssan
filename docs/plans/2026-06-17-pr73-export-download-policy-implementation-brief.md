# PR73 Implementation Brief

## PR

- Current PR: PR73 - Export/Download Policy Implementation.
- Base branch: `application-os-foundation`.
- Head branch: `codex/pr73-export-download-policy-implementation`.
- PR72 merge confirmed: PR #198 merged at `2026-06-17T17:03:37Z`, merge commit `fbcc5cb2497d163c45497ba9bb1ae068da2e5e6e`.

## Repo State

- `application-os-foundation` fast-forward sync passed before implementation.
- Local PR73 branch was created from synced `application-os-foundation` at `fbcc5cb2497d163c45497ba9bb1ae068da2e5e6e`.
- Working tree was clean before implementation.
- `stash@{0}: pre-pr61-untracked-docs-quarantine` exists and was not restored, inspected, deleted, or committed.

## Controlling Roadmap Section

- Canonical roadmap: `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`.
- Current item: Phase 10, PR73 - Export/Download Policy Implementation.
- Required scope: authorize export/download eligibility only after explicit safe confirmation and all prior gates.

## Allowed Scope

- Add deterministic local MCP export/download policy boundary logic.
- Support policy metadata for `resume_variant`, `cover_letter`, and `application_package`.
- Accept only PR71 approved preview safe-summary state.
- Require artifact freshness and revision-lineage state where applicable.
- Require explicit safe confirmation enum.
- Return safe policy decision metadata only.
- Add safe suggested filename, retention/delete/rollback, and redacted audit metadata only.
- Update PR65 component data policy only for exact PR73 safe enum/key/kind/action-label support.
- Update the roadmap progress ledger to record PR72 merged and PR73 active.

## Forbidden Scope

- No PR74 resume export.
- No PR75 cover letter or application package export.
- No downloadable files, file bytes, download URLs, MIME payloads, blobs, base64, attachment objects, filesystem paths, or storage writes.
- No send, submit, apply, upload, persist, external cleanup, Convex mutation/action/write, or external service call.
- No runtime/UI/server/tool wiring, production connector behavior, `window.openai`, iframe/widget integration, `tools/list`, `tools/call`, OAuth/token/account-link runtime behavior, schema changes, package changes, lockfile changes, outbound HTTP, or LLM/model calls.
- No raw CV/resume/job/proposal/application/cover-letter text, source quotes, private facts, `never_use` facts, full generated artifacts, identity/session/token/account data, Convex document IDs, raw tool args, raw `_meta`, or raw audit entries in returned outputs.

## Proposed Files To Touch

- `docs/plans/2026-06-17-pr73-export-download-policy-implementation-brief.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `my-app/src/modules/local-mcp/mcpGeneratedArtifactExportDownloadPolicy.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpGeneratedArtifactExportDownloadPolicy.test.ts`
- `my-app/src/modules/local-mcp/mcpComponentDataPolicy.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpComponentDataPolicy.test.ts`

## Files Forbidden To Touch

- Package and lockfiles.
- Convex schema, mutations, actions, generated runtime files, and storage code.
- UI, route, server, tool registry, `tools/list`, `tools/call`, bridge, iframe, or widget files.
- PR68, PR69, PR70, PR71, and PR72 implementation files unless a strict integration blocker appears.

## Expected Tests

- Focused PR73 export/download policy tests.
- Direct PR65 component data policy tests for each new PR73 safe key/string/kind/action-label allowance.
- Nearby PR72 revision loop, PR71 human approval workflow, PR70 cover letter/application message preview, PR69 resume variant preview, PR68 generated artifact boundary, PR65 component data policy, and PR67 UX tests.
- Full local MCP Vitest suite.
- `rtk npx tsc --noEmit`.
- `rtk npx convex codegen`.
- `rtk npx fallow audit --changed-since application-os-foundation --format compact`.
- `rtk git diff --check application-os-foundation...HEAD`.

## Expected Source Guards

- Reject runtime, browser, React, iframe, tool registration, `tools/list`, `tools/call`, network, model, Convex write, real export/download execution, send/submit/apply, prompt templates, package/lockfile, and schema changes.
- Scan raw source for forbidden imports/package/schema paths and file/blob/download payload behavior.
- Scan stripped source for runtime/browser/model/network/write/export execution tokens.

## Acceptance Criteria

- PR73 accepts only PR71 `approve_preview` safe-summary state.
- Confirmation is safe enum only: `confirm_export_download_policy`.
- Freshness and revision lineage must match the approved artifact; revised-after-approval state blocks.
- Retention/delete/rollback policy metadata must be satisfied before allowing policy eligibility.
- Returned surfaces expose only safe policy summary, safe refs, counts, categories, flags, suggested filename metadata, retention/delete/rollback metadata, and redacted audit metadata.
- No real export/download action is executed and no file bytes, URLs, paths, blobs, MIME payloads, attachments, or base64 are returned.
- Full generated text never appears in model-visible, component-visible, `_meta`, content, props, bridge payload, state snapshot, model-context update, audit, refusal, or serialized result surfaces.
- Runtime capabilities remain blocked; the result only says the artifact is eligible for a later export PR.

## Rollback Plan

- Revert the PR73 module and test file.
- Revert the narrow PR73 additions to component data policy and its tests.
- Revert the ledger and this brief.
- No data migration, package change, schema change, generated artifact cleanup, storage cleanup, or runtime cleanup is required.

## Status

READY_TO_IMPLEMENT
