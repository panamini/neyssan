# PR87 Production Deployment Gate

Date: 2026-06-21
Branch: `codex/pr87-production-deployment-gate`
Base: `application-os-foundation`
Base/HEAD verifies: `a032632704ce89e0679508a40050cce9fe341bbe`
Target PR: PR87 - Production Deployment Gate

Final verdict: `BLOCKED_PRODUCTION_GATE`
BLOCKER_CODE: `PRODUCTION_BUILD_RED`

## Etat du repo

Certain:

- PR86.1 / GitHub #222 is merged.
- Local `HEAD` and `origin/application-os-foundation` both resolve to `a032632704ce89e0679508a40050cce9fe341bbe`.
- Working tree was clean before PR87 edits.
- No remote PR exists for `codex/pr87-production-deployment-gate`.
- `rtk git diff --name-only origin/application-os-foundation...HEAD` and `rtk git diff --check origin/application-os-foundation...HEAD` were empty on base.
- PR80-live remains blocked by provider authorization prerequisites.
- Approved answer-copy remains blocked until a future authoritative approved-answer source model exists.
- Production billing is not implemented; Stripe remains optional/test-boundary only and live Stripe is blocked.
- Norma Core is a separate repository and was not touched.

Probable:

- The app can still be exercised locally with `./run.sh local-fast`, as proven by PR86.1, but that is not a preview/staging deployment proof.
- Existing Convex production deployment metadata exists in `my-app/convex.json`, but frontend hosting, parser hosting, signed-in smoke, rollback and runtime monitoring are not proven as one deployable environment.

A verifier:

- Real Clerk signed-in preview/staging smoke with a non-sensitive test account alias.
- Repository variables/secrets for CI Convex/Clerk.
- Actual protected preview/staging host for the frontend.
- Parser deployment target and rollback action.
- Convex deployment dry-run/deploy authority.

## Architecture runtime actuelle

| Composant | Runtime local | Runtime preview/prod | Config | Health check | Rollback |
| --- | --- | --- | --- | --- | --- |
| Frontend Vite | `npm run dev:frontend:raw`, `./run.sh local-fast` | not proven; no Vercel/Netlify/Fly/Render target found | `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY` | Vite HTTP readiness only in local/CI | not proven |
| Convex | `convex dev --local` via `run.sh local-fast` | `my-app/convex.json` has `prod:giddy-basilisk-88`; CI expects `CONVEX_DEPLOY_KEY` and `CONVEX_DEPLOYMENT` | `CONVEX_DEPLOYMENT`, `CONVEX_DEPLOY_KEY`, `CLERK_JWT_ISSUER_DOMAIN`, `CONVEX_PARSER_URL` | local `/instance_name`; no production smoke run | not proven |
| Parser | FastAPI Docker/workspace service on `:8001` local | GHCR image build exists; hosting provider target not defined | `CONVEX_PARSER_URL`, `PARSER_ORIGIN`, `CV_OCR_ENGINE` | `/ready`, `/healthz` | image rollback possible in principle, not proven against a host |
| Clerk/Auth | Clerk React frontend and Convex auth config | issuer/publishable key required; preview account not proven | `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_JWT_ISSUER_DOMAIN` | no auth health endpoint | not proven |
| MCP/ChatGPT | Vite dev-only `/mcp` behind `LOCAL_MCP_DEV_ENDPOINT=1`; tests exercise fixture/local paths | not deployable as production ChatGPT/App SDK runtime | local/dev flag only plus Stytch-shaped boundaries | helper/status tests only | not proven |
| Stripe test boundary | pure local/server status helper | no live billing; live keys blocked | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` optional test-shaped only | tests pass | disable/unset keys |
| Manual handoff | Convex/manual handoff boundary, default-off flag | not preview-smoked | `TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED` | status helper/tests | set flag false/unset |
| Observability | bounded local helpers and PR83 runbook | helpers are not proven connected to deployed runtime monitoring | status/event helpers | tests only | not proven |

## Build, lint, typecheck, tests

Base commands:

- `rtk npm run build` in `my-app`: failed before edits. Root causes include many `tsc -b` errors across Convex/MCP modules and `TS6307` project-reference errors from `vite.config.ts` importing `src/modules/local-mcp/localMcpDevEndpoint.ts`.
- `rtk npm run lint` in `my-app`: failed before edits. ESLint config references missing `./scraping-server/tsconfig.json`; `my-app/scraping-server` is not present in `HEAD`.
- `rtk npx tsc --noEmit --pretty false` in `my-app`: passed.
- Focused Vitest for Stripe boundary, PR80-live safety, local MCP dev endpoint, MCP operational status/events: passed, 37 tests.
- `rtk ./node_modules/.bin/convex codegen --typecheck disable` in `my-app`: blocked locally because `CONVEX_DEPLOYMENT` is unset.
- `rtk npm audit --omit=dev` in `my-app`: failed with 37 runtime dependency vulnerabilities, including 2 critical.

PR87 cannot declare production readiness while the production build command is red.

## CI

Current CI does not prove the PR87 production gate:

- `.github/workflows/ci.yml` installs dependencies, requires Convex codegen secrets, then runs only selected Match Review guardrail tests.
- `.github/workflows/playwright.yml` targets `main/master`, not `application-os-foundation`, and runs smoke/full Playwright against local Vite only when repository vars/secrets exist.
- `.github/workflows/cv-parser-service.yml` targets `main` and parser paths only; it has a TODO for deployment once hosting credentials exist.
- `.github/workflows/release.yml` builds/pushes a parser image to GHCR on `main` or manual dispatch, but does not deploy a protected staging environment.

## Env inventory

REQUIRED for local/full-stack or CI:

- `VITE_CONVEX_URL`: frontend public Convex URL; consumed by Vite app/CI.
- `VITE_CLERK_PUBLISHABLE_KEY`: frontend public Clerk key; consumed by Clerk frontend/CI.
- `CLERK_JWT_ISSUER_DOMAIN`: server-side Convex auth issuer; consumed by `convex/auth.config.ts`.
- `CONVEX_DEPLOYMENT`: Convex deployment selector; consumed by Convex CLI/CI.
- `CONVEX_DEPLOY_KEY`: Convex deploy/codegen secret; consumed by CI.
- `CONVEX_PARSER_URL`: server-side parser origin; consumed by Convex structured upload/parser probes.

OPTIONAL:

- `CONVEX_TEAM`, `CONVEX_PROJECT`: local Convex slugs for `./run.sh local-fast`.
- `PARSER_ORIGIN`: parser edge origin fallback.
- `VITE_PARSER_URL`, `VITE_CONVEX_PARSER_URL`: dev/frontend parser routing helpers.
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`: optional test-shaped Stripe boundary only.
- `TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED`: manual handoff feature flag; default false.
- `LOCAL_MCP_DEV_ENDPOINT`: local Vite `/mcp` dev endpoint flag; default off.
- `MISTRAL_API_KEY`, `OPENAI_API_KEY`, model envs: LLM/runtime features outside the PR87 deployment proof.

MUST_BE_FALSE or unset:

- `TWOWEEKS_LIVE_EXTERNAL_ACTIONS_ENABLED`: PR80-live remains blocked even if true returns provider authorization required.
- approved answer-copy runtime flag/source: no authoritative approved-answer source exists.
- live Stripe keys (`sk_live_*`, `pk_live_*`): blocked by the billing boundary.

MUST_BE_UNSET:

- Real provider/ATS credentials, OAuth token storage, browser automation credentials, production billing secrets in repo or client-prefixed env.

## MCP runtime

The real `/mcp` endpoint is not production deployable in PR87:

- `vite.config.ts` registers the endpoint only in Vite dev server middleware.
- The flag is `LOCAL_MCP_DEV_ENDPOINT=1`.
- Tests and modules show fixture/local/dev flows, no production ChatGPT connector endpoint, no public deployed transport proof, and no fully proven auth/account-link runtime smoke.

This is a secondary production gate blocker. The primary bounded code for this report remains `PRODUCTION_BUILD_RED` because the production build fails first.

## Frontend

- Build command: `npm run build` in `my-app`.
- Output directory: Vite default `dist` if build succeeds.
- Preview command: `npm run preview` in `my-app`.
- Host target: not proven by repository config.
- SPA rewrite/CSP/headers: not proven by active deployment config.

## Convex

- `my-app/convex.json` declares `prod:giddy-basilisk-88`.
- `convex/auth.config.ts` uses `CLERK_JWT_ISSUER_DOMAIN` or a dev Clerk default.
- CI codegen requires `CONVEX_DEPLOY_KEY` and `CONVEX_DEPLOYMENT`.
- No schema migration was touched.
- No Convex deploy/dry-run was run because local config is missing `CONVEX_DEPLOYMENT`.

## Parser

- Active parser is `cv_parser_service/main.py` via Docker/runtime and `./run.sh local-fast`.
- Health endpoints: `/ready` and `/healthz`.
- `rtk ./run.sh status` observed local `/ready: 200`, local Convex at `http://127.0.0.1:3210`, parser runtime `workspace`, tunnel stopped, and edge `/ready: 530`.
- `release.yml` can build/push a GHCR parser image.
- `cv-parser-service.yml` contains an explicit TODO for deployment once hosting credentials exist.
- No parser hosting provider or rollback target is proven.

## Health, observability, flags, kill switches

- Parser has `/ready` and `/healthz`.
- PR83 status/event helpers and runbook are present and tested locally.
- Runtime monitoring/dashboards or deployed health aggregation are not proven.
- Manual handoff defaults disabled unless `TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED=true`.
- Live external actions default disabled; enabling still returns `provider_authorization_required`.
- Answer-copy remains blocked.
- Live Stripe is blocked; test Stripe is optional.

## Signed-in smoke

Blocked:

- PR86.1 Playwright smoke is signed-out with fixtures/safe gates.
- No existing automated signed-in Clerk preview/staging smoke was proven in this PR87 run.
- A valid signed-in smoke must cover `/dashboard`, `/cv`, `/jobs`, `/jobs/:jobId` where fixture exists, `/proposal`, owner/profile isolation, manual handoff disabled/enabled status, and no cross-owner data.

## Dependency audit and bundle secret scan

- Dependency audit: `rtk npm audit --omit=dev` failed with 37 runtime dependency vulnerabilities, including 2 critical. PR87 did not change packages or lockfiles.
- Bundle secret scan: not completed because the production build fails before a bundle exists.

No secret values were read or documented. Only variable names are listed.

## Rollback

No runtime change was made in this PR87 report.

Minimum rollback for this docs-only PR87 branch:

- Revert this document and the ledger update.

Required future rollback proof before readiness:

- Frontend host rollback to previous artifact/version.
- Convex deploy rollback/forward-fix plan with schema risk classification.
- Parser image rollback to previous GHCR tag/deployed image.
- Flag rollback by unsetting/disabling manual handoff, live external actions, and any Stripe test config.

## Files modified

- `docs/plans/2026-06-21-pr87-production-deployment-gate.md`: records PR87 deployment gate evidence and blocker.
- `docs/plans/2026-06-12-chatgpt-app-roadmap-progress-ledger.md`: records PR86.1 merged and PR87 blocked preflight state.

No package, lockfile, schema, CI, parser business logic, billing production, provider/OAuth/token, PR80-live, answer-copy, or Norma Core file was changed.

## Risks and next action

Root blockers:

- Production build red.
- Lint gate unusable.
- Runtime dependency audit red.
- Preview/staging frontend target undefined.
- MCP runtime not production deployable.
- Signed-in smoke missing.
- Runtime observability and rollback not proven.

Smallest next action:

1. Fix `npm run build` without weakening TypeScript or changing package/lockfile.
2. Fix lint config so lint starts against real existing projects.
3. Add/identify a protected preview/staging target decision.
4. Add signed-in Clerk smoke evidence.
5. Prove parser/Convex/frontend rollback and runtime health.

## Verdict

`BLOCKED_PRODUCTION_GATE`

BLOCKER_CODE=`PRODUCTION_BUILD_RED`
