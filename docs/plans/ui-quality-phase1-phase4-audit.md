# UI quality audit — Phase 1 through QA checkpoint

## Context
This branch completed the scoped UI quality pass against the active `v1` product surface. The original Phase 1 + Phase 4 slice expanded through the adjacent audited surfaces that had clear token/scope gaps: Jobs, Documents, Templates, Onboarding replay, Settings document style, Command Palette, Sidebar, and serif usage in app chrome.

## Current status
- Branch: `claude-review`
- Latest commit: `288333a5 polish ui quality tokens and surfaces`
- Working tree status at last update: clean
- Validation status:
  - `rtk pnpm tsc --noEmit --pretty false` ✅
  - `rtk pnpm exec vite build` ✅
  - Targeted UI tests for the touched surfaces ✅
  - Browser screenshot smoke in light/dark ✅

## Completed scope
- [x] Confirmed exact missing tokens and duplicate token definitions from code.
- [x] Moved/aliased `--type-h1`, `--type-h2`, `--type-body` into `foundation.css`.
- [x] Added `--type-small`, `--type-label`, and `--kpi-numerals` to `foundation.css` as font-shorthand tokens while preserving current rhythm; KPI numerals remain tabular.
- [x] Added `--grid-gap` and `--rail-width` to `foundation.css` as aliases to existing layout tokens.
- [x] Removed the local `:root` type-token block from `product.css` after foundation aliases were in place.
- [x] Rechecked Dashboard CTA hierarchy and reduced it to one filled brand CTA (`Review match`).
- [x] Normalized Dashboard status tones so warning/success carry semantic load and brand accent is not used for routine `Drafting` state.
- [x] Re-audited remaining serif-token usage; removed active app-chrome serif usage while leaving document renderers and intentional template mini previews untouched.
- [x] Polished Jobs source/action hierarchy and match verdict rail.
- [x] Compacted Documents cards and normalized card metadata/status hierarchy.
- [x] Added labeled onboarding segmented progress.
- [x] Improved Settings document-style swatches with selected states.
- [x] Added selected-state affordance to Templates cards.
- [x] Made Command Palette Enter inert until an item is intentionally active; shortcuts now render as keyboard chips.
- [x] Reworked Sidebar active state to use neutral selected blocks with a small accent stripe instead of brand gradients.
- [x] Captured QA screenshots for target routes in light and dark.

## QA evidence
Screenshots and route/console notes are saved in:

- `docs/UI/qa/2026-05-05/qa-results.json`
- `docs/UI/qa/2026-05-05/*.png`

Routes covered in light and dark:

- `/dashboard`
- `/jobs`
- `/jobs/job_alpha`
- `/proposal`
- `/documents`
- `/templates`
- `/settings?tab=docstyle`
- `/cv`

Expected browser QA notes:

- Clerk development-key warning appears on loaded routes.
- `/jobs` and `/jobs/job_alpha` show the unauthenticated sign-in state in this local smoke pass; authenticated job-detail data was not available in the preview session.

## Known validation blockers / unrelated warnings
- `pnpm lint:css` is blocked by pre-existing `src/styles/product-cv.css` violations, primarily disallowed hex colors and `rgb()` usage, outside this UI-quality slice.
- Full `pnpm test -- --run` is not a clean guardrail in this environment because it OOMs / hits unrelated environment blockers including Convex deployment configuration and canvas native module warnings.
- Production build passes but emits existing non-fatal warnings:
  - stale `baseline-browser-mapping`
  - stale Browserslist/caniuse-lite data
  - `pdfjs-dist` eval warning
  - large chunk warning

## Remaining todo
- [ ] Decide whether to push branch `claude-review`.
- [ ] Optional: run authenticated browser QA for `/jobs/:jobId` so the real job-detail/match data view is captured instead of the sign-in state.
- [ ] Optional: fix or separately ticket the unrelated `product-cv.css` stylelint debt.
- [ ] Optional: stabilize or split the full Vitest run so full-suite results are usable in this environment.
- [ ] Optional: refresh Browserslist / baseline browser mapping dependencies in a separate maintenance change.

## Files changed by the UI-quality pass
- `my-app/src/components/CommandPalette.tsx`
- `my-app/src/components/jobs/JobDetail.tsx`
- `my-app/src/components/jobs/JobMatchPanel.tsx`
- `my-app/src/components/onboarding/OnboardingReplay.tsx`
- `my-app/src/pages/DashboardPage.tsx`
- `my-app/src/pages/DocumentsPage.tsx`
- `my-app/src/pages/SettingsPage.tsx`
- `my-app/src/pages/TemplatesPage.tsx`
- `my-app/src/styles/foundation.css`
- `my-app/src/styles/product.css`
- `my-app/src/styles/product-jobs.css`
- `my-app/src/styles/product-libraries.css`
- `my-app/src/styles/product-proposal.css`
- `my-app/src/styles/product-settings.css`
- `docs/UI/qa/2026-05-05/*`
