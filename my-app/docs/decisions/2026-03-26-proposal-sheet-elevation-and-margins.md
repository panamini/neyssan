# Proposal Sheet Elevation And Margins

Date: 2026-03-26

## Status

Accepted

## Scope

Active code:

- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalInputForm.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/hooks/use-scroll-edge-fades.ts`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/foundation.css`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css`

Legacy but informative:

- historical proposal-sheet shadow variants from earlier `product.css` revisions

Obsolete / non-authoritative:

- backup trees, `*.bak`, archived component copies

## Decision

Proposal documents are treated as flat bordered reading surfaces, not raised cards.

We separate two concerns:

1. Surface elevation
   Proposal sheets stay on the default surface plane with a border. They do not get decorative top and bottom drop shadows.

2. Overflow affordance
   Overflow cues only appear when content is actually clipped:
   - bottom fade plus subtle bottom shadow when more content exists below
   - top fade only after the user has scrolled and content exists above

This removes the previous mismatch where the compose sheet suggested depth at the bottom while the generated output suggested depth at the top.

## Margin Canon

The document text frame now follows the requested paper-like hierarchy:

- inner inline margin: `2` units
- top margin: `3` units
- outer inline margin: `4` units
- bottom margin: `6` units

These are encoded as:

- `--proposal-sheet-margin-inline-inner`
- `--proposal-sheet-margin-block-start`
- `--proposal-sheet-margin-inline-outer`
- `--proposal-sheet-margin-block-end`

## Why

The current guidance from major design systems is consistent on this point:

- Atlassian distinguishes normal elevation from `overflow` shadows and reserves overflow shadows for scrolled content rather than for general card decoration.
- Carbon treats tiles and cards on the page plane as flat surfaces and explicitly warns against adding drop shadows when border and spacing are sufficient.

For proposal reading surfaces, this gives the right balance:

- not cold or sterile, because clipped text still gets a soft reading affordance
- not over-designed, because depth is not faked where there is no real elevation change

## Sources

- Atlassian Elevation: <https://atlassian.design/foundations/elevation/>
- Carbon Tile usage: <https://carbondesignsystem.com/components/tile/usage/>
