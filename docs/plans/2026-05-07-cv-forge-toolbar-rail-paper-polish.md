# Plan: CV Forge toolbar, ATS, rail tabs, and paper parity polish

Date: 2026-05-07
Status: audit / implementation plan
Scope: CV Forge first. Only touch shared Menu / tooltip primitives if needed for a source-level fix. Do not change parser/import behavior.

## User-reported issues

Screenshots show four remaining visual mismatches after the toolbar chrome pass:

1. **Pick resume tooltip is dirty / redundant**
   - In expanded mode the button already has visible text (`Pick resume`), so the hover tooltip duplicates the label and visually collides with the menu/trigger.
   - Desired behavior: no tooltip while the text label is visible; only show tooltip in collapsed/icon-only mode.
   - Also verify the canonical saved chip/button treatment from the app skeleton (same visual grammar as Proposal’s draft/saved controls), not a custom CV-only pill.
   - Keep the tone badge, but shorten its text to the tone label only (`Natural`, `Warm`, `Formal`) instead of `Natural tone`, `Warm tone`, etc.

2. **Collapsed ATS pill fill is not full-pill**
   - In collapsed mode the visible `ATS` mark is an inner mini-chip inside the ATS pill.
   - Desired behavior: when collapsed, the ATS control should read as one full filled pill, not as a pill containing a smaller filled mark.

3. **Right rail tab bars have different heights**
   - CV rail tabs (`Sections / Ask / Style`) and Proposal rail tabs (`Draft / Ask / Heading / Style`) do not share the same block height / padding.
   - Screenshot comparison: CV tab bar is visibly shorter than Proposal.

4. **Page count pill is too noisy**
   - CV currently shows a page-count pill even when the document is one page.
   - Desired behavior: remove the page count pill by default.
   - Only show page count when all are true:
     - document is active/open,
     - workspace is in preview mode,
     - page count is greater than one.

5. **Proposal Forge and CV Forge still do not feel like the same material system**
   - User perception: toolbar/panel color differs, and CV paper shadow quality differs from Proposal paper.
   - Also explicitly required: CV toolbar-to-paper distance must equal Proposal Forge, and CV toolbar width must equal paper width.
   - Review addition: audit inner workspace background/canvas material before choosing any new color.
   - Additional polish: collapsed rail panel padding/margins should look as calm and proportional as Proposal’s collapsed rail.
   - Confirm proposal-collapsed layout order remains `toolbar → page → panel/rail` and that CV follows the same page-first ordering when collapsed.

## Current implementation status

### Already done / verify only

These items are no longer primary implementation work in the current branch; keep them as regression checks:

- Pick resume tooltip removal:
  - trigger keeps `aria-label="Pick resume"`
  - no native `title`
  - no `data-toolbar-tooltip` in expanded mode
- Pick resume closed/open icon structure:
  - closed: `FolderSimple`
  - open: `FolderOpen`
- Collapsed ATS full-pill behavior at `max-width: 1419px`.
- CV rail tab geometry/material parity:
  - wrapper padding uses `var(--space-1)`
  - button block size uses `var(--control-sm)`
  - active background uses `var(--color-surface-raised)`
- CV rail panel padding uses `var(--space-5)`.
- CV resume workspace document shell has the added Proposal-like shadow layer.

### Still to implement / verify

- Tone badge copy:
  - keep the tone badge
  - show only `Natural`, `Warm`, `Formal`
  - do not show `Natural tone`, `Warm tone`, `Formal tone`
- Page count pill gating:
  - no `1 page` pill
  - only show page count when document preview is active and `effectivePageCount > 1`
  - implement by source-level render gating, not CSS-only hiding
- Background/canvas slab:
  - verify target branch/source has no broad `.dasti-cv-skeleton-forge { background: var(--sf1); }`
  - if present, remove/demote to match Proposal’s transparent skeleton grid
- Browser verification:
  - actual CV toolbar width equals visible paper width
  - actual CV toolbar-to-paper gap equals Proposal
  - side-by-side paper/shadow/background comparison after layout renders real paper
  - audit rail-panel button backgrounds in screenshots/current browser, especially the active tab/button material that appears weird/heavy in CV compared with Proposal

## Measured audit findings

Historical measurements were taken at `1440x900`; update them after browser verification on current source.

### Toolbar shell

CV `.dasti-cv-stage-bar` and Proposal `.dasti-proposal-skeleton-stage__bar` are already identical at the shell level:

- `height`: `56.45px`
- `padding`: `11.23px`
- `gap`: `13.23px`
- `border`: `0px none`
- `background`: transparent
- `box-shadow`: `rgba(29, 26, 22, 0.06) 0px 4px 12px, rgba(29, 26, 22, 0.04) 0px 1px 2px`
- `backdrop-filter`: `saturate(1.4) blur(18px)`
- `border-radius`: `15.12px`

Conclusion: do **not** tune the toolbar shell color directly. The perceived color delta is coming from neighboring surfaces, workspace canvas treatment, and paper/shadow context.

### Background / canvas material audit

Confirmed from current CSS:

- CV Forge page shell and Proposal Forge page shell use the same outer background model:
  - `.dasti-page-shell--cv-forge`
  - `.dasti-page-shell--proposal-forge`
  - both use the radial gradient based on `var(--bg)`.
- Therefore the top-level page background is not the main difference.

Inner workspace difference to verify:

```css
.dasti-cv-skeleton-forge {
  background: var(--sf1); /* should not be present in the final CV Forge workspace */
}
```

Proposal has no equivalent broad skeleton-grid background on `.dasti-proposal-skeleton-forge`; the grid itself is transparent and lets the page canvas remain visible. If current CV source already has `background: transparent`, treat this as verify-only.

Likely root cause:

- CV places the document, toolbar, and rail on a large `sf1` workbench slab.
- Proposal feels cleaner/lighter because only real surfaces are raised; the workspace grid remains transparent over the canonical page canvas.
- This broad slab also changes the perceived toolbar color, even though the toolbar shell itself already matches Proposal.

Recommended direction:

- Do **not** choose a new color.
- Align CV to Proposal's canvas model:
  - top-level Forge canvas: `var(--bg)` / canonical gradient canvas
  - Forge workspace grid: transparent
  - rail/panels/cards: `var(--sfr)` or canonical raised panel token
  - document desktop behind paper, if needed: `var(--sf2)` only inside the document viewport/shell
  - paper: `var(--paper)` / canonical paper token
- Remove or demote the broad `.dasti-cv-skeleton-forge { background: var(--sf1); }` slab unless the whole workspace is intentionally a card.

Acceptance:

- CV and Proposal share the same outer canvas material.
- CV no longer feels like it sits on a separate full-workspace card/slab.
- Toolbar color perception matches Proposal without changing toolbar shell color.

### Toolbar/page geometry

Confirmed feasible:

- Yes, CV toolbar width can be scoped exactly to paper width.
- It is not happening now because CV still derives its stage authority from `--forge-page-inline-size` (a broader legacy page/frame width token) while Proposal derives the visible paper width from an explicit A4-based visual width token and passes that through the workspace shell.
- Proposal’s current model is effectively:
  - JS computes the paper width token (`--proposal-paper-visual-inline-size`)
  - that token feeds the stage width and shell width contract
  - the visible paper and toolbar share the same width authority

Proposal measured:

- toolbar width: `793.69px`
- page/shell width: `793.69px`
- toolbar left == page left
- toolbar bottom → page top gap: `13.21px`

CV screenshot / recent measurements show the toolbar is `860px` wide while the visible CV paper appears narrower. This means the previous CV stage authority still points at `--cv-paper-visual-inline-size: var(--forge-page-inline-size)` instead of the actual rendered resume paper width.

Required contract:

```text
actual rendered CV paper width
  -> --cv-paper-visual-inline-size
  -> .dasti-cv-skeleton-forge__stage width
  -> .dasti-cv-stage-bar width
```

Acceptance:

- CV toolbar left edge equals CV paper left edge.
- CV toolbar right edge equals CV paper right edge.
- CV toolbar bottom → CV paper top gap equals Proposal's `13.21px` gap, i.e. should derive from the same token (`var(--space-2)` / current stage gap), not a CV-only magic number.

### Rail tab height mismatch

Computed rail tab metrics:

CV `.dasti-cv-rail-tabs`:

- outer height: `45px`
- padding: `calc(var(--space-1) - 1px)` → `7.5px`
- active button height: `28px`
- active bg: `var(--sf0)` → computed `rgb(239, 235, 226)`

Proposal `.dasti-proposal-skeleton-rail__tabs`:

- outer height: `51px`
- padding: `var(--space-1)` → `8.5px`
- active button height: `var(--control-sm)` → `32px`
- active bg: `var(--color-surface-raised)` → computed `rgb(255, 255, 255)`

Root cause:

- CV intentionally restored a lighter rail-tab style, but it no longer uses Proposal's tab block-size token.
- Proposal tabs are 4px taller internally (`32px` vs `28px`) and have 1px more outer padding per side.

Recommended fix:

- Keep CV's three-tab structure and calmer labels (`Sections / Ask / Style`).
- Align geometry tokens only:
  - CV tab wrapper padding: `var(--space-1)`
  - CV tab button min block size: `var(--control-sm)`
- Consider aligning active background to `var(--color-surface-raised)` if visual parity is preferred over the current warmer active chip.

### CV rail panel padding / collapsed feel mismatch

Computed panel metrics:

- CV rail padding: `26.46px` (`var(--space-4)`)
- Proposal rail padding: `34.02px` (`var(--space-5)`)

This contributes to perceived different right-panel material and tab placement, especially once collapsed.

Recommended fix:

- Move `.dasti-cv-rail` padding to `var(--space-5)` if the goal is Proposal parity.
- Re-check whether the denser CV organize rows still fit after this change.
- If collapsed layout needs more room, prefer Proposal-like rail padding/margins over ad hoc spacing tweaks.

### Tone badge wording mismatch

Current source:

```tsx
<ToneBadge tone={tone}>
  {tone.charAt(0).toUpperCase() + tone.slice(1)} tone
</ToneBadge>
```

Desired behavior:

- Keep the tone badge/control.
- Remove the redundant word `tone` from the visible label.
- Display only the canonical tone label:
  - `Natural`
  - `Warm`
  - `Formal`

Acceptance:

- Toolbar says `Natural`, `Warm`, or `Formal`, not `Natural tone`, `Warm tone`, or `Formal tone`.
- Do not remove the tone badge entirely.

### Page count pill visibility mismatch

Current source path:

- `VerbatiResumePreview.tsx` renders `.dasti-doc-page-count--resume-panel` / `.dasti-doc-page-count--resume-workspace` near the resume preview.
- It can show `1 page`, which adds visual noise near the paper.

Desired behavior:

- Hide page count by default.
- Only render/show page count when:
  - the document is active/open,
  - the CV workspace is in preview mode,
  - `effectivePageCount > 1`.

Recommended implementation direction:

- Prefer gating at render/source level rather than hiding with CSS.
- Pass a workspace/preview flag down if needed, or derive from existing `hostMode` / `workspaceMode` props if already available.
- Keep accessibility label when shown.

Acceptance:

- No `1 page` pill in normal one-page CV edit/preview.
- Multi-page preview can still show `2 pages`, `3 pages`, etc. when document preview is active.

### Collapsed ATS fill mismatch

Current source:

- `.dasti-cv-ats` remains the outer pill.
- `.dasti-cv-ats__mark` becomes visible only when collapsed and has its own inner background.

That creates a nested mini-chip. For collapsed mode, the outer pill itself should carry the state fill.

Recommended fix:

- In `@media (max-width: 1419px)`:
  - hide `.dasti-cv-ats__label`
  - make `.dasti-cv-ats__mark` text-only (`background: transparent`, full width)
  - put the ready/warn fill and border on `.dasti-cv-ats[data-state]`
  - size the outer ATS pill to the final compact pill width.

Acceptance:

- Collapsed ATS looks like one complete pill with centered `ATS`.
- Ready/warn state remains visible through outer pill background/border/color and tooltip/title.

### Pick resume tooltip mismatch

Current source always sets:

```tsx
data-toolbar-tooltip="Pick resume"
title="Pick resume"
```

This is correct for icon-only mode but redundant in expanded mode.

Recommended source-level fix:

- Add a CSS/attribute gate, not an ad hoc tooltip patch:
  - keep accessible `aria-label="Pick resume"`
  - remove native `title` in expanded mode entirely if possible
  - use CSS tooltip only when label is hidden, e.g. via a class/attribute set by CSS breakpoint or separate duplicate icon-only trigger pattern.

Preferred implementation:

- Remove `title` from the Pick resume trigger to eliminate browser-native dirty tooltip.
- Remove `data-toolbar-tooltip` from expanded source.
- If collapsed tooltip is required, add CSS-driven tooltip through a compact-only rule, or accept `aria-label` without hover tooltip at first. User preference says tooltip is only acceptable when collapsed.

### Paper color / shadow quality mismatch

Relevant source facts:

Proposal paper path:

- `.dasti-proposal-document__page` uses:
  - `background: var(--proposal-document-paper)`
  - `box-shadow: var(--document-stage-halo)`
- `.dasti-proposal-output-shell--workspace .dasti-document-shell` additionally has:
  - `box-shadow: var(--document-viewer-frame-shadow), 0 12px 28px -24px ...`

CV paper path:

- `.dasti-cv-paper-stage .dasti-document-stage__canvas[data-document-page="true"]` uses:
  - `box-shadow: var(--document-stage-halo, var(--sh-paper))`
- CV workspace resume shell sets document-viewer variables separately, including:
  - `--document-viewer-frame-surface: var(--color-surface-muted)`
- CV page/paper appears to lack the same layered document-shell shadow treatment visible in Proposal workspace.

Likely root causes:

1. Proposal has both page-level `--document-stage-halo` and workspace shell/frame shadow layers.
2. CV appears to rely mostly on the resume canvas halo / mini-preview shell path.
3. CV and Proposal may be using different paper elements as the visual object (`.dasti-document-stage__canvas` vs `.dasti-proposal-document__page` / `.dasti-document-shell`).

Recommended audit before changing CSS:

- In a browser state with an actual CV loaded, measure these exact elements:
  - `.dasti-cv-stage-bar`
  - `.dasti-cv-paper-stage`
  - `.dasti-cv-paper-stage .dasti-document-stage__canvas[data-document-page="true"]`
  - `.dasti-cv-paper-stage .dasti-document-shell`
  - `.dasti-proposal-skeleton-stage__bar`
  - `.dasti-proposal-document__page`
  - `.dasti-proposal-output-shell--workspace .dasti-document-shell`
- Compare `background`, `box-shadow`, `border`, `border-radius`, and actual bounding boxes.

Expected fix direction:

- Do not manually invent a CV-only shadow.
- Make CV paper consume the same canonical document shadow tokens as Proposal:
  - page: `--document-stage-halo`
  - surrounding shell/frame, if present: `--document-viewer-frame-shadow` plus Proposal's subtle workspace secondary shadow if needed.
- Make the visible CV paper element and Proposal paper element agree on `background: var(--paper)` / canonical paper token.

## Implementation plan

### 1. Verify already-completed toolbar/rail polish

Do not rework these unless verification finds a regression:

- Pick resume tooltip is removed in expanded mode.
- Pick resume uses `FolderSimple` / `FolderOpen`.
- Collapsed ATS is one full pill.
- CV rail tabs use Proposal-like height/material tokens.
- CV rail padding uses `var(--space-5)`.
- CV document shell has the Proposal-like shadow layer.

### 2. Keep tone badge but shorten label

- Change CV tone badge copy from `${Tone} tone` to just `${Tone}`.
- Preserve the `ToneBadge` component and tone color semantics.

Acceptance:

- `Natural`, `Warm`, `Formal` only.
- No `Natural tone`, `Warm tone`, `Formal tone`.
- Tone badge remains visible.

### 3. Gate page count pill

- Update the resume preview page count render path so page count is hidden by default.
- Only show the page-count pill when document preview is active and `effectivePageCount > 1`.
- Do not show `1 page`.

Acceptance:

- One-page CV has no page-count pill.
- Multi-page active preview displays page count.

### 4. Verify collapsed ATS and audit rail button material

- Confirm collapsed ATS still shows `ATS` centered in one full pill.
- Audit the rail-panel button backgrounds from the supplied screenshots and in-browser computed styles.
- Specific concern: the CV selected rail tab/button background reads weird/heavy compared with Proposal’s rail button material.
- Compare against app skeleton / Proposal tokens before deciding whether `var(--color-surface-raised)` is actually the right active material in this context.
- If it is not canonical or looks visually wrong, fix it by choosing the canonical raised/selected surface token used by Proposal/app-skeleton, not by inventing a new CV-only color.
- Confirm rail tab height/material still matches Proposal-like geometry:
  - wrapper padding `var(--space-1)`
  - button min-height / min-block-size `var(--control-sm)`
- Confirm rail padding remains `var(--space-5)` and collapsed rail spacing feels aligned to Proposal.

### 5. Verify/remove the CV full-workspace background slab

- Remove or demote `.dasti-cv-skeleton-forge { background: var(--sf1); }` so the CV workspace grid follows Proposal's transparent grid model.
- Keep raised backgrounds only on actual surfaces:
  - rail/panels/cards: `var(--sfr)` / raised surface token
  - document viewport/shell desktop: `var(--sf2)` only where a document desktop is needed
  - paper: `var(--paper)`
- Do not introduce a new CV-specific background color.

Acceptance:

- CV and Proposal page canvases read as the same material.
- CV toolbar shell still uses the existing matching toolbar styles.
- The workspace no longer appears as one large `sf1` slab.
- The visual order in collapsed mode still reads as a page-first stack, not a rail-first card stack.

### 6. Re-anchor CV toolbar to actual paper width

- Identify the actual rendered CV paper element and its width authority.
- Update `--cv-paper-visual-inline-size` to match that actual paper width, not just `--forge-page-inline-size` if that token represents a wider stage.
- Ensure `.dasti-cv-skeleton-forge__stage`, `.dasti-cv-stage-bar`, and `.dasti-cv-paper-stage` inherit that same width.

Acceptance:

- CV toolbar width equals visible CV paper width.
- CV toolbar left/right edges align with visible CV paper left/right edges.
- No fixed pixel width hacks.

### 7. Match Proposal toolbar-to-paper gap

- Use Proposal's measured `13.21px` gap as the target.
- Prefer shared token (`var(--space-2)` / document stage gap) over hard-coded pixel values.
- Apply to the stage stack, not by moving only the paper.

Acceptance:

- CV toolbar bottom → CV paper top equals Proposal toolbar bottom → Proposal paper top.

### 8. Align paper color and shadow through canonical tokens

- After element measurement with a loaded CV, update CV paper/shell to use the same paper and shadow tokens as Proposal.
- Prefer token reuse over new CV-only shadows.

Acceptance:

- CV paper has the same perceived elevation quality as Proposal paper.
- CV and Proposal paper backgrounds use the same canonical paper token unless a resume-specific style intentionally overrides the printed page itself.

## Verification checklist

1. Browser screenshots/probes at `1440`, `1419`, `900`, `760`.
2. Hover Pick resume expanded: no tooltip.
3. Collapsed Pick resume: icon-only; optional tooltip only if non-colliding.
4. Saved pill uses the canonical skeleton/app-skeleton saved/draft grammar.
5. Tone badge remains but label is only `Natural`, `Warm`, or `Formal`.
6. Page count pill is hidden for one-page documents; only multi-page active preview shows it.
7. Collapsed ATS: one filled pill, centered `ATS`.
8. CV rail tab bar height equals Proposal rail tab bar height.
9. CV toolbar width equals visible CV paper width.
10. CV toolbar-to-paper gap equals Proposal.
11. Background/canvas comparison: CV skeleton grid is transparent like Proposal; raised backgrounds remain only on real surfaces.
12. Rail button color/material comparison: audit the weird-looking CV rail selected button background against Proposal/app-skeleton and fix if non-canonical or visually heavy.
13. Collapsed rail padding/margins feel aligned to Proposal.
14. Paper shadow/color comparison with side-by-side screenshots.
15. Focused tests:
   - `cd my-app && rtk npx vitest run src/components/cv/__tests__/CvStageBar.test.tsx src/components/__tests__/CvForgeToolbar.css.test.ts`
16. TypeScript:
   - `cd my-app && rtk npx tsc --noEmit --pretty false`
