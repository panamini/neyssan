# Proposal Forge Internal View Switcher

Date: 2026-03-12

## Decision

- Keep Proposal Forge on the existing `/proposal` route.
- Add an internal workspace switcher with two sibling views:
  - `Compose`
  - `Saved`
- Keep `Compose` as the default landing mode.
- Render the existing saved-proposals surface as the primary content of `Saved`, instead of appending it below the compose flow.

## Small Accompanying Fix

- Proposal generation already stores a saved proposal row in the backend action.
- Proposal Forge should not insert a second saved row from the client for the same generation.
- The client now updates the generated row status instead of creating a duplicate saved-history entry.

## Scope Kept Intentionally Unchanged

- No route change
- No generation-logic redesign
- No auth, scraping, tone, CV, or extension-handoff redesign
- No advanced search, filters, versioning, or new history data model
