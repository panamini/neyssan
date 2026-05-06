# Proposal Forge style layer regression audit

Date: 2026-05-06

## Goal

Audit the Proposal Forge style-layer regression described in the handoff and identify the active code path, confirmed defects, likely root cause, and smallest safe implementation plan.

## Scope

This audit started as read-only. The follow-up implementation is tracked in code/tests under `my-app/`.

Active code inspected:

- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/components/proposal/ProposalRail.tsx`
- `my-app/src/features/verbati/styleState.ts`
- `my-app/src/lib/proposal-output-draft.ts`
- `my-app/convex/createProposalPublic.ts`
- `my-app/convex/updateProposalPublic.ts`
- nearby Proposal Forge tests under `my-app/src/pages/__tests__/`

There is no top-level `v1/` directory in this worktree. The active Proposal Forge implementation is currently under `my-app/`.

## User-reported behavior

1. Draft A is opened and set to `Style 1`.
2. Draft B is opened and set to `Style 2`.
3. Reopening Draft A shows the rail label as `Style 1`, but the rendered font/color are from Draft B.
4. Editing font/color while Draft A is open also changes Draft B.
5. Job context is linked again, but the job offer title does not appear tied to the actual parsed/selected offer from the website extension.

## Executive finding

The style regression is confirmed in active code.

`ProposalForge.tsx` hydrates a draft's persisted style metadata when `draftId` changes, but it does not atomically reset the transient runtime style layer. Because `resolveProposalStyle()` gives `proposalWorkspaceStyle` priority whenever `hasUserEditedStyle` is true, a previously opened draft's workspace style can continue winning over the newly loaded draft metadata.

This matches the reported split-brain state: the rail label can come from freshly loaded bundle/helper metadata while the renderer consumes stale `proposalWorkspaceStyle` from another draft.

## Confirmed facts

### Active style ownership is split across multiple states

In `my-app/src/pages/ProposalForge.tsx`, Proposal Forge keeps document style across separate state variables:

- `proposalStylePreset`
- `proposalWorkspaceStyle`
- `hasUserEditedStyle`
- `proposalTemplateId`
- `proposalTemplateBundleId`
- `proposalPaletteOverride`
- `proposalCustomAccentHex`
- `proposalStyleChoice`
- `latestProposalStyleCommitRef`

This is active code.

### Runtime winner prefers workspace style

`my-app/src/features/verbati/styleState.ts` resolves proposal style as:

```ts
if (hasUserEditedStyle && workspaceStyle) {
  return {
    style: canonicalizeVisualStyle(workspaceStyle),
    source: "custom",
  };
}
```

This is active code and is the critical precedence rule.

### Draft hydration does not reset the full runtime style layer

The draft load effect in `my-app/src/pages/ProposalForge.tsx` handles `selectedDraftProposalId` and restores:

- content
- proposal type
- voice preset
- template id
- style preset
- style link mode
- palette override
- custom accent
- template bundle id
- source compose draft
- generated proposal id
- output draft storage

But it does not call:

- `setHasUserEditedStyle(...)`
- `setProposalWorkspaceStyle(...)`
- `setProposalStyleChoice(...)` with a value derived from the loaded draft

It also writes `proposalStyleChoice` into `writeStoredOutputDraft(...)` using the current in-memory React state from the previous render/document, not a freshly derived `nextStyleChoice`.

This is active code and directly supports the stale-style hypothesis.

### Style edits are document-intended but global-runtime implemented

`commitProposalLocalStyle(...)` in `my-app/src/pages/ProposalForge.tsx` writes:

- `setProposalStyleLinkMode("proposal_local")`
- `setProposalStylePreset(resolvedStylePreset)`
- `setHasUserEditedStyle(true)`
- `setProposalWorkspaceStyle(resolvedStylePreset)`
- `setProposalTemplateBundleId(...)`
- `setProposalPaletteOverride(...)`
- `setProposalCustomAccentHex(...)`
- `setProposalStyleChoice(...)`
- `latestProposalStyleCommitRef.current = { proposalId: generatedProposalIdRef.current ... }`

The intent is document-local, but `proposalWorkspaceStyle` and `hasUserEditedStyle` are component-wide runtime state. If document switch hydration does not reset them, they are allowed to leak.

### Saved-to-draft restore has the safer pattern

`handleCopySavedProposalToDraft(...)` does reset:

- `setHasUserEditedStyle(shouldRestoreSavedDetachedStyle)`
- `setProposalWorkspaceStyle(shouldRestoreSavedDetachedStyle ? effectiveSavedProposalStylePreset : null)`
- `setProposalStyleChoice(resolveProposalStyleChoice(...metadata/style...))`

This is active code and provides a local pattern to copy into draft hydration.

### Convex persistence accepts the style metadata

`my-app/convex/createProposalPublic.ts` and `my-app/convex/updateProposalPublic.ts` both accept:

- `templateId`
- `verbatiStyle`
- `styleLinkMode`
- `styleChoice`
- `templateBundleId`
- `typographyOverride`
- `layoutOverride`

`updateProposalPublic.ts` merges metadata as `{ ...proposal.metadata, ...args.metadata }`, so a stale frontend metadata patch can overwrite the row. The server is not the primary source of the leak; it persists what the frontend sends.

## Root cause

Confirmed root cause:

Draft hydration in `ProposalForge.tsx` is not atomic for document-local style state.

Concrete failure mode:

1. Draft B style edit calls `commitProposalLocalStyle(...)`.
2. Runtime state becomes `hasUserEditedStyle = true` and `proposalWorkspaceStyle = Draft B style`.
3. User reopens Draft A.
4. Draft hydration sets metadata/helper fields for Draft A, including `proposalStylePreset` and `proposalTemplateBundleId`.
5. Hydration does not clear or replace `proposalWorkspaceStyle`.
6. `resolveProposalStyle(...)` sees `hasUserEditedStyle && workspaceStyle` and returns Draft B style.
7. Renderer uses Draft B font/color while rail can still label Draft A's bundle.

## Job-title audit

The job-title issue is partially confirmed.

Confirmed active behavior:

- `proposalPersistenceMetadata` chooses `sourceJobTitle` from `canonicalJobRecord?.title`, then `outputSourceComposeDraft?.jobTitle`, then `composePreviewValues?.jobTitle`.
- Draft restoration builds `nextSourceComposeDraft.jobTitle` from `draftProposal.metadata?.sourceJobTitle ?? draftProposal.title ?? ""`.
- Saved proposal copy-to-draft builds `restoredJobTitle` from `openedSavedProposal.metadata?.sourceJobTitle`, then saved proposal document title, then proposal row title.
- `linkedJobId` can come from `canonicalJobId`, `prefill?.jobId`, or `duplicateSourceJobId`.

Risk:

If `metadata.sourceJobTitle` is missing, the UI can mask the missing selected-offer title with the proposal title. That makes the user see a plausible title even when the selected website offer title was not persisted.

Unverified boundary:

I did not verify the browser extension/import payload end-to-end in this audit. The authoritative selected-offer title field should be traced through the import/handoff path before patching that part.

## Severity

### P1: Cross-draft style leakage

This affects persisted drafts and can cause one proposal's document style to overwrite or visually mask another proposal's style. It is a core Proposal Forge document-ownership bug.

### P2: Source job title fallback masks missing source title

This makes source context look linked when the stored metadata may not actually contain the selected offer title. It is lower severity than style leakage but affects trust in job/proposal linkage.

## Smallest safe fix

Patch only draft hydration first.

In the `selectedDraftProposalId` load effect:

1. Derive `nextStylePreset` using the same sanitizer/normalizer used elsewhere before storing it.
2. Derive `nextStyleChoice` from `draftProposal.metadata?.styleChoice`, or from `{ templateId: nextTemplateId, stylePreset: nextStylePreset }`, falling back to `"auto"`.
3. Compute `shouldRestoreDraftDetachedStyle = nextStyleLinkMode === "proposal_local" && Boolean(nextStylePreset)`.
4. Set all style state together:
   - `setProposalStylePreset(nextStylePreset)`
   - `setProposalStyleLinkMode(nextStyleLinkMode)`
   - `setHasUserEditedStyle(shouldRestoreDraftDetachedStyle)`
   - `setProposalWorkspaceStyle(shouldRestoreDraftDetachedStyle ? resolveVerbatiStyle(nextStylePreset) : null)`
   - `setProposalTemplateId(nextTemplateId)`
   - `setProposalTemplateBundleId(nextTemplateBundleId)`
   - `setProposalPaletteOverride(nextPaletteOverride)`
   - `setProposalCustomAccentHex(nextCustomAccentHex)`
   - `setProposalStyleChoice(nextStyleChoice)`
5. Write `nextStyleChoice` to `writeStoredOutputDraft(...)`, not the old `proposalStyleChoice`.
6. Continue clearing `latestProposalStyleCommitRef.current`, `pendingQueuedComposeSnapshotRef.current`, and `latestComposeAutosaveSnapshotRef.current` on document switch.

Do not change `resolveProposalStyle()` first. Its precedence rule may be acceptable once hydration is document-scoped; changing it could break intended live-edit behavior.

## Job-title fix plan

Patch this after the style leak is stabilized.

1. Stop falling back from `sourceJobTitle` to proposal title during draft restore.
2. Stop falling back from saved proposal `sourceJobTitle` to saved proposal title for source compose context.
3. Normalize invalid `jobId` values like `"N/A"` to `null` before metadata persistence.
4. Trace the extension/import handoff payload and persist its selected-offer title as `metadata.sourceJobTitle` at creation time.
5. Add a regression where selected offer title is `X` and generated proposal title is `Y`; reopened Proposal Forge must show source title `X`, and if `X` is unavailable it must show an explicit missing source title rather than `Y`.

## Tests to add

Add a focused test under `my-app/src/pages/__tests__/`, likely `ProposalForge.draft-style-isolation.test.tsx`.

Regression sequence:

1. Mock two draft rows:
   - Draft A: `templateBundleId: "swiss_serif"` and style A.
   - Draft B: `templateBundleId: "magazine_editorial"` and style B.
2. Render `/proposal?draftId=A`.
3. Assert rail and rendered document use A.
4. Navigate to `/proposal?draftId=B`.
5. Assert rail and rendered document use B.
6. Navigate back to `/proposal?draftId=A`.
7. Assert rail and rendered document use A, not B.
8. Change font/color in A.
9. Assert `updateProposalPublic.default` targets A and does not send B's style.

Add a smaller unit test around `resolveProposalStyle()` only if a wrapper/hydration helper is introduced. The bug is primarily in hydration, not in the pure resolver.

## Verification plan

Minimum after implementation:

```bash
rtk npx vitest run src/pages/__tests__/ProposalForge.draft-style-isolation.test.tsx
rtk npx vitest run src/pages/__tests__/ProposalForge.generated-style-sync.test.tsx src/pages/__tests__/ProposalForge.draft-persistence.test.tsx
rtk npx tsc --noEmit
```

Browser verification is still required because the reported bug is visual/rendered behavior:

1. Open Draft A and apply Style 1.
2. Open Draft B and apply Style 2.
3. Reopen Draft A and verify rail label plus rendered font/color/layout are Style 1.
4. Edit Draft A font/color.
5. Reopen Draft B and verify it did not change.
6. Save/reopen both draft and saved proposal views.
7. Verify the source job title matches the parsed selected offer, not the generated proposal title.

## Deferred broader fix

After the targeted repair, replace the style cluster with a single document-scoped object:

```ts
type ProposalDocumentStyleState = {
  documentId: string | null;
  layer: "settings_default" | "cv_inherited" | "document_preset" | "document_custom";
  templateId: ProposalTemplateId;
  verbatiStyle: VerbatiStylePreset;
  styleChoice: ProposalStyleChoice;
  templateBundleId: ProposalTemplateBundleId | null;
  paletteOverride: ProposalPaletteId | null;
  customAccentHex: string | null;
};
```

Rendering, rail label, autosave, and Save to Library should all read from that one state object. This removes the current split-brain risk where labels and renderer can read different style winners.

## What remains uncertain

- The exact browser extension selected-offer payload field was not traced in this audit.
- Existing dirty worktree changes are broad and pre-existing; this audit did not classify which changes are user-authored versus previous agent work.
- No tests or browser checks were run because this task was scoped as an audit from the handoff plan.
