# ProposalForgeNext Archive Decision

Date: 2026-03-31

## Status

- Active code: `src/pages/ProposalForge.tsx`
- Legacy but informative code: none
- Obsolete/dead code retained temporarily as archive: `src/pages/ProposalForgeNext.tsx`

## Decision

`ProposalForgeNext.tsx` is no longer part of the live proposal runtime.

- `/proposal` is owned by `ProposalForge`
- `/proposal-next` redirects to `/proposal`
- proposal sidebar active-state logic now follows `/proposal` only

The remaining presentational pieces that were still valuable from `ProposalForgeNext` have already been reduced and adopted into `ProposalForge`:

- `ProposalComposeToolbar`
- `ProposalArtifactInspector`
- `ProposalBriefCard`

## Why Archive Instead Of Delete In This Batch

`ProposalForgeNext.tsx` is a large donor file with active local modifications in the current worktree. Deleting it in the same batch as the final UI backports would increase merge risk without improving live behavior.

Archiving it as obsolete/dead code closes the migration plan while keeping a stable donor snapshot available for any follow-up extraction or diff review.

## Follow-up

A later cleanup-only batch may delete `src/pages/ProposalForgeNext.tsx` once the worktree is quieter and no one needs donor-page diff context.
