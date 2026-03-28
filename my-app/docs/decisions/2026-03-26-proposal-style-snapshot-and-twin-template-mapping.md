# Decision: Proposal Style Snapshot And Twin Template Mapping
Date: 2026-03-26

## Status
- Implemented

## Context
- Resume rendering already had an authoritative `verbatiStyle` preset with palette and typography families.
- Proposal rendering only persisted `templateId`, which meant saved proposals could not keep their own paper/color/font identity.
- The proposal preview in Style Forge looked detached because it was not reading the same theme pipeline as the resume preview.

## Decision
- Proposal templates are now organized as proposal-specific twins of the resume layouts.
- Keep layout and style as separate but linked concerns:
  - `templateId` owns proposal document geometry.
  - `verbatiStyle` owns typography families, palette, and paper/ink theme variables.
- Persist `verbatiStyle` in two places:
  - local proposal output draft for live cross-page preview
  - saved proposal metadata for historical rendering fidelity
- Normalize legacy proposal template ids into the new twin template ids at read time instead of doing a destructive migration first.
- Make the proposal paper token derive from the same calm tinted canvas family as the resume theme, with the dark-mode black-paper override preserved.

## Rationale
- This keeps the implementation small and reversible.
- It reuses the existing Style Forge source of truth instead of creating a second styling system for proposals.
- It lets proposals keep their own appearance after the user later changes the CV style.
- It fixes the white/flat render symptom by removing the dependency on generic app paper tokens.

## Consequences
- Proposal rendering is now style-linked end-to-end: picker, runtime draft, saved metadata, renderer, and library views.
- Old proposals with legacy template ids still render because ids are normalized on read.
- Old proposals without a saved `verbatiStyle` snapshot fall back to the default Verbati style until they are regenerated or resaved.
