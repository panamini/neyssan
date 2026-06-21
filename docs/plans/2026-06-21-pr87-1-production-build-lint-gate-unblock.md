# PR87.1 Production Build / Lint Gate Unblock

Date: 2026-06-21
Branch: `codex/pr87-1-production-build-lint-gate-unblock`
Base: `application-os-foundation`
Base verifies: `2102d8136cf03d142dac4290421d6aa392369809`
Target PR: PR87.1 - Production Build / Lint Gate Unblock

Final status: `BLOCKED_PRODUCTION_BUILD_LINT_REMAINING`

## Scope

PR87.1 is a narrow implementation follow-up to PR87. It may unblock the production build/lint gate only, and must not start PR88/private beta, PR80-live, answer-copy, production billing, provider/OAuth/token work, or package/lockfile changes.

## Confirmed baseline

- PR87 / GitHub #223 is merged into `application-os-foundation`.
- Local `application-os-foundation` and `origin/application-os-foundation` both resolved to `2102d8136cf03d142dac4290421d6aa392369809` before this branch was created.
- No existing branch or PR was found for `codex/pr87-1-production-build-lint-gate-unblock`.
- `npm run lint` in `my-app` failed before ESLint could start because `.eslintrc.cjs` required missing `./scraping-server/tsconfig.json`.
- `npm run build` in `my-app` failed during `tsc -b`.
- `npm audit --omit=dev` in `my-app` failed with runtime dependency vulnerabilities.

## Implementation

- Removed the stale ESLint override for `scraping-server/**/*.ts`.
- Removed `scraping-server/**/*.ts` from the non-typed override exclusion list.
- Did not create a fake `scraping-server` project or weaken TypeScript/build settings.
- Did not change code, schemas, packages, lockfiles, CI, billing, provider/OAuth/token, PR80-live, answer-copy, PR88, or PR89 surfaces.

## Verification

Commands run in `my-app`:

- `rtk npm run lint`: starts past the removed `scraping-server` config blocker, then remains red on existing ESLint violations.
- `rtk npm run build`: remains red during `tsc -b`; latest run reported 304 TypeScript errors in 73 files, first at `convex/activeCvSnapshots.ts(153,29)`.
- `rtk npm audit --omit=dev`: remains red with 37 runtime dependency vulnerabilities, including 2 critical.

## Remaining production gate blockers

- Production build is red.
- Lint is no longer blocked by missing `./scraping-server/tsconfig.json`, but the lint gate remains red on existing ESLint violations.
- Runtime dependency audit is red.
- Preview/staging target is not proven.
- MCP production runtime is not deployable.
- Signed-in smoke is missing.
- Runtime observability and rollback are not proven.
- PR88 must not start yet.

## Verdict

`BLOCKED_PRODUCTION_BUILD_LINT_REMAINING`
