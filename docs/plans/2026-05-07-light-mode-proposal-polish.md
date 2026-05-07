# Proposal workspace geometry polish plan

Date: 2026-05-07
Scope: active `v1` Proposal Forge geometry only.

## Confirmed active code

- `my-app/src/pages/ProposalForge.tsx` owns the live Proposal Forge grid, the current two-pane breakpoint constant, the `liveOutputFrameInlineSize` measurement loop, and `proposalWorkspaceOutputShellInlineSize`.
- `my-app/src/styles/product-proposal.css` owns `.dasti-proposal-skeleton-forge`, `.dasti-proposal-skeleton-stage`, and `.dasti-proposal-skeleton-rail`.
- `ProposalDocumentStage.tsx` owns the stage bar/status chrome, so this pass should not try to solve geometry there.

## Primary bug

The Proposal workspace still treats the page stage as leftover `1fr` space, while the rail also carries extra gutter behavior. That squeezes the page too early and risks a width feedback loop if the measured frame is reused for the grid.

## Approach

- Keep the document/page as the layout authority.
- Use `--forge-page-inline-size` as the stage authority.
- Keep `liveOutputFrameInlineSize` only in the existing output-shell sizing path; do not feed it back into the grid unless browser evidence proves it stable.
- Make the collapse breakpoint a named constant in `ProposalForge.tsx` and match CSS exactly.
- Use grid gap only for between-column spacing.
- Center the whole grid group, not the rail itself.
- Keep this pass Proposal-local. If browser evidence forces a shared CSS token change, stop and re-open the plan before touching shared styles.

## Out of scope for this pass

- No `foundation.css`, `base.css`, `ds-v2.css`, `App.tsx`, or `ProposalDisplay.tsx` edits.
- No CV Forge layout edits unless a shared CSS dependency is proven.
- No badge/pill rework in this pass.

## Files to modify

- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/styles/product-proposal.css`

## Steps

- [x] Introduce `const proposalTwoPaneMinViewportWidth = 1420;` in `ProposalForge.tsx` with a short comment tying it to page width + rail width + grid gap + page padding. Browser measurement showed `1320` still squeezed the stage at 1360px.
- [ ] Add Proposal-local geometry vars in the grid style object:
  - `--proposal-workspace-stage-inline-size: var(--forge-page-inline-size)`
  - `--proposal-workspace-rail-inline-size: 360px`
- [ ] Update the two-pane grid to:
  `minmax(0, var(--proposal-workspace-stage-inline-size)) var(--proposal-workspace-rail-inline-size)`
  and keep the live measurement out of that grid contract.
- [ ] Keep `liveOutputFrameInlineSize` feeding `proposalWorkspaceOutputShellInlineSize` only.
- [ ] In `product-proposal.css`, replace the rail hardcode with `var(--proposal-workspace-rail-inline-size)`, remove `margin-inline-end` and any self-offsetting rail alignment such as `justify-self: end`, and let `gap` / `--grid-gap` own spacing.
- [ ] Center the `.dasti-proposal-skeleton-forge` grid group in two-pane mode (`--grid-justify: center` or equivalent); do not center or offset `.dasti-proposal-skeleton-rail` independently.
- [x] Match the collapse CSS exactly to the JS constant: `@media (max-width: 1419px)`.
- [ ] Preserve the current single-column fallback ordering for narrow viewports.
- [ ] Verify no Proposal layout browser regressions at 1440, 1360, 1280, 1180, and 1024.
- [ ] If any shared CSS file becomes necessary, add a CV Forge smoke check before committing; otherwise keep CV verification smoke-only.

## Verification

- Browser measure at 1440 / 1360 / 1280 / 1180 / 1024.
- Run the focused Proposal Forge workspace/stage tests that cover the active geometry surface.
- Toolbar right edge stays inside the page column.
- Document width remains readable until the breakpoint collapse.
- Rail spacing is gap-only; no extra margin remains.
- JS and CSS breakpoint values match exactly.
- CV Forge gets only a smoke check unless shared CSS changes.
