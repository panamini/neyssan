# Verbati style persistence hardening (May 4, 2026)

Date: 2026-05-04
Scope: `/cv` style-only save path (frontend + Convex backend) and browser-facing regression coverage.

## Issue

Style changes previously used the same full CV save path as content edits, which sent full `cvDocument` on every debounce flush. For large documents, this could exceed Convex `1 MiB` limits and could also create a new `userProfiles` row when only style metadata existed in memory.

## Fix

- Frontend now routes style-only persistence to a dedicated metadata patch API:
  - `my-app/src/features/verbati/useBoundVerbatiCvStyle.ts`
  - `my-app/src/pages/CvForge.tsx`
  - `my-app/src/features/verbati/VerbatiCvPreviewPanel.tsx`
  - `my-app/src/features/verbati/VerbatiStyleWorkspace.tsx`
  - `my-app/src/contexts/CvLibraryContext.tsx`
  - `my-app/src/adapters/StorageAdapter.ts` (`saveMetadataPatch`)
- Backend mutation now handles metadata-only patching safely:
  - `my-app/convex/profiles.ts`
  - no `cvDocument` is written for metadata-only style saves
  - existing profile rows are updated in place (metadata merged)
  - no new row is created if profile is missing

## Verification executed

- `rtk npm test -- --run convex/__tests__/profiles.patch.test.ts`
- `rtk npm test -- --run src/adapters/__tests__/StorageAdapter.test.ts`
- `rtk npm test -- --run src/features/verbati/__tests__/useBoundVerbatiCvStyle.test.tsx`
- `rtk npm test -- --run src/features/verbati/__tests__/VerbatiCvPreviewPanel.test.tsx src/features/verbati/__tests__/VerbatiCvPreviewPanel.workspace-style-cycle.test.tsx`
- `rtk npx tsc --noEmit`
- `rtk npx playwright test e2e/cvforge-preview-linking.spec.ts --project=chromium --grep "keeps modal targets in preview mode and routes aliases correctly"` (after selector hardening)
- Browser smoke (headless) check: `node style-smoke.mjs` and `node style-smoke-local.mjs` seeds for `/cv` and `/style`, including `Edit profile` modal wiring on resume-link clicks.

## Remaining risk

- Full cross-browser coverage for this flow still depends on local Playwright browser binaries (`chromium`, `firefox`, `webkit`) being available in CI/dev hosts.
- The seeded CV in this specific e2e script does not include profile metadata rows, so `notes` alias coverage is intentionally guarded to the model output rather than enforced on every seed variant.
