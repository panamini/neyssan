# 2026-03-20 Menu Option Items Audit

## Scope
- active code only
- dropdown menu items with title + description

## Findings

### Active code
- `ProposalInputForm.tsx` has two repeated dropdown item patterns:
  - proposal type options
  - tone options
- Both use the same shell and the same title/description rhythm, but everything is inline.

## Recommendation
Create a semantic menu option family for:
- shell
- title
- description

Adopt it first in `ProposalInputForm.tsx`.
