# PR75 Implementation Brief

## Current PR

- PR: PR75
- Title: Cover Letter / Application Package Export
- Base branch: `application-os-foundation`
- Head branch: `codex/pr75-cover-letter-application-package-export`
- Confirmed PR74 GitHub PR: #200, merged
- Confirmed PR74 merge commit: `7796a41da34e7e18675417a6a1f7adc46b5505d5`
- Local base state before branch: `application-os-foundation` fast-forward synced to `7796a41da34e7e18675417a6a1f7adc46b5505d5`
- Working tree before implementation: clean
- Stash note: `stash@{0}: pre-pr61-untracked-docs-quarantine` exists and was not touched

## Controlling Roadmap

- Canonical roadmap: `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`
- Controlling section: Phase 10, PR75 - Cover Letter / app pkg Export
- Roadmap result: approved cover letter / application package downloadable material
- Exact next PR after PR75: PR76 - Write Action Framework

## Merged Decisions

- PR68 separates safe summaries from restricted generated artifact content.
- PR70 represents application message preview as `application_package`, not a new `application_message` artifact kind.
- PR71 approval is preview approval only: `approvedForPreview`, not send/submit/apply permission.
- PR72 revision freshness must be checked before export.
- PR73 allows export/download policy metadata only and creates no file bytes, URL, persistence, or write action.
- PR74 created the resume export pattern: controlled local markdown representation, summary-only visible surfaces, restricted export payload, deterministic metadata/checksum.

## Current Repo State

- PR74 is merged on GitHub as #200.
- Local branch was created from the exact PR74 merge commit.
- Progress ledger is stale before PR75 edits: it still lists PR74 as active and PR75 as next.
- This PR may update that ledger to record PR74 merged and PR75 active.

## Files Read Before Coding

- `AGENTS.md`
- `/Users/pana/.codex/RTK.md`
- `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `my-app/src/modules/local-mcp/mcpGeneratedArtifactBoundary.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpGeneratedArtifactBoundary.test.ts`
- `my-app/src/modules/local-mcp/mcpCoverLetterApplicationMessagePreview.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpCoverLetterApplicationMessagePreview.test.ts`
- `my-app/src/modules/local-mcp/mcpGeneratedArtifactHumanApprovalWorkflow.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpGeneratedArtifactHumanApprovalWorkflow.test.ts`
- `my-app/src/modules/local-mcp/mcpGeneratedArtifactRevisionLoop.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpGeneratedArtifactRevisionLoop.test.ts`
- `my-app/src/modules/local-mcp/mcpGeneratedArtifactExportDownloadPolicy.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpGeneratedArtifactExportDownloadPolicy.test.ts`
- `my-app/src/modules/local-mcp/mcpResumeExport.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpResumeExport.test.ts`
- `my-app/src/modules/local-mcp/mcpComponentDataPolicy.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpComponentDataPolicy.test.ts`
- `my-app/src/modules/local-mcp/mcpComponentErrorLoadingRefusalUx.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpComponentErrorLoadingRefusalUx.test.ts`
- `my-app/src/modules/local-mcp/privacyRedactionFixtures.ts`
- `my-app/package.json`
- `/Volumes/video/git/twoweeks-wiki/WIKI_SCHEMA.md`
- `/Volumes/video/git/twoweeks-wiki/AGENTS.md`
- `/Volumes/video/git/twoweeks-wiki/CLAUDE.md`
- `/Volumes/video/git/twoweeks-wiki/wiki/hot.md`
- `/Volumes/video/git/twoweeks-wiki/wiki/index.md`
- `/Volumes/video/git/twoweeks-wiki/wiki/tech/export-pipeline.md`
- `/Volumes/video/git/twoweeks-wiki/wiki/sources/2026-06-11-mcp-chatgpt-app-readiness-spec.md`
- `/Volumes/video/git/twoweeks-wiki/wiki/sources/2026-06-11-chatgpt-app-end-to-end-safety-audit.md`

## Files Proposed To Touch

- `docs/plans/2026-06-17-pr75-cover-letter-application-package-export-implementation-brief.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `my-app/src/modules/local-mcp/mcpCoverLetterApplicationPackageExport.ts`
- `my-app/src/modules/local-mcp/__tests__/mcpCoverLetterApplicationPackageExport.test.ts`
- `my-app/src/modules/local-mcp/mcpComponentDataPolicy.ts`, only if exact PR75 safe metadata enums require it
- `my-app/src/modules/local-mcp/__tests__/mcpComponentDataPolicy.test.ts`, only if policy keys/enums change

## Files Forbidden To Touch

- `package.json` and lockfiles
- Convex schema, mutations, actions, internal mutations, internal actions
- runtime/server/route/transport/tool wiring
- UI/React/component runtime files
- production `tools/list` or `tools/call`
- PR68-PR74 implementation files unless strict integration requires it

## Allowed Scope

- Add deterministic local MCP export boundary logic for `cover_letter` and `application_package`.
- Require allowed PR73 policy, approved PR71 state, fresh PR72 lineage/no pending revision, explicit PR75 confirmation, retention/delete/rollback safety, safe filename metadata, and no send/submit/apply/upload intent.
- Return safe metadata in visible surfaces and restricted export content only in controlled `exportPayload` fields.
- Use deterministic `.md` text representations and deterministic checksum without adding dependencies.

## Forbidden Scope

- No PR76 write-action framework.
- No send, submit, apply, upload, email, delivery, recipient/channel/subject/thread/provider metadata.
- No real download URL, object URL, signed URL, filesystem path, file write, storage write, persistence, network, LLM/model call, OAuth/token/account-link runtime, UI/runtime/server/transport wiring, package, lockfile, or schema change.
- No raw CV/resume/job/proposal/application/cover-letter text in any model/component-visible surface, audit metadata, `_meta`, props, bridge payload, state snapshot, model-context update, refusal, log, or debug payload.

## Expected Tests

- Focused PR75 Vitest for allowed cover letter and application package exports.
- Negative PR75 tests for wrong artifact kind, blocked policy, stale state, unsafe confirmations, unsafe content, unsafe metadata, send/submit/apply/upload/delivery fields, malformed inputs, hostile descriptors/proxies, and leakage across visible surfaces.
- Direct component-data-policy tests if new PR75 safe strings/kinds/metadata are added.
- Regression tests for PR74, PR73, PR72, PR71, PR70, PR69, PR68, PR65, and PR67.
- Full local MCP Vitest suite.
- `rtk npx tsc --noEmit`
- `rtk npx convex codegen`
- `rtk npx fallow audit --changed-since application-os-foundation --format compact`
- `rtk git diff --check application-os-foundation...HEAD`

## Expected Source Guards

- No `window.openai`, `postMessage`, `React`, `.tsx`, `.jsx`, `iframe`, `registerTool`, `registerResource`, `tools/list`, `tools/call`.
- No `fetch`, `axios`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `OpenAI`, `chat.completions`, `responses.create`.
- No `mutation(`, `action(`, `internalMutation(`, `internalAction(`.
- No real `download(`, `send(`, `submit(`, `apply(`, `upload`, `writeFile`, `createWriteStream`, `fs.`, `URL.createObjectURL`, `signedUrl`.
- No delivery/send metadata keys such as `sendTarget`, `deliveryChannel`, `providerMessageId`, `threadId`, `recipient`, `emailSubject`, or `emailBody`.

## Acceptance Criteria

- Approved cover letter export succeeds only through PR73 policy and PR75 confirmation.
- Approved application package export succeeds only through PR73 policy and PR75 confirmation.
- Full export content exists only in controlled export payloads.
- Visible surfaces contain metadata only and pass `mcpComponentDataPolicy`.
- Blocked/refusal results contain no export payload.
- Outputs are deterministic for identical inputs.
- Static guards confirm no runtime, network, model call, storage, filesystem, or write/send/apply behavior.

## Rollback Plan

- Revert this PR branch commit.
- Remove the new PR75 module, test file, ledger update, and brief.
- If policy keys are added, revert only the PR75 policy/test additions.
- No data migration, persistence cleanup, storage cleanup, dependency rollback, or runtime disable step is needed.

## Decision

READY_TO_IMPLEMENT
