# Document Preview Shell Fit Guards

Date: 2026-04-02

## Status

Accepted

## Active code

- `src/pages/ProposalForge.tsx`
- `src/pages/CvForge.tsx`
- `src/components/ProposalsList.tsx`
- `src/features/verbati/VerbatiResumePreview.tsx`
- `src/styles/product.css`

## Problem

Two regressions kept recurring in the active workbench code:

- the saved proposal preview would re-crop horizontally after shell layout tweaks
- the CV workspace preview would appear offset or overflow even when the A4 page geometry itself was correct

The repeated failure mode was treating the document page as the problem when the real break was usually in the shell or stage contract around it.

## Decision

### 1. Saved proposal preview fit is owned by the selected-shell contract

The selected saved proposal layout must keep its second grid track on the committed width token:

- `var(--proposal-library-selected-shell-inline-size)`

Do not replace that track with a generic `1fr` track in the active saved preview path.

That change makes the preview column look flexible, but it breaks the width assumptions used by the A4 stage and reintroduces horizontal crop.

### 2. CV workspace preview must override generic centered document viewport rules

The generic document viewport defaults are useful for many embedded previews, but not for the active `/cv` workspace canvas.

Workspace resume preview must explicitly keep:

- `margin-inline: 0`
- `max-width: none`

on `.dasti-doc-viewer-shell--resume-workspace .dasti-doc-viewport--resume`

Without that override, the fitted page recenters inside the shell and creates the false impression of a large blank gutter or a cropped page.

### 3. Toolbar alignment changes must happen at the shared row wrapper first

For Proposal Forge, expanded and collapsed toolbar positioning should be controlled by the shared toolbar row wrapper before adding narrower slot-specific exceptions.

The stable invariant is:

- the workbench toolbar row stays left-aligned in the active workspace
- slot-level rules must not re-center it independently

## Consequences

- Saved proposal preview regressions should be debugged at the selected-shell width contract before touching proposal page rendering.
- CV workspace preview regressions should be debugged at the workspace shell and viewport alignment layer before touching resume page geometry.
- Future spacing or chrome work should preserve these guards unless the stage contract itself is intentionally redesigned.
