# Studio Current CV Navigation Audit

Date: 2026-03-21

## Status

Resolved in active code.

## Symptom

Clicking `Studio` in the sidebar could land on `/cv` and show the empty-state card:

- `Your resume space is ready`

even when the user was already working on a current CV.

## Root Cause

Active code was relying on in-memory context restoration instead of explicit navigation state.

### Active code

- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/Sidebar.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/contexts/CvLibraryContext.tsx`

### What was happening

1. The sidebar `Studio` entry navigated to `/cv` with no explicit CV id.
2. `CvForge` rendered `ProfileReviewCard` without a `cvId` prop.
3. `ProfileReviewCard` only calls `loadCv(cvId)` when `cvId` is provided.
4. The page therefore depended on `CvLibraryContext` to have already restored `currentCv` from memory or local storage.
5. When that restoration had not completed yet, or had not been forced by the route, the page rendered the empty state instead of the active CV.

## Fix

The route now carries the active CV explicitly:

- Sidebar `Studio` uses the current CV id when available.
- If no in-memory `currentCv` exists yet, it falls back to the persisted `cvActiveId`.
- CV sub-items navigate to `/cv?id=...`.
- `CvForge` reads `?id=` and passes it into `ProfileReviewCard`.

This makes the route deterministic and avoids relying on background hydration timing.

## Classification

- `Sidebar.tsx`, `CvForge.tsx`, `ProfileReviewCard.tsx`, `CvLibraryContext.tsx`: active code
- No legacy parser or backup tree involved in this bug
