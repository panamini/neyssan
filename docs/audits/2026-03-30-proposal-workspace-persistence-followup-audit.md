# Proposal Workspace Persistence Follow-up Audit

Date: 2026-03-30

## Scope

- Active route: `src/pages/ProposalForgeNext.tsx`
- Legacy but informative: `src/pages/ProposalForge.tsx`
- Related navigation/storage paths:
  - `src/components/Sidebar.tsx`
  - `src/components/ProposalInputForm.tsx`
  - `src/lib/proposal-workspace-state.ts`
  - `src/lib/proposal-output-draft.ts`

## Active vs legacy

- `ProposalForgeNext.tsx` is active runtime code. `App.tsx` mounts it on `/proposal`.
- `ProposalForge.tsx` is no longer routed, but it is still informative because it retains the older saved-proposal workflow.

## Confirmed regression source

The active page no longer had the old explicit saved-to-live-draft restore model.

- `ProposalForge.tsx` kept a deliberate saved-proposal handoff path that restored the live draft and compose storage together.
- `ProposalForgeNext.tsx` reused the same in-memory fields for both saved-proposal hydration and live workspace editing, then relied on local storage to restore the live draft after the route flipped back from `/proposal?id=...` to `/proposal`.

That made the saved-view transition brittle:

- the current page could hydrate saved-proposal state into the live workspace fields
- leaving saved view depended on a storage round-trip instead of a dedicated live-draft snapshot
- the live request context (`lastProposalRequest`) was also not being rebuilt from stored compose input

This explains the reported symptom shape:

- job-offer input could survive independently
- output could disappear after saved/workspace transitions
- resume detours could expose the same weakness if the workspace was restored from stale or incomplete draft state

## Fix applied

In `ProposalForgeNext.tsx`:

- added a dedicated live workspace snapshot ref for compose + output draft state
- capture that live snapshot before hydrating a saved proposal
- restore the live snapshot directly when leaving saved view
- guard output-draft persistence during the saved-to-live transition so stale saved-view state does not win the race
- rebuild `lastProposalRequest` from stored compose draft so the restored workspace keeps its editable request context

In `ProposalInputForm.tsx`:

- Proposal -> Resume navigation already uses router navigation instead of raw `history.pushState`

## Verification

Targeted regression suites:

- `src/pages/__tests__/ProposalForge.saved-view.test.tsx`
- `src/pages/__tests__/ProposalForge.draft-persistence.test.tsx`
- `src/components/__tests__/Sidebar.proposal-navigation.test.tsx`
- `src/pages/__tests__/ProposalForge.stop-state.test.tsx`

Result:

- 4 files passed
- 8 tests passed

Additional focused coverage now asserts:

- saved proposal -> live draft returns the original editable output
- the live output draft in storage survives that round-trip
- saved proposal inspection plus a Resume detour still restores the live editable output
