# Resume + Cover Letter Entry Implementation

Date: 2026-04-17
Status: Implemented

## Goal
- Reframe Quick Start as a shared entry action instead of a resume-only affordance.
- Add a minimal cover-letter first-run surface without adding a wizard, new storage, or a parallel route model.
- Remove unsupported text parsing from Quick Start.

## Implementation Summary

### 1. Shell-level Quick Start
- Added shell routing helpers so Quick Start can open from the sidebar, legacy `start=quick` links, and the cover-letter import path.
- Reused the existing `QuickStartFlow` internals instead of moving business logic into a new controller.
- Kept query compatibility while extending support for:
  - initial branch selection
  - upload-only resume mode
  - return-to-proposal behavior

### 2. Quick Start simplification
- Reduced the flow to a minimal chooser:
  - `Resume`
  - `Cover letter`
- Resume branch now supports only:
  - `Upload PDF or image`
  - `Start fresh`
- Removed:
  - `Paste text`
  - `.txt` handling
  - text parsing fallback
  - tone step

### 3. Cover-letter cold-start surface
- Added a new in-shell blank-entry surface inside `/proposal`.
- The surface appears only when there is no handoff, saved view, meaningful compose draft, output draft, or attached resume context.
- Choices:
  - `Use a resume`
  - `Import a resume`
  - `Use Chrome extension`
  - `Open editor`

### 4. Import return path
- `Import a resume` opens Quick Start in upload-only mode.
- On successful import:
  - stay on `/proposal`
  - attach the imported CV via the existing attached-CV path
  - skip the cold-start surface
- No new storage, shadow handoff, or side persistence was added.

### 5. Chrome extension helper
- Centralized the active source labels and URLs in a shared constant.
- Primary inline links:
  - `LinkedIn`
  - `Indeed`
  - `Upwork`
- Secondary expandable links:
  - `ZipRecruiter`
  - `HelloWork`
- Links open in a new tab and point to relevant job/search surfaces.

### 6. User-facing naming
- Updated shell/library copy from `Proposal(s)` to `Cover letter(s)`.
- Kept internal `/proposal` route and existing proposal storage intact.

## Files Touched
- `my-app/src/App.tsx`
- `my-app/src/components/Sidebar.tsx`
- `my-app/src/components/CoverLetterStartSurface.tsx`
- `my-app/src/components/onboarding/QuickStartFlow.tsx`
- `my-app/src/components/ProposalBriefCard.tsx`
- `my-app/src/components/ProposalInputForm.tsx`
- `my-app/src/lib/proposal-source-platforms.ts`
- `my-app/src/lib/quick-start-routing.ts`
- `my-app/src/pages/CvForge.tsx`
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/pages/ProposalsLibrary.tsx`
- affected tests under `my-app/src/components/**/__tests__` and `my-app/src/pages/__tests__`

## Verification
- Passed targeted regression suite:
  - `src/components/onboarding/QuickStartFlow.test.tsx`
  - `src/pages/__tests__/CvForge.quick-start.test.tsx`
  - `src/components/__tests__/Sidebar.proposal-navigation.test.tsx`
  - `src/pages/__tests__/ProposalForge.attached-cv-sync.test.tsx`
  - `src/pages/__tests__/ProposalsLibrary.test.tsx`
  - `src/pages/__tests__/CvsLibrary.test.tsx`

## Known Constraint
- Repo-wide `npm run lint` is not currently usable because ESLint config loads `./scraping-server/tsconfig.json`, which is missing from this workspace.
