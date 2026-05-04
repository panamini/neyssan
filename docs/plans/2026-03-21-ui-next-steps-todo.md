# UI Next Steps Todo

Date: 2026-03-21

## Done (latest)

- [x] Proposal Forge right-sheet preview/edit readability stabilized
- [x] Proposal controls polished (`pen` toggle, `send/stop`, hover states)
- [x] Proposal compose/output spacing and fade behavior tightened
- [x] Studio routing fixed to open the active CV deterministically (`/cv?id=...`)
- [x] Theme icon pass updated (`Moon` for dark mode)
- [x] Completed CV `/style` and `/cv` style-only persistence hardening with metadata patching + backend metadata merge safety.
- [x] Reworked `e2e/cvforge-preview-linking.spec.ts` to stabilize preview-mode selectors and close behavior around section-linking modals.

## Next Step (priority)

- [ ] Reconfirm cross-breakpoint `Proposal` visual QA (`desktop`, `tablet`, `mobile`) in both themes, then freeze styles.
  - Validate: same typography rhythm in preview/edit
  - Validate: bottom text alignment left/right sheets
  - Validate: fixed bottom fade visibility (subtle, no frost)
  - Validate: stacked-card alignment on mobile
  - Validate: compose toolbar and metadata band alignment

## Immediately After

- [ ] Add/refresh targeted UI regression tests for the stabilized `Proposal` flow:
  - mode toggle (`preview <-> edit`)
  - stale draft id guard (`Proposal not found`)
  - compose prefill handoff (`Open in Proposal Forge`)

## Deferred (after Proposal freeze)

- [ ] CV Forge section micro-polish follow-up:
  - header action icon sizing consistency
  - `skills/languages` add action placement review
  - final spacing audit against dasti token grid
