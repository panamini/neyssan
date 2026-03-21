# 2026-03-20 Menu Option Item Semantics

## Context
- `ProposalInputForm` repeats the same dropdown-option shell for `Type` and `Tone`.
- The visual language is already stable, but still duplicated inline.

## Decision
Add a small semantic family in `globals.css`:
- `.dasti-menu-option`
- `.dasti-menu-option__title`
- `.dasti-menu-option__description`

These classes define only the reusable menu-option shell and text rhythm, using existing tokens.

## Initial Adoption
- `ProposalInputForm.tsx`

## Follow-up
If later needed, other contextual menus can reuse this pattern, but dropdown lists and full selection cards should remain separate families.
