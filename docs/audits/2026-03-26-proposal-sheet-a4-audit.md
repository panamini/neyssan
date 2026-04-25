# Proposal Sheet A4 Audit

Date: 2026-03-26

## Scope

- Active code:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/foundation.css`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx`
- Legacy but informative: none needed for this audit.
- Obsolete/dead code: archive and backup trees not considered.

## Finding

- The design tokens declared an A4-like portrait ratio correctly:
  - `--document-sheet-ratio: 1 / 1.41421356`
- But the runtime sheet sizing was not strictly A4 in practice because:
  - `--document-sheet-inline-size` was `560px`
  - `--document-sheet-max-block` was `min(72vh, 780px)`
  - A 560px-wide A4 sheet should be about 792px high, not 780px
- Result:
  - the sheet was being visually compressed vertically by about 12px at the default maximum size
  - this made proposal cards read more like editorial rectangles than true A4 sheets

## Fix Applied

- Updated proposal sheet width resolution in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css` so width is constrained by the current max block size:
  - `width: min(100%, var(--document-sheet-inline-size), calc(var(--document-sheet-max-block) / 1.41421356))`
- Applied to:
  - `.dasti-proposal-sheet`
  - `.dasti-proposal-sheet-frame`
  - `.dasti-proposal-sheet--composer`

## Effect

- The proposal sheet now preserves its declared A4 ratio even when the max-height token is the active constraint.
- On large screens, the sheet becomes slightly narrower than before rather than vertically squashed.

## Follow-up

- If the product should use a stricter physical-paper model everywhere, the next step is to replace the derived constant with a dedicated paper-size token pair:
  - canonical inline size
  - canonical block size
- If focus mode should also remain strictly A4 at all times, its width should be derived from its own focused max-height token the same way.
