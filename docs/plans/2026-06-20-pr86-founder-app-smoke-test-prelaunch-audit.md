# PR86 Founder App Smoke Test and Pre-Launch Audit

Audit run: 2026-06-21 Europe/Paris.
Branch: `codex/pr86-founder-app-smoke-test-prelaunch-audit`.
Base: `application-os-foundation`.

## 1. Current repo state

- PR85 / GitHub PR #220 is merged.
- `application-os-foundation` was fetched and local HEAD matches `origin/application-os-foundation`.
- Local HEAD is `1e0aadee60dba69d6044b31d050fcfdba400153e`.
- The worktree was clean before PR86 branch creation.
- Remote branch `codex/pr86-founder-app-smoke-test-prelaunch-audit` and an existing PR86 PR were absent before work began.
- The repo is now on `codex/pr86-founder-app-smoke-test-prelaunch-audit`.
- Existing local env files are present, but this document records env var names only.

## 2. PR85 merge verification

`rtk gh pr view 220 --repo panamini/neyssan --json number,state,mergedAt,mergeCommit,headRefName,baseRefName,title,url` returned:

- State: `MERGED`
- Base: `application-os-foundation`
- Head: `codex/pr85-stripe-test-mode-boundary`
- Merge commit: `1e0aadee60dba69d6044b31d050fcfdba400153e`
- Merged at: `2026-06-20T22:53:42Z`
- URL: `https://github.com/panamini/neyssan/pull/220`

`rtk git rev-parse HEAD` and `rtk git rev-parse origin/application-os-foundation` both returned the same merge commit.

## 3. Exact local start commands

Documented full local founder path:

```bash
rtk env OPEN_BROWSER=0 ./run.sh local-fast
```

Expected local URL after a successful start:

```txt
http://localhost:5173
```

Current result:

- `./run.sh local-fast` exits with Docker daemon unavailable.
- `rtk ./run.sh status` reports parser stopped, local Convex stopped, tunnel stopped, and Docker daemon unreachable.
- This blocks the full founder app path because `local-fast` is the documented app/parser/local Convex workflow.

Frontend-only diagnostic:

```bash
cd my-app
rtk npx vite --host 127.0.0.1 --port 5173 --clearScreen false
```

Result:

- `http://127.0.0.1:5173` served HTTP 200.
- This is not sufficient for founder app testing because it does not start parser or local Convex.

## 4. Required env vars

Required for signed-in founder testing:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`
- local Convex binding via `CONVEX_TEAM` and `CONVEX_PROJECT`, or an equivalent local Convex deployment binding
- `VITE_CONVEX_URL`, normally provided by `./run.sh local-fast`

Required for parser-backed local full-stack testing:

- Docker daemon running
- parser/local Convex dependencies available through `./run.sh local-fast`
- parser and LLM env only when the tested flow needs parsing or generation, for example `MISTRAL_API_KEY`

Not required for founder smoke testing:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`

## 5. No-Stripe test path

No Stripe env is the safe default for founder testing.

Command:

```bash
rtk npx tsx -e 'import { evaluateBillingTestMode } from "./src/modules/billing/stripeBillingConfigBoundary.ts"; console.log(JSON.stringify({ noStripe: evaluateBillingTestMode({}).status, testStripe: evaluateBillingTestMode({ STRIPE_SECRET_KEY: "sk_test_12345678", STRIPE_PUBLISHABLE_KEY: "pk_test_12345678" }).status, liveStripe: evaluateBillingTestMode({ STRIPE_SECRET_KEY: "sk_live_12345678", STRIPE_PUBLISHABLE_KEY: "pk_live_12345678" }).status }))'
```

Result:

```json
{"noStripe":"internal_test_mode","testStripe":"stripe_test_configured","liveStripe":"stripe_live_mode_blocked"}
```

Allowed in `internal_test_mode` and `stripe_test_configured`:

- app test access
- read-only summaries
- artifact export
- manual handoff

Still blocked:

- PR80 live submit/apply
- approved answer-copy
- workspace/team/admin runtime
- billing portal

## 6. Optional Stripe test-mode path

Optional local-only env var names:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`

Only test-shaped keys are accepted. Live-shaped keys return `stripe_live_mode_blocked`. The boundary exposes status only, never key values, and does not add Stripe SDK, checkout, webhooks, subscriptions, billing portal, paid entitlement state, or production billing runtime.

## 7. Exact founder manual smoke checklist

Run this after Docker is running and `./run.sh local-fast` succeeds.

1. Start the full local stack with `rtk env OPEN_BROWSER=0 ./run.sh local-fast`.
2. Open `http://localhost:5173`.
3. Open `/sign-in` and sign in through the configured Clerk test account.
4. Open `/dashboard` and confirm the app shell, topbar, and signed-in account control render.
5. Open `/cv` and confirm the owner profile/CV loads.
6. Edit a safe profile field, save it, reload, and confirm the owner-scoped value persists.
7. Open `/jobs` and create or select a local test job.
8. Open `/proposal` and confirm the current proposal workspace can preview and edit a proposal using the selected CV/job context.
9. Open `/documents` if the current run has artifacts, and confirm only approved/exportable artifacts are available.
10. In the manual handoff panel, use only the safe sequence: prepare package, confirm exact review copy, open destination yourself, download approved artifacts if present, and report the user-observed outcome.
11. Confirm answer-copy controls are absent or blocked with the approved blocked reason.
12. Confirm PR80-live submit/apply is unavailable and no live external action execution is reserved, dispatched, or finalized.
13. Confirm Stripe is not required by leaving `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` unset and checking `internal_test_mode`.
14. Optionally set local dummy test-mode Stripe env values and confirm `stripe_test_configured`.
15. Sign in as a second Clerk test user and verify the first user's profile/job/handoff records are not visible through `/cv`, `/jobs`, `/jobs/:jobId`, or manual handoff flows.

## 8. Automated tests run

Passed:

```bash
rtk npx vitest run src/modules/billing/__tests__/stripeBillingConfigBoundary.test.ts src/modules/billing/__tests__/stripeBillingConfigBoundaryScopeGuards.test.ts convex/__tests__/ownerProfileBoundaryScopeGuards.test.ts convex/__tests__/liveExternalActionSafety.test.ts convex/__tests__/manualApplicationHandoff.test.ts convex/__tests__/applicationPackages.test.ts
```

Result: 6 files passed, 63 tests passed.

Passed:

```bash
rtk npx vitest run src/modules/local-mcp/__tests__/mcpOperationalStatus.test.ts src/modules/local-mcp/__tests__/mcpOperationalEvents.test.ts src/modules/local-mcp/__tests__/mcpOperationalErrorTaxonomy.test.ts
```

Result: 3 files passed, 11 tests passed.

Passed:

```bash
rtk npx vitest run convex/__tests__/mcpReviewCockpitSummary.test.ts convex/__tests__/mcpApplicationPackageSummary.test.ts convex/__tests__/mcpEvidenceGraphSummary.test.ts src/modules/local-mcp/__tests__/mcpReadOnlyReviewComponent.test.ts src/modules/local-mcp/__tests__/mcpRealApplicationPackageSummary.test.ts src/modules/local-mcp/__tests__/mcpRealEvidenceGraphSummary.test.ts
```

Result: 6 files passed, 79 tests passed.

Passed:

```bash
rtk npx tsc --noEmit --pretty false
```

Result: no TypeScript errors.

Blocked:

```bash
rtk env PLAYWRIGHT_APP_URL=http://127.0.0.1:5173 npx tdpw test e2e/playwright-pr-smoke.spec.ts --project=chromium
```

Result: TestDino token missing.

Fallback browser smoke:

```bash
rtk env PLAYWRIGHT_APP_URL=http://127.0.0.1:5173 npx playwright test e2e/playwright-pr-smoke.spec.ts --project=chromium
```

Result: 1 passed, 1 failed. Proposal workspace smoke passed. CV preview smoke failed because `[data-renderer-variant="swissminima"]` was not found and the page snapshot still showed `Loading CV.`

## 9. What works now

- PR85 merge/base governance is clean.
- The frontend-only Vite server can serve `http://127.0.0.1:5173`.
- Stripe is optional for app testing; no Stripe env returns `internal_test_mode`.
- Test-shaped Stripe env returns `stripe_test_configured`.
- Live-shaped Stripe env returns `stripe_live_mode_blocked`.
- PR84 owner/profile scope guards pass.
- Owner/package cross-context rejection tests pass.
- Manual handoff owner isolation, redaction, rate limits, answer-copy block, artifact boundary, and event taxonomy tests pass.
- PR80-live config remains blocked without provider authorization, credentials, test tenant, and test posting.
- Read-only summaries and review cockpit projection tests pass.
- `rtk npx tsc --noEmit --pretty false` passes.

## 10. What remains blocked

- The documented full local founder path is blocked because Docker daemon is not running.
- The full authenticated browser path through local parser and local Convex was not verified.
- `rtk npx tdpw test` is blocked by missing `TESTDINO_TOKEN`.
- The fallback Playwright PR smoke is not fully green; the CV preview smoke is stuck at `Loading CV.`
- PR80-live remains blocked.
- Approved answer-copy remains blocked.
- Production billing remains unimplemented.
- Stripe live mode remains blocked.

## 11. Launch-blocking issues

- Founder cannot test the full app now from this execution boundary because `./run.sh local-fast` cannot start without Docker daemon access.
- Existing browser smoke evidence is not enough to claim app testability: frontend-only Vite serves, but the full local stack is unavailable and the CV smoke fails.
- A successful pre-launch gate still needs a rendered, signed-in browser pass through `/dashboard`, `/cv`, `/jobs`, `/proposal`, and manual handoff against the full local stack.

## 12. Non-launch-blocking inherited issues

These are inherited repo gates and were not fixed in PR86.

- `rtk npm run lint` still fails because `.eslintrc.cjs` requires missing `./scraping-server/tsconfig.json`.
- `rtk npm run build` still fails on existing repo-wide TypeScript debt, including `convex/activeCvSnapshots.ts:153`, readonly/mutable type mismatches in application context/package/evidence/live-safety paths, proposal/CV page type errors, and `tsconfig.node.json` include gaps.

These failures should remain visible for the next stabilization gate. They are not caused by this audit doc.

## 13. Final verdict

BLOCKED_APP_TEST_PATH
