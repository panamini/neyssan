# CV Forge paper width and AI routing sync

Date: 2026-05-04
Scope: PR4 CV Forge rendering + helper AI routing.

## Issue

CV Forge edit mode had a narrower paper shell than preview after an earlier compact-stage patch, and the CV AI helper path still mixed in a legacy Ministral fallback for section suggestions.

## Fix

- `my-app/src/pages/CvForge.tsx`
  - removed the edit-only compact stage class
  - edit and preview now share the same `dasti-cv-paper-stage` width contract
- `my-app/src/styles/product-cv.css`
  - paper width is `min(100%, 860px)`
  - mobile collapses both paper modes to `width: 100%`
- `my-app/src/features/verbati/resume/ResumePage.tsx`
  - shared preview renderer now handles rich summary editing parity via `PaperRichInlineEditor`
- `my-app/convex/functions.ts`
  - CV helper routing now defaults to `mistral-small-latest` for summary/custom text and suggestion actions

## Verification

- `npm run test -- src/components/__tests__/CvForgeToolbar.css.test.ts src/pages/__tests__/CvForge.workspace-mode.test.tsx --run`
- `npm run test -- convex/lib/__tests__/editorAi.test.ts src/components/__tests__/CvForgeToolbar.css.test.ts src/features/verbati/resume/__tests__/ResumePage.test.tsx src/pages/__tests__/CvForge.workspace-mode.test.tsx --run`

## Result

- CV Forge edit and preview now match on paper width.
- CV helper routing is aligned to Mistral Small.
- The remaining next step is Proposal cross-breakpoint QA.
