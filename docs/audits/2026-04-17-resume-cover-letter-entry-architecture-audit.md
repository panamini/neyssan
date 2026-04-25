# Resume + Cover Letter Entry Architecture Audit

Date: 2026-04-17
Status: Implemented

## Scope
- Audit the current entry architecture for resume and cover-letter workflows.
- Correct Quick Start placement so it no longer reads as a resume-only action.
- Add a lightweight cold-start surface for blank cover-letter entry.
- Remove unsupported text parsing from Quick Start and keep the trusted file-import contract.

## Code Classification

### Active code
- `my-app/src/App.tsx`
- `my-app/src/components/Sidebar.tsx`
- `my-app/src/components/onboarding/QuickStartFlow.tsx`
- `my-app/src/pages/CvForge.tsx`
- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/components/ProposalInputForm.tsx`
- `my-app/src/components/ProposalBriefCard.tsx`
- `my-app/src/lib/proposal-personalization.ts`
- `clerk-chrome-extension-final/src/contents/content.tsx`

### Legacy but informative
- `clerk-chrome-extension-final/README-EXTENSION-TESTING.md`
- older extension scraping helpers that still mention stale source subsets

### Obsolete / dead
- `my-app/src/pages/ProposalForgeNext.tsx`
- extension `fiverr` scraping code paths that are no longer reachable from current content-script matching and platform detection

## Findings

### 1. Quick Start was misclassified as a resume action
- The previous placement under `New Resume` implied that Quick Start belonged to the resume workspace.
- The actual flow crosses workspace boundaries because it can lead into cover-letter work.
- Result: information architecture was misleading even when the flow itself was functional.

### 2. Blank cover-letter entry was too raw
- A fresh `/proposal` entry dropped straight into the editor unless the user arrived with a handoff or existing draft context.
- That behavior was fast for experts but weak for first-time users who had not yet attached a resume or used the extension.

### 3. Quick Start exposed unsupported parser choices
- The trusted import path is file-based Mistral ingestion.
- Quick Start still exposed text entry and text parsing behaviors that did not match that contract.
- Keeping `Paste text` in this surface would create a misleading and non-canonical import path.

### 4. Extension source copy could not be guessed safely
- The active source list had to come from current extension code, not stale README copy.
- The current active set in code is `LinkedIn`, `Indeed`, `Upwork`, `ZipRecruiter`, and `HelloWork`.
- `Fiverr` remains inactive for this product surface and should not be shown.

## Recommendation
- Put `Quick Start` at the top of the shell as a standalone action.
- Keep Quick Start minimal:
  - `Resume`
  - `Cover letter`
- For resume:
  - `Upload PDF or image`
  - `Start fresh`
- For cover letter:
  - route into `/proposal`
  - show a compact cold-start surface only for blank compose entry
- Remove text parsing from Quick Start entirely.
- Keep internal proposal routes and persistence unchanged for now; change only user-facing copy to `Cover letter` / `Cover letters`.

## Implemented Outcome
- Quick Start now renders at shell level and no longer sits under Resume.
- Existing `start=quick` triggers remain compatible.
- Quick Start no longer offers `Paste text`, `.txt`, or any client-side text fallback.
- Resume import now exposes only PDF/image upload and still uses the canonical Mistral import path.
- Blank `/proposal` now shows a lightweight cover-letter start surface with:
  - `Use a resume`
  - `Import a resume`
  - `Use Chrome extension`
  - `Open editor`
- Extension helper links are active outbound links and reflect the verified active source list.
- User-facing shell and library copy now uses `Cover letter` / `Cover letters`.

## Verification
- Targeted Vitest coverage passed for:
  - `QuickStartFlow`
  - `CvForge` quick-start auto-entry
  - sidebar navigation and Quick Start routing
  - proposal attached-CV sync and cold-start behavior
  - CV library and cover-letter library copy/regression checks
- `npm run lint` is currently blocked by an existing repo-level ESLint config problem:
  - `.eslintrc.cjs` references `./scraping-server/tsconfig.json`
  - that file is missing in the current workspace
