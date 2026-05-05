# Proposal generation duplicate draft audit

Date: 2026-05-05
Status: planning audit for next fix
Active path: `v1` Proposal Forge (`my-app/src/pages/ProposalForge.tsx`, `my-app/src/components/ProposalInputForm.tsx`, Convex proposal generation/persistence)

## Reported symptom

A single Generate appears to create two library-visible rows:

- one proposal draft, and
- one still-drafting/draft-like proposal.

Separately, Save/Finalize appears not to promote the draft to Saved.

## Current boundary finding

This is active code.

There are currently two write paths that can create or mutate a proposal during one Generate lifecycle:

1. `ProposalInputForm.tsx` calls the Convex generation action.
   - The action returns `result.proposalId`.
   - The action already stores a proposal row server-side through `internal.proposals.storeProposal` in `generateProposalMutation.ts`.
   - After success, `ProposalInputForm` calls `updateGeneratedProposal({ id: result.proposalId, status: "draft" })`.

2. `ProposalForge.tsx` autosave also persists the rendered proposal.
   - `handleProposalStart` intentionally clears `generatedProposalId` / `generatedProposalIdRef` before generation.
   - `handleProposalSubmit` later sets `generatedProposalId` from `nextProposalId` if the action returned one.
   - The compose autosave effect can call `performProposalSave`.
   - If `generatedProposalIdRef.current` is not set at the moment autosave flushes, `performProposalSave` calls `createProposal`, creating another draft row.

The most likely duplicate cause is a race/identity gap between server-side generation storage and client autosave creation. The invariant we want is: after generation returns a server proposal id, all client save/autosave/finalize operations must update that exact id; the client must not create a second row for that generation.

## Why draft may never become saved

Save/Finalize currently calls `flushScheduledProposalSave(normalizedTitle, { status: "saved" })` in `ProposalForge.tsx`.

That should promote the active row in place, but it depends on `generatedProposalIdRef.current` pointing at the intended draft row. If the UI is looking at one draft while autosave created or tracked another row, Save can update the wrong identity or fail to affect the visible draft the user expects. This matches the user-visible feeling: drafts exist, but the intended draft never becomes Saved.

## Desired invariant

For one user-triggered Generate:

- exactly one server proposal row is created;
- that row starts as `status: "draft"`;
- generated result, autosave, edits, style changes, and Save/Finalize all share the same id;
- Save/Finalize updates that same row to `status: "saved"`;
- no additional client-created draft is created unless there was no server id at all.

## Fix plan

1. Treat `result.proposalId` as authoritative generation identity.
   - In `ProposalInputForm`, the action-created row remains the creation point for normal generation.
   - In `ProposalForge.handleProposalSubmit`, set `generatedProposalIdRef.current = nextProposalId` before any autosave can create.

2. Guard client autosave creation after generation.
   - Add a `generationIdentityPendingRef` or equivalent guard set on `handleProposalStart`.
   - While generation is pending, autosave must not call `createProposal`.
   - Once `handleProposalSubmit` receives `nextProposalId`, autosave may only `updateProposal` that id.
   - If generation returns no id, then and only then autosave may create a draft row.

3. Make `performProposalSave` refuse accidental creates when a generated server row is expected.
   - If content came from a generation result and no id is available yet, queue/retry rather than create.
   - This prevents the second `drafting` row.

4. Ensure Save/Finalize promotes the active identity.
   - `flushScheduledProposalSave(..., { status: "saved" })` should use the active draft id from `generatedProposalIdRef.current`.
   - If no id is present, it may create one saved row, but only for non-generated local content.

5. Add red-first tests.
   - Generate action returns `proposal_action_id`; autosave runs; assert `createProposalPublic` is not called and `updateProposalPublic` is called with `proposal_action_id` and `status: "draft"`.
   - Save after that generation; assert `updateProposalPublic` is called with `proposal_action_id` and `status: "saved"`; assert `createProposalPublic` is still not called.
   - Generate action returns no id; autosave may create exactly one draft.

## Verification

Run focused tests:

```bash
rtk npm test -- src/pages/__tests__/ProposalForge.autosave.test.tsx src/pages/__tests__/ProposalForge.save-to-library.test.tsx
rtk npm test -- src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.output-draft-guard.test.tsx
rtk npm test -- convex/__tests__/proposalsPublic.test.ts convex/__tests__/jobsPublic.test.ts
rtk bash -lc 'cd my-app && npx tsc --noEmit'
```

If possible, verify manually/browser with a real Generate:

1. Generate once.
2. Open Proposal Library.
3. Confirm exactly one Draft row for that generation.
4. Click Save/Finalize.
5. Confirm that same row becomes Saved and no Draft duplicate remains.
