# Document Viewer Fit / Zoom Geometry

Date: 2026-03-28

## Status

Accepted — supersedes the Fit geometry clauses in `2026-03-27-proposal-output-shell-spec.md`

## Active Code

- `src/components/ProposalDisplay.tsx`
- `src/features/verbati/resume/ResumePage.tsx`
- `src/styles/product.css`

## Decisions

### 1 — Fit = fill available width; vertical scroll is expected

`Fit` scale is computed as:

```
fitScale = Math.min(1, availableWidth / PAGE_WIDTH_PX)
```

Height is **not** included in the min. A4 paper (ratio 1:1.41) at fill-width always
overflows a viewport that is shorter than it is wide. That is normal document-viewer
behavior; the user scrolls to see the rest of the page.

**Supersedes** the earlier spec clause that said Fit must consider both width and height.
Height-constrained Fit produced a page narrower than the content area, leaving
100px+ dark gutters on both sides. The root cause is documented in the audit below.

### 2 — The document page element is the sole geometry authority

| Surface | True A4 element | Sized by |
|---|---|---|
| Proposal | `.dasti-proposal-sheet__preview-page` | inline `width` / `height` px |
| Resume | `.resume-page` | CSS `transform: scale(--preview-scale)` |

The outer shell, frame, body, and scroll container are structural viewer chrome.
They must not define the page ratio and must not be measured as if they were the page.

### 3 — Scroll bleed is horizontal-only overflow detection

The scroll container removes its bleed (`data-edge-fit="true"`, `padding: 0`) only
when the page overflows **horizontally** — i.e., when the user has zoomed in past
fill-width. Vertical overflow is handled naturally by the scroll container and must
not trigger bleed removal:

```js
// correct
const viewportOverflows = actualPageWidth > previewViewportSize.width + 1;

// wrong — vertical overflow is always true at Fit after width-only scale
const viewportOverflows =
  actualPageWidth > previewViewportSize.width + 1 ||
  actualPageHeight > previewViewportSize.height + 1;
```

### 4 — Document renderer body padding is zeroed

`.dasti-proposal-sheet__body` has asymmetric base padding (`8px` start / `16px` end)
that is correct for editable and plain-text modes but wrong for the document renderer,
where the scroll container's bleed tokens are the sole spacing layer.

The modifier class `.dasti-proposal-sheet__body--document-viewer` zeros this padding
and is applied whenever `isReadonly && usesDocumentRenderer`.

### 5 — Scroll-node mount must be tracked as React state

When proposal content is already present at mount time (saved proposal loaded from
props), `useLayoutEffect` fires before the scroll node is attached. The ref set does
not re-trigger effects. A `scrollNodeMounted` boolean state is used to bridge this:

```js
const [scrollNodeMounted, setScrollNodeMounted] = React.useState(false);
// set in the attach callback; included in useLayoutEffect deps
```

This ensures the fit scale is computed on first render even when content precedes
the scroll node.

## Why these decisions replace the prior ones

The 2026-03-27 shell spec included:

> `Fit` must consider both available width and available height.

Live DOM measurement proved this produces a 0.501 scale factor (height-limited) on
a 606px-wide viewer, resulting in a 398px page inside a 534px content area — 68px
dark gap per side, plus 24–40px frame bleed = 100px+ total dark gutter. The page
visually appeared to be floating with a thick dark border instead of filling the viewer.

Width-only Fit (scale 0.672) fills the page edge-to-edge in the content area with
only the intentional 24px symmetric bleed, which matches standard PDF viewer behavior.

## Reference

Audit: `docs/audits/2026-03-28-document-viewer-ratio-fit-zoom-fix.md`
