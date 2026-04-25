# 2026-03-30 Workbench Toolbar Handoff Plan

## Objective

Fix the top-left workspace control alignment so that:

1. proposal collapsed and expanded toolbar states occupy the same top-left position
2. resume workspace edit/preview toggle occupies that same position
3. the expanded proposal toolbar does not overlap the compose shell
4. tooltip spacing remains correct after the layout fix

This plan is self-contained and assumes no prior thread context.

## Current Broken State

### Screenshots indicate

- Proposal collapsed toolbar is not aligned with resume workspace controls
- Proposal expanded toolbar overlays the compose shell/content region
- Proposal collapsed/expanded states do not share the same anchor
- Resume and proposal are using visually different top-left origins

### Code causing that state

- Proposal toolbar slot is currently rendered in the proposal page left-column stack:
  - `my-app/src/pages/ProposalForgeNext.tsx`
- The collapsed proposal toolbar can render inside a zero-width collapsing column:
  - `dasti-forge-left-col--collapsed-anchor` in `my-app/src/styles/product.css`
- Resume workspace controls are rendered inside the resume viewer shell instead:
  - `my-app/src/features/verbati/VerbatiResumePreview.tsx`
- Both use `dasti-workbench-top-left-slot`, but not in the same containing block

## Non-goals

- Do not redesign the toolbar visual style
- Do not rewrite proposal generation flows
- Do not refactor unrelated proposal/resume rendering code
- Do not do large architecture work outside the layout anchor and tooltip positioning problem

## Canonical Decision

Use one stable workspace-level anchor per page, located at the top-left of the primary workspace canvas area to the right of the sidebar.

That anchor must not depend on:

- left panel width
- collapsed/expanded left-column state
- document presence
- brief-card visibility

## Implementation Strategy

### Step 1. Revert the proposal toolbar to a stable host level

In `my-app/src/pages/ProposalForgeNext.tsx`:

- Stop hosting the shared top-left slot inside the left-column stack
- Move the slot to the stable workspace surface/container that persists whether the left panel is open or collapsed
- The most likely correct host is the output/workbench wrapper that remains present in both states

Desired outcome:

- collapsed proposal toolbar and expanded proposal toolbar are rendered in the same host container
- switching `leftPanelVisible` does not move the host container

### Step 2. Remove proposal dependence on the zero-width left column

In `my-app/src/pages/ProposalForgeNext.tsx` and `my-app/src/styles/product.css`:

- eliminate the proposal-toolbar dependency on `renderCollapsedToolbarInLeftCol`
- or force the proposal collapsed toolbar to use the output-side anchor instead of the left-column anchor
- do not position the proposal toolbar relative to `dasti-forge-left-col--collapsed-anchor`

Desired outcome:

- proposal toolbar x/y origin stays stable while the left column opens/closes

### Step 3. Keep resume on the same canonical anchor level

In `my-app/src/features/verbati/VerbatiResumePreview.tsx`:

- keep the resume workspace toggle in a `dasti-workbench-top-left-slot`
- but ensure the slot’s containing block is the same logical workspace origin used by proposal

This may require moving the slot one level higher or lower so both modules agree on:

- page-shell inline padding
- workspace surface top offset
- content column origin

Do not just reuse the class name; make sure the containing block is equivalent.

### Step 4. Restore layout reservation for expanded proposal toolbar

After proposal is hosted in the correct container:

- make the expanded proposal toolbar reserve vertical space instead of overlaying the compose shell

Two valid options:

1. Keep the toolbar in normal flow and render collapsed state in an absolutely positioned variant only
2. Keep both anchored, but reserve exact block space from the stable host with a real measured/design token height contract

Recommended:

- prefer normal flow for expanded toolbar
- reserve anchored positioning for collapsed/floating state only

Reason:

- expanded toolbar is a true bar, not a floating badge
- it is easier to keep it from overlapping content in flow than with synthetic slot heights

### Step 5. Re-check tooltip contracts after layout is fixed

Preserve if possible:

- `dasti-toolbar--surface-tooltips`
- `dasti-toolbar-tooltip-trigger--above`
- compose-toolbar tooltip surface compensation

But re-validate after the host/container move:

- expanded proposal toolbar tooltip should sit 2px below the toolbar surface panel
- bottom compose-shell toolbar tooltips should stay above their triggers
- regenerate tooltip should keep trigger-based spacing

### Step 6. Add regression coverage

Add at least one of:

- DOM-level tests asserting class placement and host container usage
- Playwright screenshot tests for proposal collapsed, proposal expanded, resume preview, resume edit

Minimum coverage should verify:

1. proposal collapsed and proposal expanded use the same host slot
2. resume workspace toggle uses the same host slot contract
3. expanded proposal toolbar does not overlap the compose shell region

## Concrete Files To Touch

- `my-app/src/pages/ProposalForgeNext.tsx`
- `my-app/src/components/ProposalComposeToolbar.tsx`
- `my-app/src/features/verbati/VerbatiResumePreview.tsx`
- `my-app/src/pages/CvForge.tsx` only if its workspace wrapper must move
- `my-app/src/styles/product.css`
- relevant tests:
  - `my-app/src/components/__tests__/ProposalComposeToolbar.test.tsx`
  - `my-app/src/pages/__tests__/CvForge.workspace-mode.test.tsx`
  - add a proposal workspace placement test if possible

## Current Code You Should Treat As Partial / Suspicious

- `anchored?: boolean` on `ProposalComposeToolbar`
- `.dasti-compose-toolbar--anchored`
- `.dasti-workbench-top-left-slot`
- proposal placement inside the left-column stack in `ProposalForgeNext.tsx`

These are not necessarily wrong individually, but together they are not producing the required behavior.

## Acceptance Criteria

- Proposal collapsed toolbar and expanded toolbar render from the same top-left point
- Resume workspace toggle renders from that same top-left point
- Proposal expanded toolbar no longer sits on top of compose shell content
- No visible jump when collapsing/restoring proposal left panel
- Expanded toolbar tooltip no longer touches the toolbar surface
- Existing targeted tests still pass

## Suggested Execution Order

1. Fix proposal host container and remove left-column dependency
2. Align resume host container to the same level
3. Decide whether expanded proposal toolbar should be flow-based or anchored with exact reserved space
4. Re-tune tooltip offsets only after geometry is correct
5. Add regression coverage

## Notes For The Next LLM

- Do not assume matching class names mean matching geometry
- The current failure is mostly about containing blocks, not about one more `top/left` tweak
- Favor a single canonical slot contract over special cases per module
