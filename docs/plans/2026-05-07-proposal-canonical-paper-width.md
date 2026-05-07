# Proposal canonical paper width plan

Date: 2026-05-07
Scope: Proposal Forge workspace preview/edit geometry only.

## Context

Recent fixes made collapsed preview look cleaner and aligned the compact toolbar/panel/page widths, but the underlying model is still unstable: Proposal Forge has multiple width authorities and the visible page can change around the rail-collapse breakpoint.

The intended outcome is one page-first contract: rail collapse should change the surrounding workspace arrangement, not the visual document paper width. The page may only shrink when the viewport is genuinely too narrow.

## Width-map audit

| Mode | Current shell/frame authority | Current stage/page authority | Breakpoint risk |
| --- | --- | --- | --- |
| Expanded preview | `proposalWorkspaceOutputShellInlineSize` uses `liveOutputFrameInlineSize` when available; otherwise `--forge-page-inline-size` | `ProposalDisplay` uses `useDocumentStageLayout()` with `previewFitMode="width"`, so page width follows measured `.dasti-document-stage-chassis` | Live measured frame and measured stage can disagree with compact fallback |
| Compact preview | Inline grid style now sets `--proposal-workspace-stage-inline-size` to A4 px stopgap; `proposalWorkspaceOutputShellInlineSize` still falls back to `--forge-page-inline-size` | Page still follows measured `.dasti-document-stage-chassis` | Compact code path can still diverge because workbench/output shell and stage use different variables |
| Expanded edit | Workspace width derives from `proposalWorkbenchColumnInlineSize` / `--proposal-workspace-output-shell-inline-size`; document editor uses separate body/editor rules | Edit stage uses `useDocumentStageLayout()` with `fitMode="width"` but edit affordances/padding are separate | Edit can look like a different page if shell/body padding differs from preview |
| Compact edit | Same compact workspace variables plus editor-specific CSS | Same measurement-based stage but compact CSS changes height/flex/padding | Rail collapse and editor rules change measurement simultaneously |
| At breakpoint | `isCompactComposeLayout` flips at 1420px; `ResizeObserver` live frame measurement is disabled in compact mode; CSS media rules also flip | The measured chassis width changes at the same time | This is why the page feels like it changes identity at collapse |

## Root causes

1. **Two width authorities in `ProposalForge.tsx`.**
   Expanded mode may use `liveOutputFrameInlineSize`, while compact mode uses fallback tokens. That allows the page/frame width to jump at the breakpoint.

2. **Preview width is incidental measurement.**
   `ProposalDisplay.tsx` scales A4 from the measured `.dasti-document-stage-chassis`, not from a shared workspace paper-width contract.

3. **Shell, frame, stage, viewport, and paper are mixed.**
   CSS variables like `--proposal-workspace-output-shell-inline-size`, `--document-viewer-shell-inline-size`, `--proposal-workspace-stage-inline-size`, and `--document-stage-width` overlap but do not form one hierarchy.

4. **Preview and edit paths are visually similar but not contractually shared.**
   Preview and edit use the same layout hook, but body/editor padding and shell rules can still produce different apparent page widths.

## Canonical contract

Introduce one workspace-level variable as the source of truth:

```css
--proposal-paper-visual-inline-size
```

Meaning: the visible document page width in Proposal Forge workspace.

Rules:

- Expanded and compact workspace modes derive toolbar, rail/panel, output shell, document shell, stage chassis, preview stage, and edit shell from this variable.
- Rail collapse must not change this variable.
- `liveOutputFrameInlineSize` should not become the page-width authority. If kept, it should be diagnostic or derived from the canonical page width, not vice versa.
- `ProposalDisplay` should receive or inherit the intended visual paper width so `useDocumentStageLayout()` measures within a known page-width container rather than discovering width from incidental shell padding.
- Page width may shrink below the canonical value only through `min(100%, var(--proposal-paper-visual-inline-size))` when the viewport cannot fit it.
- The canonical visual width should be Proposal-local and derived from the app's document workspace design width first. Use raw renderer A4 px only if the width-map/browser audit confirms it is the intended visual target, not merely the renderer coordinate width.

## Approach

1. Define `--proposal-paper-visual-inline-size` in `ProposalForge.tsx` workspace styles from the canonical app document workspace width. Start from `--forge-page-inline-size` / existing Forge document design tokens, then use browser measurements to decide whether the visual target should instead match the rendered A4 px width.
2. Replace compact-only A4 stopgaps with this shared variable after confirming the intended visual target.
3. Make both expanded and compact `--proposal-workspace-stage-inline-size` and `--proposal-workspace-output-shell-inline-size` derive from the canonical paper width where the page is the object.
4. Keep the two-pane grid geometry intact by deriving total workbench max width from canonical paper width + rail width + grid gap.
5. Ensure `.dasti-document-stage-chassis` has no extra inline padding in workspace preview when the scrollbar should sit at the page edge; any breathing room should belong to the outer canvas, not the scroll viewport.
6. Apply the same canonical width to edit mode shell/stage so preview/edit do not appear to be different pages.
7. Update CSS contract tests to assert the canonical variable and breakpoint stability.

## Files to modify

Primary:

- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/styles/product-proposal.css`
- `my-app/src/components/__tests__/ProposalDisplay.css.test.ts`

Possible if needed:

- `my-app/src/components/ProposalDisplay.tsx` — only to pass an explicit workspace visual page width or class/data hook if CSS inheritance cannot make `useDocumentStageLayout()` measure the intended width.

Avoid:

- `my-app/src/hooks/use-document-stage-layout.ts` — shared document infrastructure. Do not change it unless CSS/props cannot give the measured element a stable canonical width and a separate audit proves hook-level support is required.

## Reuse

- Existing Forge document width tokens, especially `--forge-page-inline-size`, as the first candidate for the canonical visual workspace width.
- `A4_PAGE_WIDTH_PX` from `my-app/src/lib/document-stage.ts` only as an audit comparison or fallback if browser measurements prove the rendered A4 px width is the intended visual target.
- Existing `useDocumentStageLayout()` in `my-app/src/hooks/use-document-stage-layout.ts` for fit/overflow calculations, without changing the hook in the first implementation pass.
- Existing workspace CSS variables in `ProposalForge.tsx` and `product-proposal.css`; consolidate rather than adding parallel variables.

## Steps

- [x] Add a Proposal-local `--proposal-paper-visual-inline-size` workspace variable, initially derived from `--forge-page-inline-size` unless the browser width-map proves the rendered A4 px width is the correct visual target.
- [x] Record the measured candidate widths before implementation: `--forge-page-inline-size`, `A4_PAGE_WIDTH_PX`, expanded page rect, compact page rect, toolbar rect, panel rect, and scrollbar viewport rect.
- [x] Route `--proposal-workspace-stage-inline-size` through `--proposal-paper-visual-inline-size` in both compact and expanded workspace modes.
- [x] Route `--proposal-workspace-output-shell-inline-size` / `--document-viewer-shell-inline-size` through the same canonical variable where the output shell represents the page frame.
- [x] Remove or demote `liveOutputFrameInlineSize` as a page-width authority; keep it only if needed for observation/debugging or non-page shell sizing.
- [x] Keep rail width and grid gap independent so two-pane layout remains page + rail, not rail-driven page scaling.
- [x] Make workspace preview scrollbar align with the page edge by keeping stage padding out of the scroll viewport.
- [x] Align edit shell/stage with the same page-width contract.
- [x] Keep `use-document-stage-layout.ts` unchanged in the first pass; stabilize the measured element through CSS/props instead.
- [x] Add/adjust CSS tests to cover compact/expanded width source ordering and ensure compact mode does not use a competing page width.

## Verification

Implementation audit result:

- Browser width-map confirmed `--forge-page-inline-size` is 860px while the expanded visible document stage/page is ~793.7px.
- The canonical workspace paper visual width is therefore the rendered A4 width at the current app scale (`A4_PAGE_WIDTH_PX`, rounded to 793.7px), not the legacy Forge frame/gutter width.
- Post-change measurements at 1430px and 1410px both showed toolbar, shell, chassis, viewport, and page at ~793.7px; narrow viewport scaled all of them together.
- Edit mode measurements at 1430px and 1410px also matched the same ~793.7px width.

Automated:

- `cd my-app && npx tsc --noEmit --pretty false`
- `npm --prefix my-app run test -- src/components/__tests__/ProposalDisplay.stage.test.tsx`
- `npm --prefix my-app run test -- src/components/__tests__/ProposalDisplay.css.test.ts src/components/__tests__/ProposalDisplayFooter.css.test.ts`

Browser/manual:

- Before implementation, measure candidate canonical widths and choose the design-token-derived visual target; do not assume raw A4 px is correct.
- Measure expanded preview just above 1420px and compact preview just below 1420px: visible page width should remain stable unless viewport is too narrow.
- Check expanded edit vs compact edit: white page width should match preview page width.
- Check long preview: scrollbar stays on the right edge of the visible page/preview viewport.
- Check narrow/mobile: page, toolbar, and panel shrink together via `min(100%, canonical width)`.
- Confirm rail collapse changes only layout ordering/presence, not document paper identity.

## Non-goals

- Do not change generation, model routing, Convex, export, print rendering, or saved proposal behavior.
- Do not make the outer workspace shell the scroll owner.
- Do not reintroduce a framed card around the paper.
