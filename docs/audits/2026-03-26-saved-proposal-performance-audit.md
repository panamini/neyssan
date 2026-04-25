# Saved Proposal Performance Audit

Date: 2026-03-26

## Classification

- Active code:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css`
- Legacy but informative:
  - previous single-card saved proposal view before the stacked rail
- Obsolete/dead:
  - archive and backup trees outside `my-app`

## Findings

- The lag on first selection is not a Convex fetch bottleneck in the active UI path. The proposals query is already hydrated before the click in the common case.
- The main cost came from rendering too many full proposal sheets at once after the saved rail became a stacked A4 view.
- Each selection invalidated the full stack, including multiple document bodies and typography layout work.
- The dark horizontal artifact on secondary cards came from the top `::before` fade overlay on `.dasti-proposal-sheet__body`, which reads like a black strip when cards are stacked in dark mode.

## Implemented Fix

- Main selected card now shows a loading skeleton while a new saved proposal is being selected.
- Secondary saved proposals are chunked progressively: 2 cards initially, then more cards are loaded on scroll via `IntersectionObserver`.
- Secondary stacked cards no longer render the top/bottom fade overlay pseudo-elements.

## Follow-up

- If proposal libraries become very large, the clean next step is virtualization, not simply increasing the chunk size.
