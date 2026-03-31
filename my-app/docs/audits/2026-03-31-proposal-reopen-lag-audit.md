# Proposal Reopen And Lag Audit

Date: 2026-03-31

## Scope

- Active runtime baseline: `my-app/src/App.tsx`
- Requested files inspected:
  - `my-app/src/App.tsx`
  - `my-app/src/pages/ProposalForge.tsx`
  - `my-app/src/pages/ProposalForgeNext.tsx`
  - `my-app/src/components/ProposalInputForm.tsx`
  - `my-app/src/components/Sidebar.tsx`
  - `my-app/src/components/ProposalsList.tsx`
  - `my-app/src/pages/ProposalsLibrary.tsx`
  - `my-app/src/lib/proposal-workspace-state.ts`
  - `my-app/src/lib/proposal-output-draft.ts`
- Git/history compared:
  - `13b4bed2`
  - `815a1c25`
  - later saved-view commits including `8c891236`, `b33948e9`, `debb740b`

## Classification

- Active code:
  - `App.tsx`
  - `ProposalForge.tsx`
  - `ProposalInputForm.tsx`
  - `Sidebar.tsx`
  - `ProposalsList.tsx`
  - `ProposalsLibrary.tsx`
  - `proposal-workspace-state.ts`
  - `proposal-output-draft.ts`
- Legacy but informative:
  - `ProposalForgeNext.tsx`
    - `App.tsx` routes `/proposal-next` to `<Navigate to="/proposal" replace />`, so `ProposalForgeNext` is not the live `/proposal` runtime.
- Obsolete/dead code:
  - none concluded from this audit beyond the inactive `/proposal-next` page component.

## Exact Active Runtime Path

1. `my-app/src/App.tsx`
   - `/proposal` renders `<ProposalForge />`
   - `/proposal-next` redirects to `/proposal`
2. `my-app/src/pages/ProposalForge.tsx`
   - query parsing decides the branch:
     - `view=saved` or any `id` query param => saved view
     - otherwise => compose view
3. Saved view branch:
   - renders saved-action toolbar plus `<ProposalsList />`
   - does not render `ProposalInputForm`
4. Compose view branch:
   - renders `<ProposalInputForm />`
   - compose draft is read from local storage and live component state

## Findings

### 1. Imported handoff briefs were not durably persisted after the route started stripping `handoffId`

Active path:

- `ProposalForge.tsx`
  - fetches handoff data into `prefill`
  - strips `handoffId` from the live `/proposal` URL after first consume
- `ProposalInputForm.tsx`
  - applies `prefill` into form state with `form.setValue(...)`

Problem:

- the active route depended on the child form path to eventually persist the imported brief into `dasti:proposal-compose-draft:v1`
- once `handoffId` is stripped, a later `/proposal` remount can no longer refetch the imported handoff
- if the durable compose draft still contains older text, that older text wins on return

Why this matches the reported symptom:

- the user reported imported extension/clerk proposal context disappearing after leaving `/proposal`
- the same report said older random typed input survived on return
- active `ProposalForge.tsx` rebuilt visible brief state from `lastProposalRequest` or `readStoredProposalComposeDraft()`, not from `prefill`
- that creates exactly the "two compose drafts on top of each other" feel:
  - transient imported handoff in form memory
  - stale durable compose draft in local storage

Regression window:

- `13b4bed2` already had handoff prefill support
- `88cfb1b9` introduced the `consumedHandoffIdRef` route flow that strips `handoffId`
- from that point onward, imported handoff reopen depended on the compose draft being durably persisted before leaving the page
- the active route did not make that guarantee before this audit fix

Conclusion:

- this is a real live-runtime reopen bug distinct from the saved-view `Duplicate to draft` bug
- the smallest safe fix is route-level:
  - persist imported handoff title/job-offer text into the compose draft as soon as the handoff resolves
  - let the brief card fall back to `prefill` while the handoff is active

### 2. Saved-view semantics were intentionally changed before this audit

The active code and git history do not support "opening a saved proposal should itself reopen the compose brief UI".

Evidence:

- `13b4bed2` already had an explicit saved view with:
  - `Back to draft`
  - `Copy to draft`
- `815a1c25` kept the same model and renamed the action to `Duplicate to draft`
- `815a1c25` also changed save-to-library so saving navigates directly to `/proposal?view=saved&id=...`
- `my-app/src/pages/__tests__/ProposalForge.saved-view.test.tsx` in both `13b4bed2` and `815a1c25` explicitly asserts:
  - `Back to draft` preserves the existing live draft
  - `Copy/Duplicate to draft` is the action that restores saved proposal content and source brief into the live draft

Conclusion:

- The active, tested behavior since `13b4bed2` is:
  - saved view stays a saved view
  - only `Duplicate to draft` restores compose/job-offer text into the editable live draft
- If the desired product behavior is "saved view itself should show restored compose state", that would be a product change, not the smallest safe regression fix.

### 3. The actual copy-back bug is real: missing `sourceJobDescription` could wipe the existing compose brief

Active path:

- `ProposalForge.tsx`
  - `handleCopySavedProposalToDraft`

Problem:

- before the fix, the handler built a partial compose draft:
  - `jobTitle`
  - `proposalType`
  - optional `jobDescription`
  - optional `voicePreset`
- when a saved proposal had no `metadata.sourceJobDescription`, the handler wrote a partial object and dropped the previous compose `jobDescription`

Why this is real:

- this bug is directly visible in the old handler body from `13b4bed2`, `815a1c25`, and `HEAD` before the local fix
- it is now covered by the focused test:
  - `my-app/src/pages/__tests__/ProposalForge.saved-view.test.tsx`
  - `keeps the existing compose brief when the saved proposal lacks source brief metadata`

Regression window:

- introduced with the copy-back handler in `13b4bed2`
- still present in `HEAD` before this audit's working-tree fix

### 4. The typing lag has a provable draft-persistence cause

Provable active path:

- `ProposalInputForm.tsx`
  - `form.watch(...)`
  - wrote compose draft to local storage on every change
  - dispatched `PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT`
- `ProposalForge.tsx`
  - `handleProposalFormValuesChange`
  - wrote the same compose draft again through `writeStoredProposalComposeDraft(...)`
- `Sidebar.tsx`
  - listened to `PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT`
  - refreshed sidebar proposal workspace state from storage after each event

What that means:

- one keystroke in the brief could trigger:
  - compose write #1 in `ProposalInputForm`
  - compose event #1
  - compose write #2 in `ProposalForge`
  - compose event #2
  - sidebar refresh work for both events

Additional active duplication:

- `ProposalForge.tsx` also persisted output draft directly in an effect after submit/state changes
- `writeStoredProposalOutputDraft(...)` was already called elsewhere in the same flow
- identical output writes still dispatched output refresh events

Confidence:

- high confidence for duplicated local-storage/event traffic as a real lag source
- not proven that it is the only lag source

### 5. Output draft persistence was blocked behind a follow-up server mutation

Active path:

- `ProposalInputForm.tsx`
  - generate proposal action returns `proposalContent` and `proposalId`
  - then awaited `updateGeneratedProposal(...)`
  - only after that awaited mutation finished did it call the parent `onSubmit(...)`
- `ProposalForge.tsx`
  - `onSubmit(...)` is where the live output draft is persisted into `dasti:proposal-output-draft:v1`

Why this matters:

- if `updateGeneratedProposal(...)` is slow, stalled, or never resolves, the browser never reaches `ProposalForge`'s `onSubmit(...)`
- compose draft can still exist because compose persistence happens locally before generation completes
- output draft can be missing entirely because the local output writer is downstream of that blocked callback

Why this matches the reported local-storage snapshot:

- the user reported seeing only:
  - `dasti:proposal-compose-draft:v1`
  - no `dasti:proposal-output-draft:v1`
- the reported storage contents are exactly what this ordering bug can produce:
  - compose title/brief survive
  - generated output is absent from local storage

Proof level:

- this is now covered by focused test evidence:
  - `my-app/src/components/__tests__/ProposalInputForm.provider-busy.test.tsx`
  - `calls onSubmit without waiting for the generated-proposal status sync mutation`
- that test holds the status-sync mutation open and proves the local submit path must not wait on it

Regression window:

- this blocking ordering is present in `13b4bed2`
- still present in `815a1c25`
- still present in `HEAD` before this audit fix

Conclusion:

- this is a real live-runtime bug in the active generation path
- the smallest safe fix is to commit local submit/output state immediately after generation returns, then run the server draft-status sync in the background

### 6. Output draft storage failures were silent, making the browser state look inconsistent

Active path:

- `writeStoredProposalOutputDraft(...)` in `proposal-output-draft.ts`
- before the fix, any serialization or local-storage failure dropped the whole write silently

Why this matters:

- if the proposal output is already visible in React state but the output-draft write fails, the browser UI can look correct while developer tools show no `dasti:proposal-output-draft:v1`
- compose draft may still be present because it is a much smaller, separate local-storage write

Proof level:

- I can prove the silent-failure hole existed in code
- I cannot prove from code alone which exact browser/runtime value triggered it in the user's session

Fix:

- the writer now:
  - warns instead of failing silently
  - retries with a sanitized fallback payload
  - preserves the output-draft key whenever the essential fields are still serializable

### 7. Plain `/proposal` re-entry restored output and compose from different sources

Active path before the fix:

- output state restored from `dasti:proposal-output-draft:v1`
- compose form restored from `dasti:proposal-compose-draft:v1`

Problem:

- after a proposal was generated, later unsent typing in the compose brief kept updating `dasti:proposal-compose-draft:v1`
- on a later plain `/proposal` revisit, the UI could restore:
  - output from the generated draft
  - compose from later unsent edits
- that produced the exact mismatch the user reported:
  - generated proposal still visible
  - compose/job-offer text showing `fhtf...`

Proof level:

- this is now covered by focused route-level test evidence
- `ProposalForge.draft-persistence.test.tsx`
- `prefers the generated output source brief over later unsent compose edits on plain proposal re-entry`

Fix:

- the stored output draft now carries `sourceComposeDraft`
- active `/proposal` re-entry seeds compose restore from that source snapshot
- active `/proposal` also syncs the compose-draft local-storage key back to that source snapshot on re-entry so the devtools value and the visible UI agree again

### 8. Sidebar invalidation was broader than the data it actually needs

Active sidebar usage:

- sidebar uses compose draft title for the current proposal label
- sidebar does not use compose `jobDescription`

But before the fix:

- every compose-draft update replaced sidebar compose state
- `jobDescription` typing caused sidebar state churn even when the visible sidebar title did not change

Conclusion:

- this is a safe optimization target because it does not change user-visible saved/compose semantics

### 9. What I could not prove

- I could not prove that extra remounts are the dominant lag source
- I could not prove that route/view rebuilds are the dominant lag source
- I could not prove a browser-measured latency delta in this audit, because the user explicitly redirected the work away from Playwright/browser verification
- I could not prove the exact browser-specific trigger for the "visible output but no output-draft key" report; I could only prove:
  - the submit ordering bug
  - the silent output-writer failure hole

## Git Interpretation

### `13b4bed2`

- added draft restore model
- established saved view + explicit copy-back semantics
- already included handoff prefill support in the compose form
- introduced per-change compose persistence path
- introduced the partial copy-back overwrite bug
- already blocked local submit/output persistence behind awaited `updateGeneratedProposal(...)`

### `88cfb1b9`

- introduced the live route behavior that consumes imported handoffs and strips `handoffId`
- made durable compose-draft persistence the only way to reopen imported handoff text after a later plain `/proposal` revisit

### `815a1c25`

- changed save-to-library to navigate directly into the saved route
- reinforced the explicit "saved copy" vs "live draft" split
- did not change the core copy-back semantics

### `8c891236` and later

- changed saved-view chrome/layout and compose panel presentation
- did not change the core rule that saved view is separate from compose and `Duplicate to draft` is the restore action

## Fix Chosen

Targeted code fix, not revert.

Why:

- reverting `815a1c25` would undo the intentional save-to-library saved-route workflow
- reverting `13b4bed2` would undo proposal workspace recovery
- the safe fix is:
  - commit local output draft state before waiting on server draft-status sync
  - durably persist imported handoff compose text at the active route level
  - let the live brief UI fall back to active handoff text while the handoff is present
  - preserve existing compose brief when saved metadata lacks `sourceJobDescription`
  - reduce duplicate draft writes/events
  - reduce sidebar churn on brief-body-only edits

## Exact Files Changed

- `.gitignore`
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/components/ProposalInputForm.tsx`
- `my-app/src/components/__tests__/ProposalInputForm.provider-busy.test.tsx`
- `my-app/src/components/Sidebar.tsx`
- `my-app/src/lib/proposal-workspace-state.ts`
- `my-app/src/lib/proposal-output-draft.ts`
- `my-app/src/lib/__tests__/proposal-output-draft.test.ts`
- `my-app/src/pages/__tests__/ProposalForge.draft-persistence.test.tsx`
- `my-app/src/pages/__tests__/ProposalForge.handoff-continuity.test.tsx`
- `my-app/src/pages/__tests__/ProposalForge.saved-view.test.tsx`
- `my-app/src/pages/__tests__/ProposalForge.save-to-library.test.tsx`
- `my-app/src/lib/__tests__/proposal-workspace-state.test.ts`
- `my-app/docs/audits/2026-03-31-proposal-reopen-lag-audit.md`
- `my-app/docs/plans/2026-03-31-proposal-reopen-lag-recovery-plan.md`

## Verification

### Automated

Executed from `my-app/`:

```bash
npx vitest run src/components/__tests__/ProposalInputForm.provider-busy.test.tsx src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.handoff-continuity.test.tsx src/pages/__tests__/ProposalForge.saved-view.test.tsx src/pages/__tests__/ProposalForge.save-to-library.test.tsx src/lib/__tests__/proposal-workspace-state.test.ts src/lib/__tests__/proposal-output-draft.test.ts src/components/__tests__/Sidebar.proposal-navigation.test.tsx --reporter=verbose
```

Result:

- 8 test files passed
- 45 tests passed

### Browser/manual

- No Playwright/browser verification was completed in the final audit path.
- Reason: the user explicitly instructed "no fuck playwright look the code".
- Result: browser-measured lag remains unproven in this audit.

## Manual Verification Steps To Run Later

1. Open `/proposal`
2. Open `/proposal?handoffId=<real imported handoff>`
3. Confirm the imported title and job-offer text appear, then navigate away and back to `/proposal`
   - expected: the imported compose brief still appears instead of older stale text
4. Generate a proposal, then inspect browser local storage
   - expected: `dasti:proposal-output-draft:v1` exists after generation returns
   - expected: if the full payload cannot be serialized cleanly, a sanitized output-draft payload still exists instead of no key
5. Leave `/proposal`, then come back to plain `/proposal`
   - expected: generated output restores from `dasti:proposal-output-draft:v1`
   - expected: compose/job-offer text restores from the output draft's source brief, not from later unsent `dasti:proposal-compose-draft:v1` edits
6. Type several sentences into the job-offer field and confirm the sidebar no longer visibly churns while the proposal title stays unchanged
7. Save a proposal, open the saved route, then click `Back to draft`
   - expected: previous live draft remains intact
8. From the same saved route, click `Duplicate to draft`
   - expected: saved proposal content becomes the live draft output
9. Repeat step 8 with a saved proposal missing `metadata.sourceJobDescription`
   - expected: existing compose `jobDescription` survives

## Bottom Line

- The active runtime says saved view and live draft are intentionally separate.
- The real reopen bug on the imported handoff path was that the route stripped `handoffId` without directly guaranteeing durable compose-draft persistence.
- The real missing-output bug was that local output persistence waited behind an awaited server draft-status sync.
- The real browser-reproduced storage bug was that output-draft persistence could fail with `QuotaExceededError`, leaving only the stale compose draft in localStorage while the restore path lost the generated-output snapshot.
- The real plain `/proposal` mismatch bug was that output and compose restored from different storage sources after generation.
- The real saved-draft bug was the partial compose overwrite in `Duplicate to draft`.
- The provable lag source is duplicated draft persistence plus unnecessary sidebar invalidation on compose edits.
- The browser console now also proves that quota pressure is a separate failure mode from the reopen regression. The targeted mitigation is session-storage fallback for the output draft, not a broader persistence rewrite.
- The browser console also proves quota pressure was part of the lag path itself: repeated synchronous `localStorage.setItem(...)` failures on the output-draft key added blocking work on proposal open/restore. The follow-up mitigation is to stop retrying local-storage writes after the first quota failure in the same tab session and use session storage directly until reset.
