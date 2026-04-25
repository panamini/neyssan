# 2026-03-20 Selection Card Semantics

## Context
- `StyleForge` had repeated selectable-card shells for `Layout` and `Typography`.
- The interaction model was already stable, but the shell styling was duplicated inline.
- Preview internals and typography-specific title styles still need to stay local.

## Decision
Add a small semantic selection-card family in `globals.css`:
- `.dasti-selection-card`
- `.dasti-selection-card--active`
- `.dasti-selection-card__stack`
- `.dasti-selection-card__stack--airy`
- `.dasti-selection-card__title`
- `.dasti-selection-card__subtitle`

These classes define only the reusable shell and text rhythm:
- padding: `--s3`
- base gap: `--s3`
- active background: `--sf2`
- active border: `--bm`
- neutral border: `--bo`

## Initial Adoption
- `StyleForge.tsx`
  - `Layout` options
  - `Typography` options

## Follow-up
Later passes can evaluate whether other interactive option groups should use this family, but dropdown menu items are intentionally excluded from this first adoption.
