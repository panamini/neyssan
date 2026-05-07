# Plan: CV Forge canonical page geometry, import verification, and toolbar polish

Date: 2026-05-07
Status: proposed
Scope: CV Forge only. Do not commit until geometry and Import PDF are verified.

## Context

The screenshots and code review show CV Forge has the same class of layout issue Proposal Forge recently had: there is no canonical page/stage/rail geometry contract. The visible toolbar and rail are still governed by leftover grid space (`minmax(0, 1fr) 360px`) rather than by the document page width. This makes toolbar alignment, rail collapse, ATS pressure, and import-action placement feel unstable.

Import PDF also needs a browser-level verification pass. Source wiring points to the real Mistral/OCR import path, so the issue is not proven to be a mock or parser problem.

## Confirmed source facts

Active files:

- `my-app/src/pages/CvForge.tsx`
- `my-app/src/components/cv/CvStageBar.tsx`
- `my-app/src/components/cv/CvRail.tsx`
- `my-app/src/styles/product-cv.css`

Proposal reference:

- `my-app/src/pages/ProposalForge.tsx`
- `my-app/src/components/proposal/ProposalDocumentStage.tsx`
- `my-app/src/styles/product-proposal.css`

Current CV facts:

- `New CV` and `Import PDF` already live in `CvRail` under Create.
- Top toolbar no longer has New/Import buttons; it has status, ATS, tone, edit/preview, hidden version history, pick resume, share.
- `Import PDF` source path is real:
  - `CvRail` → `onImportPdf`
  - `CvForge` → `handleImportEntryCv`
  - `handleImportEntryCv` → `cvImportInputRef.current?.click()`
  - hidden file input → `handleEntryImportFileChange`
  - `handleEntryImportFileChange` → `importStructuredCvFile(file)`
- CV layout still uses a leftover-space grid: `grid-template-columns: minmax(0, 1fr) 360px`.
- Proposal has the cleaner canonical contract:
  - `--proposal-paper-visual-inline-size`
  - `--proposal-workspace-stage-inline-size`
  - `--proposal-workspace-rail-inline-size`
  - centered page+rail grid.

## Recommended approach

Make canonical CV page/stage/rail geometry the primary fix. Treat import, toolbar order, ATS compaction, rail tabs, and breakpoint behavior as secondary tasks inside that stable layout contract.

## Files to modify

- `my-app/src/styles/product-cv.css`
- `my-app/src/pages/CvForge.tsx`
- `my-app/src/components/cv/CvStageBar.tsx`
- `my-app/src/components/cv/CvRail.tsx`
- Focused tests as needed:
  - `my-app/src/components/cv/__tests__/CvStageBar.test.tsx`
  - `my-app/src/components/__tests__/CvForgeToolbar.css.test.ts`
  - targeted CV workspace tests that mention `Import CV` / `Import PDF`

## Reuse

- Reuse Proposal geometry pattern from `my-app/src/styles/product-proposal.css`:
  - `.dasti-proposal-skeleton-forge`
  - `.dasti-proposal-skeleton-forge__stage`
  - `--proposal-paper-visual-inline-size`
  - `--proposal-workspace-stage-inline-size`
  - `--proposal-workspace-rail-inline-size`
- Reuse existing CV import path in `my-app/src/pages/CvForge.tsx`:
  - `handleImportEntryCv`
  - `cvImportInputRef`
  - `handleEntryImportFileChange`
  - `importStructuredCvFile`
- Reuse existing CV rail/action components; do not create a new import pipeline.

## Steps

### 1. Establish canonical CV page/stage/rail geometry

Introduce CV-local geometry variables in `product-cv.css`:

```css
--cv-paper-visual-inline-size: var(--forge-page-inline-size);
--cv-workspace-stage-inline-size: var(--cv-paper-visual-inline-size);
--cv-workspace-rail-inline-size: 360px;
```

Apply them to `.dasti-cv-skeleton-forge` so the grid is page-first, not leftover-space-first:

```css
grid-template-columns:
  minmax(0, var(--cv-workspace-stage-inline-size))
  var(--cv-workspace-rail-inline-size);
justify-content: center;
```

Then make stage, toolbar, and paper inherit the same authority:

- `.dasti-cv-skeleton-forge__stage`
  - `width: min(100%, var(--cv-workspace-stage-inline-size));`
  - `justify-self: center;`
  - `min-width: 0;`
- `.dasti-cv-paper-stage`, `.dasti-cv-page-preview-stage`
  - use `--cv-paper-visual-inline-size` instead of raw `--forge-page-inline-size`.
- Toolbar remains inside the stage, so it naturally scopes to page/stage width.

Acceptance:

- The CV toolbar width matches the CV page/stage width.
- The rail width remains independent and does not define page width.
- No one-off toolbar width hacks.

### 2. Fix rail collapse as a page-first breakpoint

Use Proposal Forge's responsive geometry as the first implementation value:

- two-pane minimum viewport: `1420px`
- collapsed CSS media query: `@media (max-width: 1419px)`

Only diverge from `1420/1419` if browser measurements prove CV needs a different value.

Expanded mode requires: stage width + rail width + grid gap + shell padding. Collapsed mode should happen before the page is forced to shrink awkwardly. In collapsed mode:

- stage width remains `min(100%, var(--cv-workspace-stage-inline-size))`
- rail width uses the same stage width
- rail stacks below/above without changing the page identity
- toolbar inherits the stage/page width

Browser-check widths:

- 1440
- 1420
- 1419
- 1360
- 1260
- 1240
- 1180
- 900
- 760

Acceptance:

- Rail collapses before the page shrinks in a visually awkward way.
- Page, toolbar, and rail remain aligned across expanded and collapsed modes.

### 3. Restore the rail tab visual regression

Regression introduced in the previous pass:

- `Sections / Ask / Style` was restyled into a heavier raised pill/control cluster.
- User feedback: previous CV version was better and closer to desired Proposal Forge feel.

Plan:

- Restore the lighter previous segmented treatment for `.dasti-cv-rail-tabs`.
- Keep labels as `Sections`, `Ask`, `Style`.
- Do not force Proposal's four-tab structure or bulky raised controls onto CV.
- If preserving some Proposal parity, keep it subtle: compatible border/background/radius tokens only.

Acceptance:

- Rail tabs look calm, lighter, and close to the previous CV version.
- They still fit the app design language without becoming heavy toolbar buttons.

### 4. Verify canonical Import PDF, but do not over-diagnose without proof

The “remove duplicate Import CV” step is mostly stale because current source already has only `Import PDF` in CV rail. Keep that invariant.

Run a browser probe before changing import code:

- Attach a temporary probe to the hidden input or monkey-patch `HTMLInputElement.prototype.click` in Playwright.
- Click visible `Import PDF`.
- Confirm whether input activation occurs.
- Confirm whether `cvImportInputRef.current` is non-null.
- Confirm whether `isEntryPickerBusy` blocks the handler.

Only if the probe proves a problem:

- If ref is null, keep the hidden file input mounted unconditionally at a stable page-root location.
- If busy state mismatch blocks it, make button disabled state match `handleImportEntryCv`'s actual guard.
- If remote `.click()` is unreliable, switch to a stable native input trigger pattern (`label htmlFor` or adjacent input) while keeping `handleEntryImportFileChange` and `importStructuredCvFile` unchanged.

Acceptance:

- `Import PDF` opens the real file picker path.
- It continues into `importStructuredCvFile` on file selection.
- No mock import UI remains in this path.

### 5. Treat ATS placement as measurement-driven, not default relocation

Do not move ATS next to Share by default. It is semantically a status pill like Saved and tone.

Preferred behavior:

- Keep ATS in the left status cluster by default.
- Compact ATS text under toolbar pressure:
  - desktop: `ATS-ready` / `ATS review`
  - compact: shorter label such as `ATS`, or icon-only with tooltip if necessary.
- Only move ATS adjacent to Share if browser measurements prove it is needed to preserve one-line layout.

Acceptance:

- ATS remains understandable.
- It does not force toolbar wrapping or page-width overflow.
- Any relocation is justified by measured layout pressure, not assumed.

### 6. Keep toolbar order and controls stable inside page geometry

Target toolbar remains compact and page-scoped:

- status/tone/ATS cluster
- divider
- edit/preview icon segmented control
- spacer/right-side actions
- pick resume
- share

Notes:

- Version history remains hidden/disabled unless product scope changes.
- Share stays icon-only with accessible label/tooltip.
- Edit/preview stays icon-only with accessible labels.

Acceptance:

- Toolbar is one-line at valid desktop widths.
- It does not exceed the canonical stage width.

### 7. Tests and verification

Before commit:

1. TypeScript:
   - `cd my-app && rtk npx tsc --noEmit --pretty false`
2. Focused tests:
   - `cd my-app && rtk npx vitest run src/components/cv/__tests__/CvStageBar.test.tsx src/components/__tests__/CvForgeToolbar.css.test.ts`
   - Run/update targeted CV workspace tests that check `Import PDF`, not `Import CV`.
3. Browser probes:
   - Import PDF opens the real input path.
   - Rail shows `New CV` and `Import PDF`, not `Import CV`.
   - Rail tabs are restored to lighter prior treatment.
   - Toolbar width matches stage/page width.
   - Stage, page, toolbar, and rail stay aligned at 1440, 1420, 1419, 1360, 1260, 1240, 1180, 900, and 760.
   - ATS compacts under pressure and does not cause wrap/overflow.
4. Review pass.
5. Commit only after verification succeeds.

## Non-goals

- Do not change parser behavior.
- Do not change Mistral/OCR implementation.
- Do not alter Proposal Forge behavior.
- Do not broadly rewrite CV Forge.
- Do not commit while Import PDF remains unverified.
