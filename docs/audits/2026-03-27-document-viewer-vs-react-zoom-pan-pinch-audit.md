# Document Viewer vs `react-zoom-pan-pinch` Audit

Date: 2026-03-27

## Scope

Audit whether Neyssan should replace or augment the current resume/proposal preview viewer with `react-zoom-pan-pinch`.

## Classification

- Active code:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiResumePreview.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/ResumePage.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-preview.css`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css`
- Legacy but informative:
  - none used in this audit
- Obsolete/dead:
  - none used in this audit

## Current Viewer Strengths

- Resume preview already has native fit logic tied to real page dimensions and content density.
- Proposal preview already has a real document renderer whose mm-based layout and typography depend on the measured page width.
- The current system can use scroll geometry and DOM size directly, which matches the requirement for real A4-proportional previews.

## Current Viewer Weaknesses

- Zoom centering was inconsistent between resume and proposal.
- Proposal had extra left anchoring because preview scroll was being reset to `0`.
- Narrow viewport resizes could leave the page visually hanging out of the staging shell because the viewport was not re-centering after layout changes.

## `react-zoom-pan-pinch` Findings

Sources used:

- GitHub repo: https://github.com/prc5/react-zoom-pan-pinch
- Docs: https://BetterTyped.github.io/react-zoom-pan-pinch/?path=/story/docs-props--page
- npm package: https://www.npmjs.com/package/react-zoom-pan-pinch

Observed from package metadata and shipped types:

- Current npm version is `3.7.0`.
- Package description: “Zoom and pan html elements in easy way.”
- Public API is wrapper-driven (`TransformWrapper`, `TransformComponent`).
- The library state is transform-oriented:
  - `scale`
  - `positionX`
  - `positionY`
  - `setTransform`
  - `centerView`
  - `zoomToElement`
- Available props include `limitToBounds`, `centerZoomedOut`, `centerOnInit`, and custom wheel/pan/pinch behaviors.

## Conclusion

`react-zoom-pan-pinch` is strong as a generic transform wrapper, but it is not a clean replacement for Neyssan’s proposal preview.

Reason:

- Neyssan proposal layout is not just a bitmap or generic DOM zoom problem.
- Proposal typography and layout depend on the page width measured by the real renderer, not only on a visual `transform: scale(...)`.
- A transform-only wrapper would fight the proposal mm/grid system because it changes visual size without necessarily changing the measured width the renderer uses.

Inference from sources:

- Because the package exposes transform state (`scale`, `positionX`, `positionY`) and wrapper-based APIs rather than document-width APIs, it is better suited to image/canvas/general DOM zoom than to Neyssan’s width-driven proposal renderer.

## Recommendation

- Keep Neyssan’s native viewer shell as the source of truth for resume/proposal previews.
- Improve the native shell with:
  - centered zoom behavior
  - viewport recentering on resize
  - pan via native scroll geometry
- Only consider `react-zoom-pan-pinch` later if Neyssan wants:
  - touch-first pinch gestures quickly
  - a generic media viewer
  - an isolated wrapper for non-document surfaces

It should not replace the proposal renderer pipeline.
