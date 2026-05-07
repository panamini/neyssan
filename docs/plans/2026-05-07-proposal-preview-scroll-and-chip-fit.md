# Proposal preview scroll and chip-fit plan

Date: 2026-05-07
Scope: active Proposal Forge preview geometry only.

## Observed issues

1. **Collapsed mode leaves a large empty block below the page.**
   The page should end at the actual page end, not at an inflated shell height.

2. **Preview mode is not scrollable through long content / second page.**
   The wrong container is likely owning height/overflow, so the visible page behaves like a single fixed block instead of a scrollable document viewport.

3. **The Draft pill grows too wide.**
   The status chip is expanding with layout pressure instead of staying intrinsic to its text.

## Active code path to inspect

- `my-app/src/pages/ProposalForge.tsx` — workspace/layout shell and viewport sizing inputs.
- `my-app/src/components/ProposalDisplay.tsx` — preview stage, page positioner, scroll viewport, page count/canvas logic.
- `my-app/src/styles/product-proposal.css` — stage, viewport, and status chip sizing rules.
- `my-app/src/components/proposal/ProposalDocumentStage.tsx` — only if the toolbar/status chip needs extra structure or class hooks.

## Working hypothesis

- The **scrollable container** should be the proposal preview viewport element inside `ProposalDisplay.tsx`, not the outer workspace shell.
- The **extra blank space** is likely coming from a fixed stage height or viewport height that exceeds the rendered page stack in collapsed mode.
- The **draft pill width** is likely caused by flex growth / max-width behavior on the status chip and should be made intrinsic.

## Files to modify

Primary files:

- `my-app/src/components/ProposalDisplay.tsx`
- `my-app/src/styles/product-proposal.css`

Allowed fallback only if existing markup/classes cannot express the fix cleanly:

- `my-app/src/components/proposal/ProposalDocumentStage.tsx` — class/structure support only, no behavior changes.

## Plan

- [x] Audit the current preview viewport ownership in `ProposalDisplay.tsx` and identify the single element that must scroll when proposal content exceeds one page.
- [x] Remove any fixed-height shell behavior that creates a large blank area below the rendered page stack in collapsed mode.
- [x] Keep the page stack height driven by actual content/page count, while the scroll container handles overflow.
- [x] Make collapsed preview use the same document viewport rules as multi-page preview, instead of trapping the content in a single non-scrolling block.
- [x] Ensure the preview viewport, not the outer workspace shell, owns vertical scrolling for long proposals.
- [x] Make the Draft/status pill intrinsic width again: no flex grow, no oversized width expansion, and ellipsis only if the text genuinely overflows.
- [x] If the status chip needs a separate meta element, split the chip into intrinsic primary text + compact secondary meta instead of letting one pill absorb both widths.
- [x] Only add `ProposalDocumentStage.tsx` class hooks if CSS cannot target the current toolbar groups cleanly.

## Verification

- [x] Browser-check collapsed mode at narrow widths and confirm the page stops at its real end.
- [x] Browser-check a long proposal / second-page case and confirm the preview viewport scrolls to the bottom.
- [x] Confirm the scrollable element is the intended preview viewport, not the outer page shell.
- [x] Confirm the Draft pill width stays content-sized and does not stretch across the toolbar.
- [x] Run focused Proposal preview/stage tests after the layout change.
