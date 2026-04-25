# Resume Preview Workspace Background Token

## Status
Accepted on April 4, 2026.

## Decision
The base document viewer frame surface is defined in `src/styles/foundation.css` through:

- `--document-viewer-frame-surface`

The visible grey canvas behind the resume paper in `CvForge` preview mode is then adjusted on the workspace path in:

- `src/styles/product.css`
- selector: `.dasti-doc-viewer-shell--resume-workspace`
- variable: `--document-viewer-stage-surface`

That variable must resolve to the site grey workspace token:

- `var(--color-surface-muted)`

The outer preview wrappers should mirror that same token so the workspace reads as one surface:

- `.dasti-cv-preview-workbench__main`
- `.dasti-cv-preview-panel-slot`

## Why
Using `var(--color-surface)` made the preview look almost black in dark mode. The intended workspace canvas is the grey panel tone, not the shell background tone.

A temporary custom token was introduced earlier in `foundation.css`:

- `--cv-preview-canvas-bg: #b6b0a6`

That token is no longer the source of truth and should not be reintroduced. The mistake was treating `product.css` as the only owner. The correct split is:

- `foundation.css` owns the shared document viewer frame token
- `product.css` overrides the resume workspace stage background for this specific preview path

## Change Guide
If the team wants a different resume preview grey later:

1. Update `--document-viewer-stage-surface` inside `.dasti-doc-viewer-shell--resume-workspace`
2. Update `.dasti-cv-preview-workbench__main`
3. Update `.dasti-cv-preview-panel-slot`
4. Keep all three selectors on the same token so the preview does not split into mismatched layers
