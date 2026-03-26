# Proposal Header Visibility: Compose Hides Header, Saved Shows Full Header

## Status

Accepted on 2026-03-26.

## Context

The generated proposal card serves two different jobs:

- On the `Compose` page, it is a working output surface beside the generator form.
- On the `Saved` page, it is a document library surface where title and metadata help identify the proposal.

Using the same full header in both places caused two problems:

- In compose split layouts, the title and metadata were truncated or visually broken.
- In narrow stacked states, the header competed with the document text and reduced reading quality.

## Decision

Use different header modes by context:

- `Compose` generated output: `actions-only`
- `Saved` selected proposal: `full`
- `Saved` secondary stack cards: `hidden`

This means:

- The compose output never shows title or metadata in its document header.
- The saved primary card keeps title and metadata visible and editable.
- Secondary saved cards show only the document body preview, without any header.

## Rationale

- Compose is a composition shell, not the archival reading context.
- Saved is the identification and retrieval context, so title and metadata matter there.
- A calm action rail in compose reads better than a partially visible title block.
- This keeps header behavior explicit and predictable instead of letting it degrade by width.

## Implementation Notes

- `ProposalForge` passes `documentHeaderMode="actions-only"` to the generated output card.
- `ProposalsList` keeps `documentHeaderMode="full"` for the selected saved card.
- `ProposalsList` keeps `hideDocumentHeader` for secondary saved cards.

## Follow-up

- If actions move to a bottom toolbar later, the compose output may switch from `actions-only` to `hidden`.
- Title editing should stay attached to the saved primary card unless compose gets a dedicated rename control outside the document shell.
