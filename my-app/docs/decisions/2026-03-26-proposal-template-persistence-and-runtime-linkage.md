# Decision: Proposal Template Persistence And Runtime Linkage
Date: 2026-03-26

## Status
- Implemented

## Context
- Proposal voice preset already persists as a user default in `proposalSettings`.
- Generated proposal output already exists, but its render shell had no template identity.
- Style Forge needed to control proposals without creating a fake disconnected preview system.

## Decision
- Store the active proposal template default in `userProfiles.proposalTemplateId` and expose it through `proposalSettings`.
- Stamp the selected template id onto each proposal row via `proposals.metadata.templateId`.
- Keep the Style Forge render-mode toggle in browser storage only.
- Use the existing local proposal output draft as the live unsaved preview bridge for Style Forge.
- Persist the template picker with the active `voicePreset` as well, so template changes remain valid during Convex hot-reload windows or stale validator bundles.
- Keep template spacing in millimetre intent, but convert that intent against the A4 page ratio inside the scaled preview sheet so 35 mm, 52 mm, and 18 mm document margins stay proportionally correct at runtime.

## Rationale
- User-level template state makes the proposal renderer reactive across Proposal Forge and Style Forge.
- Proposal-level template metadata preserves historical rendering for saved proposals when the user later changes the default.
- Browser-only persistence is sufficient for the Style Forge mode switch because it is UI context, not proposal content.
- Reusing the existing draft storage avoids a rewrite or a new server-side draft model.

## Consequences
- Proposal templates now have an end-to-end contract: picker, state, persistence, renderer mapping, and output rendering.
- Saved proposals remain visually stable even after the default template changes.
- Existing proposals without stamped metadata fall back to the default template until they are regenerated or resaved.
- Proposal body measure now stays capped around 64 characters with an explicit 18 mm right margin and 10.5 pt to 11.5 pt body sizing, which keeps the letter renderer inside the requested editorial reading band.
