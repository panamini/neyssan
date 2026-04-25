# 2026-03-20 Selection Cards Audit

## Scope
- active code only
- focus on true selectable cards, not dropdown menu items

## Findings

### Active code
- `StyleForge.tsx` has two repeated selectable card shells: Layout options and Typography options.
- Both use the same visual logic: neutral card, active surface, subtle border, right-side check, left-aligned content stack.
- Their shell styling is still inline and duplicated.

### Not in this pass
- `ProposalInputForm.tsx` tone/type dropdown items are menu options, not full selection cards.
- `Colors` palette in `StyleForge` is a different interaction pattern.

## Recommendation
Introduce a small semantic selection-card family in `globals.css` and adopt it in `StyleForge` first:
- shell
- active state
- content stack
- title/subtitle

Keep preview internals and typography-specific text styles local.
