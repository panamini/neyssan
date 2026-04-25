# Audit: Proposal Confirm-Delete Red Token Mismatch

Date: 2026-03-20

## Scope
- Confirm-delete check color in proposal/resume library UIs (light and dark modes).

## Findings

1. The mismatch was real and came from multiple confirm flows, not a single component.
   - `my-app/src/components/ProposalsList.tsx`
   - `my-app/src/pages/ProposalsLibrary.tsx`
   - `my-app/src/pages/CvsLibrary.tsx`

2. The main inconsistency:
   - some flows used neutral/transparent base with red only on hover,
   - while the validated sidebar behavior uses danger surface at rest and stronger danger on hover.

3. Token source of truth for the validated behavior:
   - rest: `--erb` + `--ert`
   - hover: `--er` + `--op`

## Applied Fix

- Aligned all affected confirm-delete check states to the same token behavior:
  - rest: `background: var(--erb)`, `color: var(--ert)`
  - hover: `background: var(--er)`, `color: var(--op)`
  - border kept transparent for clean optical match.

- Also kept destructive hierarchy consistent:
  - delete trigger stays neutral,
  - confirm check carries danger emphasis.

## Classification
- Active code: all files listed above.
- Legacy but informative: none used.
- Obsolete/dead code: none required for this diagnosis.

