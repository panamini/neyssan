# Proposal Workspace Persistence Deep Audit

Date: 2026-03-31

## Summary

I re-verified the active runtime from local code and current diff.

- `/proposal` mounts `ProposalForge`, not `ProposalForgeNext`.
- `/proposal-next` is a redirect back to `/proposal`.
- The storage-backed Proposal -> Resume -> Proposal roundtrip is currently intact in the active runtime path.
- The concrete active bug I found was different: every "saved proposal" surface was still mixing `status: "draft"` rows with `status: "saved"` rows. That made saved/open behavior inconsistent and made the save button above the generated output misleading.

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
- `my-app/src/contexts/CvLibraryContext.tsx`
- `my-app/convex/proposalsPublic.ts`
- `my-app/convex/proposalsCountPublic.ts`

### Legacy but informative code

- `my-app/src/pages/ProposalForgeNext.tsx`

`ProposalForgeNext` still contains proposal workspace logic, but `App.tsx` no longer routes `/proposal` to it.

### Obsolete/dead for this runtime path

- Any audit or test assumption that `/proposal` is still backed by `ProposalForgeNext`
- Any saved/open behavior analysis that ignores the current `status` field split between live drafts and saved proposals

## Verified Runtime Path

Confirmed from local code:

- `my-app/src/App.tsx:10-14`
- `my-app/src/App.tsx:109-118`

Result:

- `/proposal` -> `ProposalForge`
- `/proposal-next` -> redirect to `/proposal`

The earlier audit state that treated `ProposalForgeNext` as the active runtime was stale.

## Route Entry Audit

### Proposal workspace entry points

- Sidebar workspace card: `my-app/src/components/Sidebar.tsx:702-708`
- Collapsed rail proposal link uses `/proposal` when reopening the workspace
- "Open Proposal Forge" / style-side open actions: `my-app/src/features/verbati/VerbatiProposalWorkspace.tsx:407-418`

All of these are workspace-entry paths and should land on `/proposal`.

### Saved proposal entry points

- Proposal saved-view selection in `ProposalForge`: `my-app/src/pages/ProposalForge.tsx:485-507`
- Sidebar saved proposal links: `my-app/src/components/Sidebar.tsx:879-899`
- Proposal library cards: `my-app/src/pages/ProposalsLibrary.tsx:193-199`
- Verbati selected proposal open action: `my-app/src/features/verbati/VerbatiProposalWorkspace.tsx:407-413`
- Saved proposal stack selection: `my-app/src/components/ProposalsList.tsx:552-580`

All of these should only operate on `status === "saved"` rows and should land on `/proposal?view=saved&id=...`.

### Resume-side entry from proposal

- Proposal CV picker "Edit" flow: `my-app/src/components/ProposalInputForm.tsx:1041-1055`

That flow explicitly sets `cvActiveId`, loads the CV, then navigates to `/cv?id=...`.

## Reset Trigger Inventory

Explicit reset/clear triggers in active code:

- Create new proposal from sidebar: `my-app/src/components/Sidebar.tsx:695-700`
- Delete live proposal workspace from sidebar: `my-app/src/components/Sidebar.tsx:710-730`
- Delete saved proposal that matches the live draft id: `my-app/src/components/Sidebar.tsx:732-759`
- Create new proposal from proposal library: `my-app/src/pages/ProposalsLibrary.tsx:87-92`
- Route-state reset token consumption: `my-app/src/pages/ProposalForge.tsx:943-951`

I did not find an active implicit reset on normal Proposal -> Resume -> Proposal navigation.

## `cvActiveId` Audit

Active proposal-side behavior:

- Explicit select CV: `my-app/src/components/ProposalInputForm.tsx:1011-1019`
- Explicit clear CV: `my-app/src/components/ProposalInputForm.tsx:1021-1039`
- Edit CV from proposal picker: `my-app/src/components/ProposalInputForm.tsx:1041-1055`

I did not find any active effect that clears `cvActiveId` opportunistically. In the current active code, `cvActiveId` is cleared only by explicit user removal.

## Storage Audit

### Compose draft

- Storage key: `dasti:proposal-compose-draft:v1`
- Written from form changes in `ProposalInputForm`
- Read on form mount and on sidebar/workspace refresh

### Output draft

- Storage key: `dasti:proposal-output-draft:v1`
- Written synchronously on successful submit in `my-app/src/pages/ProposalForge.tsx:1128-1160`
- Also mirrored by the page-level persistence effect

### Resume identity

- Storage key: `cvActiveId`
- Set and cleared only through explicit proposal CV picker actions in active code

## Exact Root Causes Found

### 1. Previous audits targeted the wrong runtime

Exact files:

- `my-app/src/App.tsx:109-118`
- `my-app/src/pages/ProposalForgeNext.tsx:1-120`

The active runtime is `ProposalForge`. Any regression analysis centered on `ProposalForgeNext` was outdated.

### 2. Saved proposal data was not actually saved-only

Exact files:

- `my-app/convex/proposalsPublic.ts:174-188`
- `my-app/convex/proposalsCountPublic.ts:18-25`

Before this fix, the saved proposal query/count path included draft rows. That polluted every saved/open surface.

### 3. Saved surfaces were not defensively filtering by status

Exact files:

- `my-app/src/pages/ProposalForge.tsx:485-507`
- `my-app/src/components/Sidebar.tsx:879-899`
- `my-app/src/pages/ProposalsLibrary.tsx:79-99`
- `my-app/src/components/ProposalsList.tsx:400-407`
- `my-app/src/components/ProposalsList.tsx:542-580`
- `my-app/src/features/verbati/VerbatiProposalWorkspace.tsx:196-250`

These surfaces treated the query as inherently saved-only. Combined with the server bug above, draft rows could appear as saved proposals.

This is the concrete reason:

- opening a "saved" proposal could actually open a draft row
- returning to the draft/workspace looked inconsistent
- the save button above the generated output was misleading because draft rows already appeared in saved-library surfaces before the user saved them

## Fix Applied

### Server-side

- `my-app/convex/proposalsPublic.ts`
  - query narrowed to the `by_user_and_status` index
  - added a defensive `status === "saved"` filter before projection
- `my-app/convex/proposalsCountPublic.ts`
  - count narrowed to saved rows only
  - added a defensive `status === "saved"` filter before counting

### Client-side

- `my-app/src/pages/ProposalForge.tsx`
  - saved-view hydration now filters to saved rows only
- `my-app/src/components/Sidebar.tsx`
  - sidebar recent proposal list now filters to saved rows only
- `my-app/src/pages/ProposalsLibrary.tsx`
  - proposal library cards now filter to saved rows only
- `my-app/src/components/ProposalsList.tsx`
  - saved proposal stack now filters to saved rows only
- `my-app/src/features/verbati/VerbatiProposalWorkspace.tsx`
  - style workspace saved proposal picker/preview now filters to saved rows only

## Verification

### Focused Vitest

Command:

`npm test -- convex/__tests__/proposalsPublic.test.ts convex/__tests__/proposalsCountPublic.test.ts src/components/__tests__/Sidebar.proposal-navigation.test.tsx src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.saved-view.test.tsx src/pages/__tests__/ProposalForge.save-to-library.test.tsx`

Result:

- 6 files passed
- 15 tests passed

### Route contract

Command:

`npm test -- src/__tests__/App.proposal-route.contract.test.ts`

Result:

- 1 file passed
- 1 test passed

### Real-browser runtime path

Command:

`PLAYWRIGHT_APP_URL=http://127.0.0.1:4173 npx playwright test e2e/proposal-workspace-roundtrip.spec.ts --project=chromium`

Result:

- 2 tests passed

What that browser run covered:

- proposal workspace visible
- resume workspace visible
- proposal -> resume workspace click
- resume -> proposal workspace click
- proposal compose/output storage survives the detour
- proposal-side resume picker Edit flow preserves proposal state on return

What it did not cover:

- authenticated end-to-end Convex generation from the browser harness

That generation boundary was still covered in active-code tests through `ProposalForge` submit flow:

- `src/pages/__tests__/ProposalForge.draft-persistence.test.tsx`
- `src/pages/__tests__/ProposalForge.save-to-library.test.tsx`

## Files Changed In This Audit Pass

- `my-app/convex/proposalsPublic.ts`
- `my-app/convex/proposalsCountPublic.ts`
- `my-app/convex/__tests__/proposalsPublic.test.ts`
- `my-app/convex/__tests__/proposalsCountPublic.test.ts`
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/components/Sidebar.tsx`
- `my-app/src/pages/ProposalsLibrary.tsx`
- `my-app/src/components/ProposalsList.tsx`
- `my-app/src/features/verbati/VerbatiProposalWorkspace.tsx`
- `my-app/src/components/__tests__/Sidebar.proposal-navigation.test.tsx`

## Conclusion

The active runtime path is `ProposalForge`, and the storage-backed Proposal -> Resume -> Proposal roundtrip is currently working in local browser verification.

The concrete active regression I found and fixed was the draft-vs-saved boundary: saved proposal queries and saved proposal UIs were still treating draft rows as saved rows. That was the real source of the saved/open inconsistency and the misleading save behavior.

If a signed-in manual generate -> resume -> proposal path still fails in the deployed app after this fix, the next suspect is deploy parity or auth-backed generation/runtime state outside the local verified route path, not `ProposalForgeNext` routing.
