# Follow-up Audit: Sidebar Rhythm, Proposal Meta, Palette Scope, Achievements Actions

Date: 2026-03-19

Scope: active UI code only

## Confirmed

### Sidebar route labels and document rows were misaligned
- Status: confirmed
- Classification: active code
- Why: `Current` / `Compose` text started on a different text column than the document rows underneath them, which weakened the hierarchy instead of clarifying it.
- Relevant file:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/Sidebar.tsx`
- Implementation:
  - document rows and “new” actions were moved onto the same text column as `Current` / `Compose`

### Proposal document title/meta rhythm was too loose
- Status: confirmed
- Classification: active code
- Why: the title leading and the subtitle/meta line sat too far apart for a compact document card. Optical best practice on screen is a tighter title leading with a smaller 1–4px gap before supporting metadata.
- Relevant file:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx`
- Implementation:
  - title leading tightened
  - meta line-height tightened

### Achievements header actions were redundant
- Status: confirmed
- Classification: active code
- Why: the `+` already opens the full editor and can append a new row, so the separate pencil created duplicate meaning.
- Relevant file:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/AchievementsBlock.tsx`
- Implementation:
  - removed the pencil action
  - kept `+` for add
  - made the achievements preview itself clickable for edit

### Card header action buttons still had an overly strong click/focus effect
- Status: confirmed
- Classification: active code
- Why: small icon actions do not need the same visible focus treatment as primary buttons. The previous ring treatment read as a flash.
- Relevant files:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/AchievementsBlock.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/SectionEditor.tsx`
- Implementation:
  - replaced the stronger visible ring on those icon actions with a quieter inset treatment

## Partially Confirmed

### Literal phi ratio for `Current` and `Compose`
- Status: partially confirmed
- Classification: active code
- Why: the sidebar should feel optically proportioned, but the live shell is built on the project’s 8px grid and the Dasti references do not require a literal mathematical φ ratio for those rows.
- Decision:
  - fixed optical alignment and hierarchy first
  - did not force an artificial numeric ratio that would fight the grid

## Not Confirmed

### Palette selection should recolor the whole app shell by default
- Status: not confirmed
- Classification: active code
- Why: using the document palette to also recolor navigation and workspace UI makes the app state less stable and can blur the difference between product chrome and document styling.
- Recommendation:
  - keep workspace accent stable
  - keep palette applied to document preview/export
  - if needed later, add a separate workspace-theme control rather than coupling both behaviors

## Already Enforced

### Achievements should appear right after Experience
- Status: already implemented
- Classification: active code
- Relevant file:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/contexts/CvLibraryContext.tsx`
- Why:
  - the insertion order already places `achievements` directly after `experience`

## Recommendation

The add-section control should stay under the CV title, not at the end of the document.

Reason:
- it is a document-level action, not a section-local action
- keeping it at the top improves discoverability
- placing it only at the bottom makes long CVs slower to edit

If needed later, the safe enhancement is:
- keep the main add-section bar under the title
- optionally add a small secondary ghost add affordance at the bottom for long documents
