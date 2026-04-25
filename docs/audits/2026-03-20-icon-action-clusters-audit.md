# 2026-03-20 Icon Action Clusters Audit

## Scope
- active code only
- wrappers and spacing of compact icon action groups
- excludes the individual button token logic itself

## Findings

### Active code
- `ProposalsList.tsx` repeats compact icon rows and a divider inline.
- `CvsLibrary.tsx` and `ProposalsLibrary.tsx` repeat the same compact confirm tray shell inline.
- `SectionEditor.tsx` repeats tight icon header clusters inline.
- `Sidebar.tsx` uses a flush action tray that is structurally the same pattern, with an additional local mask effect.

## Recommendation
Add a small semantic family for:
- base icon cluster
- tight variant
- flush variant
- divider
- compact confirm tray

Keep the icon-button colors and destructive hierarchy on the existing button tokens and local logic.
