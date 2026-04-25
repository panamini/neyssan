# 2026-03-20 Surface Panel Shells Audit

## Scope
- active code only
- neutral panel/card shells
- excludes interactive library cards and modal shells

## Findings

### Active code
- `ProposalForge.tsx` repeats a neutral panel shell for compose/output panels.
- `ProposalsList.tsx` repeats the same neutral panel shell for metadata/content panels.
- `StyleForge.tsx` defines a very similar section-card shell locally.

### Recommendation
Create a small semantic surface-panel shell in `globals.css` and adopt it first on:
- `ProposalForge.tsx`
- `ProposalsList.tsx`
- `StyleForge.tsx`

Keep local headers, body rhythm, and overflow behavior as local overrides.
