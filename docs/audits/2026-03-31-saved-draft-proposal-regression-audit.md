# Saved Draft Proposal Regression Audit

Date: 2026-03-31

## Scope

- Reopening a saved draft proposal no longer restored the saved compose/job-offer text.
- Audit the active save/load/hydration/render path.
- Inspect git history to identify where the behavior regressed.
- Answer the related performance questions from code evidence.

## Active Runtime

Active code:
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/App.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`

Verified runtime:
- `/proposal` renders `ProposalForge`
- `/proposal-next` is not the live runtime for this flow

Legacy but informative:
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForgeNext.tsx`

## Save / Load / Hydration Path

### Save path

The saved proposal metadata is assembled in:
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`

`proposalPersistenceMetadata` includes:
- `sourceJobDescription` from `lastProposalRequest.jobDescription`
- or fallback `readStoredProposalComposeDraft().jobDescription`

That metadata is persisted through:
- `createProposal(...)` in `handleSaveOutputToLibrary`
- `updateProposal(...)` in saved draft updates

Backend schema still accepts and returns `sourceJobDescription`:
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/updateProposalPublic.ts`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/proposalsPublic.ts`

### Load path

Saved proposals are loaded into `openedSavedProposal` from:
- `proposalsPublic.default`

Saved view is entered through:
- `?view=saved&id=<proposalId>`
- or bare `?id=<proposalId>` compatibility path

### Draft restore path

The only path that explicitly copies saved proposal data back into the live compose draft is:
- `handleCopySavedProposalToDraft()`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`

That path:
- restores proposal output into page state
- writes a compose draft to `dasti:proposal-compose-draft:v1`
- remounts `ProposalInputForm` via `composeFormInstanceKey`

## Confirmed Regression

Root cause:
- `handleCopySavedProposalToDraft()` was rebuilding a partial compose draft and writing it with `writeStoredProposalComposeDraft(...)`
- `writeStoredProposalComposeDraft(...)` replaces the full stored draft
- when a saved proposal did not carry `metadata.sourceJobDescription`, the restore path omitted or wrote an empty `jobDescription`
- the full compose draft in localStorage was therefore overwritten and the saved job-offer text disappeared on reopen

Files:
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/proposal-workspace-state.ts`

## Git Evidence

Working committed behavior:
- commit `815a1c25` `Fix proposal save-to-library workflow`

In that committed version, `handleCopySavedProposalToDraft()` only wrote `jobDescription` when `restoredSourceJobDescription` was truthy.

Current regressed tree before the fix:
- the live file always rebuilt a partial compose draft and replaced the stored draft
- this regressed behavior was present in the working tree, not introduced by a clean historical commit identified in `git log`

Conclusion:
- git history shows the committed implementation was safer
- the regression came from later live-tree changes after the committed saved-draft recovery work

## Fix Applied

File changed:
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`

Change:
- `handleCopySavedProposalToDraft()` now starts from `readStoredProposalComposeDraft() ?? {}`
- saved-view restore overlays the fields it really knows
- `jobDescription` is only overwritten when `restoredSourceJobDescription` is non-empty

This preserves the existing compose/job-offer text for saved proposals that do not include source brief metadata.

## Tests Added / Updated

File changed:
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/__tests__/ProposalForge.saved-view.test.tsx`

Added regression:
- saved proposal without `metadata.sourceJobDescription`
- existing compose draft already contains job-offer text
- `Duplicate to draft` keeps the existing compose brief instead of wiping it

Focused test run:

```bash
npm test -- src/pages/__tests__/ProposalForge.saved-view.test.tsx src/pages/__tests__/ProposalForge.draft-persistence.test.tsx
```

Result:
- 2 files passed
- 8 tests passed

## Performance Audit

### Did the save pipeline patch introduce the lag?

No direct evidence.

Code comparison shows the current per-keystroke compose draft write path already existed in earlier committed `ProposalForge`/`ProposalInputForm` code before this saved-draft fix.

Evidence:
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalInputForm.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`
- older committed code from `815a1c25` already had:
  - `form.watch(...)` -> localStorage write + compose draft event
  - `onValuesChange` -> page-level update path

The saved-draft fix itself is not a credible source of typing lag.

### Are page switches doing unnecessary remounts/rebuilds?

Partly.

Expected:
- switching `/proposal` -> `/cv` -> `/proposal` fully unmounts and remounts the route

Extra rebuilds:
- `ProposalInputForm` is force-remounted via `composeFormInstanceKey` after explicit draft-copy/reset flows
- not on ordinary typing

Conclusion:
- route remount is expected
- the main lag signal is not route switching itself

### Are render/save jobs constrained to one active job where appropriate?

Yes for generation flows:
- `ProposalInputForm` gates submit with `isGenerating`
- uses `activeGenerateRunIdRef`
- uses `activeGenerationClientRunIdRef`
- regeneration is separately gated by `isRegeneratingGeneratedProposal`
- save-to-library and generated-proposal commit are guarded by `isSavingOutputToLibrary` and `isSavingGeneratedProposal`

### Are stale in-flight jobs cancelled?

Partly.

Generation stop:
- sends `requestProposalGenerationCancel({ clientRunId })`
- stale/stopped results are ignored with local run id checks

What is missing:
- no browser-side `AbortController` for the request path

Conclusion:
- stale results are guarded against
- cancellation is partial, not full transport abort

### Is autosave firing too often?

Yes.

On every compose change:
- `ProposalInputForm` writes `dasti:proposal-compose-draft:v1`
- dispatches `PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT`
- calls `onValuesChange`

Then `ProposalForge`:
- updates `lastProposalRequest`
- updates toolbar voice state

This is keystroke-level persistence and state churn.

### Is global/sidebar state invalidating too much UI?

Yes, likely.

`Sidebar` listens to:
- `PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT`
- `PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT`
- `storage`
- `focus`
- `visibilitychange`

On compose/output draft events it refreshes local workspace snapshot state, which is enough to rerender sidebar UI during editing.

### Is lag CPU/render driven, save/network driven, or layout/reflow driven?

Primary likely cause:
- CPU/render/state churn

Why:
- compose edits write localStorage and dispatch events on every keystroke
- sidebar refreshes proposal workspace snapshot on those events
- page-level state also updates on every keystroke

Not the primary cause:
- network save on every keystroke

Reason:
- network writes are still guarded around explicit save/regenerate/commit flows, not the base compose typing path

Secondary contributors:
- localStorage serialization
- global/sidebar rerenders

## Recommended Next Perf Pass

Not part of this bug fix, but the next likely high-value perf cleanup is:

1. Collapse compose-draft persistence to one owner
   - either `ProposalInputForm`
   - or `ProposalForge`
   - not both via watcher + page callback

2. Reduce sidebar invalidation frequency
   - avoid refreshing sidebar workspace snapshot on every compose keystroke
   - prefer a narrower or deferred update path

3. Keep generation cancellation logic, but do not treat it as full transport cancellation

## Final Status

Saved-draft reopen regression:
- fixed

Performance diagnosis:
- answered from active code and git evidence
- no perf patch shipped in this audit pass
- next work should target per-keystroke draft persistence churn and sidebar invalidation
