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

### 9. CV local-storage duplication was a proven quota-pressure source

Active code before the follow-up pass:

- `CvLibraryContext.tsx`
  - persisted the CV index under both `cvDocuments` and legacy `cvLibrary`
  - persisted full document snapshots under `cv:${id}`
- `StorageAdapter.ts`
  - also persisted the same full document snapshots under legacy `cv-doc:${id}`

Why this matters:

- the app was keeping duplicated document-scale payloads in synchronous browser storage
- proposal-output quota failures were already proven in the browser console
- duplicated CV cache keys increase the chance of hitting quota over time and make storage enumeration heavier

Fix:

- keep `cvDocuments` as the active library key and clear legacy `cvLibrary`
- keep `cv:${id}` as the active document key and clear legacy `cv-doc:${id}`
- migrate legacy keys on mount/read so existing browser profiles still recover

Proof level:

- high confidence from active code inspection
- I did not measure exact byte totals in the user profile, so this is a proven pressure source but not a quantified one

### 10. `ProposalForge` still did parent-level compose work on every change after the storage fixes

Active code before the follow-up pass:

- `ProposalInputForm.tsx`
  - `form.watch(...)` still emitted the full normalized compose payload on every change
- `ProposalForge.tsx`
  - `handleProposalFormValuesChange(...)` persisted the compose draft and stored the full `FormValues` in parent state through `setLastProposalRequest(values)`
  - style resolution, brief rendering, and character-limit state were derived from that parent object

Why this matters:

- long imported job offers were re-pushed into page-level React state on every edit
- that forced the proposal page to rebuild render state for the live brief and style derivation far more often than needed
- this matches the remaining lag symptom after the quota-fallback fixes, once the visible reopen bug was already gone

Fix:

- `ProposalForge.tsx` now keeps a lightweight `composePreviewValues` snapshot for live compose UI state
- compose-draft persistence is batched with a short timeout instead of synchronously updating page state on every watch emission
- submit, delete, reset, saved-copy, and handoff-restore paths explicitly flush or replace the pending compose snapshot so correctness is preserved

Proof level:

- proven from active code inspection that this parent-state churn existed
- I can prove the code path is reduced now
- I cannot yet prove from code alone that this removes all remaining browser lag

### 11. Sidebar resume switching still had a separate hot path

Browser evidence from the user after the earlier proposal-focused fixes:

- `Sidebar.tsx:822 [Violation] 'requestAnimationFrame' handler took 604ms`
- `Sidebar.tsx:822 [Violation] 'requestAnimationFrame' handler took 970ms`
- `Sidebar.tsx:822 [Violation] 'requestAnimationFrame' handler took 490ms`

Active code before the follow-up pass:

- `Sidebar.tsx`
  - wrapped `loadCv(targetId)` inside `window.requestAnimationFrame(...)`
- `CvLibraryContext.tsx`
  - `loadCv(...)` did not first reuse the already-loaded in-memory `cvs` list
  - it proceeded into storage parsing and normalization work even when the target CV was already in memory
- `Sidebar.tsx`
  - also re-read proposal draft storage directly during render, even though it already maintained draft state from events

Why this matters:

- resume switching and workspace switching can still feel laggy even after proposal-draft storage fixes
- the browser was explicitly attributing long frames to the sidebar callback path, not only to proposal focus

Fix:

- `Sidebar.tsx` now uses `React.startTransition(...)` for queued resume loads instead of `requestAnimationFrame(...)`
- `CvLibraryContext.tsx` now checks `currentCv` and the in-memory `cvs` collection before hitting browser storage
- `Sidebar.tsx` now relies on its maintained draft state instead of re-reading proposal draft storage during render

Proof level:

- proven from active code and the user browser logs that this was a real hot path
- I can prove the code path is reduced now
- I still cannot prove from code alone that this removes all remaining lag in the browser

### 12. A real storage measurement hook is now installed in dev mode

What changed:

- `App.tsx` now installs a dev-only browser helper
- `storage-diagnostics.ts` exposes `window.__DASTI_STORAGE_DIAGNOSTICS__`
- the helper reports localStorage and sessionStorage footprint by key, sorted by size, with proposal/CV keys highlighted

Why this matters:

- quota pressure is proven, but exact browser key sizes were still unmeasured
- the plan called for measured storage by key before broader persistence migration

Proof level:

- the helper is covered by focused tests
- it still requires a real browser profile to produce the final measured offender list

### 13. What I could not prove

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
- `my-app/src/App.tsx`
- `my-app/src/adapters/StorageAdapter.ts`
- `my-app/src/contexts/CvLibraryContext.tsx`
- `my-app/src/contexts/__tests__/CvLibraryContext.test.tsx`
- `my-app/src/lib/cv-local-storage.ts`
- `my-app/src/lib/storage-diagnostics.ts`
- `my-app/src/lib/__tests__/storage-diagnostics.test.ts`
- `my-app/src/lib/proposal-personalization.ts`
- `my-app/src/lib/proposal-workspace-state.ts`
- `my-app/src/lib/proposal-output-draft.ts`
- `my-app/src/lib/__tests__/proposal-output-draft.test.ts`
- `my-app/src/lib/__tests__/proposal-personalization.test.ts`
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

Executed from `my-app/` after the storage-reduction and parent-sync follow-up:

```bash
npx vitest run src/contexts/__tests__/CvLibraryContext.test.tsx src/lib/__tests__/proposal-personalization.test.ts src/lib/__tests__/proposal-output-draft.test.ts src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.handoff-continuity.test.tsx src/components/__tests__/Sidebar.proposal-navigation.test.tsx --reporter=verbose
```

Result:

- 6 test files passed
- 35 tests passed

Executed from `my-app/` after the debounced `ProposalForge` compose-sync change:

```bash
npx vitest run src/lib/__tests__/proposal-personalization.test.ts src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.handoff-continuity.test.tsx src/components/__tests__/Sidebar.proposal-navigation.test.tsx src/lib/__tests__/proposal-output-draft.test.ts --reporter=verbose
npx tsc -p tsconfig.json --noEmit --pretty false
```

Result:

- 5 test files passed
- 26 tests passed
- TypeScript check passed

Executed from `my-app/` after the sidebar resume-load and diagnostics follow-up:

```bash
npx vitest run src/lib/__tests__/storage-diagnostics.test.ts src/contexts/__tests__/CvLibraryContext.test.tsx src/components/__tests__/Sidebar.proposal-navigation.test.tsx src/lib/__tests__/proposal-personalization.test.ts src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.handoff-continuity.test.tsx --reporter=verbose
npx tsc -p tsconfig.json --noEmit --pretty false
```

Result:

- 6 test files passed
- 39 tests passed
- TypeScript check passed

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
- A follow-up storage-reduction pass now removes duplicate CV cache writes under `cv-doc:` and the duplicate legacy library key `cvLibrary`, while keeping backward reads intact. This reduces quota pressure from accumulated CV cache data without changing proposal semantics.
- A second follow-up pass now reduces active `/proposal` parent churn by batching compose-draft sync and deriving live brief/style state from a lightweight compose preview snapshot instead of the full last submitted request object.
- A third follow-up pass now targets sidebar and resume-switch lag directly by removing `requestAnimationFrame`-based resume loading, reusing in-memory CV documents before parsing storage, and avoiding draft-storage reads during sidebar render.
- A dev-only storage diagnostics helper now exists so the real browser footprint can be measured by key instead of inferred from quota warnings.
- User browser logs improved on the active focus path, but the remaining `message`-handler violations are still not fully attributable from code alone, so lag is reduced but not yet proven fully solved.
