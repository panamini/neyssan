# Document Stage A4 Rebase Audit

Date: 2026-03-28

## Scope

Audit the live runtime before and after rebasing the document viewer onto a visible A4 stage on these surfaces:

1. Proposal compose output
2. Saved proposal selected preview
3. Proposal preview in Style Forge
4. Resume preview in Style Forge

## Classification

### Active code

- `src/components/ProposalDisplay.tsx`
- `src/components/ProposalsList.tsx`
- `src/features/verbati/VerbatiProposalWorkspace.tsx`
- `src/features/verbati/VerbatiResumePreview.tsx`
- `src/features/verbati/resume/ResumePage.tsx`
- `src/hooks/use-document-stage-layout.ts`
- `src/hooks/use-document-viewport-centering.ts`
- `src/styles/foundation.css`
- `src/styles/product.css`
- `src/features/verbati/resume/resume-preview.css`

### Legacy but informative code

- `src/hooks/use-document-viewport-centering.ts`
  The centering hook remains active, but its earlier caller assumptions reflected the old scroll-first viewer and helped explain why `Fit` behaved like a recenter plus width-fill mode instead of a stage-first layout.

### Obsolete / dead code or styling assumptions

- `data-edge-fit`
- viewer styling built around `focused`
- viewer styling built around `spotlit`
- viewer styling built around `edge-fit`
- viewer styling built around `bleed`
- shell padding tricks that treated the shell as the geometry authority
- the saved proposal "Focus proposal" action and its styling branch

## Before: live runtime findings

### Saved proposal selected preview before rebase

Environment: baseline `HEAD` runtime on `http://127.0.0.1:4174`

Observed in Playwright:

- No shared `[data-document-stage="true"]` A4 stage was mounted.
- No shared `[data-document-page="true"]` page node was mounted.
- The selected preview fell back to a `.dasti-proposal-sheet` card with a textarea edit geometry instead of the rendered-page shell.
- The document action cluster still exposed `Focus proposal`, `Regenerate`, `Delete`, `Copy`.

Measured in the live DOM:

| Element | Width | Height | Ratio |
|---|---:|---:|---:|
| `.dasti-proposal-sheet` | 427.14px | 604.06px | 0.7071 |
| `.dasti-proposal-sheet__body--editable` | 401.14px | 537.55px | 0.7462 |

Interpretation:

- The outer card was roughly A4-ish, but the visible editorial surface was not.
- The user-facing geometry authority was the textarea card, not a shared A4 stage.
- Eye / Pencil parity was therefore already broken before zoom behavior was considered.

### Resume preview in Style Forge before rebase

Environment: baseline `HEAD` runtime on `http://127.0.0.1:4174/style`

Observed in Playwright:

- Resume preview had its own shell and scaling system.
- The page itself was close to A4, but it was not participating in the same viewer contract as proposal preview.
- There was no shared floating rail and no shared `data-stage-mode` contract.

Measured in the live DOM:

| Element | Width | Height | Ratio |
|---|---:|---:|---:|
| `.resume-preview-shell--single` | 703.09px | 1053.03px | 0.6677 |
| `.resume-page-stage` | 667.09px | 943.33px | 0.7072 |
| `.resume-page` | 666.99px | 943.33px | 0.7071 |

Interpretation:

- The page renderer itself was close to A4.
- The visible shell authority was still a different layout system with different chrome and spacing rules.
- This matches the reported "technically A4, but still feels wrong" runtime behavior.

### Proposal viewer rules before rebase

Observed in active code before the rebase:

- `ProposalDisplay.tsx` treated `Fit` as width-fill and explicitly allowed vertical scrolling as the normal fit behavior.
- `VerbatiResumePreview.tsx` and `ResumePage.tsx` used a separate preview scaling path from proposal preview.
- `ProposalsList.tsx` could leave the saved proposal preview stuck in a local empty state long enough for the selected view to present the wrong geometry.
- `product.css` still contained shell rules shaped by `focused`, `spotlit`, `edge-fit`, `bleed`, and related scroll-first framing assumptions.

## After: live runtime measurements

Environment: current runtime on `http://127.0.0.1:4173`

### Proposal compose output

| Mode | Shell | Stage | Page | Stage ratio | Page ratio | Gaps | Overflow |
|---|---|---|---|---:|---:|---|---|
| Fit | 560 x 837.56 | 530 x 749.56 | 530 x 749.56 | 0.7071 | 0.7071 | 0 / 0 / 0 / 0 | false / false |
| 125% | 560 x 837.56 | 530 x 749.56 | 662.5 x 936.95 | 0.7071 | 0.7071 | overflow state | true / true |
| 150% | 560 x 837.56 | 530 x 749.56 | 795 x 1124.34 | 0.7071 | 0.7071 | overflow state | true / true |

Playwright observations:

- At `Fit`, the page touched the stage with no measured gap.
- No vertical crop occurred at `Fit`.
- The shell size stayed fixed while zooming.
- Eye / Pencil toggle kept the shell size unchanged.
- The document rail showed `Rendered / Editable`, `Fit / Zoom out / Zoom in`, `Save to library / Refresh / Delete / Copy`.

### Saved proposal selected preview

| Mode | Shell | Stage | Page | Stage ratio | Page ratio | Gaps | Overflow |
|---|---|---|---|---:|---:|---|---|
| Fit | 590 x 880 | 560 x 792 | 560 x 792 | 0.7071 | 0.7071 | 0 / 0 / 0 / 0 | false / false |
| 125% | 590 x 880 | 560 x 792 | 700 x 990 | 0.7071 | 0.7071 | overflow state | true / true |
| 150% | 590 x 880 | 560 x 792 | 840 x 1188 | 0.7071 | 0.7071 | overflow state | true / true |

Playwright observations:

- At `Fit`, the page filled the visible stage exactly.
- The stage remained centered at `125%` and `150%` with no left/right drift.
- The shell size stayed fixed while zooming.
- Eye / Pencil toggle kept the shell size unchanged.
- No green outline was visible on the selected saved proposal.
- The old `Focus proposal` action was gone.

### Proposal preview in Style Forge

| Mode | Shell | Stage | Page | Stage ratio | Page ratio | Gaps | Overflow |
|---|---|---|---|---:|---:|---|---|
| Fit | 590 x 880 | 560 x 792 | 560 x 792 | 0.7071 | 0.7071 | 0 / 0 / 0 / 0 | false / false |
| 125% | 590 x 880 | 560 x 792 | 700 x 990 | 0.7071 | 0.7071 | overflow state | true / true |
| 150% | 590 x 880 | 560 x 792 | 840 x 1188 | 0.7071 | 0.7071 | overflow state | true / true |

Playwright observations:

- Proposal preview now mounts the same stage/page pair as compose and saved proposal preview.
- Eye / Pencil toggle kept the shell size unchanged.
- Zoom overflow stayed inside the viewport.
- `Fit` remained the only deliberate recenter action.

### Resume preview in Style Forge

| Mode | Shell | Stage | Page | Stage ratio | Page ratio | Gaps | Overflow |
|---|---|---|---|---:|---:|---|---|
| Fit | 590 x 880 | 560 x 792 | 560 x 792 | 0.7071 | 0.7071 | 0 / 0 / 0 / 0 | false / false |
| 125% | 590 x 880 | 560 x 792 | 700 x 990 | 0.7071 | 0.7071 | overflow state | true / true |
| 150% | 590 x 880 | 560 x 792 | 840 x 1188 | 0.7071 | 0.7071 | overflow state | true / true |

Playwright observations:

- Resume preview now uses the same visible A4 stage contract as proposal preview.
- The shell size stayed fixed while zooming.
- Overflow occurred only inside the viewport.
- `Fit` showed the full page with no crop and no black inner frame.

## Implementation audit

### What was actually wrong

- The proposal viewer contract still treated `Fit` like a width-fill document scroller instead of "full A4 page visible inside an A4 stage".
- Proposal and resume preview used different geometry authorities.
- Editable proposal mode used a different card geometry from rendered mode.
- Saved proposal preview could resolve into the wrong shell because the local list state could remain stale on first load.
- Legacy shell styling still implied scroll-first PDF chrome, including focus/bleed/spotlight branches that did not belong to a stage-first viewer.

### What changed

- `useDocumentStageLayout` now computes the shared stage contract used by proposal and resume viewers:
  - `fitScale`
  - `stageWidth`
  - `stageHeight`
  - `pageWidth`
  - `pageHeight`
  - `overflowX`
  - `overflowY`
  - `isFit`
- `ProposalDisplay` now treats the visible stage as the geometry authority and renders the page inside `[data-document-stage="true"]` with `[data-document-page="true"]`.
- `VerbatiResumePreview` now consumes the same stage contract and the same zoom-step model.
- Editable proposal mode now sits inside the same A4 stage and shell as rendered mode.
- The shell chrome and action rail were separated from page geometry.
- The old `data-edge-fit` model was replaced by `data-stage-mode="fit"` and `data-stage-mode="overflow"`.

## Conclusion

The rebase is successful.

- At `Fit`, all four verified surfaces show a visible stage ratio and visible page ratio of approximately `210 / 297`.
- At `Fit`, the page-to-stage gap is `0px` on all measured sides.
- Above `Fit`, the shell remains fixed while the page overflows only inside the viewport.
- Proposal compose, saved proposal preview, proposal Style Forge, and resume Style Forge now read as one viewer system rather than separate shells with separate geometry rules.
