# Proposal Reopen And Lag Recovery Plan

Date: 2026-03-31

## Goal

Stabilize the active `/proposal` workspace without changing the intended saved-view workflow.

## Confirmed Target State

- `/proposal` continues to render `ProposalForge`
- imported handoff title/job-offer text survives a later plain `/proposal` revisit after the route strips `handoffId`
- generated output is persisted locally as soon as generation returns, even if the follow-up server draft-status sync is slow
- saved proposals continue to open in saved view
- `Back to draft` continues to preserve the existing live draft
- `Duplicate to draft` continues to be the explicit restore action
- `Duplicate to draft` must not erase the existing compose brief when saved metadata lacks `sourceJobDescription`
- compose typing should not emit duplicate draft writes/events or force sidebar updates when only the brief body changes

## Implemented Recovery Steps

1. Preserve existing compose draft fields on saved copy-back.
   - Keep the current working-tree fix in `ProposalForge.tsx`
   - Merge `readStoredProposalComposeDraft()` into the restored draft before overwriting fields

2. Persist imported handoff text at the active route boundary.
   - `ProposalForge.tsx`
   - As soon as `prefill` resolves in compose view, merge its `jobTitle` and `jobDescription` into the stored compose draft
   - Keep existing compose controls such as tone and proposal type intact
   - Let the brief card fall back to `prefill` while the imported handoff is active

3. Decouple local output persistence from follow-up server draft-status sync.
   - `ProposalInputForm.tsx`
   - Call the parent `onSubmit(...)` as soon as generation returns
   - Run `updateGeneratedProposal(...)` in the background instead of blocking local draft/output persistence on it

4. Harden the local output writer against silent persistence failure.
   - `proposal-output-draft.ts`
   - Warn when the full payload cannot be serialized or persisted
   - Retry with a sanitized fallback payload so the essential output draft still lands in local storage

5. Rehydrate compose from the output source snapshot on plain `/proposal` re-entry.
   - `ProposalForge.tsx`
   - `ProposalInputForm.tsx`
   - Persist `sourceComposeDraft` alongside the output draft when generation succeeds
   - Seed compose restore from that source snapshot on return instead of later unsent compose edits
   - Sync the compose local-storage key back to the same source snapshot on re-entry so developer tools and visible UI agree

6. Survive local-storage quota exhaustion during output-draft persistence.
   - `proposal-output-draft.ts`
   - Read the output draft from session storage when the local-storage copy is missing
   - Fall back to session storage when local-storage `setItem(...)` throws `QuotaExceededError`
   - After the first quota failure in a tab session, stop retrying local-storage writes for the output draft and use session storage directly to avoid repeated synchronous exceptions
   - Clear both storage locations on workspace reset so fresh-workspace actions stay correct

7. Deduplicate identical draft persistence writes.
   - `proposal-workspace-state.ts`
   - `proposal-output-draft.ts`
   - Skip storage writes and update events when serialized draft content is unchanged

8. Route the active compose form through the shared compose-draft writer.
   - `ProposalInputForm.tsx`
   - Stop manual localStorage/event writes in the active parent-driven path

9. Reduce sidebar compose invalidation to sidebar-relevant fields.
   - `Sidebar.tsx`
   - Ignore compose updates that only change brief body content when the visible proposal title is unchanged

10. Lock the behavior with focused tests.
   - local submit must not wait for generated-proposal status sync mutation
   - sanitized output-draft fallback when full serialization fails
   - session-storage output-draft fallback when local storage is full
   - plain `/proposal` re-entry must prefer the output source brief over later unsent compose edits
   - plain `/proposal` re-entry must still restore from the session fallback when local storage is full
   - imported handoff persistence after route consume
   - saved-view restore behavior
   - missing-source brief preservation
   - identical compose/output draft write dedupe
   - save-to-library saved-route contract

## Deferred / Not Proven

- No broader route/render architecture change is proposed
- No revert of `815a1c25`
- No revert of `13b4bed2`
- No claim that all perceived lag is solved
- No claim that saved view should inline the compose brief

## Follow-Up Checks

1. Manual check in a browser:
   - open an imported handoff route
   - leave `/proposal`
   - return to plain `/proposal`
   - confirm the imported brief survived
2. Manual check in a browser:
   - generate a proposal
   - inspect local storage
   - confirm `dasti:proposal-output-draft:v1` exists immediately after generation returns
3. Manual check in a browser:
   - type in job-offer field
   - observe whether sidebar remains visually stable
4. Manual saved-draft roundtrip:
   - save proposal
   - open saved route
   - verify `Back to draft` preserves current live draft
   - verify `Duplicate to draft` restores saved output and preserved brief behavior
5. If lag remains after this patch:
   - profile `ProposalForge` re-renders during typing
   - measure whether `setLastProposalRequest(values)` is the next dominant cost
   - only then consider debouncing or narrowing parent state updates

## Rollback Guidance

If this recovery needs to be rolled back, revert only the targeted persistence and sidebar changes from this audit. Do not broadly revert:

- `815a1c25`
- `13b4bed2`

Those commits contain intended workflow and recovery behavior beyond the bugs addressed here.
