# UI Harmonization Canon

Date: 2026-03-21

## Context

The active UI still had four visible inconsistencies:

- `Resume Library` and `Proposal Library` used different card hierarchies.
- `Proposal Forge` and `Saved drafts` did not present proposal text inside a document-like viewport.
- `CvForge` blank experience/education previews and imported legacy blocks used different typographic hierarchies.
- Sidebar sub-items carried noisy secondary metadata, while the theme toggle sat in the main nav instead of the account area.

## Decision

The active canon is now:

1. Library cards are `title-first`.
   - Date is secondary and sits in the top row.
   - Meta comes after the title.
   - Snippet comes last.
2. Proposal text surfaces use an A4-like sheet viewport.
   - The sheet keeps a `1 / 1.41421356` ratio.
   - Overflow scrolls inside the sheet.
   - Manual resize is removed from active proposal text editors.
3. `CvForge` blank previews are the typographic source of truth for `Experience` and `Education`.
   - Imported legacy blocks must reuse the same title, subtitle, date, body, and bullet hierarchy.
4. Sidebar document rows are single-line title items.
   - Date/type sublines are removed.
   - Theme switching belongs to the footer account area, not the main nav.

## Active Code

- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvsLibrary.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalsLibrary.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalInputForm.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/SectionEditor.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/cv-display/RichSummary.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/cv-editor/BlockRenderer.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/Sidebar.tsx`

## Notes

- This does not introduce new backend data or persistence.
- A global typography switcher remains out of scope until more screens share the same text primitives.

## Button Geometry and Action Hierarchy

- Icon-only toolbar controls use canonical squircle icon buttons.
- Primary workflow actions use pills when labeled.
- Assistant handles use a squircle when icon-only and a soft pill when labeled.
- Global header actions use neutral header pills unless they are the current primary action.
- Circles are reserved for avatars, status dots, knobs, and explicit circular controls.
- Shape follows action semantics.
