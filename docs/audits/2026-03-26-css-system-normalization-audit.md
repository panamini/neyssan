# CSS System Normalization Audit

Date: 2026-03-26

## Scope

- Active code audited and updated:
  - `src/styles/globals.css`
  - `src/styles/foundation.css`
  - `src/styles/themes.css`
  - `src/styles/base.css`
  - `src/styles/primitives.css`
  - `src/styles/product.css`
  - `src/styles/utilities.css`
  - `src/index.css`
  - `src/pages/CvForge.tsx`
  - `src/pages/CvsLibrary.tsx`
  - `src/pages/ProposalForge.tsx`
  - `src/pages/ProposalsLibrary.tsx`
  - `src/features/verbati/VerbatiCvPreviewPanel.tsx`
  - `src/features/verbati/VerbatiStyleWorkspace.tsx`
  - `src/components/ProfileReviewCard.tsx`
  - `src/components/ProposalInputForm.tsx`
- Legacy but informative:
  - `DESIGN_SYSTEM.md`
  - `/Volumes/video/kay/app/pouraurelien/save/UI/UI-SPEC/css-audit/dasti_design_system_restructure.md`
  - `/Volumes/video/kay/app/pouraurelien/save/UI/UI-SPEC/css-audit/dasti_specv3_2203_systemUI.tsx`
- Obsolete or non-authoritative:
  - `pdf-ingest/`
  - backup trees
  - `*.bak`
  - parser/training-oriented legacy code per `AGENTS.md`

## Verdict

- The codebase now has an explicit CSS layer split instead of a monolithic global sheet.
- The routed product UI now consumes more canonical shell and primitive classes for layout, spacing, tabs, buttons, selects, panels, and segmented controls.
- The Verbati resume renderer remains isolated as a specialized document surface rather than becoming the app-shell layout model.

## What Changed

### 1. CSS source-of-truth split

- `globals.css` is now a composition-only entrypoint.
- Foundation concerns moved into dedicated files:
  - `foundation.css`: tokens, readable aliases, compatibility aliases
  - `themes.css`: theme overrides
  - `base.css`: element defaults, focus, scrollbars, editor resets
  - `primitives.css`: reusable component primitives
  - `utilities.css`: page/container/grid/flow utilities
  - `product.css`: product-specific component rules

### 2. Readable token aliases

- Added readable aliases for:
  - font sizes
  - line heights
  - radii
  - control heights
  - durations and easings
  - semantic colors
  - containers and gutters
  - z-index layers
- Existing short DASTI tokens and compatibility aliases remain available for migration safety.

### 3. Primitive API expansion

- Added or promoted shared primitives for:
  - `dasti-button`
  - `dasti-icon-button`
  - `dasti-panel`
  - `dasti-tabbar` / `dasti-tab`
  - `dasti-segmented-control`
  - `dasti-select`
  - `dasti-toolbar`
  - `dasti-grid-auto`
  - `dasti-grid-split`
  - `dasti-page-shell`
  - `dasti-page-header`
  - `dasti-page-actions`
  - `dasti-flow`
  - `dasti-cluster`

### 4. Routed screen adoption

- `/cv`
  - switched page shell gap to the new layout alias
  - updated `ProfileReviewCard` actions to use canonical button/select/toolbar primitives
  - updated the Verbati preview panel to use the panel/header/button system
- `/cvs`
  - switched to shared page shell and shared auto grid
  - normalized header/action layout
  - replaced inline empty-state CTA styling with canonical button classes
  - replaced inline confirm/delete button anatomy with reusable classes
- `/proposal`
  - switched to shared page shell and split-grid utility
  - replaced inline tab styling with `dasti-tabbar` and `dasti-tab`
  - aligned compose grid spacing to layout tokens
  - updated the resume chooser dialog grid to the shared auto-grid utility
- `/proposals`
  - same shell/grid/button normalization as `/cvs`
- `/style`
  - switched page shell gap and main preview split to layout utilities
  - promoted panel surfaces to canonical `dasti-panel`
  - moved preview source toggle onto `dasti-segmented-control`
  - removed page-level inline stage padding so the shared document stage owns that spacing

## Residual Gaps

- `VerbatiStyleWorkspace.tsx` still contains a large amount of inline visual styling inside the style-specific control panels. That file is improved structurally, but not fully normalized yet.
- Some product components still rely on legacy short token names for local spacing and typography.
- `product.css` still contains product-specific surfaces and document-card rules by design; only the shared canon was extracted.

## Risk Assessment

- Low risk for layout regressions in the routed shell because compatibility aliases remain in place.
- Medium risk for minor spacing or hover-state differences in the library cards and StyleForge preview controls because those areas now rely more heavily on shared primitives.

## Verification Target

- Run a visual pass on:
  - `/cv`
  - `/cvs`
  - `/proposal`
  - `/proposals`
  - `/style`
- Confirm:
  - consistent gutters
  - consistent page header anatomy
  - consistent button and segmented-control anatomy
  - consistent document-stage padding
  - no regression of the resume preview boundary
