# ProposalForge: Restore Saved Proposal Stack

Date: 2026-03-28

## Status

Accepted

## Context

An intermediate `ProposalForge` refactor replaced the existing saved-proposal stack with a compact library sidebar and a separate saved-output pane.

That change was rejected in product review because it broke the intended browsing model:

- the selected saved proposal should render as the main document
- other saved proposals should remain rendered below it with hover/focus affordances
- switching proposals should feel like moving through a proposal stack, not opening tiny cards in a side library

The previous `ProposalsList` component already implemented that model, including:

- selected proposal in focus
- secondary rendered proposals below
- lightweight paging of secondary proposals to avoid loading the full stack at once
- hover/select transitions and reveal behavior

## Decision

For `ProposalForge?view=saved`, restore `ProposalsList` as the source of truth for the saved-proposal experience.

- `ProposalForge` keeps `compose` and `saved` as separate page contexts
- `compose` continues to use the compose shell + live output
- `saved` delegates to `ProposalsList`
- route selection still stays URL-driven through `selectedProposalId`
- `handoffId` is preserved when switching between `compose` and `saved`

## Consequences

- saved proposals return to the previous stack-based reading model
- the live compose shell no longer competes with saved proposal browsing
- the saved-proposal UX matches historical product behavior instead of introducing a new library metaphor
