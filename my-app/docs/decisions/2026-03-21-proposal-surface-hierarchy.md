# Proposal Surface Hierarchy

Date: 2026-03-21

## Decision

For `Proposal Forge`, keep at most 3 large neutral surfaces visible at once:

1. `--bg`
   - page canvas / outer app background
2. `--sfr`
   - raised panel shell (`Job Offer`, `Draft`, `Saved` container cards)
3. `--sf1`
   - document well / editable reading surface (`Job Title`, compose sheet, generated draft sheet, saved editable draft, loading skeleton well)

`--sf2` stays interactive and local:
- hover
- active
- chips
- subtle emphasis
- shimmer highlight band

## Why

Too many competing large-surface grays increase cognitive noise and make hierarchy harder to parse, especially in dark mode.

This 3-step hierarchy keeps the screen legible:
- outer canvas
- panel
- document well

It also matches the desired behavior of premium writing tools more closely than a flat stack of near-identical grays.

## Application

- `ProposalInputForm` shell and toolbar align with the document well hierarchy
- `ProposalDisplay` uses the same well as the compose surface
- `Saved draft` uses the same document well
- shimmer/loading states stay inside the same well instead of introducing a fourth major gray
