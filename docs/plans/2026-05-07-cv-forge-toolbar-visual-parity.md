# Plan: CV Forge toolbar visual parity with Proposal Forge

Date: 2026-05-07
Status: proposed/audit first
Scope: CV Forge toolbar and Pick Resume menu only.

## Current commit state

The prior CV Forge geometry work has been committed:

- `6909395c fix(cv): canonicalize forge stage geometry`

Do not mix unrelated existing uncommitted files into this work.

## User requests

- Audit why CV Forge toolbar style does not visually match Proposal Forge.
- Determine whether the difference is frost/color/shadow/transparency.
- In collapsed mode, ATS should not show `OK`; show `ATS` only, colored by ready/warning state.
- In collapsed mode, Pick resume should use `FolderSimple` icon and remove the visible `Pick resume` label.
- When Pick resume menu is open/active, use `FolderOpen` icon.
- Investigate why the website top header `Ready` / `Needs review` pill text is not centered.
- Ensure Pick resume dropdown aligns under the button and is right-aligned.
- Move Pick resume before Share and add a divider between them.
- Audit the vertical spacing between the site header, the forge toolbar, and the page. CV Forge and Proposal
  Forge should use the same canonical grid/spacing rhythm here.
- Make a plan/audit first; do not implement yet.

## Screenshots reviewed

- `/Users/pana/Documents/Screenshot 2026-05-07 at 15.07.50.png`
- `/Users/pana/Documents/Screenshot 2026-05-07 at 15.11.43.png`

Observed:

- CV toolbar shell looks close in size and placement after the geometry work.
- The inner controls do not match Proposal:
  - Pick resume is a white secondary button with visible text and a down caret.
  - Share is a white floating-looking icon button with a stronger shadow.
  - CV edit/preview segmented control has a visible pill/surface treatment.
  - Proposal toolbar actions are much plainer/transparent inside the same frosted shell.
- Pick Resume dropdown opens too far left relative to the trigger; it is not right-aligned under the button.
- Top app header pill text appears slightly high/off-center.
- Vertical spacing should be treated as part of the same geometry contract. Proposal Forge currently reads
  better to the eye: the toolbar feels more deliberately related to the page, while CV Forge can read as a
  toolbar floating in leftover canvas space when the header-to-toolbar and toolbar-to-page gaps drift.

## Computed style audit

A browser computed-style comparison was run between:

- CV: `.dasti-cv-stage-bar`
- Proposal: `.dasti-proposal-skeleton-stage__bar`

Result: outer toolbar shells already match nearly exactly.

Shared values:

- `backgroundColor`: transparent, driven by `--proposal-chrome-toolbar-bg`
- `borderTopWidth`: `0px`
- `borderRadius`: `15.1181px`
- `boxShadow`: same frost shadow
- `backdropFilter`: `saturate(1.4) blur(18px)`
- `padding`: same `11.2283px`
- `height`: same `56.4531px`
- `gap`: same `13.2283px`
- `overflow`: `hidden`

Conclusion: the mismatch is **not primarily the toolbar shell frost/color/shadow**. It is the **child control grammar** inside the shell.

### Main visual deltas

#### 1. Pick resume button

CV current:

- `.ds-btn.ds-btn--secondary.dasti-cv-stage-bar__pick-resume`
- white background
- visible label `Pick resume`
- caret glyph
- border and small shadow
- 32px high

Proposal reference:

- Share/action buttons in stage bar use `.dasti-icon-button.dasti-proposal-skeleton-stage__action-plain`
- transparent background
- transparent border until hover/open
- no extra white control surface
- no visible text

#### 2. Share button

CV current:

- `.dasti-icon-button.dasti-cv-stage-bar__share`
- white background
- visible floating shadow

Proposal reference:

- `.dasti-proposal-skeleton-stage__action-plain`
- transparent background
- no visible shadow
- hover/open state supplies control background/border

#### 3. Edit/preview segmented control

CV current:

- visible rounded segmented surface background
- active inner pill shadow

Proposal current:

- also has segmented mode control, but it is nested in a plain action cluster and visually reads less like a standalone pill next to white buttons.

Likely fix:

- Keep icon segmented control but ensure surrounding controls (Pick resume, Share) are plain/transparent so the toolbar reads like Proposal.

#### 4. ATS compact behavior

CV current compact mode hides text and leaves icon text as `OK` or `!`.

User target:

- collapsed mode should show `ATS` only.
- color communicates ready/warning state.
- Do not show `OK`.

#### 5. Pick resume dropdown alignment

Current screenshot shows menu panel left edge not aligned to the trigger. It appears centered/offset, not right-aligned under the button.

Likely cause:

- The `Menu` trigger uses `align="end"` and `matchTriggerWidth`, but the menu content is much wider than the trigger and may align to an internal wrapper or available viewport fallback.
- Need inspect `components/ui/menu.tsx` before patching.

#### 6. Header `Ready` / `Needs review` pill centering

Need inspect top app/header status pill CSS. This is likely not CV Forge-specific. Candidate issue:

- line-height/min-height/padding mismatch
- flex/grid centering missing
- font metrics making it appear off-center

Do not patch globally without identifying exact selector and checking Proposal/CV impact.

#### 7. Header, toolbar, and page vertical rhythm

Need compare CV and Proposal computed layout values for:

- site header bottom edge to toolbar top edge
- toolbar bottom edge to page/paper top edge
- toolbar inline inset relative to the page
- rail top edge relative to toolbar/page in expanded mode

Current design direction:

- The app header should remain a global app boundary.
- The forge toolbar should belong to the document stage, not visually float between the header and paper.
- The page should remain the primary object; toolbar spacing should frame it quietly.
- CV Forge and Proposal Forge should use identical spacing tokens for this vertical rhythm unless content
  measurements prove one surface needs a documented exception.

Proposal Forge looks better because the toolbar/page relationship feels tighter and more intentional. A
simple minimal target is likely:

- header to forge toolbar: one canonical outer workspace step, e.g. `var(--space-4)` / grid row gap
- toolbar to page: the same or slightly smaller canonical step, e.g. `var(--space-3)` if the toolbar should
  read as page chrome
- no ad hoc per-surface margin offsets

Do not choose the final value by eye alone. Measure Proposal and CV first, then either:

- promote the Proposal spacing to the canonical Forge rhythm if it is already token-clean, or
- define a CV/Proposal shared local variable such as `--forge-stage-block-gap` / `--forge-toolbar-page-gap`
  if the current spacing is duplicated or implicit.

## Implementation plan

### 1. Keep outer CV toolbar shell as-is

Because computed styles already match Proposal, do not change these on `.dasti-cv-stage-bar`:

- background/frost tokens
- shadow
- border/radius
- padding/min-height

The problem is child controls, not shell frost.

### 2. Convert CV toolbar action controls to Proposal plain-action grammar

Add CV-local classes rather than broad `.ds-btn` overrides:

- `dasti-cv-stage-bar__pick-resume`
- `dasti-cv-stage-bar__share`

Target style should mirror Proposal:

```css
border-color: transparent;
background: transparent;
box-shadow: none;
color: var(--tm2);
```

Hover/focus/open:

```css
border-color: var(--proposal-chrome-control-active-border);
background: var(--proposal-chrome-control-hover-bg);
color: var(--ti);
```

Acceptance:

- Pick resume and Share no longer appear as separate white floating buttons.
- Toolbar visually reads like Proposal Forge.

### 3. Pick resume compact icon behavior

In `CvStageBar.tsx`:

- Import `FolderSimple` and `FolderOpen` from Phosphor icon wrapper (`@/lib/icons`).
- Track menu open state if the existing `Menu` component exposes open state; otherwise inspect `components/ui/menu.tsx` and use its available API.
- Trigger should render:
  - normal desktop: optional icon + label if space allows, but user requested collapsed mode icon-only.
  - collapsed mode: `FolderSimple` icon only.
  - open/active: `FolderOpen` icon.
- Remove visible `Pick resume` label in collapsed mode.
- Preserve accessible label: `aria-label="Pick resume"` and tooltip/title.

If the Menu component does not expose open state:

- Either extend it minimally with controlled `open/onOpenChange`, or add a CSS/data-state hook if already present.
- Prefer minimal local extension only if needed.

### 4. ATS compact behavior

In `CvStageBar.tsx`:

- Separate ATS icon/short label from long label.
- Do not render `OK` in compact mode.

Possible markup:

```tsx
<span className="dasti-cv-ats__mark" aria-hidden="true">ATS</span>
<span className="dasti-cv-ats__label">ATS-ready</span>
```

CSS:

- desktop: show mark + long label or just long label depending visual fit.
- collapsed: show `ATS` only.
- use `data-state="ready|warn"` color to communicate status.

Acceptance:

- Compact ATS says `ATS`, not `OK`.
- Ready/warning state remains visible via color and tooltip.

### 5. Add divider between Pick resume and Share

Add a divider immediately before Share, after Pick resume:

```tsx
<Menu ... Pick resume ... />
<span className="dasti-cv-stage-bar__action-divider" aria-hidden="true" />
<Menu ... Share ... />
```

Style it like existing toolbar divider, but shorter if needed.

Acceptance:

- Pick resume is directly before Share.
- Divider visually separates document-pick action from share/export action.

### 6. Right-align Pick resume dropdown under trigger

Audit `my-app/src/components/ui/menu.tsx` before changing.

Potential fixes:

- Ensure trigger wrapper is `position: relative` and menu surface uses right alignment against trigger wrapper.
- If `Menu` supports `align="end"`, verify CV trigger passes it and no CSS overrides force center positioning.
- Avoid global Menu changes unless they preserve Proposal menu alignment.
- Add CV menu class only if needed:
  - `.dasti-cv-stage-bar__resume-menu { inset-inline-end: 0; }`
  - or equivalent based on Menu implementation.

Acceptance:

- Menu right edge aligns with trigger right edge.
- Menu opens under the button, not shifted left.
- No Proposal menu regression.

### 7. Header status pill centering audit/fix

Find selector for top header status pill (`Ready` / `Needs review`).

Likely checks:

- Does it use `display: inline-flex` or grid?
- Does it use `align-items: center` / `place-items: center`?
- Is line-height larger than min-height?
- Is vertical padding asymmetric?

Fix only after selector is confirmed. Prefer local class/token change if possible.

Acceptance:

- Text is visually centered inside the pill.
- No header layout shift.

### 8. Canonical header-to-toolbar-to-page spacing audit/fix

Measure current CV and Proposal geometry in browser before changing CSS:

- header bottom to toolbar top
- toolbar bottom to page top
- toolbar left/right edge to page left/right edge
- rail top edge relative to toolbar top/bottom

Then align both Forge surfaces to one minimal spacing contract:

- use the same grid/gap token in CV Forge and Proposal Forge
- keep the toolbar close enough to read as document chrome
- keep enough top breathing room that the toolbar does not feel attached to the global app header
- avoid one-off `margin-top`, `translate`, or per-route offsets

Recommended first design target:

- Header to toolbar: one outer workspace gap.
- Toolbar to page: one tighter stage gap.
- Use existing grid tokens first. Introduce a shared local variable only if the current spacing has no clean
  token owner.

Acceptance:

- CV Forge and Proposal Forge have identical header-to-toolbar and toolbar-to-page spacing unless a measured,
  documented exception is kept.
- Proposal's calmer visual rhythm is preserved or improved.
- The page remains the main visual object; the toolbar reads as attached stage chrome, not a separate card.
- No toolbar/page overlap or cramped spacing at `1440`, `1420`, `1419`, `900`, and `760`.

## Verification plan

Before commit:

1. TypeScript:
   - `cd my-app && rtk npx tsc --noEmit --pretty false`
2. Focused tests:
   - `cd my-app && rtk npx vitest run src/components/cv/__tests__/CvStageBar.test.tsx src/components/__tests__/CvForgeToolbar.css.test.ts`
3. Browser visual/computed probes:
   - Compare CV toolbar and Proposal toolbar shell still match.
   - Confirm CV child controls now match Proposal plain-action grammar.
   - Check collapsed width: ATS shows `ATS`, not `OK`.
   - Check collapsed width: Pick resume shows `FolderSimple` icon only.
   - Check open Pick resume: `FolderOpen` icon appears.
   - Check dropdown right edge aligns with trigger right edge.
   - Check top header Ready/Needs review pill text vertical centering.
   - Compare CV and Proposal header-to-toolbar and toolbar-to-page computed gaps.
   - Confirm spacing uses the same canonical grid/token contract in both Forge surfaces.
4. Screenshot/visual review at:
   - 1440
   - 1420
   - 1419
   - 900
   - 760
5. Review pass.
6. Commit only these files.

## Non-goals

- Do not alter CV import pipeline.
- Do not alter Proposal Forge behavior unless shared Menu/header fix is required and verified.
- Do not change canonical CV geometry from commit `6909395c` except if a selector must be added for toolbar polish.
- Do not reintroduce heavy rail-tab styling.
