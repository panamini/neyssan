# Resume Viewer Stabilization Plan

Date: 2026-04-18

## Objective

Stabilize the resume preview/viewer UX before additional feature work.

## Priority Order

1. Preview/viewer stabilization
2. Mini live render stabilization
3. Editor regressions
4. Pagination/planner tuning
5. Print/export parity later
6. One-page/full-CV toggle much later

## Focused Implementation Plan

### Phase 1: Shell And Viewport Contract

- Keep one fixed viewer shell.
- Keep scrolling inside the document viewport only.
- Reduce outer shell padding and visible framing.
- Remove the extra workspace toolbar inset so the page starts higher.
- Keep the page centered horizontally in both panel and workspace hosts.

### Phase 2: Fit / Zoom / Scroll Contract

- Fit from single-page geometry, not stacked document height.
- Let stacked pages extend vertical scroll height only.
- Treat horizontal zoom overflow separately from vertical stacked-page overflow.
- Hide horizontal overflow when the page still fits width.
- Keep pan disabled in fit situations and limited to true zoom-overflow states.

### Phase 3: Editor Regression Cleanup

- Only show the rename prompt as part of fresh import flows, not ordinary reopen/edit/save flows.
- Make preview-targeted achievement focus a one-shot behavior so typing in another field remains stable.

### Phase 4: Post-Stabilization Tuning

- Tune Swiss Minima page-break thresholds.
- Re-check one-page bottom live-area margin.
- Re-check page-1 empty space before page-2 creation.

## Implemented In This Pass

- Workspace preview shell spacing and overflow handling were tightened.
- Resume viewport now exposes axis-specific overflow state.
- `CvForge` preview mode no longer adds the extra toolbar inset.
- Imported-CV rename prompt no longer auto-opens on ordinary reopen.
- Achievements modal focus no longer jumps back while typing in another field.

## Manual QA Checklist

### Workspace Preview

- Open CV preview from `CvForge`.
- Confirm the page is visible immediately on load with no left or right crop.
- Click `Fit page` and confirm the full first page is visible without width clipping.
- Zoom in and out several steps.
- Confirm horizontal clipping only appears when intentionally zoomed in.
- Confirm the viewer shell stays fixed while only the internal document area scrolls.
- Confirm the page stack stays horizontally centered.
- Confirm there is no dead vertical scroll after the last page.

### Mini Preview

- Open edit mode with the side preview visible.
- Confirm the mini preview fills width cleanly and is not pushed right.
- Confirm multipage CVs scroll inside the preview instead of leaving empty trailing space.

### Editor Regressions

- Reopen an imported CV titled `Imported CV` and confirm no rename popup appears automatically.
- Fresh-import a CV and confirm the rename flow still works when explicitly triggered by the import path.
- Open achievements from preview targeting, then click into a different achievement field and type.
- Confirm focus stays in the field you selected.

### Pagination Follow-Up

- Check a one-page Swiss Minima CV for bottom live-area margin.
- Check a borderline two-page CV for late page creation.
- Check whether page 1 leaves avoidable empty space before page 2 starts.
