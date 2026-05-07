# Proposal workspace geometry polish plan

Date: 2026-05-07
Scope: active `v1` Proposal Forge geometry only.

## Confirmed active code

- `my-app/src/pages/ProposalForge.tsx` owns the live Proposal Forge grid, the current two-pane breakpoint constant, the `liveOutputFrameInlineSize` measurement loop, and `proposalWorkspaceOutputShellInlineSize`.
- `my-app/src/styles/product-proposal.css` owns `.dasti-proposal-skeleton-forge`, `.dasti-proposal-skeleton-stage`, and `.dasti-proposal-skeleton-rail`.
- `ProposalDocumentStage.tsx` owns the stage bar/status chrome. Primary implementation should target existing classes from CSS, but this file is allowed only if existing markup/classes cannot support clean responsive grouping.

## Primary bug

The Proposal workspace still treats the page stage as leftover `1fr` space, while the rail also carries extra gutter behavior. That squeezes the page too early and risks a width feedback loop if the measured frame is reused for the grid.

A second UX issue is toolbar compression: the action cluster should stay on one line as long as possible, and the share action should not be the first thing pushed to a second line.

## Approach

- Keep the document/page as the layout authority.
- Use `--forge-page-inline-size` as the stage authority.
- Keep `liveOutputFrameInlineSize` only in the existing output-shell sizing path; do not feed it back into the grid unless browser evidence proves it stable.
- Make the collapse breakpoint a named constant in `ProposalForge.tsx` and match CSS exactly.
- Use grid gap only for between-column spacing.
- Center the whole grid group, not the rail itself.
- Keep the toolbar single-line longer than the rail collapse threshold; if needed, prefer compacting lower-priority controls before allowing the share action to wrap.
- Keep this pass Proposal-local. If browser evidence forces a shared CSS token change, stop and re-open the plan before touching shared styles.

## Out of scope for this pass

- No `foundation.css`, `base.css`, `ds-v2.css`, `App.tsx`, or `ProposalDisplay.tsx` edits.
- No CV Forge layout edits unless a shared CSS dependency is proven.
- No badge/pill rework in this pass.
- No behavior changes inside `ProposalDocumentStage.tsx`; only class/structure support for responsive grouping if CSS cannot target existing groups cleanly.

## Files to modify

Primary files:

- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/styles/product-proposal.css`

Allowed fallback only if CSS cannot target the toolbar groups cleanly:

- `my-app/src/components/proposal/ProposalDocumentStage.tsx` — class/structure support only, no behavior changes.

## Steps

- [x] Introduce `const proposalTwoPaneMinViewportWidth = 1420;` in `ProposalForge.tsx` with a short comment tying it to page width + rail width + grid gap + page padding. Browser measurement showed `1320` still squeezed the stage at 1360px.
- [x] Add Proposal-local geometry vars in the grid style object:
  - `--proposal-workspace-stage-inline-size: var(--forge-page-inline-size)`
  - `--proposal-workspace-rail-inline-size: 360px`
- [x] Update the two-pane grid to:
  `minmax(0, var(--proposal-workspace-stage-inline-size)) var(--proposal-workspace-rail-inline-size)`
  and keep the live measurement out of that grid contract.
- [x] Keep `liveOutputFrameInlineSize` feeding `proposalWorkspaceOutputShellInlineSize` only.
- [x] In `product-proposal.css`, replace the rail hardcode with `var(--proposal-workspace-rail-inline-size)`, remove `margin-inline-end` and any self-offsetting rail alignment such as `justify-self: end`, and let `gap` / `--grid-gap` own spacing.
- [x] Center the `.dasti-proposal-skeleton-forge` grid group in two-pane mode (`--grid-justify: center` or equivalent); do not center or offset `.dasti-proposal-skeleton-rail` independently.
- [x] Match the collapse CSS exactly to the JS constant: `@media (max-width: 1419px)`.
- [x] Preserve the current single-column fallback ordering for narrow viewports.
- [x] Add a no-wrap toolbar policy for the Proposal stage bar so icons stay on one line until the rail has already collapsed; first target existing `dasti-proposal-skeleton-stage__bar`, `__actions`, spacer, and menu trigger classes from CSS. Touch `ProposalDocumentStage.tsx` only if extra class hooks are required.
- [x] Keep the rail collapse earlier than toolbar wrap pressure so the page loses space later than the chrome.
- [x] Verify no Proposal layout browser regressions at 1440, 1360, 1280, 1180, and 1024.
- [x] If any shared CSS file becomes necessary, add a CV Forge smoke check before committing; otherwise keep CV verification smoke-only.

## Verification

- Browser measure at 1440 / 1360 / 1280 / 1180 / 1024.
- Run the focused Proposal Forge workspace/stage tests that cover the active geometry surface.
- Toolbar never overlaps the rail column, and share remains on the primary row until single-column mode.
- Document width remains readable until the breakpoint collapse.
- Rail spacing is gap-only; no extra margin remains.
- JS and CSS breakpoint values match exactly.
- CV Forge gets only a smoke check unless shared CSS changes.
