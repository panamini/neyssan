# Document Stage A4 Viewer Rebase

Date: 2026-03-28

## Status

Accepted

Supersedes:

- `2026-03-28-document-viewer-fit-zoom-geometry.md`

## Active code

- `src/components/ProposalDisplay.tsx`
- `src/features/verbati/VerbatiResumePreview.tsx`
- `src/features/verbati/resume/ResumePage.tsx`
- `src/hooks/use-document-stage-layout.ts`
- `src/hooks/use-document-viewport-centering.ts`
- `src/styles/foundation.css`
- `src/styles/product.css`
- `src/features/verbati/resume/resume-preview.css`

## Decision

### 1. This viewer is not a PDF-style width-fill scroller

`Fit` no longer means "fill the available width and accept vertical cropping or scrolling as normal".

`Fit` now means:

- the visible stage is DIN A4 (`210 / 297`)
- the page is DIN A4 (`210 / 297`)
- the full page is visible
- the page fills the stage
- no vertical crop is allowed
- no black inner frame is part of the fit state

### 2. The visible A4 stage is the geometry authority

The geometry contract is owned by the visible stage, not by the shell chrome.

The outer shell provides:

- border
- halo
- toolbar rail
- title and metadata placement

The stage provides:

- visible A4 bounds
- fit size
- overflow viewport
- pan and zoom surface

The page provides:

- rendered document or plain-text editor content

### 3. Proposal and resume must consume the same stage contract

Proposal and resume viewers may keep separate internal renderers, but they must share the same layout contract.

`useDocumentStageLayout` is the shared mechanism and returns:

- `fitScale`
- `stageWidth`
- `stageHeight`
- `pageWidth`
- `pageHeight`
- `overflowX`
- `overflowY`
- `isFit`

This keeps proposal compose, saved proposal preview, proposal Style Forge, and resume Style Forge on one viewer model.

### 4. Shell chrome and page geometry stay separate

Controls are outside the page geometry.

The compact floating rail is the only document action rail and is arranged as:

- left: `Eye / Pencil`
- center: `Fit / - / +`
- right: `Save / Refresh / Delete / Copy`

The shell height derives from the A4 stage plus minimal chrome. The shell does not define the A4 shape.

### 5. Editable proposal mode uses the same shell and A4 stage as rendered mode

The editor remains plain text, not WYSIWYG.

However, editable mode must not switch to a different card system. It stays inside the same A4 stage, with stable editorial margins and a readable line length.

Eye / Pencil toggling must not change the viewer card size.

### 6. Zoom behavior is overflow-inside-viewport only

Above `Fit`:

- the shell stays fixed
- the stage stays fixed
- the page grows inside the viewport
- overflow happens inside the viewport only

`Fit` is the only deliberate recenter action.

The state model for this is exposed as:

- `data-stage-mode="fit"`
- `data-stage-mode="overflow"`

This replaces the earlier `data-edge-fit` mental model.

## Why the previous decision was replaced

The superseded decision accepted width-fill plus vertical scrolling as the meaning of `Fit`.

That kept the viewer mentally anchored to a PDF-style scroll-first shell. In practice this caused:

- the visible shell to read as the primary surface instead of the A4 page
- proposal and resume preview to diverge in behavior
- editable proposal mode to use a different geometry from rendered mode
- zoom and centering rules to feel inconsistent even when the page itself was technically A4

The new contract removes that ambiguity by making the visible A4 stage the only geometry authority.

## Consequences

- Viewer chrome can be restyled without changing the document geometry.
- Proposal and resume previews can share zoom, fit, centering, and overflow behavior.
- Future viewer work should target the stage contract first, then renderer-specific content inside the page.

## Reference

Audit: `docs/audits/2026-03-28-document-stage-a4-rebase-audit.md`
