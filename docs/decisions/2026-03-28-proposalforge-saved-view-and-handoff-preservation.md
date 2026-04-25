# ProposalForge: Saved View Is Inspection-First

Date: 2026-03-28

## Status

Accepted

## Context

The earlier `ProposalForge` unification pass kept the live compose shell visible while opening a saved proposal. In practice this created three regressions:

- the saved proposal view showed the wrong job brief because the compose form still displayed the live draft inputs
- the output lost visual priority because workbench panels pushed the document down the page
- browsing between saved proposals became slower because the quick-access library list was no longer persistent while reading

There was also a functional regression in route handling: switching between `compose` and `saved` deleted `handoffId`, which broke the continuity of `Open in Proposal Forge` flows coming from the extension.

## Decision

`/proposal` keeps one route, but it now has two explicit UI contexts:

- `compose`
- `saved`

`saved` is an inspection-first layout, not a split-screen with the compose shell.

### Saved view

- hide the compose shell entirely
- keep a persistent saved-proposals browser visible beside the output on desktop
- make the generated output the primary surface
- move style and saved-proposal voice controls below the output
- keep explicit actions:
  - `Back to draft`
  - `Copy to draft`

### Compose view

- keep the proposal form and live output side by side
- place the output before the style inspector in the right column so the document remains the first visible result surface

### Route continuity

- preserve `handoffId` when switching between `compose` and `saved`
- copying a saved proposal back to the live draft also restores the compose-draft storage when source brief metadata is available
- if the original brief is unavailable, clear `lastProposalRequest` so regenerate cannot silently run against stale context

## Consequences

- opening a saved proposal no longer makes the user think they are editing the saved proposal from the live draft brief
- the extension handoff survives saved-proposal browsing
- saved proposals regain fast in-page switching without destroying the live draft
- `saved` and `compose` still share the same underlying page and output primitives, but not the same visual emphasis
