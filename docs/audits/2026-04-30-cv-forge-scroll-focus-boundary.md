# CV Forge Scroll/Focus Boundary Audit

Date: 2026-04-30

## Symptom

In CV Forge, after loading a CV and scrolling down to `Selected Projects`, wheel scrolling can stop. Clicking the `Projects` section row appears to unblock scrolling.

## Active Code Boundary

This is active code:

- `my-app/src/pages/CvForge.tsx`
- `my-app/src/features/verbati/VerbatiResumePreview.tsx`
- `my-app/src/hooks/use-document-pan.ts`
- `my-app/src/styles/product-cv.css`

## Earliest Plausible Boundaries

1. `CvForge.focusPreviewSection(...)` programmatically focuses and scrolls a preview section.
2. `VerbatiResumePreview` installs a capture-phase `wheel` listener on `.dasti-doc-viewport--resume`.
3. `useDocumentPan(...)` captures pointer drag gestures for manual document panning.
4. CV Forge layout CSS defines nested scroll containers: page shell, document viewport, and sticky rail.

## Winning Boundary

The strongest boundary is `VerbatiResumePreview` wheel ownership.

`VerbatiResumePreview` manually applies `deltaY` to the resume viewport and calls `event.preventDefault()` when the viewport scroll position changes. Existing tests also assert that, at the bottom edge, the outer scroll root does not move. That is a valid behavior for a standalone document viewer, but in PR4 CV Forge the resume is embedded inside a larger scrollable forge page.

## Why The Symptom Matches

When the pointer is over the resume viewport, wheel events are captured before the page can handle them. If the resume viewport is at or near a scroll boundary, normal browser scroll chaining is blocked by design. Clicking a rail section changes focus and scroll position, which can make it feel "unblocked", but it does not define a coherent focus model.

`useDocumentPan(...)` is less likely as the root cause because it only handles pointer drag/pan, not wheel scrolling.

## Recommended Fix

Add an explicit scroll ownership mode to `VerbatiResumePreview`, for example:

- `scrollBoundary="contain"` for standalone/workspace document viewers that must trap scroll.
- `scrollBoundary="chain"` for embedded CV Forge edit surfaces where wheel at a viewport edge must bubble to the page.

Then pass `scrollBoundary="chain"` from CV Forge edit mode. Keep preview/print/export unaffected.

## Guard Test

Add or update a `VerbatiResumePreview` test for panel mode with `scrollBoundary="chain"`:

- viewport starts at bottom
- outer `document.scrollingElement` has room to scroll
- wheel down over the resume viewport does not call the manual trap path
- outer scroll is allowed to change or the event is not prevented

Keep existing containment tests for workspace/standalone viewer behavior.

## Non-Fix

Do not add more `focusPreviewSection(...)` calls or extra `scrollTo(...)` calls. That would treat symptoms while keeping conflicting scroll owners.
