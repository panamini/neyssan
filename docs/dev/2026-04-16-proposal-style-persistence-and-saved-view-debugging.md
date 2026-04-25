# Proposal Style Persistence and Saved-View Debugging Notes

Date: 2026-04-16

Branch context:

- checkpoint commit: `99e49f0d` (`Preserve proposal style fix state and trace diagnostics`)
- authoritative runtime tree: `my-app/`

## 1. Executive summary

Users were seeing proposal styling behave inconsistently across the `/proposal` lifecycle:

- a generated proposal could look correct immediately after save
- the saved proposal row in Convex could also contain the correct style metadata
- but reopening the saved proposal could still show the wrong visible typography/style pair
- in earlier rounds, same-id local draft state could also interfere with saved-view reopening and with `Duplicate to draft`

This bug was confusing because several layers were individually plausible:

- save/autosave might have been writing bad metadata
- unmount or navigation might have been clobbering the saved row
- local/session draft storage might have been restoring stale style
- saved-view rendering might have been ignoring correct persisted metadata

The actual blocker in this branch was not the save path. The hard saved-view failure was a render-side boundary:

- persisted saved metadata stayed correct
- duplicated draft could render the same saved proposal correctly
- the saved view still rendered bundle/default typography instead of the persisted saved `verbatiStyle`

What this branch fixed:

- same-id optimistic/local output draft no longer overrides an existing saved proposal row in the saved-view merge path
- route-driven saved proposal reopening no longer enters the main-card loading skeleton unnecessarily
- saved-view style resolution in `ProposalsList` no longer lets bundle UI state replace the persisted saved typography on initial render
- trace instrumentation was added to prove whether the first wrong boundary was a later write or a reopen/render-resolution bug

What this branch did not prove:

- it did not prove that every inherited-CV scenario is closed under every long-lived browser session shape
- it did prove the code boundary that was wrong, and it added regressions around that boundary

## 2. Scope

Active runtime scope for this document:

- `my-app/` is the authoritative application tree
- the active flow is the current `/proposal` flow implemented in:
  - `my-app/src/pages/ProposalForge.tsx`
  - `my-app/src/components/ProposalsList.tsx`
  - `my-app/src/components/ProposalDisplay.tsx`
  - `my-app/src/lib/proposal-render-state.ts`
  - `my-app/src/lib/proposal-output-draft.ts`
  - `my-app/convex/createProposalPublic.ts`
  - `my-app/convex/updateProposalPublic.ts`
  - `my-app/convex/proposalsPublic.ts`

Authoritative storage/query surface:

- browser draft state in `proposal-output-draft.ts` and proposal workspace draft helpers
- server persistence in Convex `proposals` rows
- saved proposal querying through `api.proposalsPublic.default`

Intentionally out of scope:

- legacy trees and backup trees outside `my-app/`
- speculative alternate proposal pages unless directly referenced by current active code
- PDF export parity except where it helps explain the saved-view style state
- broad storage-architecture redesigns beyond the branch’s actual changes

## 3. System overview

### Compose flow

The compose workspace lives in `my-app/src/pages/ProposalForge.tsx`.

Core pieces:

- compose inputs are collected through `ProposalInputForm`
- style state is maintained in page state:
  - `proposalStylePreset`
  - `proposalTemplateId`
  - `proposalStyleLinkMode`
  - `proposalTemplateBundleId`
  - `proposalPaletteOverride`
  - `proposalCustomAccentHex`
- draft input state is mirrored into browser storage through `writeStoredProposalComposeDraft(...)`
- generated output state is mirrored through `writeStoredProposalOutputDraft(...)`

Important functions:

- `buildComposeSaveSnapshot(...)`
- `performProposalSave(...)`
- `scheduleProposalSave(...)`
- `flushScheduledProposalSave(...)`
- `handleSaveOutputToLibrary(...)`

### Generation flow

Generation creates or updates a proposal artifact in memory, then persists it when needed:

1. Compose state yields `proposalRenderMetadata`
2. `proposalPersistenceMetadata` extends that render metadata with:
   - proposal type
   - voice/tone
   - source brief metadata
   - applicant/header fields
3. `buildComposeSaveSnapshot(...)` packages:
   - `title`
   - `content`
   - `metadata`
   - a `token` used to avoid redundant writes
4. `performProposalSave(...)` calls:
   - `createProposal(...)` when there is no generated id
   - `updateProposal(...)` when the id already exists

### Local draft and output draft storage

Proposal browser storage is handled in:

- `my-app/src/lib/proposal-output-draft.ts`
- `my-app/src/lib/proposal-workspace-state.ts`

Key persisted browser artifacts:

- output draft:
  - `dasti:proposal-output-draft:v1`
  - session fallback `dasti:proposal-output-draft:session:v1`
- compose draft:
  - `dasti:proposal-compose-draft:v1`

The output draft stores the generated artifact snapshot, including style-related fields such as:

- `proposalTemplateId`
- `proposalVerbatiStyle`
- `proposalStyleLinkMode`
- `templateBundleId`
- `generatedProposalId`
- `sourceComposeDraft`

### Server create/update

Canonical persistence is in Convex:

- create: `my-app/convex/createProposalPublic.ts`
- update: `my-app/convex/updateProposalPublic.ts`
- read/query: `my-app/convex/proposalsPublic.ts`

The proposal metadata validators explicitly include:

- `verbatiStyle`
- `styleLinkMode`
- `templateBundleId`
- `templateId`
- `sourceCvId`

### Saved proposal reopen

Saved proposal reopen has two main active paths:

1. `ProposalForge.tsx`
   - computes `sortedSavedProposals`
   - resolves `openedSavedProposal`
   - derives `savedProposalRenderMetadata`
   - restores saved-view state into `savedProposal*` page state
2. `ProposalsList.tsx`
   - lists saved proposals
   - handles route-driven selection
   - resolves main saved-card render state
   - persists saved-proposal edits/autosaves

### Duplicate-to-draft

`Duplicate to draft` is handled in `ProposalForge.tsx` from the currently opened saved proposal:

- it copies saved proposal content back into the live draft workspace
- it restores source brief metadata into compose draft state when present
- it restores style state into compose state
- it can reattach a CV when `sourceCvId` is present

The duplicated draft is important because it provided a control case during debugging:

- if duplicate-draft rendered the correct visible style for the same saved proposal id
- but saved view rendered the wrong style
- then the persistence row was probably not the blocker

### Saved-view rendering

Saved view uses:

- `ProposalForge.tsx` for saved proposal page state
- `ProposalsList.tsx` for saved proposal card selection and main saved-card rendering
- `ProposalDisplay.tsx` for the actual document rendering surface
- `resolveProposalRenderState(...)` in `proposal-render-state.ts` for final style/template resolution

In short:

```ts
persisted metadata -> runtime style/template resolution -> render metadata -> ProposalDisplay -> actual DOM/fonts
```

## 4. Style model

The practical style model is carried by proposal metadata fields and a small set of UI-only helper fields.

### `verbatiStyle`

`verbatiStyle` is the persisted style snapshot. It carries the visual choices that matter for rendering:

- `layout`
- `typography`
- `palette`
- optional `accentHex`

This is the most important saved render snapshot. If `verbatiStyle` is present on a saved proposal row, saved view should generally treat it as authoritative for rendering.

### `templateId`

`templateId` is the persisted proposal renderer/template id. It is typically derived from the active style preset and used by the rendering layer.

`resolveProposalRenderState(...)` uses:

- preferred template id first
- stored template id second
- otherwise `getProposalTwinTemplateId(stylePreset)`

### `styleLinkMode`

`styleLinkMode` is the persistence-level answer to “where should style truth come from?”

Allowed active modes in this branch:

- `inherit_cv`
- `proposal_local`

### `templateBundleId`

`templateBundleId` represents a saved style bundle selection in the UI/editor sense.

Important distinction:

- `templateBundleId` is not the same thing as the canonical saved render style
- it is safe as a user-facing selection state
- it is dangerous if it becomes render-authoritative over a persisted `verbatiStyle`

That distinction is exactly where Bug B happened.

### Palette and custom accent behavior

Saved style can contain:

- a normal palette id
- a custom palette with `accentHex`

`ProposalsList.tsx` keeps separate saved-view UI state for:

- `selectedPaletteOverride`
- `selectedCustomAccentHex`
- `selectedLayoutOverride`

These are editor/view interaction states, not inherently canonical persistence truth.

### What `inherit_cv` means

`inherit_cv` means:

- the proposal should follow the style of its linked source CV
- `sourceCvId` identifies that CV
- if there is no persisted saved artifact snapshot, CV style can be re-resolved at runtime

Important nuance in this branch:

- once a saved proposal already has a persisted `verbatiStyle`/`templateId` snapshot, saved view should not casually replace that render state with some other bundle/default state

### What `proposal_local` means

`proposal_local` means:

- the proposal is detached from CV style changes
- its own saved `verbatiStyle` is authoritative
- duplicate-to-draft should preserve that detached local style

### When the active CV is authoritative

The active CV is authoritative when:

- the compose workspace is following CV style
- or a saved proposal lacks a persisted artifact snapshot and needs CV fallback

### When the saved proposal snapshot is authoritative

The saved proposal snapshot is authoritative when:

- the saved row contains `metadata.verbatiStyle` and/or `metadata.templateId`
- especially in saved view
- especially for `proposal_local`
- and also for `inherit_cv` once the saved proposal already captured a style snapshot

This branch’s saved-view fixes rely on that rule.

## 5. Persistence model

### Browser storage

#### Output draft

Stored in `proposal-output-draft.ts`.

Purpose:

- preserve the current generated artifact for the live draft workspace
- support reopen/back-to-draft behavior
- carry source compose context along with the generated artifact

Relevant persisted fields:

- `generatedProposalId`
- `proposalTemplateId`
- `proposalVerbatiStyle`
- `proposalStyleLinkMode`
- `templateBundleId`
- `proposalContent`
- `sourceComposeDraft`

#### Compose draft

Stored in proposal workspace draft storage.

Purpose:

- preserve current compose inputs
- preserve source URL/platform/brief

It is not the canonical place for saved proposal style truth.

### Saved proposal row in Convex

This is the canonical saved proposal row and the main source of truth for reopen/save-library behavior.

Persisted metadata includes:

- `templateId`
- `verbatiStyle`
- `sourceCvId`
- `styleLinkMode`
- `templateBundleId`
- title/content/source brief metadata

### Saved-view renderer state

Saved view uses several in-memory layers:

- `openedSavedProposal`
- `selectedStoredRenderState`
- `selectedBaseStylePreset`
- `selectedEffectiveStylePreset`
- `selectedRenderState`
- `savedProposalRenderMetadata`

These are renderer/editor states. They are not all persistence truth.

### UI-only state versus persisted state

Persisted or persistence-derived:

- `templateId`
- `verbatiStyle`
- `styleLinkMode`
- `sourceCvId`
- `templateBundleId`

UI-only or editor-only:

- `selectedPaletteOverride`
- `selectedCustomAccentHex`
- `selectedLayoutOverride`
- `isSwitchingProposal`
- selection/loading tokens

One of the main lessons from this branch:

- UI/editor state must not silently become render-authoritative over persisted saved metadata

## 6. Autosave and save behavior

### How save works in this branch

Compose save in `ProposalForge.tsx` builds `proposalPersistenceMetadata` and writes it through `performProposalSave(...)`.

`proposalPersistenceMetadata` includes:

- render metadata from `proposalRenderMetadata`
- `proposalType`
- `voicePreset`
- `resolvedVoicePreset`
- `requestedVoicePreset`
- `sourceJobDescription`
- `sourceUrl`
- `platform`
- applicant/header fields

The style portion of that metadata comes from:

- `effectiveProposalTemplateId`
- serialized `effectiveProposalStylePresetWithPalette`
- `resolvedRuntimeStyleLinkMode`
- optional `attachedCvId`
- optional `proposalTemplateBundleId`

### Create vs update

- `createProposal(...)` is used when there is no persisted generated id yet
- `updateProposal(...)` is used when `generatedProposalIdRef.current` already exists

The same saved proposal id is then reused across later updates and saved-library navigation.

### Same proposal id reuse

Same-id reuse mattered because it created the original masking condition:

- a local output draft and a saved server row could share the same proposal id
- if the merge path preferred the local optimistic row over the queried saved row
- the user could reopen the right id but get the wrong metadata/render state

### What we verified about canonicalized style writes

Proven by branch code/tests/traces:

- Convex validators in `createProposalPublic.ts`, `updateProposalPublic.ts`, and `proposalsPublic.ts` accept and return canonical proposal style metadata fields
- `ProposalForge.save-to-library` tests verify that save payloads include the expected `styleLinkMode` and `verbatiStyle` for both inherited and local style cases
- autosave tests verify saved proposal updates preserve metadata through the same update path

### Why autosave was investigated first

Autosave was a credible first suspect because the observed browser symptom looked like:

- style was correct once
- later navigation/reopen produced a wrong result

That often indicates:

- a later write
- an unmount flush
- or a stale queued autosave snapshot

### Why autosave was not the final blocker for the saved-view bug

The trace instrumentation proved a narrower split:

- saved row metadata remained correct
- duplicated draft used the same saved row and rendered correctly
- saved view alone rendered the wrong visible typography

That ruled out autosave as the final blocker for the saved-view visual mismatch.

## 7. Reopen and hydration behavior

### Route selection

Saved proposal reopen can start from:

- `/proposal?view=saved&id=<proposalId>`
- backward-compatible `/proposal?id=<proposalId>`

`ProposalsList.tsx` now handles route-driven hydration with:

- `selectProposal(requested, false)`

instead of routing through the switching skeleton path.

### List/query selection

`ProposalForge.tsx` builds `sortedSavedProposals` from:

- queried server rows
- fallback saved proposals
- optional optimistic overlay

The important branch fix:

```ts
if (optimisticSavedDraftProposal) {
  const optimisticId = String(optimisticSavedDraftProposal._id);
  if (!mergedProposals.has(optimisticId)) {
    mergedProposals.set(optimisticId, optimisticSavedDraftProposal);
  }
}
```

That preserves the real saved row when the same id already exists in the query result.

### Saved-view render state

Saved view derives render state from:

- `openedSavedProposal`
- persisted saved metadata
- optional CV style fallback if no persisted style snapshot exists

The critical resolution boundary in `ProposalsList.tsx` is:

- `selectedStoredRenderState`
- `selectedBaseStylePreset`
- `selectedEffectiveStylePreset`
- `selectedRenderState`

### Duplicate-to-draft flow

`Duplicate to draft` in `ProposalForge.tsx` restores:

- saved content
- saved proposal title/meta
- source brief metadata
- attached CV id if present
- saved style state

This path mattered because it proved the same saved proposal metadata could render correctly in draft even while saved view was visually wrong.

### Hard refresh behavior

Hard refresh was part of the debugging split:

- if refresh restores the correct saved row and the UI stays wrong, the blocker is likely client reopen/render logic
- if refresh changes the server row, the blocker is a write/clobber path

In this branch, the saved-view visual blocker was on the reopen/render side.

### Where CV fallback can re-enter

CV fallback can re-enter via:

- `resolveSavedSourceCvStylePreset(...)` in `ProposalsList.tsx`
- saved-view restore in `ProposalForge.tsx`
- any `resolveProposalRenderState(...)` call that supplies `activeCvStylePreset`

This is safe only when the saved proposal does not already carry a persisted artifact snapshot that should win.

## 8. Debugging timeline

### Initial hypothesis

The initial working hypothesis was persistence corruption:

- style looked correct immediately after save
- later reopen showed a wrong style
- therefore autosave, unmount flush, or storage restore looked like the most likely bug boundary

That hypothesis was reasonable, but incomplete.

### Trace plan

The branch then added a structured trace plan built around one marker:

- `[proposal-style-trace]`

Instrumentation was added in:

- `my-app/src/lib/proposal-style-trace.ts`
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/convex/createProposalPublic.ts`
- `my-app/convex/updateProposalPublic.ts`

The trace contract intentionally separated:

- raw server/query rows
- raw local/session output draft
- raw compose draft
- raw CV style source
- resolved render state
- `winnerSource`
- `winnerReason`

### Scenarios tested

The debugging work used both tests and authenticated manual browser flows.

Manual scenarios included:

- save proposal with custom local style
- save proposal with CV-inherited style
- open from library
- open saved proposal
- duplicate saved proposal to draft
- navigate away and back
- hard refresh

The critical comparison was always:

- content correctness
- metadata correctness
- visible rendered style correctness

### What the first rounds ruled out

The traces and browser repros ruled out several plausible causes:

- the canonical saved row was not always being clobbered
- duplicate-to-draft was not inherently losing style once the same-id overlay bug was fixed
- the saved-view bug was not just a content bug or badge-label bug
- the render layer in `ProposalDisplay.tsx` was not inherently broken, because draft view rendered correctly with the same style input

### What each round proved

Round 1 proved:

- same-id optimistic/local draft overlay could override a saved proposal row in reopen/duplicate flows

Round 2 proved:

- route-driven saved reopen could enter a switching/loading skeleton path even when the target row was already available

Round 3 proved the remaining visual blocker:

- saved row metadata could be correct
- duplicate draft could render the correct visible style
- saved view could still render the wrong visible typography because bundle/default style state replaced the persisted saved `verbatiStyle`

That final proof narrowed the bug from “style persistence is broken” to “saved-view render-style resolution is wrong.”

## 9. Proven bugs in this branch

### Bug A: same-id saved-row overwrite by optimistic/stale local draft

Symptom:

- reopening a saved proposal with the same id as a stale local output draft could use the stale local draft instead of the queried saved row
- `Duplicate to draft` then restored the wrong metadata/style/content source

First wrong boundary:

- saved proposal merge in `ProposalForge.tsx`
- function/area: `sortedSavedProposals`

Why it happened:

- the merge path injected an optimistic saved proposal derived from local draft state
- if that optimistic row had the same id as a real queried saved row, it could become the selected saved proposal

Why that was dangerous:

- the user appeared to be opening the canonical saved proposal id
- but the actual selected record could be a stale browser draft snapshot

Fix applied:

- `ProposalForge.tsx` now adds `optimisticSavedDraftProposal` only when that id is not already present in merged saved proposals

Compact illustration:

```ts
if (optimisticSavedDraftProposal && !mergedProposals.has(optimisticId)) {
  mergedProposals.set(optimisticId, optimisticSavedDraftProposal);
}
```

Regression coverage added:

- `my-app/src/pages/__tests__/ProposalForge.saved-view.test.tsx`
  - `duplicates the persisted inherited-style row instead of a stale local draft when reopening the same proposal id`
  - `duplicates the persisted local-style row instead of a stale inherited draft when reopening the same proposal id`

### Bug B: saved-view bundle/default style overriding persisted saved typography

Symptom:

- saved proposal content was correct
- saved metadata (`templateId`, `verbatiStyle`, `styleLinkMode`, `sourceCvId`) was correct
- duplicate-to-draft rendered the correct visible style
- but saved view still rendered the wrong visual typography/style pair

First wrong boundary:

- `my-app/src/components/ProposalsList.tsx`
- functions/areas:
  - `resolveSavedAppearanceState(...)`
  - `selectedStoredRenderState`
  - `selectedBaseStylePreset`

Why it happened:

- `ProposalsList` maintained bundle-related saved-view UI state
- that bundle-derived state was allowed to become render-authoritative even when the saved row already had a persisted `verbatiStyle`
- the main saved card then rendered the bundle/default typography instead of the saved row’s persisted typography

Why duplicate-to-draft could still look correct:

- duplicate-to-draft in `ProposalForge.tsx` restored from the saved proposal snapshot path, not the broken saved-card bundle override path
- therefore the same saved proposal id could look wrong in saved view but correct once duplicated back into draft

Fix applied:

- `resolveSavedAppearanceState(...)` now treats only explicit saved `templateBundleId` as bundle state; it no longer infers a render-authoritative bundle from saved style/layout alone
- `selectedBaseStylePreset` now uses the stored saved render state unless there is an actual pending user bundle override

Compact illustration:

```ts
const hasPendingBundleOverride =
  selectedStyleBundleId !== null &&
  selectedStyleBundleId !== selectedStoredAppearance.bundleId;

if (hasPendingBundleOverride) {
  return getProposalTemplateBundleDefinition(selectedStyleBundleId).stylePreset;
}
return selectedStoredRenderState?.stylePreset ?? null;
```

Regression coverage added:

- `my-app/src/components/__tests__/ProposalsList.saved-view-typography.test.tsx`
  - persisted custom typography survives saved view
  - persisted inherited typography survives saved view

### Bug C: route-driven saved reopen entered the loading skeleton even with the row already present

Symptom:

- navigating back to a saved proposal could show `Generating…` or loading-like behavior even though the saved row was already available

First wrong boundary:

- `my-app/src/components/ProposalsList.tsx`
- route selection effect used `handleSelectProposal(...)`

Why it happened:

- route hydration was treated like a user-initiated switching animation
- that set `isSwitchingProposal=true`
- the main saved card then rendered through a loading path

Fix applied:

- route-driven saved reopen now uses `selectProposal(...)` directly

Regression coverage added:

- `my-app/src/components/__tests__/ProposalsList.route-selection.test.tsx`

## 10. The real blocker

### The real blocker for this problem

What looked like the problem first:

- save/autosave seemed to be dropping or corrupting saved style metadata

What was only a symptom:

- style being wrong after reopen
- duplicate-to-draft sometimes looking suspicious
- saved-view labels like `CV` or `Custom` being insufficient to prove visual correctness

What the actual blocker turned out to be:

- saved-view render state in `ProposalsList.tsx` allowed bundle/default UI state to replace the persisted saved style snapshot
- the visual mismatch was therefore a saved-view resolver/render-state problem, not a canonical saved-row write problem

Why this was hard to see without end-to-end traces and browser repro:

- tests that only compared metadata would pass
- the server row could be correct
- duplicate-to-draft could render correctly for the same proposal id
- only the actual saved-view rendered typography exposed the wrong boundary

### Sidenote: if this happens again

Practical checklist:

1. Check the saved server row first.
   - inspect `templateId`
   - inspect `metadata.verbatiStyle`
   - inspect `sourceCvId`
   - inspect `styleLinkMode`
2. Check browser draft storage next.
   - `dasti:proposal-output-draft:v1`
   - `dasti:proposal-output-draft:session:v1`
   - `dasti:proposal-compose-draft:v1`
3. Compare saved view and duplicate-to-draft for the same saved proposal id.
   - if duplicate draft is visually correct but saved view is not, suspect saved-view resolver/render state
4. Inspect `winnerSource` and `winnerReason` from `[proposal-style-trace]`.
5. Compare:
   - raw server row
   - raw query row
   - opened/selected saved proposal
   - saved render metadata
   - `ProposalDisplay` props
   - actual DOM/computed font families

How to distinguish save-path bugs from reopen/render bugs:

- if the stored row becomes wrong, the bug is a write/clobber bug
- if the stored row stays correct but saved view renders wrong, the bug is reopen/render resolution

Most important trace points:

- `perform-proposal-save:before-write`
- `perform-proposal-save:after-write`
- `saved-merge`
- `saved-opened-proposal`
- `saved-runtime-style`
- `saved-render-metadata`
- `saved-restore-effect`
- `proposal-forge-unmount`

## 11. Trace and verification notes

### Instrumentation added

Primary trace helper:

- `my-app/src/lib/proposal-style-trace.ts`

It standardizes:

- `[proposal-style-trace]`
- metadata snapshots
- saved row snapshots
- output draft snapshots
- compose draft snapshots
- `winnerSource`
- `winnerReason`

Client instrumentation was added mainly in:

- `my-app/src/pages/ProposalForge.tsx`

Server instrumentation was added in:

- `my-app/convex/createProposalPublic.ts`
- `my-app/convex/updateProposalPublic.ts`

### Manual flows run

Manually exercised in the authenticated browser during this branch:

- save proposal with custom local style
- save proposal with CV-inherited style
- verify library card and opened saved proposal
- duplicate saved proposal to draft
- navigate away and return
- hard refresh

The key manual comparison was:

- content
- metadata
- visible rendered typography/style pair

### Tests run

The branch used targeted Vitest coverage around:

- save-to-library metadata
- autosave metadata persistence
- saved-view reopening
- same-id optimistic overlay behavior
- saved-view typography preservation
- trace helper formatting

### Evidence that proved the first wrong boundary

Bug A evidence:

- same saved proposal id
- stale local output draft present
- duplicate-to-draft used the wrong record before the merge guard

Bug B evidence:

- saved row metadata remained correct
- duplicate draft rendered the correct typography for the same saved id
- saved view rendered bundle/default typography instead
- therefore the first wrong boundary was before `ProposalDisplay` and inside saved-view resolver/render-state selection

## 12. Tests added or updated

The following tests were added or materially updated in this branch to protect style persistence/debugged boundaries:

- `my-app/src/pages/__tests__/ProposalForge.saved-view.test.tsx`
  - protects duplicate-to-draft from same-id stale local draft takeover
  - covers inherited and local saved-style duplication paths
- `my-app/src/pages/__tests__/ProposalForge.save-to-library.test.tsx`
  - protects save payload metadata for inherited and local style
- `my-app/src/pages/__tests__/ProposalForge.autosave.test.tsx`
  - protects autosave metadata persistence for inherited and local style
- `my-app/src/pages/__tests__/ProposalForge.generated-style-sync.test.tsx`
  - protects generated-output style metadata sync paths
- `my-app/src/components/__tests__/ProposalsList.route-selection.test.tsx`
  - protects route-driven saved reopen from entering the loading skeleton
- `my-app/src/components/__tests__/ProposalsList.autosave.test.tsx`
  - protects saved-view autosave metadata behavior and style/source-CV persistence
- `my-app/src/components/__tests__/ProposalsList.saved-view-typography.test.tsx`
  - protects saved view from replacing persisted typography with bundle defaults
- `my-app/src/lib/__tests__/proposal-style-trace.test.ts`
  - protects trace snapshot shapes and storage snapshot summarization

## 13. Remaining risks / known caveats

Proven fixed boundaries:

- same-id optimistic saved-row overwrite in `ProposalForge` merge path
- route-driven saved selection loading skeleton in `ProposalsList`
- saved-view persisted-typography override in `ProposalsList` as covered by regression tests

Known caveats:

- some browser validation during the branch showed an inherited-CV long-lived-session case that still looked suspicious until reload, even after the saved-view resolver patch
- the branch did prove the wrong saved-view boundary in code and added regressions for both local and inherited typography preservation
- future regressions are still most likely where UI state, CV fallback state, and persisted saved metadata intersect

What is proven versus not proven:

- proven:
  - the saved-view bundle override boundary was wrong
  - duplicate-draft and saved-view can diverge if that boundary regresses
- not fully proven:
  - every inherited-CV live browser path is closed under all stale-session conditions

That remaining caveat should be treated as a browser-validation concern, not as evidence against the proven code boundary fixed here.

## 14. Practical maintenance guidance

Safe places to patch:

- `resolveProposalRenderState(...)` in `my-app/src/lib/proposal-render-state.ts`
- saved-view state derivation in `my-app/src/components/ProposalsList.tsx`
- duplicate-to-draft bootstrap in `my-app/src/pages/ProposalForge.tsx`
- style metadata write construction in `proposalPersistenceMetadata`

Dangerous places:

- any merge that combines server rows with local/session draft rows by proposal id
- any saved-view state that infers bundle/template UI state from persisted style and then lets that inferred UI state become authoritative
- any path that passes CV fallback style into resolution even though a persisted saved artifact snapshot already exists

How not to regress saved-view styling:

- treat persisted `metadata.verbatiStyle` as render-authoritative for saved view when present
- treat `templateBundleId` as a UI/editor selection, not automatic render truth
- keep saved-view route hydration separate from user-initiated selection animations
- verify visible typography in the browser, not just metadata objects or badges

How not to confuse bundle UI state with persisted render state:

- bundle state answers “which style bundle is selected in the UI?”
- persisted style snapshot answers “what style should this saved proposal render with right now?”
- those are related, but not interchangeable

## TL;DR for future debugging

- Start by checking whether the saved Convex row is correct.
- If the row is wrong, debug save/autosave/unmount writes.
- If the row is correct but saved view is wrong, debug saved-view resolver/render state.
- Compare saved view and duplicate-to-draft for the same proposal id.
- In this branch, the decisive blocker was not persistence corruption. It was `ProposalsList.tsx` letting bundle/default UI state override the persisted saved `verbatiStyle` during saved-view rendering.
