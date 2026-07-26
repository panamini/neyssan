# PR87.1 Production Build / Lint Gate Unblock

Date: 2026-06-21
Branch: `codex/pr87-1-production-build-lint-gate-unblock`
Base: `application-os-foundation`
Base verifies: `2102d8136cf03d142dac4290421d6aa392369809`
Target PR: PR87.1 - Production Build / Lint Gate Unblock

Final status: `BLOCKED_PRODUCTION_BUILD_LINT_REMAINING`

## PR87 merge verification

- PR87 / GitHub #223 is merged.
- PR87 merge commit is `2102d8136cf03d142dac4290421d6aa392369809`.
- `origin/application-os-foundation` resolved to `2102d8136cf03d142dac4290421d6aa392369809` before the PR87.1 branch was created.
- Initial working tree was clean before PR87.1 edits.
- No existing branch or PR was found for `codex/pr87-1-production-build-lint-gate-unblock` before branch creation.
- PR88, PR80-live, approved answer-copy, production billing, provider/OAuth/token work, package changes, lockfile changes, and schema changes remain out of scope.

## Baseline failing commands before changes

Commands run in `my-app` before PR87.1 implementation:

- `rtk npm run lint`: failed before ESLint could start because `.eslintrc.cjs` required missing `./scraping-server/tsconfig.json`.
- `rtk npm run build`: failed during `tsc -b` with 304 TypeScript errors in 73 files; first error was `convex/activeCvSnapshots.ts(153,29)`.
- `rtk npx tsc --noEmit --pretty false`: passed.
- `rtk npx fallow audit --changed-since origin/application-os-foundation --format compact`: passed for changed files; inherited dependency warnings were advisory.
- No repo package script for a runtime dependency audit was found in root or `my-app/package.json`.
- `rtk npm audit --omit=dev`: failed with 37 runtime dependency vulnerabilities, including 2 critical.

## Root causes

Lint:

- The immediate lint bootstrap blocker was stale config: `.eslintrc.cjs` referenced missing `./scraping-server/tsconfig.json`.
- After removing that stale project reference, ESLint started and exposed inherited lint debt.
- A second config issue re-enabled eased TypeScript rules inside the typed override and tried typed lint on files excluded from the TS projects.

Build/typecheck:

- Several first-order build failures were narrow stale typings: missing local `str`/`num` aliases in `mcpWriteActionFramework.ts`, an untyped profile id cast in `activeCvSnapshots.ts`, a missing `ChainConfig` re-export, a missing `meta_prose` body-validation issue literal, and a definite-assignment error in proposal persistence finalization.
- Remaining build failures are broader repo type debt: readonly Convex validator return mismatches, Convex db/query helper type mismatches, document decoration/object typing, UI/resume nullability and prop typing, local MCP readonly mutations, and `tsconfig.node.json` include gaps.

## Files changed and why

- `my-app/.eslintrc.cjs`: removed stale `scraping-server` typed-lint project reference, aligned typed override exclusions with TS project excludes, ignored docs TS/TSX artifacts, disabled duplicate core `no-unused-vars`, and kept the repo's existing eased TypeScript rules inside the typed override.
- `my-app/src/modules/local-mcp/mcpWriteActionFramework.ts`: added narrow file-local aliases for existing `str` and `num` type shorthand used throughout that file.
- `my-app/convex/activeCvSnapshots.ts`: cast profile lookup to `Id<"userProfiles">` instead of `any` so Convex narrows the document type.
- `my-app/convex/generateProposalMutation.ts`: initialized `proposalContent` before conditional assignment to satisfy definite-assignment checking.
- `my-app/convex/langchain/chains/chain_factory.ts`: re-exported `ChainConfig` from the file that imports it.
- `my-app/convex/lib/proposals/premiumCoverLetter.ts`: added `meta_prose` to the body-part validation issue union already used by the validator.
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`: records PR87.1 status and remaining blockers.

## Verification after changes

Commands run in `my-app`:

- `rtk npm run lint`: still red, but no longer blocked by missing `./scraping-server/tsconfig.json`; latest run reported 1,513 errors and 383 warnings.
- `rtk npm run build`: still red during `tsc -b`; latest summary reported 228 TypeScript errors, first at `convex/applicationContextBuilder.ts(42,3)`.
- `rtk npx tsc --noEmit --pretty false`: passed.
- `rtk npm audit --omit=dev`: still red with 37 runtime dependency vulnerabilities, including 2 critical.
- `rtk npx vitest run src/modules/local-mcp/__tests__/mcpWriteActionFramework.test.ts convex/lib/proposals/__tests__/premiumCoverLetter.test.ts convex/lib/proposals/__tests__/proposalStructuredPath.test.ts convex/__tests__/liveExternalActionSafety.test.ts convex/__tests__/manualApplicationHandoff.test.ts src/components/jobs/__tests__/ManualApplicationHandoffPanel.test.tsx`: passed, 170 tests.
- `rtk git diff --check`: passed.
- `rtk npx fallow audit --changed-since origin/application-os-foundation --format compact`: advisory red because the narrow edits touch files with inherited high-complexity findings, especially `generateProposalMutation.ts`, `premiumCoverLetter.ts`, `mcpWriteActionFramework.ts`, and `activeCvSnapshots.ts`; no Fallow auto-fixes were applied.

## Remaining production gate blockers

- Production build is red: first remaining failure is `convex/applicationContextBuilder.ts(42,3)`.
- Lint is red: first remaining failure is `config/llmAdapters.ts(32,13)` / `no-empty`, after the missing-project blocker was removed.
- Runtime dependency audit is red.
- No repo runtime dependency audit package script exists; `npm audit --omit=dev` was used as the current npm runtime audit proxy and remains red.
- Preview/staging target is not proven.
- MCP production runtime is not deployable.
- Signed-in smoke is missing.
- Runtime observability and rollback are not proven.

## PR88 decision

PR88 must not start yet. PR87.1 did not make lint, production build, or runtime dependency audit green, and the deployment/signed-in smoke blockers from PR87 remain unproven.

## Rollback plan

Revert the PR87.1 commit(s). This restores the prior ESLint configuration, reintroduces the known missing `scraping-server` lint bootstrap blocker, and removes the narrow TypeScript fixes. No schema, package, lockfile, billing, provider/OAuth/token, PR80-live, answer-copy, or deployment runtime state was changed.

## Verdict

`BLOCKED_PRODUCTION_BUILD_LINT_REMAINING`
