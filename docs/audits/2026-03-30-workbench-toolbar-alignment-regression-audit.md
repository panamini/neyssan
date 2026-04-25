# 2026-03-30 Workbench Toolbar Alignment Regression Audit

## Request

Audit the proposal/resume workspace top-left toolbar alignment after the recent compose toolbar and tooltip changes, determine whether the current state is a regression or an unfinished implementation, and prepare a handoff plan for another LLM.

## Classification

- Active code:
  - `my-app/src/pages/ProposalForgeNext.tsx`
  - `my-app/src/components/ProposalComposeToolbar.tsx`
  - `my-app/src/features/verbati/VerbatiResumePreview.tsx`
  - `my-app/src/pages/CvForge.tsx`
  - `my-app/src/styles/product.css`
- Legacy but informative:
  - `my-app/src/pages/ProposalForge.tsx`
- Obsolete/dead for this task:
  - none intentionally inspected beyond the active route above

## Verdict

This is both:

1. a regression in proposal workspace positioning
2. an unfinished cross-module alignment implementation

The current CSS/class names suggest a shared top-left slot exists, but the proposal and resume pages do not anchor that slot at the same layout level. The proposal toolbar also now overlaps the compose shell in states where it should reserve vertical space instead.

## Findings

### 1. Proposal toolbar is still anchored to the wrong container

In `my-app/src/pages/ProposalForgeNext.tsx`, the new shared slot wrapper:

- `dasti-workbench-top-left-slot dasti-forge-compose-toolbar-slot`

is rendered inside the left-column flow stack, not in a stable workspace-level slot:

- `my-app/src/pages/ProposalForgeNext.tsx:1778-1827`

This is the core reason the proposal toolbar jumps when the left panel collapses:

- the left panel can be full width
- then zero width via `dasti-forge-left-col--collapsed-anchor`
- but the toolbar is still positioned relative to that changing column

Because of that, collapsed and expanded states do not share a stable world-space anchor.

### 2. Proposal collapsed state is explicitly tied to a collapsing column

`my-app/src/styles/product.css:6270-6274`

`dasti-forge-left-col--collapsed-anchor` sets:

- `max-width: 0`
- `width: 0`
- `min-width: 0`

At the same time, the collapsed proposal toolbar is rendered inside that column when `renderCollapsedToolbarInLeftCol` is true.

That means the collapsed toolbar is visually positioned by a zero-width grid track rather than by the final workspace canvas or shell. This explains the screenshot where the collapsed proposal toolbar appears far from the resume workspace toggle.

### 3. Proposal expanded toolbar anchoring regressed into overlay behavior

`my-app/src/components/ProposalComposeToolbar.tsx` now supports:

- `anchored?: boolean`
- `dasti-compose-toolbar--anchored`

and `my-app/src/styles/product.css:6386-6391` sets:

- `position: absolute`
- `inset-block-start: 0`
- `inset-inline-start: 0`

for anchored toolbars.

However, the reservation strategy is only a generic min-height slot:

- `my-app/src/styles/product.css:6281-6288`

That slot is not tied to the actual proposal compose shell spacing contract. As a result, the expanded proposal toolbar can sit on top of the compose shell/header region instead of participating in layout correctly. The screenshot showing the toolbar over the compose content is consistent with this.

### 4. Resume workspace toggle is anchored at a different layout level than proposal

Resume workspace now renders:

- `dasti-workbench-top-left-slot dasti-cv-workbench-slot`

inside `VerbatiResumePreview`, before the resume surface:

- `my-app/src/features/verbati/VerbatiResumePreview.tsx:286-299`

and the resume workbench bar is absolutely positioned within that shell:

- `my-app/src/styles/product.css:1753-1760`

This is a different geometry from proposal, where the slot currently lives in the proposal page left-column stack. The class name is shared, but the containing block is not. That is why the two modules are visibly misaligned even though they appear to use the same abstraction.

### 5. Tooltip work is only partially correct

The compose-toolbar tooltip gap work is not fully invalid, but it is sitting on top of a broken anchoring model.

Useful pieces that likely should be kept:

- `dasti-toolbar--surface-tooltips`
- `dasti-toolbar-tooltip-trigger--above`
- the extra compose-toolbar surface compensation at `my-app/src/styles/product.css:5386-5391`

But because the proposal toolbar is currently overlaid on the wrong surface, the user-visible result is still wrong even if the tooltip math itself improved.

### 6. Tests passed but they do not cover visual geometry

Current passing tests are structural or interaction tests only. They do not assert:

- x/y alignment against a common workspace origin
- no overlap with the compose shell
- consistent position between expanded and collapsed proposal states
- consistent position between proposal and resume workspaces

So the green test runs do not contradict the visual regression.

## Root Cause Summary

The implementation introduced a shared naming layer (`dasti-workbench-top-left-slot`, anchored toolbar mode) without moving both modules onto the same actual containing block.

The proposal toolbar is still effectively coupled to the proposal page’s collapsing left column.

The resume toggle is anchored to the resume workspace shell.

Those are not the same coordinate system, so alignment cannot be stable.

## What Regressed

- Proposal collapsed/expanded toolbar no longer shares a stable anchor point
- Proposal toolbar can overlap the compose surface
- Proposal and resume workspace controls no longer line up across pages

## What Looks Safe To Keep

- Bottom compose-shell tooltip-above-trigger work in `ProposalInputForm`
- Regenerate tooltip-above-trigger work in `ProposalsList`
- Generic toolbar tooltip tokenization (`data-toolbar-tooltip`) unless simplified later

## Recommendation

Do not keep iterating on offsets in the current structure.

The next implementation should:

1. choose one canonical workspace top-left anchor
2. place both proposal and resume controls at that exact layout level
3. remove proposal anchoring to the collapsing left column
4. only then fine-tune the tooltip gap and spacing
