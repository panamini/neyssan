# 2026-03-20 Title/Subtitle Stacks Audit

## Scope
- active code only
- focus on page-level and intro-panel title/subtitle stacks
- excludes selection cards, inline meta rows, and card content stacks for later passes

## Findings

### Active code
- `CvsLibrary.tsx` and `ProposalsLibrary.tsx` each define the page header eyebrow and title inline.
- `ProposalForge.tsx` defines the intro eyebrow, title, and description inline.
- Modal title/subtitle stacks are already centralized in `globals.css` via `.dasti-modal-title` and `.dasti-modal-subtitle`.

### Legacy but informative
- `StyleForge.tsx` contains local title/description treatment for option cards, but that belongs to the future `selection cards` pass rather than a global page-stack pass.

## Recommendation
Create a small semantic family in `globals.css` for:
- page and panel stack wrapper
- eyebrow
- title
- subtitle

Then apply it first to:
- `CvsLibrary.tsx`
- `ProposalsLibrary.tsx`
- `ProposalForge.tsx`

This keeps the change small and lets later passes build on a shared vertical rhythm.
