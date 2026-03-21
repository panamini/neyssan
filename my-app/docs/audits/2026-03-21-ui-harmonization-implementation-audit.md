# UI Harmonization Implementation Audit

Date: 2026-03-21

## Scope

- Library card canon
- Proposal A4 panels
- `CvForge` typography consistency
- Sidebar simplification

## Findings

### Active code

- Library cards now share the same `title-first` hierarchy in:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/CvsLibrary.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalsLibrary.tsx`
- Proposal text editing and reading now use the same sheet viewport primitives in:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalInputForm.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx`
- `Experience` and `Education` blank/imported typography now share the same primitives in:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/SectionEditor.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/cv-display/RichSummary.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/cv-editor/BlockRenderer.tsx`
- Sidebar document rows were simplified and the theme toggle moved to the footer in:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/Sidebar.tsx`

### Legacy but informative

- Legacy `SkillsModal` and `LanguagesModal` remain in the repo but are not the primary editing path for active inline skills/languages UX.

## Validation

- `npx tsc --noEmit`
- `git diff --check`

## Residual Risk

- `ProposalDisplay.tsx` still uses its markdown parser with utility-class heading scales. The viewport is harmonized, but a future pass may still normalize internal heading sizes if proposal content styling feels too strong relative to the rest of the app.
