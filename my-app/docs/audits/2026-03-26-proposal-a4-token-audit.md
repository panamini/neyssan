# Proposal A4 Token Audit

Date: 2026-03-26

## Scope

- Active code:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/foundation.css`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx`
- Legacy but informative:
  - prior hardcoded proposal sheet sizing in `product.css`
- Obsolete/dead:
  - backup trees and archive folders outside `my-app`

## Findings

- The proposal card format is now explicitly tokenized in `foundation.css`:
  - `--document-sheet-inline-size: 560px`
  - `--document-sheet-ratio: 1 / 1.41421356`
  - `--document-sheet-min-block: 420px`
  - `--document-sheet-max-block: min(72vh, 780px)`
- `product.css` now consumes those tokens for:
  - `.dasti-proposal-sheet`
  - `.dasti-proposal-sheet-frame`
  - `.dasti-proposal-sheet--composer`
- Result: compose output, saved proposal cards, and focused proposal states share the same A4-derived base geometry instead of reusing duplicated hardcoded values.

## Remaining Caveat

- The focused state still intentionally exceeds the base A4 card height to support reading/editing comfort. That is a deliberate shell behavior, not a token gap.
