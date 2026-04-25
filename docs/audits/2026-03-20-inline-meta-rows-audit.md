# 2026-03-20 Inline Meta Rows Audit

## Scope
- active code only
- small metadata rows and snippets
- excludes badges, major body copy, and selection-card content stacks

## Findings

### Active code
- `CvsLibrary.tsx` repeats identity and snippet meta styling inline.
- `ProposalsLibrary.tsx` repeats muted snippet styling inline.
- `ProposalsList.tsx` repeats compact muted rows for date, tone, and fallback disclosure.
- `Sidebar.tsx` repeats compact document meta rows with inline spacing and muted color.

## Recommendation
Introduce a lightweight semantic family for inline metadata rows:
- base muted row
- subtler row
- tighter row
- truncation helper
- inline helper

Apply it first to the most repeated and visible metadata surfaces before touching deeper component-local detail.
