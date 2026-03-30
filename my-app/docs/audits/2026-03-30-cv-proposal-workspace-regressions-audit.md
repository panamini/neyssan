# CV / Proposal Workspace Regression Audit

Date: 2026-03-30

## Classification

- Active code:
  - `src/pages/CvForge.tsx`
  - `src/features/verbati/VerbatiCvPreviewPanel.tsx`
  - `src/features/verbati/VerbatiResumePreview.tsx`
  - `src/pages/ProposalForgeNext.tsx`
  - `src/components/ProposalDisplay.tsx`
  - `src/components/ProposalComposeToolbar.tsx`
  - `src/styles/product.css`
- Legacy but informative:
  - `src/pages/ProposalForge.tsx`
  - `docs/decisions/2026-03-30-cv-workspace-canvas-first-preview.md`
- Obsolete/dead for the live route:
  - Any assumptions based only on the old mocked `CvForge.workspace-mode.test.tsx` path

## Confirmed Runtime Paths

- CV Forge preview:
  - `App -> /cv -> CvForge -> VerbatiCvPreviewPanel(hostMode="workspace") -> VerbatiResumePreview(hostMode="workspace") -> shared document stage`
- Proposal workspace:
  - `App -> /proposal -> ProposalForgeNext -> ProposalDisplay`

## Root Causes Confirmed In Active Code

### A. CV preview path

- The canvas-first CV preview refactor was active.
- The regression was not a dead route; it was a CSS/runtime mismatch.
- `product.css` still overrode the resume workspace stage viewport to `overflow: visible`, which bypassed the bounded shared stage behavior even when the document stage mounted correctly.

### B. Proposal persistence

- Normal resume/proposal switching did not contain an active reset trigger.
- Explicit destructive resets were limited to `startFreshProposalWorkspace()` / `createProposalWorkspaceResetState()` entry points in sidebar/library flows.
- The missing proof was route-level regression coverage for compose input plus output/workspace state on re-entry.

### C. Toolbar jump and D. width/alignment

- `ProposalForgeNext` mounted the compose toolbar at page-shell level instead of inside `.dasti-proposal-output-shell--next`.
- That host mismatch caused both regressions:
  - the toolbar could shift laterally when responsive controls disappeared
  - the expanded bar visually overshot the compose shell boundary

### E. Proposal A4 / viewport regression

- Shared A4 constants remained correct.
- `ProposalForgeNext` passed `previewAnchor="body"` to `ProposalDisplay`.
- `ProposalDisplay` also forced the outer preview page to `aspect-ratio: auto` for all rendered document previews, not just multipage ones.
- For multipage output, the outer chrome was behaving like one tall paper surface instead of letting the inner `.dasti-proposal-document__page` elements remain the visible A4 pages.

## Fixes Applied

- Moved the live proposal toolbar slot into `.dasti-proposal-output-shell--next`.
- Restored proposal workspace preview anchoring to the top of the document stage.
- Limited the outer proposal preview shell's stacked behavior to real multipage previews.
- Added a no-collapse toolbar modifier so compact responsive layouts keep the remaining controls left-anchored.
- Constrained the toolbar slot/bar contract to the compose shell instead of the page shell.
- Removed the CV workspace CSS override that forced the shared resume stage viewport open.

## Revert Status

- No broad revert was required.
- The shared document-stage primitives and `ProposalForgeNext` remained in place.
- The fix was surgical: only the bad host/anchor/outer-shell behaviors were corrected.
