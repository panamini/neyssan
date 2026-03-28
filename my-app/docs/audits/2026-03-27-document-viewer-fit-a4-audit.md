# Document Viewer Fit / A4 Audit

Date: 2026-03-27

## Scope

- Proposal Compose output
- Saved proposal selected preview
- Style Forge proposal preview
- Style Forge resume preview

## Classification

- Active code:
  - `src/components/ProposalDisplay.tsx`
  - `src/components/proposal-render/ProposalDocumentRenderer.tsx`
  - `src/features/verbati/VerbatiProposalWorkspace.tsx`
  - `src/features/verbati/VerbatiResumePreview.tsx`
  - `src/features/verbati/resume/ResumePage.tsx`
  - `src/styles/product.css`
- Legacy but informative:
  - older viewer shell styling in proposal library focus states
- Obsolete/dead:
  - prior assumptions that the outer shell was the A4 authority

## Verified runtime findings

Playwright verification on the running app showed:

- The true A4 authority is the document page, not the outer technical shell.
- Proposal page ratio measured live remains `~0.7071`, which matches `210 / 297`.
- Resume page ratio measured live remains `~0.7071`, which matches `210 / 297`.
- The outer viewer shell intentionally has technical bleed/chrome and is not itself the A4 page.

## Root cause of the "Fit is missing lines" bug

The main remaining bug was not the page ratio.

For longer saved proposals, the content inside the proposal document overflowed below the A4 page and was clipped by the page container. That made `Fit` look wrong even though the page ratio itself was correct.

This was verified live in Playwright by measuring:

- page ratio: correct A4
- viewport: centered and stable
- content bottom: extending below the page bottom by a small number of pixels

## Fix applied

`ProposalDocumentRenderer` now applies a single-page auto-fit pass:

- coarse fit levels (`data-fit="0"..."6"`)
- fine scale correction
- fine vertical offset correction in mm

This keeps the proposal on a single A4 page in `Fit` for near-overflow cases instead of clipping the last lines.

## Post-fix verification

Saved proposal selected preview, measured live:

- page ratio: still `~0.7071`
- content overflow vs page bottom: negative after the fix, meaning the content fits inside the A4 page

## Decision

- Keep the document page as the only A4 authority.
- Keep the shell as technical viewer chrome.
- Treat `Fit` as "whole page visible without clipping".
- If content almost fits on one page, auto-fit it inside the page rather than letting it clip.
- Do not treat shell bleed as evidence that the document ratio is wrong.
