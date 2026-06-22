# PR87.5 Production TypeScript Build Follow-up

## Crash Recovery Context

- Base branch: `application-os-foundation`
- Branch: `codex/pr87-5-production-typescript-build-followup`
- Starting HEAD: `ad4a6bb2945188e974146e35650ce7163df1bd26`
- `origin/application-os-foundation`: `ad4a6bb2945188e974146e35650ce7163df1bd26`
- Verified PR87.4 merge commit: `ad4a6bb2945188e974146e35650ce7163df1bd26`
- Verified PR87.4 GitHub PR: #229
- Starting build count after PR87.4: 56 TypeScript errors.
- Recovery boundary: preserve existing PR87.5 WIP, inspect before editing, and do not broaden into tsconfig/package/schema/deployment/provider/billing/PR88/PR89 work.

## WIP Reviewed

The crash recovery found exactly the expected 8 modified WIP files and one untracked cover-letter roadmap file.

- `my-app/src/pages/CvForge.tsx`: tightened `MutableRemirrorNode` to avoid the Remirror `content`/`marks` conflict and used a ref holder for the last list node.
- `my-app/src/pages/ProposalForge.tsx`: narrowed autosave snapshot status to `draft | saved`, normalized nullable palette overrides, narrowed document style slot source, guarded submitted compose draft source URL/platform, and based loading state on compose save status.
- `my-app/src/pages/SettingsPage.tsx`: limited `ProposalContactField` to real contact fields and guarded factory palette ids with `isProposalPaletteId`.
- `my-app/src/contexts/CvLibraryContext.tsx`: added `DocumentIconOverrides` to visual metadata patches.
- `my-app/src/hooks/useJobsQuery.ts`: extended `JobsQueryListItem` with optional fields already consumed by the UI.
- `my-app/src/lib/i18n/ui-messages.ts`: added `settings.contact.*` labels in EN/FR/ES.
- `my-app/src/adapters/StorageAdapter.ts`: persisted `documentIconOverrides` through metadata-only patch paths.
- `my-app/src/adapters/__tests__/StorageAdapter.test.ts`: added coverage proving `documentIconOverrides` save without sending `cvDocument`.

Untracked file explicitly left uncommitted:

- `docs/plans/2026-06-22-cover-letter-quality-production-roadmap.md`

## Fixes Made

No additional code fixes were made after crash recovery. The recovered WIP already removed the CvForge, ProposalForge, and SettingsPage TypeScript build errors from the post-PR87.4 frontend cluster.

The only documentation changes made during recovery are this PR87.5 evidence document and the roadmap progress ledger.

## Validation

Commands were run from `my-app` unless noted. `rtk` and `lean-ctx` were unavailable in the post-crash shell, so direct commands were used.

- `npm run build`: failed during `tsc -b` with 11 TS6307 project-membership diagnostics.
- `npx tsc -b --force --pretty false`: failed with the same 11 TS6307 diagnostics.
- `npx tsc --noEmit --pretty false`: passed.
- `npx vitest run src/adapters/__tests__/StorageAdapter.test.ts`: passed, 34 tests.
- `DEBUG_PRINT_LIMIT=1200 npx vitest run src/pages/__tests__/SettingsPage.preview.test.tsx`: passed, 32 tests.
- `DEBUG_PRINT_LIMIT=1200 npx vitest run src/pages/__tests__/ProposalForge.output-draft-guard.test.tsx src/pages/__tests__/ProposalForge.draft-heading-hydration.test.tsx`: passed, 4 tests.
- `npx vitest run src/pages/__tests__/CvForge.workspace-mode.test.tsx -t "responsibilit|bullet"`: interrupted after more than two minutes without completing; no pass/fail result.
- `npx vitest run src/pages/__tests__/ProposalForge.autosave.test.tsx src/pages/__tests__/ProposalForge.settings-style-roundtrip.test.tsx src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.brief-card.test.tsx`: failed, 19 passed / 16 failed. The failures were stale visible-surface assertions around controls/copy such as `Generate proposal`, `Style 2`, `Style 3`, `Use Ochre accent`, `Start blank`, `Paste your job offer here`, `New proposal`, and `No job loaded`; this is treated as a focused test maintenance concern outside PR87.5's production TypeScript build scope.
- `npx fallow audit --format json --quiet --base origin/application-os-foundation --explain`: advisory `verdict: fail` with 29 dead-code issues, 153 complexity findings, and 13 duplication clone groups. No fixes were applied because the findings are cleanup/complexity/dependency maintenance outside the narrow PR87.5 TypeScript build follow-up.

## Final Build Result

- Starting PR87.5 build count: 56 TypeScript errors inherited from PR87.4.
- Ending direct build count: 11 TypeScript errors.
- Ending build result: still red.
- First remaining blocker: `src/modules/application-harness/fingerprints.ts(1,34) TS6307`.
- Only TS6307 remains: yes.
- Final verdict: `BLOCKED_PRODUCTION_TYPESCRIPT_BUILD_REMAINING`.

## TS6307 Membership Evidence

All remaining production build errors are `tsconfig.node.json` project-membership diagnostics:

- `src/modules/application-harness/fingerprints.ts(1,34)` imports `src/modules/application-harness/schema.ts`.
- `src/modules/internal-tool-contracts/contracts.ts(1,33)` imports `src/modules/application-harness/fingerprints.ts`.
- `src/modules/internal-tool-contracts/contracts.ts(5,8)` imports `src/modules/internal-tool-contracts/contractRules.ts`.
- `src/modules/local-mcp/localMcpDevEndpoint.ts(1,50)` imports `src/modules/local-mcp/localMcpToolsListFixture.ts`.
- `src/modules/local-mcp/localMcpToolsListFixture.ts(1,60)` imports `src/modules/local-mcp/mcpDescriptorRegistry.ts`.
- `src/modules/local-mcp/mcpDescriptorRegistry.ts(3,8)` imports `src/modules/local-mcp/mcpSchemaProjection.ts`.
- `src/modules/local-mcp/mcpSchemaProjection.ts(5,8)` imports `src/modules/internal-tool-contracts/schema.ts`.
- `src/modules/local-mcp/mcpSchemaProjection.ts(10,8)` imports `src/modules/local-mcp/schema.ts`.
- `src/modules/local-mcp/mcpSchemaProjection.ts(11,43)` imports `src/modules/local-mcp/toolRegistry.ts`.
- `src/modules/local-mcp/toolRegistry.ts(3,8)` imports `src/modules/internal-tool-contracts/contracts.ts`.
- `vite.config.ts(10,8)` imports `src/modules/local-mcp/localMcpDevEndpoint.ts`.

Per PR87.5 scope, no tsconfig membership changes were made. This remains the next explicit follow-up decision.

## Source Guards

Pre-staging guards:

- `git diff --check`: passed.
- `git diff --name-only`: only the 8 WIP files plus the roadmap ledger were tracked modifications before staging.
- `git diff --name-only --cached`: empty before staging.
- Forbidden path guard found no package, lockfile, tsconfig, or `my-app/convex/schema.ts` changes.
- Added-line guard over `my-app` found no added `ts-ignore`, `ts-expect-error`, broad `as any`, or `skipLibCheck`.
- Added-line secret guard found no Stripe secret-looking tokens such as `sk_live_`, `sk_test_`, `pk_live_`, `rk_live_`, or `whsec_`.
- `docs/plans/2026-06-22-cover-letter-quality-production-roadmap.md` remained untracked and unstaged.
- Fallow was run in read-only advisory mode; no automatic fixes were applied.

Post-staging guards:

- `git diff --check`: passed.
- `git diff --cached --check`: passed.
- `git diff --name-only`: empty after staging intended files.
- `git diff --cached --name-only`: exactly the 8 WIP files, this PR87.5 evidence doc, and the roadmap ledger.
- Forbidden staged path guard found no package, lockfile, tsconfig, or `my-app/convex/schema.ts` changes.
- Added-line guard over staged `my-app` changes found no added `ts-ignore`, `ts-expect-error`, broad `as any`, or `skipLibCheck`.
- Refined staged secret guard found no value-shaped Stripe tokens.

## Rollback Plan

Revert the PR87.5 commit or restore only the staged files before merge. No package, lockfile, schema, tsconfig, runtime config, billing, provider/OAuth/token, PR80-live, answer-copy, deployment, or PR88/PR89 state should need rollback.

## Final Verdict

`BLOCKED_PRODUCTION_TYPESCRIPT_BUILD_REMAINING`
