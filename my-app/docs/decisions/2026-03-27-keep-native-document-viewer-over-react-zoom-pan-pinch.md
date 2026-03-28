# Keep Native Document Viewer Over `react-zoom-pan-pinch`

Date: 2026-03-27

## Decision

Do not adopt `react-zoom-pan-pinch` as the primary zoom/pan engine for Neyssan resume/proposal document previews.

## Why

- Proposal preview is width-driven, not purely transform-driven.
- Proposal layout and typography derive from the measured page width through the document renderer.
- Replacing that with a generic transform wrapper would weaken the A4/mm-based render model and risk repeating the earlier “text scales but page logic does not” failures.
- Resume and proposal can share a viewer shell and interaction logic without sharing the same inner document engine.

## What We Keep

- Native resume fit logic in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/ResumePage.tsx`
- Native proposal renderer in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/proposal-render/ProposalDocumentRenderer.tsx`
- Native viewport pan/zoom alignment in the app shell

## What We Borrow Conceptually

- Center-preserving zoom
- Better pan ergonomics
- Optional future touch/pinch affordances

## Consequence

The right architecture is:

- shared viewer shell behavior
- separate resume/proposal render engines

This keeps the proposal document truthful to its page metrics while still improving UX.
