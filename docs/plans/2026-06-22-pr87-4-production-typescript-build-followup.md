# PR87.4 Production TypeScript Build Follow-up

## Scope

- Base branch: `application-os-foundation`
- Branch: `codex/pr87-4-production-typescript-build-followup`
- Starting base SHA: `8cdb3ef1f6c45b0df2afa6b5db49bd7a5d29414c`
- Verified PR87.3: GitHub PR #228 merged at `2026-06-22T17:40:56Z` with merge commit `8cdb3ef1f6c45b0df2afa6b5db49bd7a5d29414c`.
- Scope constraint: coherent local-MCP TypeScript cluster only, starting at `src/modules/local-mcp/mcpComponentErrorLoadingRefusalUx.ts(608,3) TS2322`.
- Explicitly out of scope: package and lockfiles, `my-app/convex/schema.ts`, tsconfig membership changes, frontend page clusters, deployment, PR88/PR89, PR80-live, answer-copy, billing, OAuth/provider/token work.

## Starting Evidence

- Baseline command: `rtk npm run build` from `my-app`.
- Baseline result: failed during `tsc -b`.
- Baseline log: `/Users/pana/.lean-ctx/tee/2026-06-22_194821_rtk_npm_run_build.log`
- Starting compressed build count: 145 TypeScript errors.
- Starting parsed file-scoped diagnostics: 144.
- Starting first blocker: `src/modules/local-mcp/mcpComponentErrorLoadingRefusalUx.ts(608,3) TS2322` - `unknown[]` was not assignable to `readonly string[]`.
- Baseline `rtk npx tsc --noEmit --pretty false`: passed.

Top starting local-MCP file clusters:

- `mcpReadOnlyTwoweeksDataAdapter.ts`: 15
- `mcpReadOnlyReviewComponent.ts`: 13
- `mcpCoverLetterApplicationPackageExport.ts`: 9
- `mcpGeneratedArtifactRevisionLoop.ts`: 5
- `mcpGeneratedArtifactHumanApprovalWorkflow.ts`: 4
- `mcpOutboundEgressPolicy.ts`: 4
- `mcpWriteActionFramework.ts`: 4

Top starting local-MCP code classes:

- `TS18046`: unknown value narrowing.
- `TS2322`: unsafe assignment from unknown-shaped records.
- `TS2345`: unsafe arguments from unknown-shaped records.
- `TS2339` / `TS7053`: property and index access on insufficiently narrowed records.
- `TS6307`: tsconfig-node project membership for local-MCP/dev endpoint imports.

## Fixes Made

- Replaced the first blocker with element-by-element safe ref id parsing so only validated strings enter `readonly string[]` results.
- Added focused coverage for valid, empty, non-array, and mixed/private safe-ref-id payloads in the component error/loading/refusal UX tests.
- Tightened safe-count guards across local-MCP summaries so `Number.isInteger` and range checks only run after `typeof value === "number"`.
- Narrowed generated-artifact policy summaries and artifact kinds before returning package/export, approval, revision, and resume export results.
- Validated timestamps, preview status, action categories, risk levels, data classes, operational reasons, egress policy values, remote transport limits, and account-link/OAuth boundary numbers through typed local variables before returning them.
- Reworked read-only review and Twoweeks data adapter parsing so unavailable reasons, review labels, availability summaries, refs, blocked ref classes, and granted scope sets are narrowed before use.
- Replaced a local-MCP text-safety control-character regex with an equivalent char-code loop to keep targeted ESLint clean.

## Files Changed

- `my-app/src/modules/local-mcp/__tests__/mcpComponentErrorLoadingRefusalUx.test.ts`
- `my-app/src/modules/local-mcp/mcpComponentErrorLoadingRefusalUx.ts`
- `my-app/src/modules/local-mcp/mcpCoverLetterApplicationMessagePreview.ts`
- `my-app/src/modules/local-mcp/mcpCoverLetterApplicationPackageExport.ts`
- `my-app/src/modules/local-mcp/mcpGeneratedArtifactBoundary.ts`
- `my-app/src/modules/local-mcp/mcpGeneratedArtifactExportDownloadPolicy.ts`
- `my-app/src/modules/local-mcp/mcpGeneratedArtifactHumanApprovalWorkflow.ts`
- `my-app/src/modules/local-mcp/mcpGeneratedArtifactRevisionLoop.ts`
- `my-app/src/modules/local-mcp/mcpHandlerBoundary.ts`
- `my-app/src/modules/local-mcp/mcpJobPlatformApplyDryRun.ts`
- `my-app/src/modules/local-mcp/mcpOperationalErrorTaxonomy.ts`
- `my-app/src/modules/local-mcp/mcpOutboundEgressPolicy.ts`
- `my-app/src/modules/local-mcp/mcpProductionAccountLinkPersistenceBoundary.ts`
- `my-app/src/modules/local-mcp/mcpProductionStytchOAuthConfigBoundary.ts`
- `my-app/src/modules/local-mcp/mcpReadOnlyReviewComponent.ts`
- `my-app/src/modules/local-mcp/mcpReadOnlyTwoweeksDataAdapter.ts`
- `my-app/src/modules/local-mcp/mcpRealApplicationPackageSummary.ts`
- `my-app/src/modules/local-mcp/mcpRealEvidenceGraphSummary.ts`
- `my-app/src/modules/local-mcp/mcpRealResumeVariantPlanSummary.ts`
- `my-app/src/modules/local-mcp/mcpRealReviewCockpitSummary.ts`
- `my-app/src/modules/local-mcp/mcpRedactedAuditLog.ts`
- `my-app/src/modules/local-mcp/mcpRemoteTransportSpike.ts`
- `my-app/src/modules/local-mcp/mcpResumeExport.ts`
- `my-app/src/modules/local-mcp/mcpResumeVariantGenerationPreview.ts`
- `my-app/src/modules/local-mcp/mcpWriteActionFramework.ts`
- `docs/plans/2026-06-22-pr87-4-production-typescript-build-followup.md`
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`

## Ending Evidence

- Final build command: `rtk npm run build` from `my-app`.
- Final build result: failed during `tsc -b`.
- Final build log: `/Users/pana/.lean-ctx/tee/2026-06-22_200701_rtk_npm_run_build.log`
- Ending compressed build count: 56 TypeScript errors.
- Ending parsed file-scoped diagnostics: 56.
- Ending first blocker: `src/pages/CvForge.tsx(1017,59) TS2698` - spread types may only be created from object types.

Top ending file clusters:

- `src/pages/ProposalForge.tsx`: 20
- `src/pages/CvForge.tsx`: 16
- `src/pages/SettingsPage.tsx`: 9
- `src/modules/local-mcp/mcpSchemaProjection.ts`: 3
- `src/modules/internal-tool-contracts/contracts.ts`: 2
- Singletons: `src/modules/application-harness/fingerprints.ts`, `src/modules/local-mcp/localMcpDevEndpoint.ts`, `src/modules/local-mcp/localMcpToolsListFixture.ts`, `src/modules/local-mcp/mcpDescriptorRegistry.ts`, `src/modules/local-mcp/toolRegistry.ts`, `vite.config.ts`

Top ending code classes:

- `TS2345`: 16
- `TS2322`: 11
- `TS6307`: 11
- `TS2339`: 10
- `TS2367`: 3
- `TS2698`: 1

Remaining local-MCP diagnostics are TS6307 project-membership only:

- `src/modules/local-mcp/localMcpDevEndpoint.ts(1,50) TS6307`
- `src/modules/local-mcp/localMcpToolsListFixture.ts(1,60) TS6307`
- `src/modules/local-mcp/mcpDescriptorRegistry.ts(3,8) TS6307`
- `src/modules/local-mcp/mcpSchemaProjection.ts(5,8) TS6307`
- `src/modules/local-mcp/mcpSchemaProjection.ts(10,8) TS6307`
- `src/modules/local-mcp/mcpSchemaProjection.ts(11,43) TS6307`
- `src/modules/local-mcp/toolRegistry.ts(3,8) TS6307`

Related TS6307 evidence outside local-MCP:

- `src/modules/internal-tool-contracts/contracts.ts`: 2 diagnostics.
- `vite.config.ts(10,8) TS6307` importing `src/modules/local-mcp/localMcpDevEndpoint.ts`.

## Validation

- `rtk npx vitest run src/modules/local-mcp`: passed, 56 files / 1190 tests.
- `rtk npx tsc --noEmit --pretty false`: passed.
- Targeted ESLint on touched local-MCP implementation files: passed.
- `rtk npm run build`: failed with 56 TypeScript errors; first blocker is now outside the scoped local-MCP cluster.
- `rtk git diff --check`: passed.
- Fallow read-only audit: advisory `verdict: fail` with dead-code/duplication-style findings in changed local-MCP files; no fixes applied because they are outside this narrow TypeScript unblock scope.

Source guards:

- No package or lockfile changes.
- No `my-app/convex/schema.ts` changes.
- No tsconfig changes.
- No frontend page cluster changes.
- No `ts-ignore`, `ts-expect-error`, broad `as any`, `skipLibCheck`, strictness weakening, billing, OAuth/provider/token, PR80-live, answer-copy, or deployment changes.

## Rollback Plan

- Revert the PR87.4 commit, or restore only the touched files with `rtk git restore -- <path>` before merge.
- No runtime config, schema, package, lockfile, billing, provider/OAuth/token, deployment, PR80-live, or answer-copy state should need rollback.

## Final Status

`BLOCKED_PRODUCTION_TYPESCRIPT_BUILD_REMAINING`
