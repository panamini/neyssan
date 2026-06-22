# PR87.2 Production TypeScript Build Unblock

## Scope

PR87.2 is a narrow production TypeScript build unblock attempt after PR87.1.

Allowed scope:

- production `rtk npm run build` TypeScript blockers only
- exact blocker evidence when the build remains red
- no package or lockfile changes
- no PR88, PR89, PR80-live, approved answer-copy, production billing, provider/OAuth/token, deployment, lint-wide cleanup, or npm audit work

## Verified Base

- Base branch: `application-os-foundation`
- Base/head before branch creation: `a6a0c1ecf8da77b40b4bab95e7a731f1e3aa5613`
- PR225 ledger alignment merge was included in base.
- Branch: `codex/pr87-2-production-typescript-build-unblock`
- Draft PR: https://github.com/panamini/neyssan/pull/226

## Baseline Evidence

Initial `rtk npm run build` in `my-app` failed during `tsc -b`.

- Baseline log: `/Users/pana/.lean-ctx/tee/2026-06-22_162921_rtk_npm_run_build.log`
- Baseline parsed diagnostics: 228 file-scoped TypeScript errors
- First baseline blocker: `convex/applicationContextBuilder.ts(42,3) TS2719`
- Standalone check: `rtk npx tsc --noEmit --pretty false` passed before PR87.2 changes

Top baseline clusters:

- `src/contexts/CvLibraryContext.tsx`: 23
- `src/pages/ProposalForge.tsx`: 20
- `src/pages/CvForge.tsx`: 16
- `src/modules/local-mcp/mcpReadOnlyTwoweeksDataAdapter.ts`: 15
- `src/modules/local-mcp/mcpReadOnlyReviewComponent.ts`: 13
- `convex/liveExternalActionSafety.ts`: 7

## Changes Made

PR87.2 cleared first-order Convex and style-metadata blockers without package, lockfile, or schema broadening:

- projected Convex application-context returns to the exact validator shape
- made candidate import-batch and application-package storage sanitizers return mutable Convex-compatible arrays
- aligned live external-action query/mutation helper typing with generated Convex contexts and validator-inferred returns
- isolated Convex MCP summary DB facade casts at exported handler boundaries while keeping testable read-only facades
- fixed a record-array narrowing issue in resume variant plan summaries
- projected public proposal document decoration metadata to the exact public validator shape and removed an `as any` storage-id cast
- aligned the manual `UserProfileDoc` metadata type with the canonical user-profile metadata type
- broadened the `isResumeTemplateId` runtime guard input to `unknown`
- validated resume-template IDs in the storage adapter document appearance snapshot path

## Current Build Evidence

Final `rtk npm run build` in `my-app` still fails during `tsc -b`.

- Final log: `/Users/pana/.lean-ctx/tee/2026-06-22_164154_rtk_npm_run_build.log`
- Compressed build summary: 203 TypeScript errors remain
- Parsed file-scoped diagnostics: 202
- First remaining blocker: `src/components/cv/SectionEditorSheet.tsx(1632,24) TS2352`

Top remaining files:

- `src/contexts/CvLibraryContext.tsx`: 23
- `src/pages/ProposalForge.tsx`: 20
- `src/pages/CvForge.tsx`: 16
- `src/modules/local-mcp/mcpReadOnlyTwoweeksDataAdapter.ts`: 15
- `src/modules/local-mcp/mcpReadOnlyReviewComponent.ts`: 13
- `src/modules/local-mcp/mcpCoverLetterApplicationPackageExport.ts`: 9
- `src/pages/SettingsPage.tsx`: 9
- `src/modules/career-knowledge/resolver.ts`: 6
- `src/modules/local-mcp/localMcpToolsCallFixture.ts`: 5
- `src/modules/local-mcp/mcpGeneratedArtifactRevisionLoop.ts`: 5

Top remaining codes:

- `TS2339`: 44
- `TS2345`: 41
- `TS2322`: 39
- `TS18046`: 36
- `TS6307`: 11
- `TS7053`: 6
- `TS2540`: 5
- `TS7006`: 4

## Remaining Blocker Classes

- CV library and proposal page object narrowing errors
- local-MCP read-only adapter/review component type drift
- local-MCP generated artifact/export/download policy unknown-value parsing
- local-MCP readonly mutation fixture assignments
- `tsconfig.node.json` project membership errors for local-MCP/internal-tool-contract imports
- resume editor missing import and prop type drift
- isolated React ref/nullability issues

## Validation

Observed in this run:

- `rtk npm run build` - fails with remaining TypeScript build blockers above
- `rtk npx tsc --noEmit --pretty false` - passes with no TypeScript errors
- `rtk npx vitest run convex/__tests__/applicationPackages.test.ts convex/__tests__/candidateEvidence.test.ts convex/__tests__/liveExternalActionSafety.test.ts convex/__tests__/mcpApplicationPackageSummary.test.ts convex/__tests__/mcpEvidenceGraphSummary.test.ts convex/__tests__/mcpReadOnlyTwoweeksDataRefs.test.ts convex/__tests__/mcpResumeVariantPlanSummary.test.ts convex/__tests__/mcpReviewCockpitSummary.test.ts convex/__tests__/proposalsPublic.test.ts convex/__tests__/proposalPublicStyleCompatibility.test.ts convex/lib/__tests__/userProfileMetadata.test.ts convex/lib/__tests__/userProfileMetadataSchemaAlignment.test.ts` - 12 files / 105 tests passed
- `rtk git diff --check` - passes
- Diff source guards on added lines - no added `ts-ignore`, `ts-expect-error`, `as any`, `skipLibCheck`, `sk_test_`, `sk_live_`, or `STRIPE_SECRET_KEY=`
- Package/lockfile guard - no package or lockfile changes
- Convex runtime schema guard - `my-app/convex/schema.ts` unchanged
- `rtk npx fallow audit --changed-since origin/application-os-foundation --format compact` - read-only advisory findings remain for complexity/dead-code/duplication; no fixes applied in this PR

Do not treat lint or npm audit as PR87.2 gates unless naturally fixed by TypeScript work.

## Final Status

`BLOCKED_PRODUCTION_TYPESCRIPT_BUILD_REMAINING`
