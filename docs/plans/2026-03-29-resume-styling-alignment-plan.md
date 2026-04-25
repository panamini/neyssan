# Resume Styling Alignment Plan

Date: 2026-03-29

## Summary

Align resume styling with the proposal chrome cleanup while keeping resume-specific scope:

- keep the shared resume document surface in `VerbatiResumePreview`
- keep page wrappers separate (`/cv` and `/style`)
- consolidate styling UI around one shared resume appearance control
- reuse the shared document chrome and toolbar contract from `product.css`
- do not introduce proposal tone-of-voice controls into resume

## Target Architecture

### Shared Resume Surface

- Keep `src/features/verbati/VerbatiResumePreview.tsx` as the shared resume surface.
- This remains the resume equivalent of the proposal-side shared display module.

### Shared Resume Appearance Control

- Evolve `src/components/EmbeddedStyleInspector.tsx` into the shared resume appearance control used by:
  - `src/features/verbati/VerbatiCvPreviewPanel.tsx`
  - `src/features/verbati/VerbatiStyleWorkspace.tsx`
- If the existing component name becomes misleading after the redesign, rename it, but keep the module boundary small and shared.

### Shared CSS Chrome Contract

- Reuse the proposal chrome conventions already in `src/styles/product.css`:
  - toolbar shell spacing/radius
  - control radius hierarchy
  - drawer layering and overflow rules
  - tooltip suppression while drawers are open
  - shared document-surface anchoring

### Page-Specific Wrappers Stay Separate

- Keep `CvForge` as the live editing workbench.
- Keep `StyleForge` as the exploratory comparison/styling workbench.
- Do not merge them into one giant page component.

## Implementation Phases

### Phase 1: Shared Resume Styling Contract

- Audit and normalize the resume styling axes that should remain visible:
  - style bundle
  - layout
  - typography
  - palette
  - optional custom accent, only if product still wants it
- Explicitly exclude proposal-only controls:
  - tone of voice
  - proposal regenerate semantics

### Phase 2: Convert Resume Styling UI To Shared Chrome

- Refactor `EmbeddedStyleInspector` so it can render in the same premium toolbar/drawer language as proposal styling:
  - style trigger
  - color trigger
  - optional deeper customize drawer only if needed
- Prefer drawers/popovers over the current mixed select/pill/form layout where appropriate.
- Keep the control count minimal and the chrome aligned with proposal.

### Phase 3: Apply The Shared Control To `/cv`

- Keep `VerbatiCvPreviewPanel` as the host of the shared resume appearance control.
- Mount the shared control near the preview surface using the same document-surface anchoring discipline used for proposal.
- Reuse shared tooltip, drawer, and layering behavior.

### Phase 4: Replace Duplicate Resume Controls In `/style`

- Remove or reduce the duplicate inline layout/type/color control block in `VerbatiStyleWorkspace`.
- Reuse the shared resume appearance control instead.
- Preserve `/style`-specific features:
  - comparison mode
  - resume/proposal render switch
  - sample-vs-active preview workflow

### Phase 5: Unify Resume Color Behavior

- If custom accent remains:
  - adopt the simplified proposal-style picker behavior
  - avoid a second bespoke advanced override UI
- If custom accent is out of scope for resume:
  - keep named palettes only
  - remove the custom accent branch from the shared resume appearance control

### Phase 6: Validation

- Verify `/cv` and `/style` both style the same resume surface consistently.
- Verify style changes still persist to CV metadata.
- Verify comparison mode still works in `/style`.
- Verify there are no tone controls anywhere in resume styling UI.
- Run:
  - `npx tsc --noEmit --pretty false`
  - `npx vite build`
  - focused tests for resume preview/styling if they exist

## File Targets

- `src/components/EmbeddedStyleInspector.tsx`
- `src/features/verbati/VerbatiCvPreviewPanel.tsx`
- `src/features/verbati/VerbatiStyleWorkspace.tsx`
- `src/features/verbati/VerbatiResumePreview.tsx`
- `src/features/verbati/resume/resume-preview.css`
- `src/styles/product.css`
- `src/pages/CvForge.tsx`
- `src/pages/StyleForge.tsx`

## Prompt

Use this implementation prompt for the resume pass:

> Audit and align resume styling with the proposal chrome system.
>
> Goal:
> Keep one shared resume surface and one shared resume appearance control across `/cv` and `/style`, while preserving separate page wrappers. Resume does not need proposal tone-of-voice controls.
>
> Audit these files first:
> - `src/components/EmbeddedStyleInspector.tsx`
> - `src/features/verbati/VerbatiCvPreviewPanel.tsx`
> - `src/features/verbati/VerbatiStyleWorkspace.tsx`
> - `src/features/verbati/VerbatiResumePreview.tsx`
> - `src/features/verbati/resume/resume-preview.css`
> - `src/pages/CvForge.tsx`
> - `src/pages/StyleForge.tsx`
> - `src/styles/product.css`
>
> Constraints:
> - Keep `VerbatiResumePreview` as the shared resume document surface.
> - Reuse one shared resume appearance control for both `/cv` and `/style`.
> - Do not copy proposal tone/regenerate controls into resume.
> - Reuse the shared toolbar shell, drawer layering, radius hierarchy, and spacing contract from proposal chrome.
> - Keep page-specific wrappers separate; do not create one giant page component.
> - Prefer CSS and small wiring changes over duplicated markup.
>
> What to fix:
> 1. Consolidate resume styling UI around one shared appearance control module.
> 2. Remove duplicated resume layout/type/color controls from `VerbatiStyleWorkspace` in favor of the shared module.
> 3. Align resume drawers/tooltips/layering with the proposal chrome behavior.
> 4. Keep resume color behavior minimal and premium; if custom accent remains, use the simplified picker behavior, not a bespoke advanced override flow.
> 5. Keep `/style` comparison mode and `/cv` live editing behavior intact.
>
> Acceptance criteria:
> - `/cv` and `/style` style resumes through the same shared appearance-control system.
> - `VerbatiResumePreview` remains the shared resume surface.
> - Resume styling uses the proposal chrome language without importing proposal tone controls.
> - Drawer layering, spacing, and tooltip behavior are consistent with proposal.
> - Resume style persistence still works.
>
> Validation:
> - `npx tsc --noEmit --pretty false`
> - `npx vite build`
> - run focused resume styling / preview tests if they exist
