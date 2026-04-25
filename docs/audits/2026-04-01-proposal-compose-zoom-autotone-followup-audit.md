# Proposal Compose / Preview Follow-Up Audit

Date: 2026-04-01

## Active code audited

- `src/pages/ProposalForge.tsx`
- `src/components/ProposalInputForm.tsx`
- `src/components/ProposalDisplay.tsx`
- `src/features/verbati/VerbatiCvPreviewPanel.tsx`
- `src/features/verbati/VerbatiResumePreview.tsx`
- `src/features/verbati/resume/resume-preview.css`
- `src/styles/product.css`

## Findings

### 1. Auto-tone was still vulnerable to saved-tone override in the live compose form

Active code path:

- `ProposalForge` passes `externalVoicePreset={composeToolbarVoicePreset}` into `ProposalInputForm`.
- `ProposalInputForm` also had a saved-settings effect that re-applied `savedVoicePreset`.

Root cause:

- The saved-settings effect still ran even when `externalVoicePreset` was explicitly provided as `null` for Auto.
- That let a saved preset win over the toolbar's explicit Auto state in workspace mode.

### 2. Proposal and resume zoom controls had diverged from the compact git-backed drawer

Root cause:

- Proposal preview had been moved to a larger multi-mode zoom popover.
- Resume preview had a different compact model.
- The active UI no longer matched the previously working compact `Fit` + drawer interaction the user referenced.

### 3. CV fit-page crop came from stage layout, not from viewport scroll centering

Root cause:

- In resume preview, `.resume-page-stage` still used `place-items: center`.
- The inner resume page is rendered at full A4 width and then scaled from `top left`.
- Centering the unscaled box shifts the visible scaled page left, which causes the apparent left crop.

### 4. Resume preview toolbar was still not using the shared proposal-style controls

Root cause:

- The workspace preview rail still mounted the resume preview inspector in direct mode rather than the shared style/color-only surface used by proposal output.

### 5. The Proposal List green frame still had a winning selected-card rule

Root cause:

- `product.css` still applied `dasti-proposal-library-card--spotlit .dasti-proposal-sheet { border-color: var(--document-viewer-frame-border); }`.
- That rule reintroduced the visible frame even after the base document shell border had been neutralized.

## Minimal live-path fixes applied

- Made external Auto tone authoritative over saved tone in `ProposalInputForm`.
- Normalized restored toolbar tone values in `ProposalForge` so unsupported legacy presets collapse back to Auto instead of poisoning workspace state.
- Restored compact `Fit` plus zoom drawer behavior on both proposal and resume preview surfaces.
- Stopped proposal preview from restoring a persisted zoom level on refresh by resetting the active preview zoom index to fit by default.
- Added workspace-specific resume CSS so the scaled resume page is laid out from the top-left instead of being centered from its unscaled width.
- Switched CV workspace preview to the shared `EmbeddedStyleInspector` style/color surface.
- Neutralized the `spotlit` selected-card border rule in Proposal List so load state no longer paints the green frame.

## Verification

Focused tests passed:

- `src/components/__tests__/ProposalInputForm.provider-busy.test.tsx`
- `src/pages/__tests__/ProposalForge.workspace-toolbar.test.tsx`
- `src/components/__tests__/ProposalDisplay.test.tsx`
- `src/features/verbati/__tests__/VerbatiResumePreview.test.tsx`
- `src/features/verbati/__tests__/VerbatiCvPreviewPanel.test.tsx`
- `src/pages/__tests__/CvForge.workspace-preview.integration.test.tsx`
- `src/features/verbati/resume/__tests__/resume-preview.css.test.ts`

Manual runtime verification is still pending because the local frontend was not launched in this session.
