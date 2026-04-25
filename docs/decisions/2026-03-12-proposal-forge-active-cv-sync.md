# Proposal Forge Active CV Sync

Date: 2026-03-12

## Decision

When a user selects a CV from Proposal Forge, that selection must update both:

- the existing Proposal Forge local `cvActiveId` selector used for proposal generation
- the shared backend `activeCvSnapshots` record used by CV Forge and the extension

## Reason

Proposal Forge previously changed only local proposal context. The extension reads `activeCvSnapshots`, so the two surfaces diverged until the user later visited CV Forge.

## Scope

- No CV architecture redesign
- No auth changes
- No extension UI changes
- No change to Proposal Forge generation payload logic beyond keeping the selected local CV in sync with the shared active snapshot
