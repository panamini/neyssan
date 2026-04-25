# CV Forge Desktop Eye Toggle Overlap Audit

Date: 2026-04-04

## Scope

Audit the desktop-only overlap where the floating eye toggle in CV Forge edit mode covers the first toolbar control, while mobile does not show the same collision.

## Findings

- Active code: [my-app/src/pages/CvForge.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx)
  The eye toggle is rendered in its own absolute top-left slot for edit mode.
- Active code: [my-app/src/components/ProfileReviewCard.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx)
  The editor action row is a wrapping flex cluster, but it originally had no reserved inline lane for the floating eye toggle.
- Active code: [my-app/src/styles/product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css)
  The eye slot and the edit toolbar both began from the same desktop inset, so the first toolbar control could render underneath the eye shell. Mobile avoided the collision because it changes the shell placement and adds more top spacing.

## Root Cause

The overlap was caused by two independent desktop surfaces occupying the same horizontal origin:

1. The floating eye toggle is absolutely positioned at the top-left of the workbench.
2. The editor action toolbar above the profile card still laid out as if that left lane was free.

Because the action row was width-driven rather than lane-aware, shrinking the browser let the toolbar wrap too late and its first control slid under the eye toggle.

## Fix

- Added a desktop-only reserved inline offset based on the shared toolbar shell sizing tokens.
- Applied that offset to the CV edit action row so it keeps the same toolbar block height as the preview controls while starting after the eye lane.
- Kept the row at `width: 100%` with wrapping enabled so it collapses into a new line before reaching the eye toggle.
- Left mobile with a zero reserved offset so the existing compact layout remains unchanged.

## Verification

- `npx vitest run src/components/__tests__/CvForgeToolbar.css.test.ts`
