# PR86.1 Founder App Test Path Unlock

Date: 2026-06-21
Branch: `codex/pr86-1-founder-app-test-path-unlock`
Base: `application-os-foundation`
Base merge commit verified: `f99fba59a28d9e9278ad3c13989337c2dd8186b2`
Parent PR: PR86 / GitHub #221, merged at `2026-06-21T00:33:52Z`

Final verdict: `APP_TESTABLE_NOW`
TEST_PATH_KIND: `FULL_LOCAL_STACK`

## Scope

PR86.1 only unlocks the local founder app test path after PR86 returned `BLOCKED_APP_TEST_PATH`.

Allowed work:

- start and verify the existing `local-fast` stack
- fix the active `/cv` smoke blocker
- strengthen the PR smoke route coverage for `/dashboard`, `/cv`, `/jobs`, and `/proposal`
- record concrete evidence and ledger state

Out of scope:

- PR87 deployment
- PR80-live provider submit/apply
- approved answer copy implementation
- production billing, Stripe SDK, checkout, webhook, subscription, or billing portal work
- OAuth/token exchange/storage or provider credentials
- Norma Core, package, lockfile, schema, or broad parser/UI rewrites

## Repository State

Confirmed facts:

- Local branch started from `application-os-foundation`.
- `origin/application-os-foundation` resolved to `f99fba59a28d9e9278ad3c13989337c2dd8186b2`.
- PR86 #221 is merged into `application-os-foundation` at the same merge commit.
- No existing GitHub PR was found for `codex/pr86-1-founder-app-test-path-unlock`.
- Open PR searches for PR87, PR80-live, and answer-copy returned no active implementation PRs.

Inference:

- The roadmap ledger was stale because it still named PR86 as current, but GitHub and the remote base prove PR86 has already merged.
- PR86.1 is the next narrow corrective PR because it fixes the actual app test path blocker without starting PR87 or PR80-live.

## Local-Fast Graph

Command:

```sh
rtk env OPEN_BROWSER=0 ./run.sh local-fast
```

Observed graph:

- Parser container: `cv-parser-service-dev`, health `http://127.0.0.1:8001/ready`
- Convex local backend: `http://127.0.0.1:3210`
- Vite app: `http://localhost:5173`
- Vite receives `VITE_CONVEX_URL=http://127.0.0.1:3210`
- Parser URL exported to Convex as `CONVEX_PARSER_URL=http://127.0.0.1:8001`

Docker status:

- Docker daemon was available via Docker Desktop.
- Docker context: `desktop-linux`.
- Docker Compose: `v2.31.0-desktop.2`.

Before `local-fast`:

- local parser `/ready`: `000`
- edge parser `/ready`: `530`
- local Convex: stopped
- parser runtime: stopped
- tunnel: stopped

After `local-fast`:

- local parser `/ready`: `200`
- local Convex: `http://127.0.0.1:3210`
- parser runtime: workspace
- Vite listener: `127.0.0.1:5173`
- parser listener: `*:8001`
- Convex listener: `*:3210`

## Root Cause

Active code path:

- `/cv` route -> `CvForge`
- `CvForge` consumes `useCvLibrary()`
- `CvLibraryContext` restores a local route CV from localStorage and may set `isVisualRestorePending`
- `CvForge` keeps the preview in `Loading CV.` while `isVisualRestorePending` is true and the CV has no resume template id

Confirmed failure before the fix:

- The PR smoke seeded a local CV with `verbatiStyle` data but no `resumeTemplateId`.
- `/cv?id=playwright_smoke_cv` restored the title (`Smoke Candidate Resume`) but held the visual preview at `Loading CV.`
- Playwright failed on `[data-renderer-variant="swissminima"]`.

Fix strategy:

- Keep the remote-auth safety hold while auth/Convex is unresolved.
- Release `isVisualRestorePending` once auth and Convex have settled and no remote route refresh is usable.
- Add a focused context test for a signed-out local route CV without a template id.
- Keep the existing smoke assertion for `data-renderer-variant="swissminima"` so the fix proves rendered preview, not just route load.

## Files Changed

- `my-app/src/contexts/CvLibraryContext.tsx`
  - Releases visual restore pending for a local template-less route CV when remote restore is unavailable after auth settles.
- `my-app/src/contexts/__tests__/CvLibraryContext.test.tsx`
  - Adds regression coverage for the signed-out local route CV restore state.
- `e2e/playwright-pr-smoke.spec.ts`
  - Keeps `/cv` and `/proposal` smoke checks and adds `/dashboard` and `/jobs` safe route coverage.
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`
  - Updates PR86 as merged and PR86.1 as current.
- `docs/plans/2026-06-21-pr86-1-founder-app-test-path-unlock.md`
  - Records this evidence.

No package, lockfile, schema, Stripe, OAuth, provider, PR80-live, answer-copy, PR87, or Norma Core file was changed.

## Route Evidence

Local URL: `http://localhost:5173`

- `/dashboard`: HTTP 200, founder shell rendered with `Recent work` and `Resume the work already in progress.`
- `/cv?id=playwright_smoke_cv`: HTTP 200, `data-live-resume-preview` present, `data-renderer-variant="swissminima"` present, `Smoke Candidate Resume` visible.
- `/jobs`: HTTP 200, signed-out safe gate rendered: `Sign in to see jobs.`
- `/proposal`: HTTP 200, seeded proposal route rendered and preview/edit toggle smoke passed.

Coverage limit:

- Automated smoke uses signed-out local fixtures and safe gates.
- A real signed-in founder pass still requires a configured Clerk test account, but the local full-stack app path itself is now executable.

## Verification Commands

Passed:

```sh
rtk npx vitest run src/contexts/__tests__/CvLibraryContext.test.tsx
rtk npx tsc --noEmit --pretty false
rtk env PLAYWRIGHT_APP_URL=http://127.0.0.1:5173 npx playwright test e2e/playwright-pr-smoke.spec.ts --project=chromium
rtk npx vitest run src/modules/billing/__tests__/stripeBillingConfigBoundary.test.ts src/modules/billing/__tests__/stripeBillingConfigBoundaryScopeGuards.test.ts convex/__tests__/ownerProfileBoundaryScopeGuards.test.ts convex/__tests__/liveExternalActionSafety.test.ts convex/__tests__/manualApplicationHandoff.test.ts convex/__tests__/applicationPackages.test.ts src/contexts/__tests__/CvLibraryContext.test.tsx
rtk npx vitest run src/modules/local-mcp/__tests__/mcpOperationalStatus.test.ts src/modules/local-mcp/__tests__/mcpOperationalEvents.test.ts src/modules/local-mcp/__tests__/mcpOperationalErrorTaxonomy.test.ts convex/__tests__/mcpReviewCockpitSummary.test.ts convex/__tests__/mcpApplicationPackageSummary.test.ts convex/__tests__/mcpEvidenceGraphSummary.test.ts src/modules/local-mcp/__tests__/mcpReadOnlyReviewComponent.test.ts src/modules/local-mcp/__tests__/mcpRealApplicationPackageSummary.test.ts src/modules/local-mcp/__tests__/mcpRealEvidenceGraphSummary.test.ts
```

Results:

- CV library regression suite: 63 tests passed.
- PR Playwright smoke: 3 tests passed.
- TypeScript: no errors.
- Stripe/manual-handoff/live-safety/application package boundary suite: 126 tests passed.
- Local MCP/read-only summary suite: 90 tests passed.

Not a required pass gate for PR86.1:

```sh
rtk env PLAYWRIGHT_APP_URL=http://127.0.0.1:5173 npx tdpw test e2e/playwright-pr-smoke.spec.ts --project=chromium
```

Result: blocked by missing `TESTDINO_TOKEN`. This matches the PR86 finding and does not block the plain Playwright local app test path.

## Stripe / Billing Boundary

Command:

```sh
rtk npx tsx -e 'import { evaluateBillingTestMode } from "./src/modules/billing/stripeBillingConfig"; console.log(JSON.stringify({ noStripe: evaluateBillingTestMode({}).status, testStripe: evaluateBillingTestMode({ STRIPE_SECRET_KEY: "sk_test_123", STRIPE_PRICE_ID: "price_123" }).status, liveStripe: evaluateBillingTestMode({ STRIPE_SECRET_KEY: "sk_live_123", STRIPE_PRICE_ID: "price_123" }).status }))'
```

Observed:

```json
{"noStripe":"internal_test_mode","testStripe":"stripe_test_configured","liveStripe":"stripe_live_mode_blocked"}
```

This confirms Stripe remains optional for local testing and live Stripe remains blocked.

## PR80-Live And Answer-Copy Boundaries

Confirmed facts:

- Roadmap and ledger still require provider authorization, official credentials, sandbox/test tenant, authorized test posting, schema/questions endpoint, submit endpoint, and receipt/error/duplicate/retry clarification before PR80-live.
- `convex/__tests__/liveExternalActionSafety.test.ts` passed in the inherited boundary suite.
- `convex/__tests__/manualApplicationHandoff.test.ts` passed in the inherited boundary suite.
- Approved answer copy remains blocked because no authoritative server-derived approved answer source has been unlocked.

Inference:

- PR86.1 does not change the status of PR80-live or answer-copy. Both remain blocked by existing governance and tests.

## Remaining Limits

- TestDino cannot run until `TESTDINO_TOKEN` is supplied.
- Signed-in Clerk owner-isolation smoke is not automated in this PR.
- Existing repo-wide inherited lint/build debt remains out of scope; targeted TypeScript and relevant tests pass.

## Rollback

Revert this PR to restore the previous behavior. The most relevant behavioral rollback is the `CvLibraryContext` effect that clears stale visual restore pending for local template-less route CVs.

## Verdict

`APP_TESTABLE_NOW`
