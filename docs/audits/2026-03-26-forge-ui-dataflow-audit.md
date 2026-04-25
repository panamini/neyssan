# Forge UI and Data-Flow Audit

Date: 2026-03-26

## Scope
- Active code:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/ExperienceEducationModal.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/StructuredUploadButton.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/SectionEditor.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/AchievementsBlock.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/Sidebar.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiStyleWorkspace.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/convex/updateProposalPublic.ts`
- Legacy but informative:
  - `/Volumes/video/kay/app/pouraurelien/save/UI/UI-SPEC/css-audit/dasti_design_system_restructure.md`
  - `/Volumes/video/kay/app/pouraurelien/save/UI/UI-SPEC/css-audit/dasti_specv3_2203_systemUI.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/UI/UI-SPEC/css-audit/dasti-production-backup/dasti-rewrite-pack-v1`
- Obsolete/dead for this pass:
  - backup trees, `*.bak`, legacy parser/archive folders per project instructions.

## Findings and Changes

### 1. Date pipeline
- Root cause:
  - Experience/Education editors still exposed day-level controls.
  - New experience rows seeded `1970-01-01`, which created a fake date state even before real user input.
  - Precision drift was possible because ISO timestamps are always full dates, so the renderer depends on `startDatePrecision` / `endDatePrecision` being preserved correctly.
- Fix:
  - Removed day-level UI from both Experience and Education editors.
  - Removed the `1970-01-01` sentinel for newly created experience rows.
  - Normalized saved entries back to explicit `year` / `month` precision before persistence.
  - Kept rendering on the existing `formatRangeFromItem()` path so the selected month/year now reaches resume output consistently.

### 2. Section removal for Languages and Achievements
- Root cause:
  - Inline item removal existed, but there was no section-level affordance for deleting the whole optional section.
- Fix:
  - Added section-level `X` actions in the top-right of Languages and Achievements.
  - Removal uses the active CV section list and `reorderSections()`, so the section is removed cleanly instead of just visually hidden.

### 3. CV import routing
- Root cause:
  - The “smart import” button hid the routing decision behind a PDF text probe.
  - That behavior conflicted with the requirement to use only the two owned pipelines and to keep scanned/image PDFs on Mistral OCR.
- Fix:
  - Restored explicit import choices in a dropdown:
    - `Import with StructuredUpload`
    - `Import with Mistral OCR`
  - Removed client-side PDF text probing from this UI path.
  - Dropping a file on the import button now opens the same explicit routing menu with that file staged.

### 4. Photo upload area
- Root cause:
  - The empty state had too many competing cues: icon, badge, helper line, and upload wording.
- Fix:
  - Replaced the photo placeholder icon with `User`.
  - Removed the inline “Upload photo” helper text and the camera icon.
  - Kept a single lightweight hover badge plus the frosted drag state.

### 5. Proposal library layout
- Root cause:
  - Saved Proposal Forge had a redundant title card separate from the actual proposal sheet header.
- Fix:
  - Removed the extra title card.
  - Kept one integrated proposal card header containing title, meta, and actions.

### 6. Proposal update contract
- Root cause:
  - `updateProposalPublic` only accepted `content` and `sections`, while the UI also used it for title-only updates and mixed patch shapes.
- Fix:
  - Converted `updateProposalPublic` into a real patch mutation for public proposal fields.
  - The mutation now accepts optional `title`, `content`, `sections`, `status`, and `metadata`.
  - Content-only updates still auto-sync sections when needed.

### 7. Sidebar typography and width
- Root cause:
  - The previous width/label scale was tuned for `14px` labels.
  - Moving to one-step larger typography without widening the rail would reduce truncation tolerance too much.
- Fix:
  - Moved the canonical sidebar label size from `14px` to `16px`.
  - Increased widths from `248/232` to `256/240`.
  - This preserves the 8px grid and keeps the rail close to the original golden-ratio intent while making room for the stronger label scale.

### 8. Token audit status
- Confirmed tokenized:
  - borders
  - shadows
  - cards
  - spacing
  - clusters
  - buttons
  - text fields
  - status
  - pills
  - dropdowns
  - sidebar
  - font families
  - font sizes
  - line-height
  - letter-spacing / tracking
- Remaining migration leakage:
  - Some resume layout/view code still uses local inline typography values in the renderer layer.
  - This is a migration completeness issue, not a missing token foundation issue.

## Verification
- `npx prettier --check` passes on touched files.
- `npx vite build` passes.
- Filtered `tsc -b` shows no diagnostics for the touched files in this pass.

