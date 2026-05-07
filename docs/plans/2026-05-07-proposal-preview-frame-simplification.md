# Proposal preview frame simplification audit plan

Date: 2026-05-07
Scope: active Proposal Forge preview surface, collapsed and expanded modes.

## Screenshot audit

### Confirmed good

- Expanded desktop mode reads better: the paper itself is the main object and the right rail is separate.
- The toolbar/pill width work is directionally correct; the Draft chip no longer dominates the row.
- The page-first layout principle is still right.

### Regressions / remaining issues

1. **Collapsed preview shows a legacy frame around the paper.**
   In the collapsed screenshots, the paper sits inside a bordered beige/grey document frame. This frame is visually louder than the paper and contradicts the expanded mode, where the paper feels borderless and direct.

2. **There are too many nested surfaces.**
   The current collapsed preview stack reads as:
   app canvas → output frame → viewport/frame surface → paper.
   That is too many layers. It makes the design feel heavier and less intentional.

3. **The “desktop under the page” is acceptable only if it is one clear layer.**
   A document desktop/canvas behind the page is fine, especially for scrollable preview, but it should not become a second framed card. The contrast should come from paper + subtle shadow on a single calm canvas, not from a bordered container.

4. **Preview scroll should remain inside the document preview boundary.**
   Do not move scroll ownership outward to the workspace shell. Depending on mode, scrolling may be split between the preview stage, document viewport, or chassis, but it must stay inside the document preview boundary. The fix should remove visual frame chrome, not move scroll ownership to the outer shell.

## Root cause in active CSS

The likely legacy frame is from the collapsed media rule around `product-proposal.css`:

```css
@media (max-width: 1439px) {
  .dasti-proposal-output-shell--workspace
    .dasti-proposal-sheet__body--document-viewer {
    border: 1px solid var(--document-viewer-frame-border);
    border-radius: var(--document-viewer-radius);
    background: var(--document-viewer-frame-surface);
    box-shadow: var(--document-viewer-frame-shadow), ...;
  }
}
```

That rule reintroduces the old framed viewer shell in collapsed mode. It conflicts with the newer Proposal Forge direction where the paper is the object and workspace chrome should stay quiet.

The later natural-height fix exposed this frame more clearly because the shell now hugs the preview instead of hiding inside a fixed-height area.

## Design direction

Use one hierarchy:

1. App/workspace canvas
2. Borderless preview viewport / document desktop
3. Paper page with its own shadow

Do **not** add a card-like frame around the paper.

The elite version is minimal:

- no border around `.dasti-proposal-sheet__body--document-viewer` in workspace collapsed preview mode only
- no shadow on the viewport frame
- no extra rounded card behind the page
- keep a single subtle canvas tint if needed for scroll context
- paper itself keeps the readable page boundary via `--document-stage-halo` / paper shadow

## Files to modify

Primary:

- `my-app/src/styles/product-proposal.css`

Only if CSS cannot cleanly express the state:

- `my-app/src/components/ProposalDisplay.tsx` for a data/class hook distinguishing workspace preview shell state. No behavior changes unless scroll ownership is broken.

## Implementation plan

- [x] Remove or override the collapsed-mode border/background/shadow on `.dasti-proposal-output-shell--workspace .dasti-proposal-sheet__body--document-viewer`.
- [x] Guard the override to workspace preview only; do not affect saved view, focused view, export/print preview, or editor mode.
- [x] Keep scrolling inside the document preview viewport/stage boundary for long/multi-page preview; do not move it outward to the workspace shell.
- [x] Keep natural-height collapsed shell behavior from the previous pass, but ensure it does not create a visible framed card.
- [x] Ensure the paper page remains the only strong visual rectangle.
- [x] If the document desktop needs distinction from the app background, use a single transparent/subtle canvas tint, not a border or card shadow.
- [x] Verify expanded and collapsed modes use the same visual contract: paper direct on quiet canvas.
- [x] Re-check one-page and long/multi-page preview after removing the frame.

## Verification

Browser checks:

- Expanded desktop preview: no extra frame around the paper.
- Collapsed preview: no beige/grey bordered frame around the paper.
- One-page collapsed preview: shell stops at page end, with only small intentional breathing room if any.
- Long/multi-page collapsed preview: scrolling stays inside the document preview viewport/stage boundary; outer workspace shell does not become the scroll owner.
- Draft/status pill remains intrinsic width.

Automated checks:

- `npx tsc --noEmit --pretty false`
- focused Proposal display/stage tests
- note that full CSS lint is currently blocked by pre-existing unrelated stylelint violations.

## Commit guidance

Do not commit the current preview-scroll CSS until this frame regression is fixed. Commit the preview scroll/chip fix and frame simplification together once the visual contract is clean.
