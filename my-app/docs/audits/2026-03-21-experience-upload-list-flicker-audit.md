# Experience Upload List Flicker Audit

Date: 2026-03-21

## Scope
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/normalize-cv.ts`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/cv-editor/BlockRenderer.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/cv-display/AchievementsDisplay.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/ExperienceEducationModal.tsx`

## Finding

### Active code

The brief “loads, then boom turns into a list” behavior on imported `Experience` content is caused by a type mismatch in the first render path, not by the editor toolbar itself.

Current pipeline:

1. Import enters through `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ImportCvPreviewModal.tsx`.
2. That modal calls `CvLibraryContext.importCv(document)`.
3. `importCv()` in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/contexts/CvLibraryContext.tsx` runs:
   - `normalizeAndValidateCvDocument(...)`
   - `ensureRepresentativeBlocks(...)`
   - `safeSetCurrentCv(validatedWithReps)`
4. `experience.responsibilities` may still pass through as plain string-like content during the first imported render path, depending on the upstream parsed payload.
5. `BlockRenderer.tsx` then renders `experience` details through the `AchievementsDisplay` path for preview.
6. `AchievementsDisplay.tsx` treats non-Remirror items as plain text list items and wraps them into a bullet list doc.

There is also a visible two-stage renderer handoff inside `BlockRenderer.tsx` itself:

- before the structured link fully resolves, the block can still fall back to its own `plainText` / extracted text path
- once the linked structured item resolves, the renderer switches to the structured preview path
- that structured path then routes responsibilities into `AchievementsDisplay`

Result:
- first imported render can show text in its raw/plain form
- then once the structured preview path resolves through `AchievementsDisplay`, the same content is coerced into bullet-list presentation
- after manual editing/saving in the modal, the source of truth becomes a real Remirror doc, so the later renders look correct and stay stable

This is why the issue is most visible immediately after upload/import, but not after the user edits and saves the entry through the typed modal.

## Why it happens

The preview renderer for `experience` currently mixes two content concepts:

- legacy/typed bullet achievements
- rich responsibilities content

They converge in the same display component, `AchievementsDisplay`, which is optimized to preserve list-like structure. When responsibilities are still plain text at import time, that component interprets them as bullet candidates rather than as already formatted rich body content.

## Classification

- Active code: yes
- Legacy but informative: yes, because `achievements[]` remains a compatibility path and still influences the preview logic
- Obsolete/dead code: none identified in this chain

## Recommended direction

Do not mix imported plain-text responsibilities and bullet achievements in the same display path.

The clean long-term direction is:
- preserve `responsibilities` as Remirror doc as early as possible in the import pipeline
- render rich responsibilities through a dedicated rich-text preview path
- keep `achievements[]` only as a compatibility fallback, not as the same primary renderer

## Why shimmer is not a real fix

A shimmer can hide the visual flash, but it does not solve the underlying mismatch:

- imported responsibilities still enter at least one active preview path as plain-text-like content
- that content still converges into `AchievementsDisplay`
- `AchievementsDisplay` still applies list-oriented coercion for non-Remirror items

So shimmer would only mask a renderer handoff that still exists. The actual fix is architectural at the preview layer:

- separate rich responsibilities preview from achievements-list preview
- or guarantee that the import pipeline never hands plain responsibilities into the achievements renderer

## Implemented fix

### Active code

The fix keeps parsing intact and changes only the preview/render split and the initial upload section shape:

- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/lib/normalize-cv.ts`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/cv-editor/BlockRenderer.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/cv-display/ReadOnlyRichDoc.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/utils/cv/mapping-utils.ts`

Current rule:

- `experience.responsibilities` renders through a dedicated read-only rich-text preview
- `experience.achievements[]` remains available on the structured item
- top-level `achievements` section still renders through `AchievementsDisplay`
- upload-generated `experience` and `education` sections now start with representative blocks immediately, instead of starting with `blocks: []`

### Why the upload flash could still happen without this

The active upload path used by `CvForge` does not come from the later library import save path first.

It goes through:

- `StructuredUploadButton.tsx`
- `buildTypedSectionsFromNormalized(...)` in `mapping-utils.ts`
- `ProfileReviewCard.tsx`
- `reorderSections(...)` in `CvLibraryContext.tsx`

Before this fix, `buildTypedSectionsFromNormalized(...)` created:

- `experience.structuredContent`
- `experience.blocks = []`

That meant the first render in `SectionEditor.tsx` used the structured preview path:

- larger `cv-entry-title`
- `cv-entry-subtitle`
- `cv-entry-bullets`

Then after the document was normalized/reordered, representative blocks appeared and the same section switched to `BlockRenderer`, producing the second smaller final state.

So there were actually two active causes in sequence:

1. responsibilities were routed through a list-oriented preview path
2. the uploaded section started without representative blocks, so the section switched renderer families after upload

### Verification

The normalization path was checked with a targeted runtime test:

- `experience.achievements[]` remains attached to the experience item
- top-level `achievements` remains attached to the dedicated `achievements` section
- `buildTypedSectionsFromNormalized(...)` now returns an `experience` section with a linked representative block immediately

So the fix narrows the change to preview routing, not to the data classification model.
