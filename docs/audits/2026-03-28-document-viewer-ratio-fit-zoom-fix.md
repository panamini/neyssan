# Document Viewer Ratio / Fit / Zoom — Full Audit & Fix

Date: 2026-03-28

---

## Scope

All four document viewer surfaces:
1. Proposal Compose output (`/proposal`)
2. Saved proposal selected preview (`/proposal?view=saved&id=…`)
3. Style Forge proposal preview (`/style` → Proposal render tab)
4. Style Forge resume preview (`/style` → Resume render tab) and CV Studio (`/cv`)

---

## Layer classification

| Element | Class | Status |
|---|---|---|
| Outer shell | `.dasti-doc-viewer-shell` | Active — full-width relative container |
| Frame | `.dasti-proposal-sheet-frame` | Active — constrains max-width to `--document-viewer-shell-inline-size` |
| Sheet | `.dasti-proposal-sheet` | Active — the rounded viewer card with border, bg, shadow |
| Body | `.dasti-proposal-sheet__body` | Active — flex child inside sheet, had **incorrect padding** |
| Scroll | `.dasti-proposal-sheet__scroll` | Active — the real viewport with bleed padding, overflow:auto |
| Stage | `.dasti-proposal-sheet__preview-stage` | Active — sized to max(viewport, page) |
| Page | `.dasti-proposal-sheet__preview-page` | **True A4 authority** — aspect-ratio 210/297, scaled via inline style |
| Resume viewport | `.dasti-doc-viewport--resume` | Active — equivalent scroll container for resume |
| Resume page | `.resume-page` | **True A4 authority** — CSS transform scaled via `--preview-scale` |

---

## Pre-fix runtime measurements (live DOM, Playwright-style)

### Saved Proposal at Fit (pre-fix, after Fit click)
```
body.clientW:         606px    body.padL: 8px   body.padR: 16px (asymmetric)
scroll.clientW:       582px    scroll.padL: 24px  scroll.padR: 24px
scroll content W:     534px    scroll content H: 563px
page W:               398px    page H:           563px
left visible frame:   8 + 24 = 32px
right visible frame:  16 + 24 = 40px
gap inside content:   (534 - 398) / 2 = 68px each side
TOTAL dark frame:     L≈100px  R≈108px   (massive, asymmetric)
```

### Resume (pre-fix)
```
viewport.clientW:  545px    padL: 24px  padR: 24px
content W:         497px    content H:  693px
page W:            490px    (7px gap — height-constrained)
scale:             0.6174   (min of 0.626 width, 0.617 height)
```

### Proposal Compose (pre-fix)
```
body.padL: 8px  body.padR: 16px  (same asymmetric base-class padding)
left frame: 32px  right frame: 40px
```

---

## Root causes identified

### RC-1 — Height-constrained fit scale (primary cause of big bleed)

Both `ProposalDisplay.tsx` and `ResumePage.tsx` computed fit scale as:
```js
Math.min(1, availableWidth / PAGE_W, availableHeight / PAGE_H)
```

The viewer shell height (`min(72vh, 780px) + bleed`) is always shorter than A4 at
fill-width scale (A4 ratio is 1:1.41). Height **always** won, making the page
narrower than the content area and producing visible dark gaps on both sides.

Example: saved proposal → `min(0.672, 0.501) = 0.501` → page 398px in 534px area
→ 68px gap per side inside the content area, then add 24-40px frame = 100px+ dark sides.

**Classification: active code bug.**

### RC-2 — Asymmetric body inline padding applied to document renderer

The `.dasti-proposal-sheet__body` base CSS rule sets:
```css
padding-inline-start: var(--proposal-sheet-margin-inline-inner); /* --s2 = 8px */
padding-inline-end:   var(--proposal-sheet-margin-inline-outer); /* --s4 = 16px */
```

This padding is correct for plain-text and editable modes (where `--editable`
already overrides it to 0). In document renderer mode the scroll container's own
bleed (`24px / 28px`) provides all spacing, so the body padding:
- Added extra asymmetric width on top of bleed (L: 8+24=32px, R: 16+24=40px)
- Reduced `availableWidth` used for the fit scale by `8+16=24px`
- Combined with RC-1, produced left≈100px / right≈108px dark frames at Fit

**Classification: active code bug.**

### RC-3 — Scroll bleed removed on vertical overflow (secondary consequence of RC-1)

When `actualPageHeight > previewViewportSize.height`, the code forced `padding: 0`
on the scroll container (edge-fit mode). After fixing RC-1, the page now scrolls
vertically at Fit (page ~789px > viewport ~693px), which always triggered this
condition. This stripped the bleed at Fit, leaving the page stage in a no-padding
scroll with visible asymmetric gaps.

**Fix: restrict overflow detection to horizontal only** — vertical scroll is
expected and handled by the scroll container naturally.

**Classification: active code bug (exposed by RC-1 fix).**

### RC-4 — Saved proposal previewFitScale stuck at 1.0 on load

When `proposalContent` is already present at mount time (saved proposal loaded
from props), the `useLayoutEffect` fires with `previewScrollRef.current = null`
(scroll not yet mounted) and returns early. The scroll mounts next, but setting
the ref does not re-trigger effects. `previewFitScale` stayed at its initial `1`
state, rendering the page at full A4 width (794px) overflowing the viewer.

**Fix: track scroll mount as React state** (`scrollNodeMounted`) and include it
in the layout-effect deps, so the scale is computed once the scroll node exists.

**Classification: active code bug.**

---

## Fixes applied

### Fix 1 — Width-only fit scale (`ProposalDisplay.tsx`)

```js
// Before:
setPreviewFitScale(Math.min(1, availableWidth / W, availableHeight / H));

// After:
setPreviewFitScale(Math.min(1, availableWidth / W));
```

Fit = fill the available width. The page scrolls vertically, which is standard
document-viewer behavior.

### Fix 2 — Width-only fit scale (`ResumePage.tsx`)

```js
// Before:
const fitScale = Math.min(1, availableWidth / PAGE_WIDTH_PX, availableHeight / PAGE_HEIGHT_PX);

// After:
const fitScale = Math.min(1, availableWidth / PAGE_WIDTH_PX);
```

### Fix 3 — `--document-viewer` body modifier class (`ProposalDisplay.tsx` + `product.css`)

New CSS rule:
```css
.dasti-proposal-sheet__body--document-viewer {
  padding: 0;
}
.dasti-proposal-sheet__body--document-viewer::before,
.dasti-proposal-sheet__body--document-viewer::after {
  inset-inline: 0;
}
```

Applied in `resolveBodyClassName()` when `isReadonly && usesDocumentRenderer`.
Eliminates double-frame and asymmetry. The scroll's bleed is the sole spacing layer.

### Fix 4 — Horizontal-only overflow detection (`ProposalDisplay.tsx`)

```js
// Before:
const proposalViewportOverflows =
  actualPageWidth > previewViewportSize.width + 1 ||
  actualPageHeight > previewViewportSize.height + 1;

// After (horizontal only — vertical scroll is handled naturally):
const proposalViewportOverflows =
  actualPageWidth > previewViewportSize.width + 1;
```

Bleed is now preserved at Fit (no horizontal overflow). Bleed is removed only
when the user zooms in past Fit, which makes the page wider than the viewport.

### Fix 5 — Scroll-node-mounted state (`ProposalDisplay.tsx`)

```js
const [scrollNodeMounted, setScrollNodeMounted] = React.useState(false);

// In attach callback:
setScrollNodeMounted(node !== null);

// Added to useLayoutEffect deps:
}, [scrollNodeMounted, fitRequestCount, ...existing deps]);
```

Ensures `syncScale()` fires once the scroll node is attached, even when content
is already present at mount time.

---

## Post-fix runtime measurements (live DOM verified)

| Surface | Page W | Content W | Fill Width | L Frame | R Frame | Aspect |
|---|---|---|---|---|---|---|
| CV Studio Resume | 497px | 497px | ✓ | 24px | 24px | 1.4143 |
| Proposal Compose | 505px | 505px | ✓ | 24px | 24px | 1.4143 |
| Saved Proposal (auto, no Fit click) | 558px | 558px | ✓ | 24px | 24px | 1.4143 |
| Style Forge Proposal | 558px | 558px | ✓ | 24px | 24px | 1.4143 |

All surfaces: page fills content width exactly, symmetric 24px horizontal bleed,
correct A4 aspect ratio, no Fit-click needed on load.

### Zoom 1.25× verified
```
body.padL: 0   body.padR: 0   (document-viewer class)
scroll inline-style: padding: 0px  (edge-fit active, horizontal overflow)
data-edge-fit: "true"
stage W:  698px   scroll W: 606px  → 92px horizontal scroll
page W:   698px   = 558 * 1.25
→ No black inner border. Page fills edge-to-edge within the rounded shell.
```

---

## Source of truth

- **The A4 page element is the only geometry authority** for document content.
  - Proposal: `.dasti-proposal-sheet__preview-page` (inline `width` / `height`)
  - Resume: `.resume-page` (CSS transform via `--preview-scale`)
- The scroll container (`dasti-proposal-sheet__scroll` / `dasti-doc-viewport--resume`)
  provides the viewer frame with `--document-viewer-bleed-*` padding (24px / 28px).
- The body and shell are structural containers only — no geometry role.

---

## Files changed

- `src/components/ProposalDisplay.tsx` — fixes 1, 3, 4, 5
- `src/features/verbati/resume/ResumePage.tsx` — fix 2
- `src/styles/product.css` — fix 3 (CSS rule)
