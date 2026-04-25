# Resume Viewer Stabilization Audit

Date: 2026-04-18

## Scope

Local repo only. This audit covers the active CV preview/viewer path used by `CvForge`.

## Code Classification

### Active Code

- `my-app/src/pages/CvForge.tsx`
- `my-app/src/features/verbati/VerbatiCvPreviewPanel.tsx`
- `my-app/src/features/verbati/VerbatiResumePreview.tsx`
- `my-app/src/features/verbati/resume/ResumePage.tsx`
- `my-app/src/features/verbati/resume/resume-preview.css`
- `my-app/src/styles/product.css`
- `my-app/src/hooks/use-document-stage-layout.ts`
- `my-app/src/hooks/use-document-viewport-centering.ts`
- `my-app/src/hooks/use-document-pan.ts`
- `my-app/src/components/ProfileReviewCard.tsx`
- `my-app/src/components/structured-blocks/AchievementsModal.tsx`

### Legacy But Informative

- Shared proposal viewer shell rules in `my-app/src/styles/product.css`
  - These still define the common document-shell contract and influence CV preview behavior.
- Comparison-preview branches in `ResumePage.tsx`
  - Not the priority path, but they reveal how stage sizing and scale tokens were originally intended to work.

### Obsolete Or Dead For This Pass

- `pdf-ingest/`
- `*.bak`
- legacy parser/training code outside the active `my-app/` preview path

## Grouped Root Cause

### Viewer Shell Layering

- The active workspace preview is wrapped by too many shell layers with overlapping responsibilities:
  - page shell
  - preview workbench
  - preview panel
  - doc viewer shell
  - proposal sheet frame
  - document shell
  - viewer body
  - stage chassis
  - viewport
  - canvas
  - page stage
- Padding and framing were being applied in several places at once, which made the page start too low and kept too much non-document chrome visible.
- The workspace toolbar was offset from the shell, then the frame compensated with extra top padding. That increased the toolbar-to-page gap without improving usability.

### Fit / Zoom / Scroll

- The preview already had the right high-level direction: fit from single-page geometry and let stacked pages extend scroll height.
- The viewport still treated overflow too coarsely. Vertical stack overflow and true horizontal zoom overflow were both collapsing into one `"overflow"` mode.
- The CSS then reserved scrollbar gutter too aggressively on the workspace path, which could reduce the effective content width and contribute to clipped or awkwardly framed pages.
- The panel and workspace hosts also used slightly different width/framing rules, which increased the chance of crop or visual drift between mini preview and workspace preview.

### Editor Regressions

- The imported-CV rename dialog was state-derived from the currently loaded CV, not from the import event itself.
- That meant reopening or editing an already-imported CV with a generic title could re-trigger the rename prompt in ordinary editing flows.
- `AchievementsModal` reapplied its targeted initial focus whenever `rows` changed. Typing in a different field mutated `rows`, which could yank focus back to the preview-targeted field.

### Planner Tuning

- Swiss Minima multipage behavior is now active and materially better, but planner thresholds still need follow-up.
- Known remaining tuning risk areas:
  - bottom live-area margin on one-page cases
  - late page creation
  - excess empty space left on page 1 before page 2 starts
- This is now secondary to shell/viewer stability and should be tuned only after the viewer contract stays stable.

## Stabilization Implemented In This Pass

- Reduced duplicate workspace shell padding and frame weight.
- Removed extra workspace toolbar inset so the page starts higher.
- Exposed overflow axes on the resume viewport so vertical stack scroll and horizontal zoom scroll can be styled differently.
- Kept fit-mode multipage previews on single-page width geometry while allowing internal vertical document scroll.
- Stopped the generic imported-CV rename prompt from auto-opening on normal reopen/edit flows.
- Made achievements modal targeted focus one-shot instead of re-firing on every row edit.

## Residual Risk

- `ResumePage.tsx`, `resume-preview.css`, and `use-document-pan.ts` already had local in-progress changes before this pass. They were preserved and treated as active baseline, not reverted.
- Planner tuning is intentionally incomplete in this pass.
- Full print/export parity was not touched.
