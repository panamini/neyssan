# Proposal Workspace Persistence Recovery Plan

Date: 2026-03-31

## Goal

Keep the active `ProposalForge` runtime stable and keep saved proposal surfaces strictly separated from live proposal workspace state.

## Current Status

- `/proposal` is confirmed to route to `ProposalForge`
- `/proposal-next` is not the active runtime path
- local browser verification passes for the storage-backed Proposal -> Resume -> Proposal roundtrip
- saved proposal surfaces now filter to `status === "saved"` on both the server and the client

## Immediate Acceptance Criteria

The following must remain true:

1. Proposal workspace entry points land on `/proposal`
2. Saved proposal entry points land on `/proposal?view=saved&id=...`
3. Draft rows do not appear in saved proposal surfaces
4. `dasti:proposal-compose-draft:v1` survives resume detours unless the user explicitly resets or deletes the workspace
5. `dasti:proposal-output-draft:v1` survives resume detours unless the user explicitly resets or deletes the workspace
6. `cvActiveId` is cleared only by explicit user action

## Recovery Sequence

### Phase 1. Signed-in manual retest

Re-run the exact manual path in a signed-in environment:

1. Generate a proposal
2. Switch to Resume workspace
3. Switch back to Proposal workspace
4. Confirm:
   - job title still present
   - job description still present
   - generated proposal output still present
   - resume workspace item still present

### Phase 2. Deploy parity check

If the deployed app still behaves differently from local code:

1. Inspect the live response for `api.proposalsPublic.default`
2. Confirm the payload excludes `status: "draft"` rows
3. Confirm the proposal count surface also reflects saved rows only

If draft rows still appear remotely, the deployed backend is behind the local code.

### Phase 3. Storage inspection if the manual roundtrip still fails

At each hop, inspect:

- `localStorage["dasti:proposal-compose-draft:v1"]`
- `localStorage["dasti:proposal-output-draft:v1"]`
- `localStorage["cvActiveId"]`
- current URL and query params

Capture values:

1. immediately after generation
2. immediately after clicking Resume workspace
3. immediately after returning to Proposal workspace

### Phase 4. Re-check explicit reset paths only

If state disappears, confirm whether the user accidentally went through one of these explicit reset flows:

- create new proposal
- delete live proposal workspace
- delete the saved proposal whose id matches the live draft id
- any navigation carrying `proposalWorkspaceResetToken`

### Phase 5. Keep ProposalForgeNext out of the critical path

Do not treat `ProposalForgeNext` as an active bug target unless routing changes again.

Safe work:

- saved/workspace route guards
- storage persistence
- saved proposal filtering
- sidebar/library/Verbati entry-point consistency

Unsafe work until the manual signed-in retest is green:

- page-level refactors that move `/proposal` back to `ProposalForgeNext`
- broad saved-view/live-draft state rewrites
- cross-page migration work that changes route ownership again

## Regression Suite To Keep Running

### Vitest

- `convex/__tests__/proposalsPublic.test.ts`
- `convex/__tests__/proposalsCountPublic.test.ts`
- `src/components/__tests__/Sidebar.proposal-navigation.test.tsx`
- `src/pages/__tests__/ProposalForge.draft-persistence.test.tsx`
- `src/pages/__tests__/ProposalForge.saved-view.test.tsx`
- `src/pages/__tests__/ProposalForge.save-to-library.test.tsx`
- `src/__tests__/App.proposal-route.contract.test.ts`

### Browser

- `e2e/proposal-workspace-roundtrip.spec.ts`

## Definition Of Done

Done means:

1. signed-in manual generate -> resume -> proposal keeps compose input and output
2. signed-in manual saved proposal -> draft/workspace path is coherent
3. saved proposal surfaces never show draft rows
4. the focused Vitest suite stays green
5. the browser roundtrip spec stays green
