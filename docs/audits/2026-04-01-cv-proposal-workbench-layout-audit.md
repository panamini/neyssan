# CV Forge / Proposal Forge Workbench Audit

Date: 2026-04-01

## Scope

- Active routes only.
- Evidence sources:
  - `src/App.tsx`
  - `src/pages/CvForge.tsx`
  - `src/pages/ProposalForge.tsx`
  - live imported components on those paths
  - git history on the touched files
  - user screenshots supplied on 2026-04-01
- Non-authoritative by default:
  - `ProposalForgeNext.tsx`
  - archive / backup / `.bak` paths
  - any CSS not referenced by the live route tree

## Active Render Path

### Active code

- App shell: `src/App.tsx`
  - `AppShell -> Sidebar -> Topbar -> Routes`
  - live routes are `/cv` and `/proposal`
- CV Forge: `src/pages/CvForge.tsx`
  - edit mode: `ProfileReviewCard + VerbatiCvPreviewPanel`
  - preview mode: `VerbatiCvPreviewPanel` in workspace host mode
- Proposal Forge: `src/pages/ProposalForge.tsx`
  - workbench composition is owned directly here
  - preview/output pane is owned by `src/components/ProposalDisplay.tsx`
  - compose chrome is owned by `src/components/ProposalComposeToolbar.tsx`
- CV preview stage: `src/features/verbati/VerbatiResumePreview.tsx`
- Shared shell / workbench CSS:
  - `src/styles/product.css`
  - `src/styles/utilities.css`

### Legacy but informative code

- `src/pages/ProposalForgeNext.tsx`
  - useful only as comparison for prior workspace layout ideas
  - not imported by `App.tsx`

### Obsolete / dead for this audit

- archive / backup trees
- `.bak` files
- any parser / pdf-ingest legacy code

## Git Evidence

- `96ff9a49 Fix proposal and CV workspace toolbar/stage regressions`
  - introduced the shared A4 stage behavior that is still authoritative
- `8c891236 Polish proposal workbench chrome and saved view`
  - introduced the proposal chrome/layout changes that caused the current toolbar stretch regressions
- `debb740b Polish saved proposal chrome layout`
  - saved-view only, not the root cause of the workspace shell issues

## Findings

### 1. Proposal toolbar stretch and copy-drop root cause

The winning March 31 CSS made the proposal toolbar behave like a full-width flex shell instead of a content-sized control cluster.

Relevant winning rules before the fix:

- `.dasti-forge-compose-toolbar-slot { width: 100%; flex: 1 1 auto; }`
- `.dasti-forge-compose-toolbar-slot .dasti-compose-toolbar { width: 100%; }`
- `.dasti-compose-toolbar__bar { width: fit-content; }` but overridden by the descendant rule above
- `.dasti-compose-toolbar__group--cv { flex: 1 1 auto; max-inline-size: none; }`
- `.dasti-document-rail { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }`
- `.dasti-proposal-sheet__controls { flex-wrap: wrap; }`

Effect:

- left toolbar chrome stretched horizontally
- right-side copy/actions were no longer isolated from left-side growth
- copy/action controls could wrap or visually drop under pressure

This aligns with the supplied proposal screenshots showing an oversized left shell and unstable right action positioning.

### 2. Proposal preview zoom behavior root cause

`ProposalDisplay.tsx` was using a single zoom index tied to fit-width geometry, but the control surface only exposed "fit page" plus plus/minus icons.

Before the fix:

- no explicit `fit width / 100% / fit page` state
- desktop default effectively behaved like fitted preview rather than readable editor view
- viewport centering used `defaultCenterX: 0.5`

Effect:

- preview defaulted toward centered, thumbnail-like framing
- large document content could re-center rather than stay top-left anchored
- chrome and content scaling were coupled too loosely

### 3. CV workspace preview root cause

`VerbatiResumePreview.tsx` used:

- `fitMode: isWorkspaceMode ? "contain" : "width"`
- centered viewport defaults from the shared centering hook

Effect:

- workspace preview opened in overview / thumbnail mode
- imported CV pages could appear centered or clipped in a way that matched the supplied CV screenshots
- desktop readability suffered because the page was shrunk first

### 4. Very narrow mobile sidebar root cause

The live sidebar never left layout. It only switched to:

- `sb--forced-collapsed`
- width `var(--app-sidebar-width-collapsed-mobile)`

Effect:

- the left rail still consumed width on very narrow mobile
- mobile workbench content was squeezed even though the sidebar was visually reduced

This is visible in the supplied mobile screenshots where the rail is still present and still affects the content column.

## Minimal Fix Set Applied

### Layout / chrome

- restored content-sized proposal compose toolbar behavior
- made the document rail explicitly `left controls / flexible spacer / right actions`
- pinned right actions with `max-content` end-column behavior
- prevented action cluster wrapping

### Preview / zoom

- added explicit preview zoom modes in `ProposalDisplay`:
  - `Fit width`
  - `100%`
  - `Fit page`
  - manual zoom via `+/-`
- changed proposal preview anchoring to top-left for workspace-style preview
- changed stage overflow behavior so oversized content overflows inside the preview stage rather than resizing the shell

### CV workspace preview

- added the same explicit zoom mode model to `VerbatiResumePreview`
- changed workspace default from overview/contain to readable editor-style behavior
- forced narrow mobile back to fit-width
- top-left anchored workspace centering

### Very narrow mobile

- sidebar now fully returns `null` below 480px viewport width
- no hidden rail remains in layout at that breakpoint

## Verification

### Verified by tests

- proposal draft restore remains intact
- proposal brief collapse/reopen remains intact
- proposal workspace toolbar still routes external tone/CV controls correctly
- proposal preview path remains top-anchored
- CV workspace preview still renders through the live workspace stage
- very narrow mobile sidebar removal is covered

Focused test command:

`npm test -- src/pages/__tests__/ProposalForge.workspace-toolbar.test.tsx src/components/__tests__/Sidebar.proposal-navigation.test.tsx src/components/__tests__/ProposalDisplay.stage.test.tsx src/features/verbati/__tests__/VerbatiResumePreview.test.tsx src/pages/__tests__/ProposalForge.brief-card.test.tsx src/pages/__tests__/ProposalForge.draft-persistence.test.tsx`

### Verified by code + screenshot evidence

- sidebar fixed-width regression source identified in live shell
- proposal toolbar stretch traced to winning CSS from `8c891236`
- copy action row instability traced to rail/grid plus wrapping controls
- preview top-left anchoring and fit-mode mismatch identified in live JS/CSS
- CV workspace overview behavior traced to `fitMode: "contain"` in active code

### Not fully verified

- full post-fix runtime visual confirmation in a live browser session

Reason:

- starting the local Vite frontend for manual runtime verification was denied in this session
- user supplied screenshots were used instead for visual evidence

## Final Assessment

The root causes were in the live route path, not in dead code:

- proposal chrome regression from full-width toolbar rules
- missing explicit zoom modes in the shared proposal preview
- CV workspace using overview fit mode instead of editor fit behavior
- mobile sidebar still participating in layout

The fix set stays local to the active workbench path and does not rewrite the architecture.
