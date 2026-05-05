# Proposal Save / Autosave / Library Lifecycle Plan

## Context

The audit in `docs/audits/2026-05-05-proposal-save-autosave-library-audit.md` confirmed that active Proposal Forge behavior had drifted from the intended product lifecycle:

- generated proposals should begin as editable drafts, not finalized documents;
- autosave should protect generated proposal variants as server-backed draft proposal rows;
- Proposal Library should make those draft variants visible instead of hiding them behind local recovery state;
- explicit Save/Finalize should promote the chosen draft row to a finalized saved proposal;
- saved documents should open without silently mutating the active draft;
- `Duplicate to draft` should be explicit and should create a separate draft identity from the saved original;
- job-linked proposal rows should preserve job context cleanly.

The previous plan restored the draft/saved boundary by keeping saved lists saved-only. That protected saved documents, but it created a product mismatch: users generate multiple useful variants and expect them to appear in the Proposal Library. The revised lifecycle is:

> Proposal Library owns both server-backed draft proposals and saved proposals. `status: "draft"` means an autosaved generated proposal variant that is visible and editable. `status: "saved"` means a finalized proposal. Save/Finalize promotes the active draft row in place from `draft` to `saved`.

## Lifecycle rules

1. **Generate creates a new draft identity.**
   - A new generation is created when the user clicks Generate from the job/CV/form flow.
   - `handleProposalStart` must clear any prior `generatedProposalId` before generation begins.
   - The generation result id becomes the active draft id.
   - If the generation backend does not return a persisted id, the first autosave must create a new `status: "draft"` row.

2. **Edit updates the current draft identity.**
   - Same-draft edits include body edits, heading edits, style changes, metadata/details edits on the loaded draft, Ask AI/refinement on the current draft, and normal autosave.
   - Autosave updates only the currently active proposal row referenced by `generatedProposalId` and persists it as `status: "draft"` unless the row has been finalized.

3. **Proposal Library shows Drafts and Saved.**
   - Preferred UI: two sections: `Drafts` and `Saved`.
   - Acceptable interim UI: one grid/list with clear Draft/Saved chips.
   - The data model must still distinguish `status: "draft"` from `status: "saved"`.
   - LocalStorage draft state is only recovery/cache for the active workspace, not the source of Proposal Library rows.

4. **Save/Finalize promotes in place.**
   - Save/Finalize changes the active proposal row from `status: "draft"` to `status: "saved"`.
   - It should not clone a second saved copy or leave an accidental duplicate draft card.
   - Promotion in place preserves job linkage, document identity, and a simple mental model: “this draft became saved.”
   - Version history, if needed later, should be explicit versioning rather than accidental clones.

5. **Saved open is inspect/edit-saved state, not draft mutation.**
   - Opening `/proposal?view=saved&id=...` hydrates saved-view state only.
   - It must not mutate current draft localStorage or copy the saved proposal into the compose workspace.

6. **Duplicate saved to draft creates a new identity.**
   - Duplicate creates a new `status: "draft"` proposal row detached from the saved original.
   - The duplicate may preserve supported context such as `metadata.jobId`, top-level `jobId`, source CV id, content, title, and style metadata.
   - It must never overwrite the saved original.

7. **Job detail counts are explicit.**
   - `savedProposalCount`: finalized proposals.
   - `draftProposalCount`: generated draft proposal variants.
   - UI may show `2 saved · 3 drafts`, or surface drafts only in Proposal Forge/job context, but must not mix draft and saved rows into one unlabeled “linked proposals” number.

## Approach

Use the smallest correction that preserves the safety fixes already made while adding visible server-backed drafts:

1. Keep compose/output autosave writing `status: "draft"` for generated proposal variants.
2. Ensure every user-triggered Generate starts a new proposal identity by clearing `generatedProposalId` before the generation call and treating the returned generation id as the active draft id.
3. Change Proposal Library data loading so library surfaces can read both `draft` and `saved` proposal rows. Prefer adding a new clearly named query if existing `proposalsPublic.default` must remain saved-only for compatibility.
4. Update Proposal Library rendering to show Draft and Saved sections, or one grid with Draft/Saved chips if a two-section layout is too large for this pass.
5. Keep current localStorage output/compose draft state only as workspace recovery/cache. Do not synthesize library rows from localStorage.
6. Save/Finalize should call the existing save path with `status: "saved"` and promote the active row in place. After successful promotion, detach the active draft workspace state so the finalized row is not still treated as the current editable draft.
7. Keep saved-open hydration isolated to `savedProposal*` state.
8. Change `Duplicate to draft` from local-only clone semantics to a new draft identity. It may hydrate the workspace immediately, but persistence must create/update a new draft row, not the saved original.
9. Preserve job linkage through existing validated fields (`metadata.jobId`, mirrored top-level `jobId`) and expose separate saved/draft job counts.
10. Keep heading persistence inside current Convex validators; do not add unsupported metadata fields for `subject` or `salutation` in this pass.

## Files to modify

- `my-app/src/pages/ProposalForge.tsx`
  - keep `handleProposalStart` clearing `generatedProposalId` and confirm the generate submit path cannot reuse a prior row;
  - ensure generation result id becomes the active draft id (`generatedProposalId`) and subsequent autosave updates that draft row with `status: "draft"`;
  - ensure an id-less generation causes the first autosave to create a new `draft` row;
  - update Save/Finalize (`handleSaveOutputToLibrary`) to promote the active row in place to `status: "saved"`, then detach active draft state/local recovery cache without cloning;
  - keep saved route hydration read-only with respect to active draft state;
  - update `handleCopySavedProposalToDraft` so duplicate saved-to-draft creates or targets a new draft identity and never points `generatedProposalId` at the saved original;
  - preserve job linkage in `proposalPersistenceMetadata` from `canonicalJobId`, prefill job id, or duplicate-source job context using validated metadata fields only.

- `my-app/convex/proposalsPublic.ts`
  - change the existing public proposal query to return both `draft` and `saved` rows for library surfaces, **or** add a new query such as `listLibraryProposals` / `listProposalLibraryRows` that returns both statuses while leaving the saved-only query intact;
  - project a stable public shape including `_id`, title, content/sections, `status`, timestamps, metadata, and job linkage backfilled from `metadata.jobId` or top-level `jobId`;
  - keep rows scoped to the current user profile(s), sorted by recency, and bounded deliberately.

- `my-app/convex/schema.ts`
  - keep/add compound indexes needed for bounded status queries, including `by_user_and_status` and `by_job_and_status`;
  - add any additional compound index only if the new draft+saved library query cannot be bounded with existing indexes.

- `my-app/convex/jobsPublic.ts`
  - expose separate `savedProposalCount` and `draftProposalCount` for job detail;
  - expose clearly named saved and draft linked proposal previews if UI needs both;
  - avoid filtering draft/saved status after a small bounded `by_job` read that can miss rows.

- `my-app/src/components/ProposalsList.tsx`
  - render Proposal Library as two sections (`Drafts`, `Saved`) or a single grid/list with clear Draft/Saved chips;
  - allow draft rows from the server-backed proposal query;
  - draft rows should open as editable draft documents in Proposal Forge, not as finalized saved inspect view;
  - saved rows should open in saved inspect/finalized view;
  - do not derive library rows from `readStoredProposalOutputDraft()`.

- `my-app/src/components/Sidebar.tsx`
  - render proposal recents with Draft/Saved labeling when server rows are available;
  - keep local output/compose draft state as recovery for the active workspace only, not as a replacement for server-backed draft rows;
  - ensure a promoted saved row no longer appears as the active draft after Save/Finalize.

- `my-app/src/pages/DocumentsPage.tsx`
  - include server-backed draft proposals in the Documents/Drafts surface with a Draft chip;
  - include saved proposals in the Proposals/Saved surface with a Saved chip;
  - keep local compose/output recovery draft as a separate recovery item only when no server-backed active draft row represents it;
  - continue using `composeDraft.jobDescription` for local draft snippets.

- Tests:
  - `my-app/src/pages/__tests__/ProposalForge.saved-view.test.tsx`
  - `my-app/src/pages/__tests__/ProposalForge.save-to-library.test.tsx`
  - `my-app/src/pages/__tests__/ProposalForge.autosave.test.tsx`
  - `my-app/src/pages/__tests__/ProposalForge.draft-persistence.test.tsx`
  - `my-app/src/pages/__tests__/ProposalForge.output-draft-guard.test.tsx`
  - `my-app/src/pages/__tests__/ProposalForge.job-id-auth-hydration.test.tsx` or closest job-id test
  - `my-app/src/components/__tests__/Sidebar.proposal-navigation.test.tsx`
  - `my-app/src/pages/__tests__/DocumentsPage.test.tsx`
  - `my-app/convex/__tests__/proposalsPublic.test.ts`
  - `my-app/convex/__tests__/jobsPublic.test.ts`
  - schema/index validation or generated Convex type update if a new proposal index is added

## Reuse

- `ProposalForge.tsx::buildComposeSaveSnapshot`, `performProposalSave`, and `flushScheduledProposalSave` already support `status: "draft" | "saved"`; preserve this path.
- `generatedProposalId` / `generatedProposalIdRef` are the active proposal identity pointers. The revised contract is:
  - cleared before a user-triggered new Generate;
  - set to the generation result id or first autosave-created draft id;
  - retained for same-draft edits/autosave;
  - promoted in place on Save/Finalize;
  - never pointed at a saved original when duplicating to draft.
- Existing `writeStoredProposalOutputDraft(null)` / compose workspace helpers remain valid for detaching local recovery cache after promotion.
- `suppressStoredOutputDraftSyncRef`, `composeAutosaveTimeoutRef`, `pendingQueuedComposeSnapshotRef`, `latestComposeAutosaveSnapshotRef`, and the unmount cleanup save effect remain the key cleanup points after promotion.
- Convex proposal validators in `schema.ts`, `createProposalPublic.ts`, `updateProposalPublic.ts`, `proposalsPublic.ts`, and `proposals.ts` define the safe metadata boundary.
- Existing tests listed above should be extended rather than replaced.

## Steps

- [ ] Add/adjust regression tests first for the revised lifecycle:
  - [ ] two user-triggered Generate actions for the same job but different CV/title/form inputs create two distinct `status: "draft"` proposal rows;
  - [ ] those two draft rows both appear in Proposal Library with Draft chips or under a Drafts section;
  - [ ] edits, heading changes, style changes, Ask AI, and autosave on one loaded draft update that same draft id rather than creating a new row;
  - [ ] Save/Finalize promotes the active draft row in place to `status: "saved"`, removes it from Drafts, and shows it under Saved without creating a duplicate card;
  - [ ] opening `/proposal?view=saved&id=...` does not call duplicate-to-draft behavior, does not navigate to compose, does not call create/update mutations for draft state, and does not overwrite compose/output local storage;
  - [ ] clicking `Duplicate to draft` from a saved proposal creates a new `status: "draft"` row, preserves supported job/CV/style context, routes to editable draft intentionally, and never updates the saved original;
  - [ ] job-linked generation/save/duplicate preserve `jobId` in supported Convex fields without adding unsupported local-storage fields;
  - [ ] `ProposalsList`, Sidebar, and Documents render server-backed Draft/Saved rows separately from local recovery cache.
- [ ] Update proposal public querying to support library rows with both `draft` and `saved` statuses.
- [ ] Update `ProposalsList` to render Drafts and Saved sections, or a single grid with clear Draft/Saved chips as an interim UI.
- [ ] Update Sidebar and Documents surfaces to label draft and saved proposal rows clearly.
- [ ] Ensure `handleProposalStart` clears prior `generatedProposalId` and pending autosave identity before each user-triggered Generate.
- [ ] Ensure `handleProposalSubmit` / generation completion sets `generatedProposalId` to the returned draft id when available.
- [ ] Ensure autosave updates only the active draft row with `status: "draft"` unless Save/Finalize is explicitly running.
- [ ] Update Save/Finalize to promote the active id in place to `status: "saved"`, then detach active draft state/cache.
- [ ] Update Duplicate saved-to-draft so persistence creates a new `draft` identity and does not reuse the saved id.
- [ ] Update `jobsPublic.ts` and tests to expose separate saved/draft job proposal counts.
- [ ] Run focused tests, then the existing proposal persistence suite.

## Verification

Use `rtk` for all commands.

Focused unit/component checks:

```bash
rtk npm test -- src/pages/__tests__/ProposalForge.saved-view.test.tsx src/pages/__tests__/ProposalForge.save-to-library.test.tsx
rtk npm test -- src/pages/__tests__/ProposalForge.autosave.test.tsx src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.output-draft-guard.test.tsx
rtk npm test -- src/components/__tests__/Sidebar.proposal-navigation.test.tsx src/pages/__tests__/DocumentsPage.test.tsx
rtk npm test -- src/pages/__tests__/ProposalForge.job-id-auth-hydration.test.tsx src/pages/__tests__/ProposalForge.job-id-brief.test.tsx
rtk npm test -- convex/__tests__/jobsPublic.test.ts convex/__tests__/proposalsPublic.test.ts
```

Broader proposal persistence regression suite:

```bash
rtk npm test -- src/pages/__tests__/ProposalForge.draft-persistence.test.tsx src/pages/__tests__/ProposalForge.output-draft-guard.test.tsx src/pages/__tests__/ProposalForge.saved-view.test.tsx src/pages/__tests__/ProposalForge.save-to-library.test.tsx src/pages/__tests__/ProposalForge.attached-cv-sync.test.tsx
```

Browser flow if local app/test environment is available:

```bash
rtk npx tdpw test e2e/proposal-workspace-roundtrip.spec.ts --project=chromium
```

Manual checks:

- Generate proposal A for job X/CV 1: Proposal Library shows A as Draft.
- Change CV/title/form input and click Generate again: Proposal Library shows proposal B as a second Draft; A is not overwritten.
- Edit body/heading/style or use Ask AI on B: B updates in place; no third row is created.
- Save/Finalize B: B moves from Drafts to Saved in place; no duplicate card remains.
- Open saved proposal B from Proposal Library/Documents/Sidebar: stays in saved/finalized view and does not mutate local draft storage.
- Duplicate saved B to draft: creates proposal C as Draft; saved B remains unchanged.
- Job detail for job X shows separate saved and draft counts, not one ambiguous mixed count.
