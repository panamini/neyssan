# Forge Footer Zoom Slider Audit

Date: 2026-05-12

## Goal

Assess whether CV Forge and Proposal Forge can replace the current discrete zoom controls with a footer slider like the referenced Canva-style bottom control, and define where it should appear.

## Assumptions

- The requested footer is application chrome attached to the document stage, not content inside the exported CV/proposal paper.
- "Zoom" is a preview/runtime concern only. It must not change document geometry, pagination, export size, or saved style metadata.
- Manual page management stays out of scope. This is only zoom, not pages/add-page thumbnails.

## Current State

### Shared zoom primitives

Active code already has a shared zoom scale source:

- `my-app/src/lib/document-stage.ts`
- `DOCUMENT_ZOOM_STEPS = [0.8, 1.0, 1.25, 1.5, 2.0]`
- `my-app/src/hooks/use-document-stage-layout.ts` consumes `zoomLevel`, computes stage/page size, and reports overflow.

This means a slider is feasible without inventing a new geometry system.

### CV Forge

Active code:

- `my-app/src/pages/CvForge.tsx`
- `my-app/src/features/verbati/VerbatiResumePreview.tsx`
- `my-app/src/components/cv/CvStageBar.tsx`

Confirmed behavior:

- `VerbatiResumePreview` owns `zoomIndex`, `workspaceViewMode`, and `fitRequestCount`.
- Workspace CV preview already supports `Fit page`, `Zoom out`, and `Zoom in`.
- Zoom is active only in `hostMode="workspace"`.
- Manual zoom switches `workspaceViewMode` from `fit-page` to `manual`.
- The viewport uses `data-document-stage="true"` and `useDocumentStageLayout`.

Important nuance:

- CV Forge edit mode still renders the paper preview with inline editing surfaces. A slider can work in both `edit` and `preview` as long as it remains runtime-only and does not affect saved resume data.
- The cleanest implementation is to keep zoom state in `VerbatiResumePreview` first, then optionally lift it only if the footer must live outside that component.

### Proposal Forge

Active code:

- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/components/ProposalDisplay.tsx`
- `my-app/src/components/proposal/ProposalDocumentStage.tsx`

Confirmed behavior:

- `ProposalDisplay` already supports controlled and uncontrolled zoom via `zoomIndex`, `onZoomIndexChange`, `showZoomControls`, and `zoomStorageKey`.
- It uses the same `DOCUMENT_ZOOM_STEPS` and `useDocumentStageLayout`.
- It explicitly disables zoom while editable: `effectiveZoomLevel = isEditable ? 1 : zoomLevel`.
- `ProposalForge` currently passes `showZoomControls={false}` to `ProposalDisplay`.
- Existing ProposalDisplay tests already lock the old popover zoom control behavior.

Important nuance:

- Proposal Forge edit mode cannot simply inherit the existing zoom path because `ProposalDisplay` intentionally forces edit zoom to `1`.
- A footer slider can ship first in Proposal preview mode only. Edit-mode proposal zoom needs a separate pass because inline AI selection, textarea geometry, and edit scroll ownership rely on unscaled coordinates.

## Recommended Display Rules

### CV Forge

Show the zoom footer when:

- the CV document preview is visible in the forge workspace
- `hostMode="workspace"`
- a document is loaded
- mode is `preview` or `edit`

Hide or collapse it when:

- import recovery/empty state replaces the document surface
- mobile width cannot fit the slider; use compact `- [range] + 100%` or a zoom button opening the slider

### Proposal Forge

Show the zoom footer when:

- proposal content exists
- mode is `preview`
- document renderer is active
- loading/error states are false

Do not show it in Proposal edit mode in the first pass.

Reason: edit mode currently disables zoom on purpose. Scaling it touches textarea selection coordinates, inline AI anchors, scroll ownership, and mirror geometry.

## Best Placement

Use a bottom stage footer/status bar attached to the document stage shell, not the right rail and not inside the paper.

Recommended layout:

```text
[left optional status/page count]           [-] [slider] [57%] [+]
```

For CV Forge:

- Replace the current zoom rail control inside `VerbatiResumePreview` with a footer control, or render the same control in a footer slot from that component.
- Keep page count on the left if visible.

For Proposal Forge:

- Add a footer slot to `ProposalDocumentStage`, or place it directly below the `ProposalDisplay` output shell inside the stage.
- Avoid using `.dasti-proposal-sheet__footer` for zoom. That footer currently belongs to proposal paragraph actions and can change the document shell bottom radius.

## Implementation Plan

1. Create a shared `DocumentZoomSlider` component.
   - Props: `valueIndex`, `steps`, `onValueIndexChange`, `onFit`, `fitActive`, `disabled`, `label`.
   - Use `input type="range"` for accessibility.
   - Display the resolved percent from `steps[index] * 100`.
   - Use Phosphor `MagnifyingGlassMinus`, `MagnifyingGlassPlus`, and `CornersIn`.

2. Add shared CSS in the existing document chrome area.
   - Reuse `--proposal-chrome-toolbar-bg`, `--proposal-chrome-control-bg`, `--proposal-chrome-control-hover-bg`, `--proposal-chrome-control-border`, `--radius-toolbar-shell`, `--hs`, `--tm2`, `--ti`.
   - Style the range track/thumb with app tokens.
   - Keep the control compact: around `28-32px` high.

3. CV first.
   - Update `VerbatiResumePreview` to render the slider footer in workspace mode.
   - Wire `range` changes to `setWorkspaceViewMode("manual")` and `setZoomIndex(nextIndex)`.
   - Keep `Fit page` as a separate icon button because fit is not just a percentage; it is an auto mode.
   - Preserve current wheel/pan behavior and tests around manual zoom.

4. Proposal preview second.
   - Lift `proposalZoomIndex` state into `ProposalForge` or pass a local uncontrolled slider through `ProposalDisplay`.
   - Change `showZoomControls={false}` only if the old popover is replaced, not duplicated.
   - Prefer passing a footer control into `ProposalDocumentStage` and keep `ProposalDisplay` as the geometry owner.
   - Show only in `proposalOutputMode === "preview"` and with meaningful proposal content.

5. Proposal edit later.
   - Only after a focused spike proves selection and inline AI anchors stay correct under zoom.
   - Tests must cover textarea selection toolbar position, edit scroll owner, and proofing overlay alignment.

## Test Plan

Minimum focused tests:

- `VerbatiResumePreview.test.tsx`: slider changes `workspaceViewMode` to manual and updates zoom index.
- `VerbatiResumePreview.test.tsx`: fit button returns to fit mode.
- `ProposalForge.workspace-toolbar.test.tsx`: Proposal Forge exposes footer zoom only in preview mode.
- `ProposalDisplay.stage.test.tsx`: preview zoom still passes expected `zoomLevel` to `useDocumentStageLayout`.
- CSS contract test for the footer slider tokens and compact mobile behavior.

Browser verification needed:

- CV Forge preview mode: slider zooms, page remains centered, scrollbars stay on document stage.
- CV Forge edit mode: slider zooms without breaking inline paper editing.
- Proposal Forge preview mode: slider zooms and page count/scroll behavior remains correct.
- Proposal Forge edit mode: verify hidden in first pass.

## Recommendation

Implement this in two phases.

Phase 1:

- CV Forge slider in edit + preview.
- Proposal Forge slider in preview only.
- Remove/replace old discrete rail/popover zoom controls on those surfaces to avoid duplicate zoom UI.

Phase 2:

- Evaluate Proposal edit-mode zoom separately, because the current code explicitly protects edit mode from zoom.

