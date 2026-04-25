# 2026-03-20 Surface Panel Shell Semantics

## Context
- Several active pages repeat the same neutral shell for surface panels:
  - border radius
  - border
  - background
  - shadow
  - grid display with gap
- The shell is stable, but still duplicated inline.

## Decision
Add a small semantic panel shell family in `globals.css`:
- `.dasti-surface-panel`
- `.dasti-surface-panel--spacious`

These classes define only the neutral shell. Padding, overflow, and local section rhythm can still be overridden per surface.

## Initial Adoption
- `ProposalForge.tsx`
- `ProposalsList.tsx`
- `StyleForge.tsx`

## Follow-up
If later needed, add a distinct family for interactive library cards instead of overloading the neutral panel shell.
