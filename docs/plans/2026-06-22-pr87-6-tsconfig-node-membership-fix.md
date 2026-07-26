# PR87.6 TS6307 Project Membership Build Fix

## Scope

- Base branch: `application-os-foundation`
- Branch: `codex/pr87-6-tsconfig-node-membership-fix`
- Verified PR87.5 merge commit: `dad3c407a5fda1e0b20aa0df62f220a344599190`
- Starting base SHA: `dad3c407a5fda1e0b20aa0df62f220a344599190`
- Objective: make `npm run build` / `tsc -b` pass by fixing only TS6307 project-membership diagnostics.

## Starting Evidence

Commands from `my-app`:

- `npm run build`: failed in `tsc -b` with 11 TS6307 diagnostics.
- `npx tsc -b --force --pretty false`: failed with the same 11 TS6307 diagnostics.
- `npx tsc --noEmit --pretty false`: passed.

No non-TS6307 TypeScript errors remained in build mode.

## TS6307 Map

All diagnostics were emitted by `tsconfig.node.json`.

| Diagnostic file | Missing imported file | Proposed fix |
| --- | --- | --- |
| `src/modules/application-harness/fingerprints.ts(1,34)` | `src/modules/application-harness/schema.ts` | List the file in `tsconfig.node.json`. |
| `src/modules/internal-tool-contracts/contracts.ts(1,33)` | `src/modules/application-harness/fingerprints.ts` | List the file in `tsconfig.node.json`. |
| `src/modules/internal-tool-contracts/contracts.ts(5,8)` | `src/modules/internal-tool-contracts/contractRules.ts` | List the file in `tsconfig.node.json`. |
| `src/modules/local-mcp/localMcpDevEndpoint.ts(1,50)` | `src/modules/local-mcp/localMcpToolsListFixture.ts` | List the file in `tsconfig.node.json`. |
| `src/modules/local-mcp/localMcpToolsListFixture.ts(1,60)` | `src/modules/local-mcp/mcpDescriptorRegistry.ts` | List the file in `tsconfig.node.json`. |
| `src/modules/local-mcp/mcpDescriptorRegistry.ts(3,8)` | `src/modules/local-mcp/mcpSchemaProjection.ts` | List the file in `tsconfig.node.json`. |
| `src/modules/local-mcp/mcpSchemaProjection.ts(5,8)` | `src/modules/internal-tool-contracts/schema.ts` | List the file in `tsconfig.node.json`. |
| `src/modules/local-mcp/mcpSchemaProjection.ts(10,8)` | `src/modules/local-mcp/schema.ts` | List the file in `tsconfig.node.json`. |
| `src/modules/local-mcp/mcpSchemaProjection.ts(11,43)` | `src/modules/local-mcp/toolRegistry.ts` | List the file in `tsconfig.node.json`. |
| `src/modules/local-mcp/toolRegistry.ts(3,8)` | `src/modules/internal-tool-contracts/contracts.ts` | List the file in `tsconfig.node.json`. |
| `vite.config.ts(10,8)` | `src/modules/local-mcp/localMcpDevEndpoint.ts` | List the file in `tsconfig.node.json`. |

## Configs Inspected

- `my-app/package.json`: `build` runs `tsc -b && vite build`.
- `my-app/tsconfig.json`: project references `tsconfig.app.json` and `tsconfig.node.json`.
- `my-app/tsconfig.app.json`: app project already includes `src`, `convex`, `config`, `types`, and related app roots.
- `my-app/tsconfig.node.json`: node/build project included only `vite.config.ts`.
- `my-app/vite.config.ts`: imports `src/modules/local-mcp/localMcpDevEndpoint.ts` for the disabled-by-default local MCP dev endpoint plugin.
- Imported local MCP/internal-contract/application-harness files named in the diagnostics.

## Fix Strategy

The import direction is intentional: `vite.config.ts` owns a Vite dev-server plugin for the local-only `/mcp` fixture endpoint, and that plugin imports a small fixture descriptor graph. The TypeScript node project therefore needs to list the files it imports.

Chosen fix: add only the proven transitive files to `tsconfig.node.json` `include`. This avoids broad `src/**/*`, does not exclude failing files, and does not weaken strictness.

## Files Changed

- `my-app/tsconfig.node.json`: added the exact local-MCP/internal-contract/application-harness files required by the `vite.config.ts` import graph.
- `docs/plans/2026-06-22-pr87-6-tsconfig-node-membership-fix.md`: this evidence note.
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`: PR87.5/PR87.6 state alignment.

## Validation

Commands from `my-app` unless noted:

- `npx tsc -b --force --pretty false`: passed after the config fix.
- `npm run build`: passed after the config fix. Vite still reported existing warnings for stale Browserslist data, pdfjs `eval`, and large chunks.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run lint`: failed on existing repo-wide lint debt, with 1505 errors and 381 warnings. No lint fixes were made because lint-wide cleanup is out of PR87.6 scope.
- `npm audit --omit=dev`: failed with 37 vulnerabilities: 2 low, 14 moderate, 19 high, 2 critical. No package or lockfile changes were made.
- `git diff --check` from repo root: passed.
- `FALLOW_AGENT_SOURCE=codex npx fallow audit --format json --quiet --base origin/application-os-foundation --explain 2>/dev/null || true`: passed with `verdict: "pass"`, 0 introduced dead-code issues, 0 complexity findings, and 0 duplication clone groups. It reported 18 inherited dependency-placement findings only.
- `git status --short --untracked-files=all`: intended tracked changes plus the required untracked cover-letter roadmap file.

## Source Guards

- No package or lockfile changes.
- No `my-app/convex/schema.ts` changes.
- No added `ts-ignore`.
- No added `ts-expect-error`.
- No added broad `as any`.
- No added `skipLibCheck`; existing config values were not changed.
- No strictness weakening.
- No broad build excludes.
- No value-shaped Stripe secrets.
- `docs/plans/2026-06-22-cover-letter-quality-production-roadmap.md` remains untracked and uncommitted.

## Remaining Blockers

Production TypeScript build is green. PR88/PR89 remain blocked because lint, audit, deployment/staging, smoke, rollback, and other production gates are not cleared by this PR.

PR80-live, approved answer-copy, production billing, provider integration, OAuth callback/token exchange/token storage, checkout, webhooks, subscriptions, and billing portal work remain blocked/out of scope.

## Rollback Plan

Revert the PR87.6 commit. The rollback only removes the narrow `tsconfig.node.json` membership update and the two docs updates; no package, lockfile, schema, runtime feature, billing, provider/OAuth/token, deployment, or app-page state needs rollback.

## Final Verdict

`PRODUCTION_TYPESCRIPT_BUILD_GREEN`
