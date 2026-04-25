# Follow-up Audit: Achievements, Scroll Shell, Sidebar Rename

Date: 2026-03-19

Scope: active UI code only

## Confirmed

### Achievements add flow can wipe uploaded content
- Status: confirmed
- Classification: active code
- Why: the achievements editor seeded itself only from `section.structuredContent`, but uploaded/imported CVs can still carry achievements in legacy block content. Saving from the modal could therefore replace non-empty imported content with an empty structured array.
- Relevant files:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/AchievementsBlock.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/structured-blocks/AchievementsModal.tsx`
- Implementation change:
  - achievements now merge from both `structuredContent` and block/plain-text sources before opening the modal
  - saving resets legacy blocks and lets canonical representative blocks regenerate from structured content

### Proposal rename using a generic browser prompt is off-pattern
- Status: confirmed
- Classification: active code
- Why: proposal rename in the sidebar used `window.prompt(...)`, while resume rename already used the app’s styled dialog system.
- Relevant files:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/Sidebar.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/CvRenameDialog.tsx`
- Implementation change:
  - proposal rename now uses the same styled dialog pattern as CV rename

### White screen at end-of-page scroll is a shell issue
- Status: confirmed
- Classification: active code
- Why: the app uses internal scroll containers, but the outer page could still overscroll and reveal the browser canvas edge.
- Relevant files:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvForge.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/StyleForge.tsx`
- Implementation change:
  - outer document scrolling is locked
  - page-level scroll areas now use contained overscroll and explicit canvas background

## Partially Confirmed

### Sidebar resume hierarchy is redundant today
- Status: partially confirmed
- Classification: active code
- Why: the section label `Resume` and the route item `Resume` repeated the same concept. That redundancy is real. But the proposed full hierarchy rewrite introduces a broader navigation model change and should not be folded into a quick UI pass.
- Relevant files:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/Sidebar.tsx`
- Implementation change:
  - the route item label was renamed from `Resume` to `Current`
  - spacing around section labels and top-level rows was loosened slightly
- Deferred:
  - full grouped `Proposals / Cover letters / View all` hierarchy
  - a dedicated all-proposals library with search, filters, and sort

## Recommendation

Best practice here is:
- sidebar = recent working set / quick navigation
- `Open` page = full library
- full library should later own:
  - search
  - filters
  - sorting
  - rename / delete / open actions

That larger proposal-library pass is valid, but it should be implemented as a dedicated navigation refactor, not mixed into this bug-fix pass.
