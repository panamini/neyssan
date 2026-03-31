# Proposal Workspace Persistence Deep Audit

Date: 2026-03-31

## Summary

This audit was updated after the final manual retest went green.

Confirmed final state:

- `/proposal` mounts `ProposalForge`, not `ProposalForgeNext`
- Proposal -> Resume -> Proposal now preserves:
  - compose input
  - generated output
  - proposal-attached CV
- the final root cause was not just storage deletion
- the final root cause was an output-draft overwrite with a metadata-only null-content state

That overwrite happened even when `dasti:proposal-compose-draft:v1` and `dasti:proposal-output-draft:v1` both survived in localStorage.

## Code Classification

### Active code

- `my-app/src/App.tsx`
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/components/ProposalInputForm.tsx`
- `my-app/src/components/Sidebar.tsx`
- `my-app/src/pages/ProposalsLibrary.tsx`
- `my-app/src/components/ProposalsList.tsx`
- `my-app/src/features/verbati/VerbatiProposalWorkspace.tsx`
- `my-app/src/lib/proposal-workspace-state.ts`
- `my-app/src/lib/proposal-output-draft.ts`
- `my-app/src/lib/proposal-personalization.ts`

### Legacy but informative code

- `my-app/src/pages/ProposalForgeNext.tsx`

### Obsolete/dead for this runtime path

- any audit assumption that `/proposal` is still served by `ProposalForgeNext`

## Final Root Cause List

### RC-1. Proposal and Resume CV identity were coupled

Files:

- `my-app/src/components/ProposalInputForm.tsx`
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/lib/proposal-personalization.ts`

Problem:

- Proposal attach/remove CV and Resume active CV were not properly isolated
- Proposal was still mutating Resume state through Resume-side CV loading behavior
- Proposal page was still reading Resume `currentCv` for Proposal-attached styling behavior

Fix:

- Proposal-attached CV now uses `dasti:proposal-attached-cv-id:v1`
- Proposal attach no longer loads Resume
- Proposal page derives attached-CV behavior from Proposal-owned state

### RC-2. StrictMode mount could remove the output draft too early

File:

- `my-app/src/pages/ProposalForge.tsx`

Problem:

- the page persistence effect could remove `dasti:proposal-output-draft:v1` during initial mount before real state settled

Fix:

- the output-draft remove branch is now gated behind an initial-render ref

### RC-3. Surviving output drafts could still be overwritten with invalid null-content state

File:

- `my-app/src/pages/ProposalForge.tsx`

Problem:

- after RC-2, storage survived, but the UI could still come back empty
- DevTools inspection showed the output key still present, but with this shape:
  - `proposalContent: null`
  - `generatedProposalId: null`
  - title/meta/type/style still present

That exact shape matches Proposal generation-start / error-state transitions:

- `handleProposalStart()`
- `handleProposalError()`

Those states are valid in memory while generation is starting or failing, but they are not valid persisted output drafts.

Fix:

- Proposal output persistence now skips writing metadata-only output states
- a draft is only rewritten when there is real output content or a generated proposal id
- true empty/reset states still clear storage

This was the final fix that made the manual path green.

## Verified Runtime Path

Confirmed from local code:

- `my-app/src/App.tsx`

Result:

- `/proposal` -> `ProposalForge`
- `/proposal-next` -> redirect to `/proposal`

## Storage Findings

Final verified behavior from manual DevTools inspection:

- `dasti:proposal-compose-draft:v1` survives the Resume detour
- `dasti:proposal-output-draft:v1` survives the Resume detour
- after the final guard fix, the output draft also survives with real `proposalContent`

Important diagnostic note:

- if the key exists but `proposalContent` is `null`, Proposal is loading the right page but the stored output draft has already been corrupted by a bad overwrite path
- this is different from a missing-route or missing-storage problem

## Exact Fixes Applied

### Proposal / Resume CV boundary

- `my-app/src/lib/proposal-personalization.ts`
  - Proposal-attached CV key
  - migration from legacy `cvActiveId`
  - Proposal-attached CV document resolver
  - Proposal-attached CV update event

- `my-app/src/components/ProposalInputForm.tsx`
  - Proposal attach no longer calls Resume `loadCv()`
  - explicit Resume-open path still loads and navigates

- `my-app/src/pages/ProposalForge.tsx`
  - Proposal-attached styling now derives from Proposal-owned attached CV
  - removed Resume `loadCv(attachedCvId)` re-entry coupling
  - Proposal attached-CV UI refreshes from Proposal-owned storage/event state

### Output-draft persistence

- `my-app/src/pages/ProposalForge.tsx`
  - mount-time draft removal guarded against StrictMode bootstrap
  - metadata-only null-content states no longer overwrite a valid output draft

### Saved/workspace continuity

- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/components/Sidebar.tsx`
- `my-app/src/pages/ProposalsLibrary.tsx`
- `my-app/src/features/verbati/VerbatiProposalWorkspace.tsx`

Saved-proposal and workspace entry paths were normalized during this recovery so the restored `ProposalForge` runtime remains authoritative.

## Verification

### Focused Vitest

Verified suites include:

- `src/lib/__tests__/proposal-personalization.test.ts`
- `src/components/__tests__/ProposalInputForm.provider-busy.test.tsx`
- `src/components/__tests__/Sidebar.proposal-navigation.test.tsx`
- `src/pages/__tests__/ProposalForge.attached-cv-sync.test.tsx`
- `src/pages/__tests__/ProposalForge.draft-persistence.test.tsx`
- `src/pages/__tests__/ProposalForge.output-draft-guard.test.tsx`
- `src/pages/__tests__/ProposalForge.save-to-library.test.tsx`
- `src/pages/__tests__/ProposalForge.saved-view.test.tsx`

### Manual retest

Manual retest is green.

Verified path:

1. generate proposal
2. click Resume workspace
3. click back to Proposal workspace
4. confirm compose input still visible
5. confirm generated output still visible

## Files Changed In The Final Working Fix

- `my-app/src/App.tsx`
- `my-app/src/components/ProposalInputForm.tsx`
- `my-app/src/components/ProposalsList.tsx`
- `my-app/src/components/Sidebar.tsx`
- `my-app/src/features/verbati/VerbatiProposalWorkspace.tsx`
- `my-app/src/lib/proposal-generation-request.ts`
- `my-app/src/lib/proposal-output-draft.ts`
- `my-app/src/lib/proposal-personalization.ts`
- `my-app/src/lib/proposal-style-link.ts`
- `my-app/src/lib/proposal-voice-label.ts`
- `my-app/src/lib/proposal-workspace-state.ts`
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/pages/ProposalsLibrary.tsx`
- `my-app/src/__tests__/App.proposal-route.contract.test.ts`
- `my-app/src/lib/__tests__/proposal-personalization.test.ts`
- `my-app/src/components/__tests__/ProposalInputForm.provider-busy.test.tsx`
- `my-app/src/components/__tests__/Sidebar.proposal-navigation.test.tsx`
- `my-app/src/pages/__tests__/ProposalForge.attached-cv-sync.test.tsx`
- `my-app/src/pages/__tests__/ProposalForge.draft-persistence.test.tsx`
- `my-app/src/pages/__tests__/ProposalForge.output-draft-guard.test.tsx`
- `my-app/src/pages/__tests__/ProposalForge.save-to-library.test.tsx`
- `my-app/src/pages/__tests__/ProposalForge.saved-view.test.tsx`
- `my-app/src/pages/__tests__/ProposalForge.stop-state.test.tsx`
- `e2e/proposal-workspace-roundtrip.spec.ts`

## Conclusion

The Proposal workspace persistence bug is fixed in the active runtime path.

The final important lesson is:

- storage survival alone was not enough
- the last regression came from persisting a non-renderable output state (`proposalContent: null`) over a valid generated draft

UI migration from `ProposalForgeNext` should continue only as presentational backports into the restored `ProposalForge` runtime, not by switching runtime ownership again.
