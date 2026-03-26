# CV Renderer Integration Plan
Date: 2026-03-25

## Goal
- Integrate the standalone CV renderer into `my-app` without changing the builder source of truth and without breaking current output.

## Constraints
- `CvDocument` remains the master source.
- No brutal refactor.
- No global shared bucket without clear boundaries.
- Current editor and current output must keep working during the migration.

## Plan

### 1. Create the renderer adapter boundary
- Add an internal renderer-facing type such as `ResumeRenderModel`.
- Add a single adapter from `CvDocument` to `ResumeRenderModel`.
- Add tests for:
- document title vs displayed role
- profile/contact mapping
- date range formatting
- responsibilities/achievements fallback
- missing/empty sections
- project fallback behavior

### 2. Port the pure renderer feature
- Port into `my-app`:
- `ResumePage.tsx`
- `resume-layout.spec.ts`
- `resume-preview.css`
- Keep it isolated under a feature folder.
- Do not port showcase shell or UI kit in this step.

### 3. Add a scoped token bridge
- Create a renderer wrapper class that defines the aliases the renderer expects:
- `--color-*`
- `--font-*`
- `--radius-*`
- any required preview variables
- Keep the bridge local to the renderer container.

### 4. Mount the renderer in read-only passive mode
- Add a route, panel, or toggle that renders the live `currentCv` through the adapter.
- Keep current editor UI unchanged.
- Validate visually before replacing any existing preview path.

### 5. Replace `StyleForge` sample data
- Remove hardcoded identity and sample sections.
- Feed `StyleForge` from live adapted CV data.
- Keep current control labels temporarily, but translate them explicitly to renderer presets.

### 6. Fill the structural gaps
- Define explicit rules for:
- `projects`
- `certifications`
- generic `text`
- `contact`
- Prefer adapter-level omission or fallback first.
- Only promote new canonical section structures if the product truly needs them.

### 7. Reduce duplicate preview logic
- After validation, remove overlapping preview code where safe.
- Do not collapse builder preview and final renderer into one module before the new renderer has test coverage and real usage validation.

## Validation gates
- Builder source stays `CvDocument`.
- No root-theme regressions.
- Current edit flows remain stable.
- Renderer output matches live builder data, not sample data.
- Mapping tests cover every supported section type and known fallback.
