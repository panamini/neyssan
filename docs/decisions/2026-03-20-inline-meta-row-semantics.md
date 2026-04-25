# 2026-03-20 Inline Meta Row Semantics

## Context
- Small metadata lines were repeated across libraries, proposal detail, and sidebar rows.
- The same treatment kept reappearing with slightly different inline values for:
  - `font-size`
  - muted color choice
  - line-height
  - truncation
  - inline horizontal spacing

## Decision
Add a small semantic family in `globals.css`:
- `.dasti-meta-row`
- `.dasti-meta-row--subtle`
- `.dasti-meta-row--tight`
- `.dasti-meta-row--truncate`
- `.dasti-meta-row--inline`

These classes normalize the shared base while still allowing local overrides where needed.

## Initial Adoption
- `CvsLibrary.tsx`
- `ProposalsLibrary.tsx`
- `ProposalsList.tsx`
- `Sidebar.tsx`

## Follow-up
Use the same family later for additional doc metadata and lightweight note rows, but not for full body copy or badges.
