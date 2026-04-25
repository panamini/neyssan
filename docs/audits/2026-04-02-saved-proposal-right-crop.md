# Saved Proposal Right-Crop Audit

Date: 2026-04-02
Scope: `my-app` saved proposal list path only

## Classification

- Active code
  - `my-app/src/components/ProposalsList.tsx`
  - `my-app/src/components/ProposalDisplay.tsx`
  - `my-app/src/hooks/use-document-stage-layout.ts`
  - `my-app/src/hooks/use-document-viewport-centering.ts`
  - `my-app/src/styles/product.css`
- Legacy but informative
  - None used for this audit
- Obsolete/dead code
  - None relied on for conclusions

## What differs between the selected and secondary saved-card paths

Both paths render `ProposalDisplay`, but the selected saved card is constrained by a different outer width token:

- Selected saved card
  - `.dasti-proposal-library-selected-shell`
  - `--proposal-library-selected-shell-inline-size`
  - Previously resolved from the saved workspace width token
- Secondary saved card
  - `.dasti-proposal-library-card--secondary`
  - `--document-viewer-shell-inline-size`
  - Intentionally stays on the smaller secondary-card width

## Verified root cause

The selected saved card container was width-capped too narrowly for the current full-height document stage:

1. `.dasti-proposal-library-selected-shell` capped the selected card with the saved workspace width token.
2. That token yields a card width of about `528px`.
3. After the selected shell border (`2px` total) and stage chassis padding (`8px` left + `8px` right), the selected document stage only had about `510px` of usable inline space.
4. The current full-height selected preview path needs the container to allow the actual page width, not the narrower workspace-width track.

So the right-edge crop came from the selected container chain being too narrow before the preview stage was even measured.

## Width-chain note

The working secondary cards were informative for comparison, but they are intentionally smaller preview cards. The selected saved card is the main reading surface, so matching the narrower secondary-card width was not the correct target here.

I did not treat the removed saved-output wrapper or the recent `scrollbar-gutter` edit as automatic revert targets. They remained suspects during the audit, but the implemented fix was to enlarge only the selected saved-card container width.

## Implemented fix

Changed `.dasti-proposal-library-selected-shell` in `my-app/src/styles/product.css` so:

- `--proposal-library-selected-shell-inline-size` is now sized relative to the document page width:
  - `min(100%, calc(var(--document-sheet-inline-size) + (var(--s2) * 2) + 2px))`

This preserves the current full-height selected-card behavior and gives the selected saved card enough inline room for the document-width stage.

## Regression coverage

Added/updated test coverage in:

- `my-app/src/components/__tests__/ProposalsList.toolbar-grouping.test.tsx`
- `my-app/src/components/__tests__/ProposalDisplay.css.test.ts`

Verified with:

- `npx vitest run src/components/__tests__/ProposalsList.toolbar-grouping.test.tsx src/components/__tests__/ProposalDisplay.stage.test.tsx src/components/__tests__/ProposalDisplay.css.test.ts`
