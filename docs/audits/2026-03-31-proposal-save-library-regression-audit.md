# Proposal Save/Library Regression Audit

Date: 2026-03-31

## Scope

Audit the recent proposal workspace changes against `HEAD` after the user reported:

- clicking `Save` did not make the proposal visibly appear in the library
- the saved/draft workflow was unclear
- the saved-view draft action was confusing

## Classification

- Active code: `src/pages/ProposalForge.tsx`
- Active code: `src/components/Sidebar.tsx`
- Active code: `src/components/ProposalsList.tsx`
- Active tests: `src/pages/__tests__/ProposalForge.save-to-library.test.tsx`
- Active tests: `src/components/__tests__/Sidebar.proposal-navigation.test.tsx`

## Findings

1. A real regression was introduced in the recent sidebar optimistic-saved patch.

`src/components/Sidebar.tsx` referenced `optimisticSavedProposal` before the draft-derived values it depended on were initialized. This produced a runtime `ReferenceError` and broke the sidebar proposal navigation test suite.

2. The "save does not really show up in Library" behavior predates the latest patchset.

`HEAD` already kept the user on the live draft after `Save`, and the old `ProposalForge.save-to-library.test.tsx` explicitly asserted that behavior. That means the confusing save flow was not newly introduced by the latest toolbar batch; it was inherited behavior that remained uncorrected.

3. The saved-view draft action label did not match the actual behavior.

The saved action previously said `Copy to draft`, then was renamed to `Edit in draft`, but the implementation clears `generatedProposalId` and creates a detached live draft copy. That is duplication, not in-place editing.

4. Detached draft copies had no valid "save as new" path.

After duplicating a saved proposal back into draft, the workspace had `generatedProposalId = null`, so the existing `Save` action could not persist that draft as a new library item. This made the duplicate workflow structurally incomplete.

## Fixes Applied

- Reordered `Sidebar` optimistic-saved state so saved proposal navigation is stable again.
- Added a save dialog title-confirmation flow for the live draft save action.
- Made `Save` promote existing generated drafts to saved proposals and navigate directly to the saved route.
- Added `createProposalPublic` so detached drafts can be saved as brand new library items without regenerating.
- Renamed the saved-view draft action to `Duplicate to draft` to match the actual semantics.
- Preserved immediate saved-list visibility through optimistic saved proposal hydration.
- Updated the affected proposal and sidebar tests plus the browser roundtrip spec.

## UX Recommendation

The clean workflow is:

1. Draft is the live workspace and autosaves locally.
2. `Save to Library` promotes the current draft into a named saved proposal and opens that saved record.
3. Editing a saved proposal should update that saved proposal in place.
4. `Duplicate to draft` should explicitly fork a detached working copy.
5. Saving a detached draft should create a new saved proposal record, not overwrite the source saved proposal.

## Verification

- `npx vitest --run src/pages/__tests__/ProposalForge.save-to-library.test.tsx src/pages/__tests__/ProposalForge.saved-view.test.tsx src/pages/__tests__/ProposalForge.saved-view.guest-fixture.test.tsx src/components/__tests__/Sidebar.proposal-navigation.test.tsx`
- `npx vitest --run src/pages/__tests__/ProposalForge.handoff-continuity.test.tsx src/pages/__tests__/ProposalForge.stop-state.test.tsx src/pages/__tests__/ProposalForge.workspace-toolbar.test.tsx src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.output-draft-guard.test.tsx src/pages/__tests__/ProposalForge.attached-cv-sync.test.tsx`
- `npx playwright test e2e/proposal-workspace-roundtrip.spec.ts --project=chromium`
