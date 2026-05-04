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
- Browser smoke (headless) check: `node browser-check.mjs` equivalent script run via `page.goto('/cv?id=cv-browser-check')` with seeded localStorage and no console errors (1 preview root detected).
- Note: existing full e2e `e2e/cvforge-preview-linking.spec.ts` still fails on modal-role assertions in this branch; this appears separate from the metadata persistence path.

## Remaining risk

- Browser verification for desktop/narrow/mobile style-only regression and `/cv` panel interactions remains incomplete until a small targeted Playwright probe is stabilized for current sheet/modal DOM.
