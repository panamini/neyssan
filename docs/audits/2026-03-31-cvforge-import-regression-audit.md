# CVForge Import Regression Audit

Date: 2026-03-31

## Scope

Active runtime code only under `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app`.

Audited paths:

- structured upload from visible CvForge entrypoints
- Mistral OCR import path for scanned PDFs and images
- empty-result and surfaced error handling
- CV import integration into active editor state, library state, and persistence/load

## Classification

- Active code:
  - [src/pages/CvForge.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx)
  - [src/pages/CvsLibrary.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvsLibrary.tsx)
  - [src/components/ProfileReviewCard.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx)
  - [src/components/StructuredUploadButton.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx)
  - [src/contexts/CvLibraryContext.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/contexts/CvLibraryContext.tsx)
  - [src/adapters/StorageAdapter.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/adapters/StorageAdapter.ts)
  - [convex/actions/structuredUpload.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts)
  - [convex/actions/_probeMistral.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/_probeMistral.ts)
  - [convex/profiles.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/profiles.ts)
  - [convex/profilesPublic.ts](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/profilesPublic.ts)
- Legacy but informative:
  - none used
- Obsolete/dead code:
  - none used

## Entry Point Audit

Current structured/OCR import entrypoints found in active UI:

- Empty CvForge workspace: `ProfileReviewCard` renders `StructuredUploadButton` in the `!currentCv` branch. Evidence: [ProfileReviewCard.tsx:674](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx#L674), [ProfileReviewCard.tsx:676](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx#L676)
- Existing active CV workspace: `ProfileReviewCard` renders `StructuredUploadButton` in the active editor toolbar. Evidence: [ProfileReviewCard.tsx:825](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx#L825), [ProfileReviewCard.tsx:830](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx#L830)
- Preview mode: `CvForge` unmounts `ProfileReviewCard`, so import controls are hidden in preview-only workspace mode. Evidence: [CvForge.tsx:133](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx#L133), [CvForge.tsx:165](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx#L165)
- Sidebar / library flows: no import control is rendered there. `/cvs` empty-state copy promises import, but only a create button exists. Evidence: [CvsLibrary.tsx:142](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvsLibrary.tsx#L142), [CvsLibrary.tsx:146](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvsLibrary.tsx#L146), [CvsLibrary.tsx:148](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvsLibrary.tsx#L148)

Import mode integration found in active code:

- Empty workspace import creates a fresh `CvDocument` with a new UUID, then calls `importCv`. Evidence: [ProfileReviewCard.tsx:211](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx#L211), [ProfileReviewCard.tsx:219](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx#L219), [ProfileReviewCard.tsx:229](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx#L229)
- Existing active workspace import does not create a new CV. It replaces the current draft’s sections through `reorderSections(updated)`. Evidence: [ProfileReviewCard.tsx:830](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx#L830), [CvLibraryContext.tsx:2375](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/contexts/CvLibraryContext.tsx#L2375)

## Findings

### 1. Imported CVs are only locally durable because the Convex save/load contract does not round-trip `CvDocument`

Severity: High

Status: Proven

Classification: Active code

Exact root cause:

`CvLibraryContext.importCv(...)` correctly normalizes the imported CV, sets it as `currentCv`, inserts it into `cvs`, caches it locally, and schedules persistence. The break happens at persistence/load boundaries:

- `StorageAdapter.save(...)` sends the full `CvDocument` as `patch` to `api.profiles.patch`, using the CV UUID as `profileId`. Evidence: [StorageAdapter.ts:68](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/adapters/StorageAdapter.ts#L68), [StorageAdapter.ts:95](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/adapters/StorageAdapter.ts#L95)
- `convex/profiles.patch` only whitelists flattened profile fields such as `name`, `summary`, `skills`, `experience`, `education`, `achievements`, `metadata`, and `preferences`. It drops `id`, `title`, `sections`, and `tags`, which are the core `CvDocument` fields. Evidence: [profiles.ts:192](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/profiles.ts#L192), [profiles.ts:195](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/profiles.ts#L195), [profiles.ts:218](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/profiles.ts#L218), [profiles.ts:230](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/profiles.ts#L230)
- The frontend load path ignores the requested CV id. `useConvexStorageAdapter.loadFn` always calls `profilesPublic.get` with no args, then tries to parse that single authenticated `userProfiles` row as a `CvDocument`. Evidence: [StorageAdapter.ts:183](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/adapters/StorageAdapter.ts#L183), [StorageAdapter.ts:187](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/adapters/StorageAdapter.ts#L187), [profilesPublic.ts:48](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/profilesPublic.ts#L48), [profilesPublic.ts:103](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/profilesPublic.ts#L103)
- `performSave(...)` swallows save failures, logs them, and still caches the document locally. That masks backend persistence failure/no-op as if the import succeeded durably. Evidence: [CvLibraryContext.tsx:1185](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/contexts/CvLibraryContext.tsx#L1185), [CvLibraryContext.tsx:1228](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/contexts/CvLibraryContext.tsx#L1228), [CvLibraryContext.tsx:1229](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/contexts/CvLibraryContext.tsx#L1229)

What this means:

- This is not immediate section-application failure. The imported CV is loaded into active local editor state first.
- The durable failure is after refresh / new session / cross-device / route restore: Convex cannot faithfully save and then reload the imported `CvDocument`.
- This also explains “disappearing import” reports better than sidebar filtering. Sidebar uses local `cvs` plus `currentCv`, sorted by timestamps, so the freshly imported item should be visible until the app has to rely on remote reload again.

Regression check:

- This persistence mismatch predates the recent `ProfileReviewCard` / workspace UI work.
- The `profiles.patch` contract and `StorageAdapter` CV-vs-profile mismatch come from older storage work, not from today’s empty-state/import-surface changes.

Affected files:

- [src/contexts/CvLibraryContext.tsx:1827](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/contexts/CvLibraryContext.tsx#L1827)
- [src/adapters/StorageAdapter.ts:68](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/adapters/StorageAdapter.ts#L68)
- [src/adapters/StorageAdapter.ts:183](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/adapters/StorageAdapter.ts#L183)
- [convex/profiles.ts:192](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/profiles.ts#L192)
- [convex/profilesPublic.ts:48](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/profilesPublic.ts#L48)

### 2. The Mistral OCR backend path rejects some usable OCR output because it requires sections or at least 200 OCR characters

Severity: Medium

Status: Proven

Classification: Active code

Exact root cause:

The UI correctly passes `useMistral: true` and the backend correctly switches to `/mistral-ocr/parse`. Evidence: [StructuredUploadButton.tsx:366](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L366), [structuredUpload.ts:202](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts#L202), [structuredUpload.ts:231](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts#L231), [structuredUpload.ts:319](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts#L319)

The problem is the accept/reject heuristic after the OCR response:

- On the Mistral path, payloads are treated as meaningful only if `rawSectionsLen > 0` or `ocrChars >= 200`. Evidence: [structuredUpload.ts:871](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts#L871), [structuredUpload.ts:872](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts#L872), [structuredUpload.ts:881](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts#L881), [structuredUpload.ts:882](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts#L882)
- If neither condition passes, the action throws `mistral_unusable_content`, even if canonicalization already extracted useful profile/contact/summary fields from a short OCR response. Evidence: [structuredUpload.ts:898](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts#L898), [structuredUpload.ts:899](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts#L899)

Impact:

- Scanned one-page CVs, cropped mobile photos, or short OCR returns can fail hard even when they contain enough information to partially import.
- The error is reported as upload failure rather than partial-import-with-warning, which makes the OCR route look dead instead of strict.

Affected files:

- [src/components/StructuredUploadButton.tsx:366](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L366)
- [convex/actions/structuredUpload.ts:871](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/structuredUpload.ts#L871)

### 3. The import UI can show a success toast while applying nothing, which makes the editor appear stuck or broken

Severity: Medium

Status: Proven

Classification: Active code

Exact root cause:

After a parser response:

- `StructuredUploadButton` builds typed sections from `payload.normalized`. Evidence: [StructuredUploadButton.tsx:431](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L431)
- It only calls `onApplyToSections(...)` when `merged.length > 0`. Evidence: [StructuredUploadButton.tsx:446](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L446)
- If `merged.length === 0` and there is no `diagnostics.empty_reason`, it still emits `showToast("Structured extraction completed")`. Evidence: [StructuredUploadButton.tsx:455](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L455), [StructuredUploadButton.tsx:468](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L468)
- In the dropdown path used by CvForge, `errorMsg` is only rendered in an `sr-only` node, so there is no persistent visible inline failure state after the toast disappears. Evidence: [StructuredUploadButton.tsx:723](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L723), [StructuredUploadButton.tsx:728](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L728)

Impact:

- A parser payload can be technically non-empty but still produce zero mapped sections.
- The UI then reports success but leaves the editor unchanged.
- This matches the “looks broken / nothing happened” symptom even when the hidden file input, Convex action call, and parser transport all worked.

Regression check:

- The current `empty_reason` banner/warning behavior was restored in the 2026-03-31 work, but the false-success branch still remains when the parser yields non-empty-but-unmappable payloads.

Affected files:

- [src/components/StructuredUploadButton.tsx:431](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L431)
- [src/components/StructuredUploadButton.tsx:446](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L446)
- [src/components/StructuredUploadButton.tsx:468](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L468)
- [src/components/StructuredUploadButton.tsx:723](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L723)

### 4. Import entrypoints exist in CvForge edit mode, but they are still missing from sidebar/library flows and are hidden in preview mode

Severity: Low

Status: Proven

Classification: Active code

Exact root cause:

- Current runtime does render import in empty CvForge and active CvForge edit state, so missing click/input wiring is not the primary break.
- However, there is still no import entrypoint in the sidebar or `/cvs`, and preview-mode `/cv` hides the entire `ProfileReviewCard` surface.

Impact:

- Users can import only from the edit-mode `/cv` surface.
- If they land in preview mode or navigate through the library expecting the “Create or import” copy to be actionable, import appears unavailable.
- This is a discoverability/workflow bug, not the main data-loss root cause.

Regression check:

- The active editor import dropdown was introduced in commit `3a720657`.
- The empty-state import button was added later in the 2026-03-31 work.
- These UI changes did not create the persistence mismatch in Finding 1, but they do constrain where import is discoverable.

Affected files:

- [src/components/ProfileReviewCard.tsx:674](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx#L674)
- [src/components/ProfileReviewCard.tsx:825](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProfileReviewCard.tsx#L825)
- [src/pages/CvForge.tsx:133](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx#L133)
- [src/pages/CvsLibrary.tsx:146](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvsLibrary.tsx#L146)

### 5. OCR availability can be disabled by client-side flag/probe gating, but actual runtime impact depends on deployed env

Severity: Low

Status: Inference

Classification: Active code

Exact root cause:

- The Mistral option is enabled only when `VITE_ENABLE_MISTRAL` or `VITE_UI_ENABLE_MISTRAL_OCR` resolves truthy, otherwise it defaults to `env.DEV`. Evidence: [StructuredUploadButton.tsx:137](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L137), [StructuredUploadButton.tsx:155](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L155)
- The UI probe action checks both `/ready` and `/mistral-ocr/parse`, but the button availability only looks at `result.ready.status === 200`; it ignores the parse probe result. Evidence: [StructuredUploadButton.tsx:173](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L173), [StructuredUploadButton.tsx:176](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L176), [StructuredUploadButton.tsx:699](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L699), [convex/actions/_probeMistral.ts:68](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/_probeMistral.ts#L68), [convex/actions/_probeMistral.ts:100](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/actions/_probeMistral.ts#L100)

Why this remains inference:

- I did not inspect deployed env values or live parser readiness from the target runtime.
- The code path can incorrectly disable OCR even if parse would work, but I cannot prove that is happening in the current deployment from local source alone.

## Non-findings

- Hidden input activation and route selection wiring look correct in current code. The dropdown sets `pickerRef`, switches `accept`, and clicks the hidden input before `handleChange(...)` consumes the chosen file. Evidence: [StructuredUploadButton.tsx:232](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L232), [StructuredUploadButton.tsx:529](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L529), [StructuredUploadButton.tsx:597](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L597)
- File type acceptance matches the intended split:
  - structured: PDF/TXT
  - OCR: PDF/PNG/JPG/JPEG
  Evidence: [StructuredUploadButton.tsx:241](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L241), [StructuredUploadButton.tsx:591](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx#L591)

## Focused Verification

Focused tests run:

```bash
npx vitest run src/__tests__/structured-upload-button.test.tsx src/components/__tests__/StructuredUploadButton.emptyReason.test.tsx src/components/__tests__/ProfileReviewCard.import.test.tsx src/contexts/__tests__/CvLibraryContext.test.tsx
```

Observed result:

- 4 test files passed
- 21 tests passed

Interpretation:

- Local component wiring and in-memory import integration still work in isolation.
- The stronger break is the persistence/load contract and the OCR/content-acceptance heuristics, not a dead click handler.

## Minimal Safe Fix Plan

1. Fix persistence before touching surface polish.
   Replace the current `CvDocument -> profiles.patch` misuse with a CV-specific persistence contract that saves and loads `CvDocument` by CV id, or explicitly flatten/import into `userProfiles` if that is the intended product model. Do not keep pretending that `CvDocument` is a `userProfiles` row.

2. Stop masking failed or no-op saves.
   Make `StorageAdapter.save(...)` inspect the mutation result, and make `performSave(...)` surface remote save failure/no-op to the caller instead of silently downgrading to local-only durability.

3. Relax the Mistral acceptance rule.
   On the OCR path, accept payloads that produced usable normalized profile/contact/summary content even when `ocr_chars < 200` and `rawSections` is empty. Convert that case into a partial import warning, not a hard failure.

4. Make “nothing applied” visible.
   In `StructuredUploadButton`, if mapped sections are empty, show a visible warning/error state instead of the success toast. Keep `empty_reason` visible and add a persistent visible error message for the dropdown path.

5. Only after the pipeline is trustworthy, add missing entrypoints.
   Add import access to `/cvs` and decide whether preview-mode `/cv` should expose an import shortcut or intentionally force users back to edit mode.

## Risks

- Do not touch proposal save/library code for this fix. The root cause is in CV import persistence and CV import UI handling, not proposal persistence.
- Changing `profiles.patch` directly is risky because that mutation is shared with non-CV profile flows.
- Introducing a new CV persistence table or CV-specific mutation/query pair is safer than further overloading `userProfiles`.
- Tightening save error surfacing may reveal pre-existing backend failures that are currently hidden; expect noisy failures until the persistence contract is corrected.

## Recommended Test Coverage To Add

- A persistence round-trip test proving that an imported `CvDocument` survives save -> remote load -> route restore by its CV id.
- A regression test proving `StorageAdapter.load(id)` actually loads the requested CV id, not the generic authenticated profile row.
- An OCR-path test where Mistral returns useful normalized profile/summary content with fewer than 200 OCR chars; expected result should be partial import, not `mistral_unusable_content`.
- A UI test for the dropdown path where parser output maps to zero sections and no `empty_reason`; expected result should be a visible warning and no success toast.
- A surface-coverage test verifying where import controls exist: empty `/cv`, active `/cv`, preview `/cv`, and `/cvs`.
