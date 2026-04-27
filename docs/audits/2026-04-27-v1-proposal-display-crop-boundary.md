# v1 proposal saved/display crop boundary audit

## Scope

- Active app: `my-app`
- Active code paths inspected:
  - `my-app/src/pages/ProposalForge.tsx`
  - `my-app/src/components/ProposalsList.tsx`
  - `my-app/src/components/ProposalDisplay.tsx`
  - `my-app/src/hooks/use-document-stage-layout.ts`
  - `my-app/src/styles/product.css`
  - `my-app/src/styles/foundation.css`
- User-visible symptom: saved proposal preview bottom/right page corner looks clipped; the surrounding chrome appears to stop early.

## Boundary Verified

The real saved route was not fully verified from this execution boundary. It is auth-gated: `/proposal?view=saved&id=audit-saved` reached `Sign in to view saved proposals` / `Loading...` even with local saved fixtures.

Rendered evidence came from a temporary headless Vite harness importing the real `ProposalDisplay` component, real app CSS, and the active saved-card/output-shell class stacks. The temporary diagnostic files were removed after measurement.

## Key Measurements

Viewport: `1440 x 1100`.

Saved selected preview:

- `useDocumentStageLayout` CSS vars on `.dasti-doc-viewer-shell__surface`:
  - `--document-stage-width: 576px`
  - `--document-page-width: 576px`
  - `--document-stage-height: 814.63px`
  - `--document-page-height: 814.63px`
- Actual rendered `.dasti-proposal-sheet__preview-stage` rect:
  - width `560px`
  - height `814.63px`
  - overflow `hidden/hidden`
  - scrollbar gutter `0`
- Actual `.dasti-proposal-sheet__preview-page-positioner` / rendered page rect:
  - width `576px`
  - starts at the same left edge as the 560px stage in saved preview
  - therefore extends `16px` past the stage on the right
- Bottom delta:
  - page bottom is `0.3px` below the stage bottom
  - shell has about `99px` of spare bottom area, so the page is not hitting the outer shell bottom

Proposal Forge output harness:

- Same stage vars: `576px` stage/page width.
- Actual preview stage is also clamped to `560px`.
- Difference: `.dasti-proposal-output-shell--workspace .dasti-proposal-sheet__preview-stage` uses `display: grid; justify-content: center;`, so the 16px mismatch is centered as roughly 8px per side rather than all on the right.

Saved edit mode:

- Actual editable page/stage width: `560px`.
- Actual editable page/stage height: `792px`.
- Body/shell height: about `921px` / `923px`.
- There is about `122px` from editable page bottom to shell bottom. Edit mode's missing bottom chrome is therefore a different boundary than the saved preview corner crop.

## Confirmed Cause

This is active code.

The saved preview crop is caused by a mismatch between the measurement input and the CSS-clamped rendered stage:

1. `useDocumentStageLayout(...)` is called with `includeParentMeasurement: !isEditable`.
2. In saved preview, the chassis content box is `560px` wide because `.dasti-document-stage-chassis` has `8px` inline padding inside a `576px` body.
3. The hook takes `Math.max(chassisContentWidth, parentContentWidth)`, so it chooses the parent width: `576px`.
4. The component sets page/positioner width to `576px`.
5. CSS then clamps `.dasti-proposal-sheet__preview-stage` to `max-width: 100%`, which resolves to the chassis content width: `560px`.
6. The stage is in `data-stage-mode="fit"` and `overflow: hidden`, so the 576px page is clipped by the 560px stage.
7. Saved preview does not center the oversized positioner inside the stage, so the entire 16px overflow lands on the right edge. That matches the user's screenshot.

The scrollbar hypothesis is not supported by the rendered measurement: scrollbar gutter was `0`, and the stage was in `fit` mode with `overflow: hidden`, not scroll mode.

## Likely Safe Fix Direction

Do not add bottom padding as the first fix.

The fix should make the layout math and CSS clamp agree. The lowest-risk directions are:

- make the hook measure the actual stage content width for saved/list preview instead of the parent width, or
- make the saved preview stage use the same centering/width contract as the output shell only if preserving parent measurement is required.

The more principled fix is to stop producing `--document-page-width: 576px` when the rendered stage is constrained to `560px`.

## Remaining Uncertainty

- The authenticated saved route itself was not measured in this session.
- The harness used the exact active class stack and real component/CSS, but it is still a faithful harness, not the signed-in saved route.
- Edit mode needs a separate frame/chrome audit. Its measured boundary is not the same as the saved preview right/bottom crop.
