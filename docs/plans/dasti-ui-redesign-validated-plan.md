# DASTI UI Redesign: Validated Implementation Plan

Date: 2026-04-03

## Goal

Implement the 5-phase DASTI UI redesign against the active app code, not the draft file map.

## Validation Summary

### Active code

- `my-app/src/styles/foundation.css`
- `my-app/src/styles/product.css`
- `my-app/src/pages/CvForge.tsx`
- `my-app/src/components/ProfileReviewCard.tsx`
- `my-app/src/lib/cv-import-signals.ts`
- `my-app/src/lib/__tests__/cv-import-signals.test.ts`
- `my-app/src/components/ProposalsList.tsx`
- `my-app/src/components/ProposalInputForm.tsx`
- `my-app/src/features/verbati/resume/resume-layout.spec.ts`

### Legacy, stale, or non-authoritative plan targets

- `my-app/src/pages/ProposalsList.tsx`: stale path. The live component is `my-app/src/components/ProposalsList.tsx`.
- `product.css` as the primary job-description text target: incomplete. The active textarea line-height is set inline in `ProposalInputForm.tsx`, so product-level fallback CSS alone would not change the live compose field.
- `buildProposalSnippet()` in `ProposalForge.tsx`: likely inactive for the saved-proposal library flow. The saved-card UI uses `buildProposalSnippet()` in `ProposalsList.tsx`. The duplicate helper in `ProposalForge.tsx` appears unused and should not be changed unless a second usage is confirmed.

### Existing constraints confirmed in active code

- `--document-stage-radius` styles proposal paper in `product.css`, so paper radius needs a dedicated override token rather than changing the stage token globally.
- Resume paper radius comes from `resume-layout.spec.ts` via `--page-radius`, not from `foundation.css`.
- The import-review slot already exists in `ProfileReviewCard.tsx` and should be augmented rather than re-routed elsewhere.
- The clean CV test fixture currently uses a placeholder title (`Imported CV`), which would conflict with new generic-title detection.

## Enhanced Implementation Plan

### Phase 1: Token Foundation

Update `foundation.css`:

- Recalibrate dark-mode neutral, text, and border tokens.
- Add `--border-selected` in light and dark modes.
- Add semantic aliases:
  - `--color-border-hover`
  - `--color-border-selected`
- Add `--document-paper-radius: 4px`.
- Increase document viewer bleed tokens.
- Update dark-mode shadows for white-paper-on-dark-stage contrast.

### Phase 2: Sidebar Refinement

Update `product.css`:

- Soften `.sb` right border and `.sb__top` bottom border with `color-mix`.
- Remove default visible border from `.sb-workspace-card`; restore hover border through `--color-border-hover`.
- Replace the active document-row dot marker with a 2px x 16px accent bar.
- Remove the active document-row gradient fill while preserving hover behavior and card-level gradient usage elsewhere.

### Phase 3: Document Surfaces

Update:

- `CvForge.tsx`: widen split preview column.
- `resume-layout.spec.ts`: reduce resume paper radius from `8mm` to `1mm`.
- `product.css`: add paper-only override for:
  - `.dasti-proposal-sheet__preview-page`
  - `.dasti-document-stage__canvas[data-document-page="true"]`

Do not change `--document-stage-radius` globally.

### Phase 4: Trust Layer

Update `cv-import-signals.ts` with additive checks:

- generic/system title
- title duplication between document title and first role
- all-caps content detection
- missing dates across experiences
- placeholder content in summary/experience text

Update `cv-import-signals.test.ts`:

- change the default fixture title to a non-placeholder value so the clean test stays valid.

Add `ImportWarningBanner.tsx` and wire it into `ProfileReviewCard.tsx`:

- banner renders above the existing inline review list
- inline review list remains the detailed explanation section
- dismissal is session-scoped via `sessionStorage`

Add banner styles to `product.css`.

### Phase 5: Proposal and Empty-State Polish

Update `ProposalsList.tsx`:

- filter generic salutations from saved-card snippets
- add tone badge rendering using live `voicePreset` metadata
- show total saved-proposal count with the new pill badge in the saved sidebar heading

Update `product.css`:

- add tone-badge styles
- add count-pill styles
- add CV-empty-state guidance styles

Update `ProfileReviewCard.tsx` empty state:

- switch from pure inline styling to the shared empty-state classes where useful
- add stronger guidance copy and preserve the current CTA set

Update `ProposalInputForm.tsx`:

- set the compose job-description textarea line-height to `1.65` in the active inline style path

### Deferred / QA-only sweep

The original plan includes a broad border-softening pass. That is higher risk because many panels still use raw `var(--color-border)`. The safe implementation order is:

1. ship token changes first
2. verify the visual result
3. only then soften remaining panels that still read too hard in dark mode

That sweep is intentionally deferred from the initial implementation unless the first pass leaves obvious regressions.

## Implementation Notes

- Treat `v1` as the active baseline.
- Keep changes small and reversible.
- Do not modify archived or legacy parser surfaces.
- If a target is discovered to be unused during implementation, prefer changing the active caller rather than duplicating edits.
