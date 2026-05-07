# CV Forge ↔ Proposal Forge toolbar/rail parity audit

Date: 2026-05-07
Scope: audit only; no implementation changes.

## Active code inspected

- `my-app/src/pages/CvForge.tsx`
- `my-app/src/components/cv/CvStageBar.tsx`
- `my-app/src/components/cv/CvRail.tsx`
- `my-app/src/styles/product-cv.css`
- `my-app/src/styles/product-proposal.css`
- `/Volumes/video/git/twoweeks-wiki/wiki/tech/proposal-forge-document-geometry.md`

## Confirmed current state

### Proposal Forge geometry contract

Proposal Forge is now page-first. The document/page width is the authority, and chrome is moving toward page-derived placement rather than app-shell placement:

- The document output shell still has lifted rail behavior: `.dasti-proposal-output-shell` defines `--proposal-output-toolbar-lift`, and `.dasti-proposal-output-shell .dasti-document-rail` can be positioned above the document shell with `inset-block-start: calc(-1 * var(--proposal-output-toolbar-lift))`.
- The active Forge stage toolbar visible in the current workspace is also handled by `ProposalDocumentStage` and `.dasti-proposal-skeleton-stage__bar`; it is sized/aligned from Proposal skeleton stage/page geometry rather than the outer app shell.
- Toolbar sections use compact `min-block-size: var(--hs)` and the rail/stage toolbar is visually tied to the page boundary.
- The page remains the main object; toolbar, rail, panel, and scrollbar derive from the page geometry.

### CV Forge geometry today

CV Forge is active code, not legacy. It uses a different stack:

- `CvForge.tsx` renders `.dasti-cv-skeleton-forge` with two columns: document stage + `CvRail`.
- `.dasti-cv-skeleton-forge` adds a full surface around the workbench with `padding: var(--space-4) var(--space-5)`, background, radius, and clipped overflow.
- `.dasti-cv-skeleton-forge__stage` stacks `CvStageBar`, review banners/progress, then edit/preview content with `gap: var(--space-2)`.
- `CvStageBar` is a full-width flex toolbar inside that stage, not a lifted document rail tied to the page shell.
- CV edit/preview has additional toolbar slots (`.dasti-workbench-top-left-slot--cv-edit`, `.dasti-workbench-top-left-slot--cv-preview`, `.dasti-workbench-top-left-slot--cv-toggle`) and workbench padding (`.dasti-cv-edit-workbench-shell .dasti-grid-split { padding-top: calc(var(--document-viewer-toolbar-block-size) + var(--space-2)); }`).

## Why the CV toolbar sits lower than Proposal Forge

Confirmed from CSS/markup: this is mostly a containment/anchoring difference, not one isolated height token. Also, do not reduce Proposal's current Forge toolbar to only `.dasti-document-rail`: Proposal combines older lifted output rail machinery with the newer `ProposalDocumentStage` / `.dasti-proposal-skeleton-stage__bar` stage toolbar path.

1. **CV toolbar is inside the padded workbench surface.**  
   `.dasti-cv-skeleton-forge` contributes top padding before the stage bar appears. Proposal's rail is lifted above the output shell instead of participating in the normal vertical stack.

2. **CV stacks toolbar, banners, and document content in normal flow.**  
   `.dasti-cv-skeleton-forge__stage` has a vertical gap and `CvStageBar` remains a row in the grid. Proposal treats the rail as chrome positioned against the document shell.

3. **CV has duplicate/localized toolbar slots below the global stage bar.**  
   Edit and preview modes add their own top-left slots and padding, especially `.dasti-cv-edit-workbench-shell .dasti-grid-split` and `.dasti-workbench-top-left-slot--cv-*`. These keep the visual controls below the Proposal-style page edge.

4. **CV toolbar is still content-heavy.**  
   `CvStageBar` includes status, ATS, tone, mode labels, version history, pick resume, import CV, new CV, and share. It can wrap or scroll at breakpoints. Proposal's toolbar is closer to a compact icon/cluster rail.

## Why Proposal's rail/panel/header can appear taller even while it sits higher

The Proposal rail uses compact controls, but some clusters/panels such as style/inspector affordances may visually look taller because they are enclosed in a polished frosted shell with control padding and consistent `--hs` minimums. That apparent height is intentional chrome density; its top edge is still lifted and aligned to the document shell. CV's issue is different: its toolbar may be comparable in intrinsic block size, but it starts lower because it lives inside the padded skeleton/workbench flow.

## CV elements that already match or are close

- CV has already adopted several Proposal chrome tokens:
  - `--proposal-chrome-shell-padding`
  - `--proposal-chrome-toolbar-border`
  - `--proposal-chrome-toolbar-bg`
  - `--proposal-chrome-control-*`
  - `--proposal-chrome-tight-gap`
- CV already has icon-only edit/preview toggle styles in `.dasti-cv-workbench-toggle` and `.dasti-cv-workbench-toggle__button`.
- CV preview shell already removes some old document-frame chrome in `.dasti-cv-page-preview-stage .dasti-doc-viewer-shell--resume-panel` and `.dasti-cv-paper-stage .dasti-doc-viewer-shell--resume-panel`.
- `CvRail` already owns section organization, AI, style, and `Import PDF`; it is the natural destination for additional create/import actions.

## Remaining parity work, no-code plan

### 1. Make the CV toolbar page/rail-derived instead of skeleton-derived

Target: one-line CV toolbar behaves like Proposal's document rail.

Audit target changes for implementation later:

- Reduce `.dasti-cv-skeleton-forge` top chrome or decouple toolbar placement from skeleton padding.
- Consider a CV-local equivalent of Proposal's toolbar lift for the document workbench shell.
- Ensure the toolbar aligns to the CV paper/workbench boundary, not to the outer skeleton card.
- Avoid moving document scroll ownership unless a browser probe proves it is necessary.

### 2. Move creation/import actions out of the toolbar

Target: keep toolbar compact and move document-management actions into the rail/panel.

Current toolbar actions in `CvStageBar.tsx`:

- `Pick resume`
- `Import CV`
- `New CV`
- `Share`

Recommended parity direction:

- Move `New CV` and `Import CV` into `CvRail` under an Add/Create section near `Import PDF`.
- Keep `Pick resume` either as a compact rail action or a small toolbar selector only if it remains one-line.
- Keep `Import PDF` in the rail and group it with `Import CV` rather than leaving import paths split across rail and toolbar.

### 3. Replace text mode toggle with Proposal-style icon pills

Current `CvStageBar` renders text buttons:

- `Edit`
- `Page preview`

Target:

- Use pencil-line and eye icon pill controls like Proposal Forge.
- Preserve accessible labels/tooltips.
- Keep selected state visible through icon pill styling, not large labels.

### 4. Hide visible Share label

Current `CvStageBar` share trigger renders icon + `Share` text.

Target:

- Icon-only share/export trigger in the toolbar.
- Preserve `aria-label` and tooltip text.
- Keep safe-send/export menu behavior unchanged.

### 5. Preserve or improve rail responsibilities

Current `CvRail.tsx` already has:

- Sections tab with Add section.
- AI tab.
- Style tab.
- Footer `Import PDF` action.

Target:

- Add a clear rail/panel area for CV document actions: New CV, Import CV, Import PDF.
- Keep section editing actions in the Sections tab.
- Avoid turning the rail into a second toolbar; group actions by user intent.

### 6. Align CV rail tab visual grammar with Proposal

Target: CV rail tabs should feel like the same system as Proposal rail controls.

- Adopt Proposal rail tab visual grammar: pill shell, active raised surface, same border/background/shadow token family.
- Keep CV labels as `Sections`, `Ask`, and `Style`.
- Do not force Proposal's four-tab structure onto CV Forge; parity is visual/behavioral grammar, not identical information architecture.

### 7. Verify responsive behavior before implementation is accepted

Responsive risks to check later in browser/Playwright:

- Toolbar remains one line at desktop widths comparable to Proposal Forge.
- At narrow widths, toolbar collapse/wrap behavior is intentional and does not obscure the document.
- CV currently collapses the rail/skeleton to one column around `900px`; this may be too late or too early depending on the actual paper width. Proposal's recent lesson was page-first breakpoints, so CV should be measured rather than copied to a blind breakpoint.
- Rail collapse or single-column behavior still leaves create/import actions reachable.
- Edit and preview modes keep controls aligned to the same page/workbench boundary.
- No regressions to import review, export PDF/DOCX, or section editor flows.

## Proposed acceptance criteria for implementation

- CV Forge toolbar visually aligns to the document/paper boundary in both edit and preview modes.
- Desktop CV toolbar fits one line with compact controls.
- `New CV` and `Import CV` no longer occupy primary toolbar width.
- `Import CV` and `Import PDF` are discoverable together in the rail/panel.
- CV rail tabs use Proposal-like pill/raised-active visual grammar while keeping CV-specific labels: `Sections`, `Ask`, `Style`.
- Edit/preview mode switch uses icon pill controls with accessible labels/tooltips.
- Share/export is icon-only in the toolbar, with label moved to tooltip/menu accessibility.
- CV rail breakpoint is validated from measured page/paper geometry, not copied blindly from Proposal or the current `900px` rule.
- Proposal Forge behavior remains unchanged.

## Verification recommendation

When implementation is approved, use a rendered browser probe rather than CSS review alone:

1. Measure CV paper/workbench left/top and toolbar left/top at desktop width.
2. Compare against Proposal Forge measurements at the same viewport.
3. Repeat in edit and preview modes.
4. Repeat around the current CV `900px` rail breakpoint, any proposed replacement breakpoint, and a narrow mobile width.
5. Confirm the rail breakpoint preserves page-first geometry and keeps document actions reachable.
6. Run TypeScript and focused CV/Proposal tests if available.

## Non-goals

- No parser/import pipeline changes.
- No export model or Convex changes.
- No Proposal Forge changes unless a shared token regression is discovered.
- No broad rewrite of CV Forge layout before a small CSS/component pass is proven insufficient.
