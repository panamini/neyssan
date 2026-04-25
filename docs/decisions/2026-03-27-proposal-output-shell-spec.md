# Proposal Output Shell Spec

Date: 2026-03-27

## Status

Accepted

## Active Code

- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/proposal-render/ProposalDocumentRenderer.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/foundation.css`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/style.ts`

## Decision

The proposal style preset may style the proposal document, but it must not recolor the app shell around it.

This means the proposal render pipeline is split into two token layers:

1. App shell layer
   - Uses the normal Dasti surface, border, icon-button, and stage-card tokens.
   - Must match the technical cards around it in both light and dark mode.
   - Must not inherit proposal accent tinting on shell borders, backgrounds, or controls.

2. Proposal document layer
   - Uses proposal-specific typography and paper/ink tokens.
   - May inherit the selected Verbati twin style for:
     - heading family
     - body family
     - paper color
     - ink color
     - meta/accent ink
   - Must stay A4-driven and template-driven.

## Compose Output Expectations

- Generated proposal output in Proposal Forge should sit on the same compose rail width as the left input shell.
- The compose input shell and generated output shell should use the same outer height rhythm in the split compose view.
- The rendered proposal page remains the geometry master.
  - The document page itself stays DIN A4.
  - The viewer shell may add technical chrome, but must not redefine the page ratio.
  - Editable mode must live inside the same viewer shell contract instead of dictating a separate non-document card geometry.
- The viewer shell should use the shared document-viewer shell classes and app-level tokens.
- The compose output should remain a single document card.
- The proposal render remains the primary output after generation.
- Editing must be exposed through an explicit local document-mode toggle inside the document viewer controls, not through a detached page-level action.
- The compose output should always initialize in rendered preview mode on page load; edit mode is opt-in and must not persist across reloads.
- Zoom controls should float as an overlay inside the viewer shell and must not push the document stage downward.
- The approved zoom control pattern is a minimal dock:
  - `Fit`
  - `-`
  - `+`
- Zoom behavior must be anchor-preserving:
  - `+` and `-` keep the current focal area visible instead of recentering the page
  - after the user has panned, zoom must preserve that panned focus rather than snapping back to center
  - `Fit` is the only deliberate recenter action
- The document-mode control may use compact icons instead of full text labels:
  - `Eye` for rendered preview
  - `Pencil` for editable text
- In overlay/action-only compose contexts, the viewer controls are split:
  - mode toggle on the top-left
  - document actions on the top-right
  - zoom dock as a separate compact control in the same visual plane
- The document page, not the outer shell, is the A4 authority.
  - The true A4 ratio is the rendered page surface.
  - The technical viewer shell may keep quiet bleed/chrome around it.
- `Fit` means the entire page is visible without cropping.
  - `Fit` must consider both available width and available height.
  - `Fit` must not silently behave like width-fill if that would crop the page vertically.
- At `Fit`, the page should start centered inside the viewer.
  - Any leftover gutter is viewer chrome, not a second page ratio.
  - Edge-to-edge behavior is reserved for zoomed overflow states, not for `Fit`.
- Zoom state should not bleed between different surfaces.
  - Compose, saved proposal preview, and Style Forge preview must not reuse one another's stored zoom state on load.
- Document actions such as:
  - rendered/editable
  - copy
  - save
  - regenerate
  - delete
  - focus
  should live in a compact contextual capsule attached to the document viewer, not in the site header chrome.
- In dark mode:
  - shell/frame stays dark technical graphite
  - proposal paper stays light
  - proposal ink stays dark
  - header action icons use normal `dasti-icon-button` dark-mode colors, not white proposal-tinted surfaces
  - viewer shell chrome should read as a flat technical surface, not a lighter grey glow or slab under the page
- No accent-colored outer frame, no proposal-tinted chrome, no mixed light-shell/dark-frame state.
- The current compose-only focus/overview toggle is not the approved end state.
  - It should not behave like a pseudo document action.
  - The approved future replacement is a true split-pane collapse/expand chevron between input and output, not a second viewer mode.

## Style Forge / Saved Preview Expectations

- Style Forge and saved proposal previews use the same shell contract as compose output.
- Proposal template/twin selection styles the document, not the viewer chrome.
- Preview shell sizing may differ by layout context, but token ownership does not.
- The selected saved proposal should use the same single-card model as compose output.
- The selected saved proposal should default to the rendered state and expose the same local document-mode toggle.
- The selected saved proposal should expose the same zoom dock as compose output.
- Secondary saved proposal cards remain preview-only.

## Why

Applying the full Verbati UI theme object directly to `ProposalDisplay` caused proposal style presets to leak into:

- shell border color
- shell surface colors
- icon button surfaces
- header/meta UI colors

That produced false regressions such as:

- tinted or green outer frames
- white icon buttons in dark mode
- mismatched shell colors between resume and proposal
- dark/translucent proposal output states when shell and document tokens fought each other

## Implementation Rule

`ProposalDisplay` should consume a document-only proposal theme object, not the full Verbati UI theme object.

The approved helper for this is:

- `buildVerbatiProposalDocumentVars(...)` in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/style.ts`

The full UI helper:

- `buildVerbatiThemeVars(...)`

remains appropriate for resume preview contexts, but should not be used to recolor the proposal compose/saved/style-forge shell.
