# CV Hydration And Style System

## Purpose

This note captures the working boundary that restored the CV decoration image after refresh, the later template persistence boundary, and the broader persistence system around CV style, template, and decoration state.

## What Fixed The Image

The image started winning after we proved the live boundary between three layers:

1. `profilesPublic.getByProfileId` must return a runtime `documentDecoration.resolvedUrl` for the current `assetId`.
2. `StorageAdapter.mapPersistedProfileToCvDocument` must preserve the top-level decoration metadata even when an embedded `cvDocument` snapshot is stale or invalid.
3. `CvLibraryContext` must overlay runtime decoration metadata onto the active document when a background refresh is skipped.

The important implementation detail was not rendering `assetId` directly. The renderer still rejects asset-id-only decorations. The fix was to hydrate `resolvedUrl` before render state wins.

## What The System Is Doing

The current system is a layered CV persistence model:

1. Durable local state stores the CV document, style metadata, and decoration metadata.
2. Remote Convex state stores the canonical user profile row and the embedded `cvDocument` snapshot.
3. Public profile reads hydrate runtime-only fields such as `documentDecoration.resolvedUrl`.
4. The client merges remote state into local state only when the remote version is actually the winning source.
5. Runtime-only image URLs are not persisted back into durable storage.

The style stack is meant to keep these fields synchronized:

- `resumeTemplateId`
- `verbatiStyle`
- `verbatiStyleBaseSnapshot`
- `documentStyleVersion`
- `documentIcons`
- `documentIconOverrides`
- `documentDecoration` runtime fields

## What Fixed Template Persistence

Template persistence failed at a different boundary than the image URL. Browser diagnostics showed this live path:

1. Template selection reached `CvForge.handleSelectTemplate`.
2. `CvLibraryContext.saveCurrentCvStyleOnly` built metadata with the selected `resumeTemplateId`.
3. `StorageAdapter.saveMetadataPatch` sent the selected template in the metadata-only patch.
4. Convex `profiles.patch` wrote the selected template into top-level profile metadata.
5. `profilesPublic.getByProfileId` returned the selected top-level metadata after refresh.
6. `StorageAdapter.mapPersistedProfileToCvDocument` mapped that metadata correctly.
7. `CvLibraryContext.shouldApplyBackgroundRefresh` rejected the remote document as weaker than the local cached document.
8. The skipped-refresh overlay path preserved local content, but previously kept local metadata with no explicit template, so preview fell back to `workshop_resume_onecol_ats`.

The fix keeps the content protection but lets explicit remote visual metadata win when the local document has only an implicit or missing template. The refresh path now overlays remote visual metadata on skipped refreshes without replacing sections or user content.

The protected fields are:

- `resumeTemplateId`
- `verbatiStyle.resumeTemplateId`
- `verbatiStyleBaseSnapshot.resumeTemplateId`
- `verbatiStyleSlotId`
- `verbatiStyleSlotSource`
- `verbatiStyleSlotNameSnapshot`
- `documentStyleVersion`
- `documentIcons`

The regression test is `preserves remote visual metadata when weaker remote content is skipped` in `my-app/src/contexts/__tests__/CvLibraryContext.test.tsx`.

## Why Template And Font Needed A Separate Fix

Image persistence and style persistence are adjacent but not identical.

The image fix solved the decoration boundary, but template and font can still regress if refresh logic compares only document content and not style freshness. If a remote refresh is older for style metadata, it can overwrite the newer local `resumeTemplateId` or typography choice and make the font drawer feel frozen.

That means the real refresh rule is:

- preserve newer local style metadata when remote content is otherwise equivalent
- only accept remote style state when it is actually fresher or materially different

## Current Remaining Flicker

After the template fix, the selected template survives a hard refresh, including Sanat. There is still a visible first-paint flicker: `workshop_resume_onecol_ats` can render briefly, then the chosen template replaces it once the remote visual metadata overlay lands.

Why it happens:

1. The app restores the local full CV cache first for responsiveness.
2. That cached local document can lack explicit `metadata.resumeTemplateId`.
3. `useBoundVerbatiCvStyle` treats missing template metadata as an implicit default.
4. `VerbatiResumePreview` renders Workshop one-column for the first paint.
5. The authenticated remote read returns the explicit template metadata.
6. The skipped-refresh visual overlay updates state, and the chosen template renders.

This is no longer a persistence failure. It is a hydration ordering issue.

Possible fixes:

- Best user-facing fix: persist explicit visual metadata into the local full CV cache when `saveCurrentCvStyleOnly` runs and when remote visual metadata is overlaid. This should make the first local restore already know the selected template.
- More conservative render fix: gate preview rendering until the active CV has either explicit visual metadata or the authenticated remote refresh has completed. This avoids the wrong first paint but may show a loading/blank preview for longer.
- Avoid: forcing Workshop one-column as a durable fallback. That hides the symptom while preserving the same bad first paint for every non-default template.

Recommended next fix pass: make local cache hydration template-aware by ensuring selected visual metadata is written to the full `cv:<id>` cache at style-save time and after remote visual overlay. Then add a browser or context regression that local restore after template save has `metadata.resumeTemplateId` before remote refresh.

## Verification

Commands run after the template fix:

```text
rtk npx vitest run src/contexts/__tests__/CvLibraryContext.test.tsx
58 passed

rtk npx tsc --noEmit
TypeScript: No errors found
```

User browser verification after the patch confirmed the selected template now persists after hard refresh, with only the remaining brief Workshop one-column first paint.

## Reusable Proposal Summary

The proposal-safe description is:

“We built a CV persistence pipeline that separates durable document state from runtime hydration. Images are restored by hydrating runtime decoration URLs from Convex before render, while style/template state is preserved by allowing explicit remote visual metadata to overlay local content when a full remote document refresh is rejected as weaker. The system keeps the UI responsive without persisting blob URLs or destabilizing the document model.”
