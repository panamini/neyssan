# Proposal Forge Output Toolbar Width Audit

Date: 2026-04-04
Scope: `my-app` Proposal Forge live workspace only

## Classification

- Active code
  - `my-app/src/pages/ProposalForge.tsx`
  - `my-app/src/components/ProposalDisplay.tsx`
  - `my-app/src/styles/product.css`
  - `my-app/src/components/__tests__/ProposalDisplay.css.test.ts`
- Legacy but informative
  - None used for this audit
- Obsolete/dead code
  - None relied on for conclusions

## Verified root cause

Two separate layout contracts were causing the toolbar mismatch:

1. Desktop width mismatch
   - The live output toolbar in Proposal Forge is the `.dasti-document-rail` inside `.dasti-proposal-output-shell`.
   - In the workspace path, `.dasti-proposal-output-shell--workspace` set `--proposal-output-rail-inline-inset: var(--s2)`.
   - Desktop places that rail absolutely with both inline sides inset by that token.
   - Result: the toolbar rendered narrower than the output shell even though the shell itself used the full workspace column width.

2. Compact/mobile missing vertical gap
   - At `max-width: 1439px`, the rail switches back into normal document flow and uses `margin-block-end: var(--document-rail-gap)`.
   - The Proposal Forge workspace shell did not define `--document-rail-gap`.
   - Result: the mobile/compact toolbar could sit flush against the output shell because the intended gap token resolved to nothing in this path.

## Implemented fix

Updated `my-app/src/styles/product.css` for `.dasti-proposal-output-shell--workspace` so that:

- `--proposal-output-rail-inline-inset` is now `0px`
- `--document-rail-gap` is now `var(--space-2)`
- In the compact/mobile path, the outer `dasti-document-shell` frame is made transparent and frameless while the visible chrome moves down onto `.dasti-proposal-sheet__body--document-viewer`

This keeps the desktop output toolbar aligned to the full shell width and restores the intended compact/mobile separation below the toolbar.

## Follow-up finding

After the first fix, the compact/mobile screenshot still looked visually fused because the toolbar gap existed inside the same framed `dasti-document-shell`.

- The rail had switched back to normal flow correctly.
- But the outer output shell border/background still wrapped both the toolbar and the page body.
- That made the gap read as interior padding instead of separation between two surfaces.

The compact/mobile follow-up fix keeps the toolbar in normal flow but moves the visible frame onto the document-viewer body so the gap reads clearly as separation.

## Regression coverage

Updated CSS contract coverage in:

- `my-app/src/components/__tests__/ProposalDisplay.css.test.ts`

Verified with:

- `npx vitest run src/components/__tests__/ProposalDisplay.css.test.ts src/pages/__tests__/ProposalForge.workspace-toolbar.test.tsx`
