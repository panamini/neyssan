# 2026-03-20 Icon Action Cluster Semantics

## Context
- Small icon-action groups were already visually close, but their wrappers stayed inline and duplicated.
- The repeated patterns were:
  - compact icon rows
  - tighter header icon rows
  - divider inside an icon row
  - compact icon confirm trays

## Decision
Add a small semantic family in `globals.css`:
- `.dasti-icon-cluster`
- `.dasti-icon-cluster--tight`
- `.dasti-icon-cluster--flush`
- `.dasti-icon-cluster__divider`
- `.dasti-icon-confirm-tray`
- `.dasti-icon-confirm-tray__label`

This pass standardizes only the cluster shell. Individual button colors and states stay local or on existing button classes.

## Initial Adoption
- `ProposalsList.tsx`
- `CvsLibrary.tsx`
- `ProposalsLibrary.tsx`
- `SectionEditor.tsx`
- `Sidebar.tsx`

## Follow-up
If later needed, convert repeated overlay delete triggers to their own semantic class, but keep that separate from cluster wrappers.
