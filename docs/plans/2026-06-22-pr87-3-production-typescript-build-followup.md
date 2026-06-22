# PR87.3 Production TypeScript Build Follow-up

## Implementation Brief

Current PR:

- PR87.3 - Production TypeScript Build Follow-up
- Base branch: `application-os-foundation`
- Branch: `codex/pr87-3-production-typescript-build-followup`
- Starting HEAD: `a73a51212177253ddaac9d34d77dd0943593b478`

Controlling roadmap/ledger:

- `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md` - PR87 production deployment gate remains blocked until production build is green.
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md` - current implementation PR is PR87.3; exact next PR is PR87.3 after PR87.2 merged with `BLOCKED_PRODUCTION_TYPESCRIPT_BUILD_REMAINING`.
- `docs/plans/2026-06-21-pr87-2-production-typescript-build-unblock.md` - PR87.2 ended with 203 build errors and first blocker `src/components/cv/SectionEditorSheet.tsx(1632,24) TS2352`.

Merged decisions constraining scope:

- PR87.3 is production TypeScript build follow-up only.
- PR88/private beta and PR89/public launch remain blocked.
- PR80-live, approved answer-copy, production billing, provider/OAuth/token work, deployment, lint-wide cleanup, and npm audit remain blocked or separate gates.
- No package, lockfile, schema, production deployment config, billing/OAuth/provider/token, PR80-live, or answer-copy files should be touched.

Current build state:

- `rtk npm run build` in `my-app`: fails during `tsc -b`.
- Starting build summary: 203 TypeScript errors.
- Parsed file-scoped diagnostics: 202.
- First failure: `src/components/cv/SectionEditorSheet.tsx(1632,24) TS2352`.
- Full baseline log: `/Users/pana/.lean-ctx/tee/2026-06-22_175014_rtk_npm_run_build.log`.
- `rtk npx tsc --noEmit --pretty false` in `my-app`: passes.

Top starting clusters:

- `src/contexts/CvLibraryContext.tsx`: 23
- `src/pages/ProposalForge.tsx`: 20
- `src/pages/CvForge.tsx`: 16
- `src/modules/local-mcp/mcpReadOnlyTwoweeksDataAdapter.ts`: 15
- `src/modules/local-mcp/mcpReadOnlyReviewComponent.ts`: 13

Repeated TypeScript codes:

- `TS2339`: 44
- `TS2345`: 41
- `TS2322`: 39
- `TS18046`: 36
- `TS6307`: 11

Files read before coding:

- `AGENTS.md`
- `/Users/pana/.codex/RTK.md`
- `docs/plans/2026-06-12-chatgpt-app-implementation-roadmap-agent-contract.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
- `docs/plans/2026-06-21-pr87-production-deployment-gate.md`
- `docs/plans/2026-06-21-pr87-1-production-build-lint-gate-unblock.md`
- `docs/plans/2026-06-21-pr87-2-production-typescript-build-unblock.md`
- `my-app/package.json`
- `my-app/tsconfig.json`
- `my-app/tsconfig.app.json`
- `my-app/tsconfig.node.json`
- `my-app/src/components/cv/SectionEditorSheet.tsx`
- `my-app/src/components/structured-blocks/SkillsDrawer.tsx`
- `my-app/src/types/cvDocument.ts`
- `my-app/src/components/cv/__tests__/SectionEditorSheet.test.tsx`

Files proposed to touch based on current failures:

- `my-app/src/components/cv/SectionEditorSheet.tsx` - first build blocker, normalize generic structured skill records to `ISkillItem`.
- Further files only if they become the next current first blocker after rerunning build.
- `docs/plans/2026-06-22-pr87-3-production-typescript-build-followup.md` - required PR87.3 evidence doc.
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md` - factual PR87.3 ledger update.

Files forbidden to touch:

- `package.json`
- lockfiles
- TypeScript strictness/build-exclude config
- `my-app/convex/schema.ts`
- production deployment config
- billing/OAuth/provider/token files
- PR80-live/answer-copy surfaces

Allowed scope:

- Narrow TypeScript fixes in files named by the current production build.
- Runtime-preserving type narrowing, nullable/undefined handling, shape projection, import/export repair, and safe guards.
- Focused tests for touched modules if behavior changes.

Forbidden scope:

- PR88/private beta, PR89/public launch, production deployment work, lint-wide cleanup, npm audit fixes.
- Billing, checkout, webhooks, subscriptions, billing portal.
- Provider integration, OAuth callback/token exchange/token storage.
- Workspace/team/admin runtime.
- PR80-live submit/apply and approved answer-copy.
- Package, lockfile, schema, or strictness changes without maintainer approval.

Expected tests:

- `rtk npm run build`
- `rtk npx tsc --noEmit --pretty false`
- Focused touched-module tests when applicable.
- `rtk git diff --check`
- `rtk git status --short`

Expected grep/source guards:

- Added `ts-ignore`
- Added `ts-expect-error`
- Broad `as any`
- `skipLibCheck`
- TypeScript strictness weakening or build excludes if tsconfig files are touched
- Package/lockfile changes
- Secret-looking Stripe values without printing secret contents

Acceptance criteria:

- Either `rtk npm run build` passes, or remaining production build errors are reduced/isolated and documented.
- `rtk npx tsc --noEmit --pretty false` remains green.
- No forbidden scope or forbidden files are touched.
- No broad `any`, `ts-ignore`, `ts-expect-error`, strictness weakening, package, lockfile, schema, or secret changes are introduced.
- This document and the ledger record the final build state.

Rollback plan:

- Revert the PR87.3 commit(s), or restore only the touched files with `rtk git restore -- <path>` before commit.
- No runtime config, schema, package, lockfile, billing, provider/OAuth/token, deployment, PR80-live, or answer-copy state should need rollback.

Implementation brief status: `READY_TO_IMPLEMENT`

## Starting Evidence

- Starting branch/head: `codex/pr87-3-production-typescript-build-followup` at `a73a51212177253ddaac9d34d77dd0943593b478`.
- Base verification: local `HEAD` and `origin/application-os-foundation` both resolved to `a73a51212177253ddaac9d34d77dd0943593b478`.
- PR #227 merge commit included: `a73a51212177253ddaac9d34d77dd0943593b478`.
- No open remote PR existed for `codex/pr87-3-production-typescript-build-followup` before branch creation.
- Starting build command: `rtk npm run build`.
- Starting build result: failed during `tsc -b`.
- Starting first failure: `src/components/cv/SectionEditorSheet.tsx(1632,24) TS2352`.
- Starting TypeScript error count: 203 errors in the compressed build summary; 202 parsed file-scoped diagnostics.
- Standalone no-emit result: `rtk npx tsc --noEmit --pretty false` passed.

## Work Log

- Cleared the first `SectionEditorSheet.tsx` skill drawer blocker by normalizing generic structured skill records into `ISkillItem` with valid `name`, `level`, `bucket`, and optional string fields.
- Cleared a `FloatingAiToolbar.tsx` React/framer ref type mismatch by using `React.RefObject<HTMLDivElement>` for the panel ref.
- Cleared `OnboardingReplay.tsx` typography and locale narrowing errors by reusing `resolveVerbatiFontPairId` and `normalizeUiMessageLocale`.
- Cleared `ProposalsList.tsx` timestamp typing without changing the product sort contract: saved proposals now sort by latest activity, `updatedAt ?? _creationTime`.
- Cleared the `CvLibraryContext.tsx` document-decoration object narrowing cluster by reading passthrough metadata through `normalizeDocumentDecoration`.
- Cleared resume editor drift in `ResumeOneColAtsPage.tsx`, `ResumeSanatAsymmetricPage.tsx`, and `RichInlineEditor.tsx`.
- Cleared small shared/library blockers in `document-decoration.ts`, `editor-ai-selection.ts`, `export-renderers.ts`, `visibleJobVerdict.ts`, `ui-preferences.ts`, and `career-knowledge/resolver.ts`.
- Cleared narrow local-MCP tuple, readonly field, unknown-array, audit-count, and envelope field narrowing blockers in the touched local-MCP modules.
- Updated `SectionEditorSheet.test.tsx` to exercise the current skill-suggestion select and dismiss accessible labels.

## Review Fix Evidence

- Review blocker fixed: `ProposalsList.tsx` restores saved-proposal latest-activity sorting with typed `updatedAt?: number` / `createdAt?: number` fields on `SavedProposalRecord`; no broad `any` or type weakening was added.
- Regression test added: `ProposalsList.heading-isolation.test.tsx` now uses proposal A with older `_creationTime` and newer `updatedAt`, proposal B with newer `_creationTime` and no `updatedAt`, and asserts A renders first.
- Existing targeted test failure resolved: `ProposalsList.toolbar-grouping.test.tsx` was stale against current copy/accessibility (`Proposal Library`, `0 draft proposals and 2 saved proposals`) and current default sort selection (`beta` when no `updatedAt` is present). The component copy was not changed.
- Targeted lint introduced by PR87.3 changed lines fixed: the unnecessary local-MCP `as readonly []` assertions were replaced by a typed frozen empty tuple constant, and the unnecessary validation failure assertion in `localMcpToolsCallFixture.ts` was removed.
- CV normalization choice documented: `documentDecoration` is treated as a closed shape in local `DocumentDecoration` and Convex validators, so `CvLibraryContext.tsx` uses `normalizeDocumentDecoration` at the runtime overlay boundary instead of preserving unknown decoration keys.
- Skills normalization choice documented: `ISkillItem.level` is required by `cvDocument.ts`, so skill drawer records with missing/invalid level are normalized to the existing neutral `"Intermediate"` level before entering `SkillsDrawer`.
- Remaining targeted ESLint on all changed files is still red due inherited large-file issues outside the review-fix lines; the narrow local-MCP introduced lint subset now passes.

## Final Evidence

Final build command:

- `rtk npm run build`
- Result: failed during `tsc -b`
- Final build log after review fixes: `/Users/pana/.lean-ctx/tee/2026-06-22_193346_rtk_npm_run_build.log`
- Final compressed build summary: 145 TypeScript errors
- Final parsed file-scoped diagnostics: 144
- Final first blocker: `src/modules/local-mcp/mcpComponentErrorLoadingRefusalUx.ts(608,3) TS2322`

Top final clusters:

- `src/pages/ProposalForge.tsx`: 20
- `src/pages/CvForge.tsx`: 16
- `src/modules/local-mcp/mcpReadOnlyTwoweeksDataAdapter.ts`: 15
- `src/modules/local-mcp/mcpReadOnlyReviewComponent.ts`: 13
- `src/modules/local-mcp/mcpCoverLetterApplicationPackageExport.ts`: 9
- `src/pages/SettingsPage.tsx`: 9
- `src/modules/local-mcp/mcpGeneratedArtifactRevisionLoop.ts`: 5
- `src/modules/local-mcp/mcpGeneratedArtifactHumanApprovalWorkflow.ts`: 4
- `src/modules/local-mcp/mcpOutboundEgressPolicy.ts`: 4
- `src/modules/local-mcp/mcpWriteActionFramework.ts`: 4

Top final codes:

- `TS18046`: 35
- `TS2322`: 34
- `TS2345`: 30
- `TS2339`: 13
- `TS6307`: 11
- `TS7053`: 6

Files touched:

- `my-app/src/components/FloatingAiToolbar.tsx`
- `my-app/src/components/ProposalsList.tsx`
- `my-app/src/components/__tests__/ProposalsList.heading-isolation.test.tsx`
- `my-app/src/components/__tests__/ProposalsList.toolbar-grouping.test.tsx`
- `my-app/src/components/cv/SectionEditorSheet.tsx`
- `my-app/src/components/cv/__tests__/SectionEditorSheet.test.tsx`
- `my-app/src/components/onboarding/OnboardingReplay.tsx`
- `my-app/src/contexts/CvLibraryContext.tsx`
- `my-app/src/features/verbati/resume/ResumeOneColAtsPage.tsx`
- `my-app/src/features/verbati/resume/ResumeSanatAsymmetricPage.tsx`
- `my-app/src/features/verbati/resume/RichInlineEditor.tsx`
- `my-app/src/lib/document-decoration.ts`
- `my-app/src/lib/editor-ai-selection.ts`
- `my-app/src/lib/export-renderers.ts`
- `my-app/src/lib/jobs/visibleJobVerdict.ts`
- `my-app/src/lib/ui-preferences.ts`
- `my-app/src/modules/career-knowledge/resolver.ts`
- `my-app/src/modules/local-mcp/localMcpServerSkeleton.ts`
- `my-app/src/modules/local-mcp/localMcpToolsCallFixture.ts`
- `my-app/src/modules/local-mcp/mcpApplicationMessageSend.ts`
- `my-app/src/modules/local-mcp/mcpApprovalAuditBoundary.ts`
- `my-app/src/modules/local-mcp/mcpCallEnvelope.ts`
- `docs/plans/2026-06-22-pr87-3-production-typescript-build-followup.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`

Commands run:

- `rtk git fetch origin`
- `rtk git checkout application-os-foundation`
- `rtk git pull --ff-only origin application-os-foundation`
- `rtk git status --short`
- `rtk git rev-parse HEAD`
- `rtk git rev-parse origin/application-os-foundation`
- `rtk gh pr list --head codex/pr87-3-production-typescript-build-followup --state open --json number,title,url`
- `rtk gh pr view 227 --json mergeCommit --jq .mergeCommit.oid`
- `rtk git checkout -B codex/pr87-3-production-typescript-build-followup`
- `rtk npm run build`
- `rtk npx tsc --noEmit --pretty false`
- `rtk npx tsc -b --pretty false`
- `rtk npx vitest run src/components/cv/__tests__/SectionEditorSheet.test.tsx src/components/__tests__/FloatingAiToolbar.test.tsx src/__tests__/ui-preferences.test.tsx src/components/jobs/__tests__/MatchReadBlock.test.tsx src/modules/local-mcp/__tests__/localMcpServerSkeleton.test.ts src/modules/local-mcp/__tests__/localMcpToolsCallFixture.test.ts src/modules/local-mcp/__tests__/mcpApplicationMessageSend.test.ts src/modules/local-mcp/__tests__/mcpApprovalAuditBoundary.test.ts`
- `rtk npx vitest run src/components/__tests__/ProposalsList.autosave.test.tsx src/components/__tests__/ProposalsList.heading-isolation.test.tsx src/components/__tests__/ProposalsList.route-selection.test.tsx src/components/__tests__/ProposalsList.saved-view-typography.test.tsx src/components/__tests__/ProposalsList.toolbar-grouping.test.tsx`
- `rtk npx eslint src/modules/local-mcp/localMcpServerSkeleton.ts src/modules/local-mcp/localMcpToolsCallFixture.ts`
- Focused ESLint summary for changed TS/TSX files.
- `rtk git diff --check`
- `rtk npx fallow audit --changed-since origin/application-os-foundation --format compact`
- Source guard commands over added diff lines and forbidden files.

Validation results:

- `rtk npm run build`: failed; 145 compressed TypeScript errors remain.
- `rtk npx tsc --noEmit --pretty false`: passed.
- Focused Vitest: passed, 7 files / 122 tests.
- ProposalsList targeted Vitest: passed, 5 files / 8 tests. The run emits inherited React warnings about duplicate `workshop` keys in the layout menu, but tests pass.
- Introduced local-MCP lint subset: passed, no ESLint issues in `localMcpServerSkeleton.ts` and `localMcpToolsCallFixture.ts`.
- Focused ESLint summary for all changed TS/TSX files: still red with 130 errors / 36 warnings, down from 135 / 34 after removing introduced local-MCP assertions. Remaining errors are inherited large-file lint debt outside the review-fix lines.
- `rtk git diff --check`: passed.
- Fallow advisory: red with inherited complexity/dead-code/duplication findings on changed large files; no auto-fixes applied.
- Added `ts-ignore`: none.
- Added `ts-expect-error`: none.
- Added broad `as any`: none.
- Added `skipLibCheck`: none.
- Package/lockfile changes: none.
- Tsconfig changes: none.
- `my-app/convex/schema.ts` changes: none.
- Stripe secret-looking added lines: none.

Remaining blockers:

- Production build remains red across 35 files.
- Largest remaining clusters are `ProposalForge.tsx`, `CvForge.tsx`, local-MCP read-only/review/export modules, `SettingsPage.tsx`, and `tsconfig.node.json` project-membership `TS6307` errors.
- The `TS6307` class may require a tsconfig-node membership decision; tsconfig changes are forbidden in PR87.3 without explicit approval.
- PR88/private beta, PR89/public launch, PR80-live, approved answer-copy, production billing, provider/OAuth/token work, deployment, lint-wide cleanup, and npm audit remain blocked or separate future gates.

Final status:

`BLOCKED_PRODUCTION_TYPESCRIPT_BUILD_REMAINING`
