# Proposal Preview Size Parity Audit

## Scope
- Active code only.
- Styled proposal preview sizing versus `/print/proposal` styled PDF geometry.
- Final verification run: `tmp/proposal-styled-parity/2026-04-16T03-18-32-112Z`

## Root cause
- Proposal preview defaulted to a viewport-fit stage for most templates.
- Styled proposal PDF used fixed A4 geometry through `/print/proposal`.
- `ProposalDisplay` only used the fixed-A4 shell branch for `volk_register`, so `swiss_margin` and other live templates could look larger or smaller in preview even when typography matched.
- Zoom UI encoded `fit page` as `zoomIndex === 1`, so `100%` was not a true print-faithful baseline.

## Fix
- Removed the proposal-only `actual` / `fit_width` / `fit_page` state model.
- Restored one fit-to-container preview baseline for proposal surfaces.
- Kept proposal preview content on a fixed internal A4 surface by rendering the preview through a scaled A4 shell instead of resizing the document geometry itself.
- Updated `ProposalDisplay` so the visible preview auto-fits the full A4 page into the available container without default cropping.
- Simplified zoom controls back to one `Fit page` reset plus zoom in/out around the fit baseline.
- Updated the detached saved-proposal toolbar to match the same simplified zoom behavior.

## Verification
- Focused tests passed for:
  - `use-document-stage-layout`
  - `ProposalDisplay`
  - `ProposalsList` detached toolbar path
  - existing proposal print/export coverage
- Live parity harness passed:
  - `previewComputesExpectedFonts: true`
  - `printComputesSameFontsAsPreview: true`
  - `previewVsPrintVisiblyDifferent: false`
  - `printVsRasterVisiblyDifferent: false`
  - `firstDivergenceBoundary: "no-divergence-detected"`

## Artifact references
- Preview screenshot: `tmp/proposal-styled-parity/2026-04-16T03-18-32-112Z/preview.png`
- Print screenshot: `tmp/proposal-styled-parity/2026-04-16T03-18-32-112Z/print-route-pre-pdf.png`
- PDF raster: `tmp/proposal-styled-parity/2026-04-16T03-18-32-112Z/pdf-raster-page-1.png`
- Summary: `tmp/proposal-styled-parity/2026-04-16T03-18-32-112Z/summary.json`
