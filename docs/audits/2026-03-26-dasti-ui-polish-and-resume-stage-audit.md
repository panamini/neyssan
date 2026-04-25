# Dasti UI Polish And Resume Stage Audit
Date: 2026-03-26

## Scope
- Answer the current StyleForge question: is the stage around the rendered resume proportioned correctly, and should it use equal margins?
- Audit the active `my-app` UI token / spacing / card shell system against the Dasti reference implementation and the attached audit notes.
- Focus on active code and active reference files only.

## Reference Files
- Active code:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/index.css`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiStyleWorkspace.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-preview.css`
- Active reference code:
  - `/Volumes/video/kay/app/pouraurelien/save/UI/TSET/dasti-production-hybrid-refactor/src/styles/tokens.css`
  - `/Volumes/video/kay/app/pouraurelien/save/UI/TSET/dasti-production-hybrid-refactor/src/styles/base.css`
  - `/Volumes/video/kay/app/pouraurelien/save/UI/TSET/dasti-production-hybrid-refactor/src/styles/utilities.css`
  - `/Volumes/video/kay/app/pouraurelien/save/UI/TSET/dasti-production-hybrid-refactor/src/pages/resume/resume-preview.css`
- Informative design notes:
  - `/Volumes/video/kay/app/pouraurelien/save/UI/UI-SPEC/css-audit/cssaudit.md`
  - `/Volumes/video/kay/app/pouraurelien/save/UI/UI-SPEC/css-audit/dasti_design_system_restructure.md`
  - `/Volumes/video/kay/app/pouraurelien/save/UI/UI-SPEC/css-audit/dasti_specv3_2203_systemUI.tsx`
- Related earlier audit:
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/docs/audits/2026-03-19-dasti-ui-migration-audit.md`

## Executive Summary
- The current resume stage is visually much closer to the intended Dasti direction than before, but it is still not fully normalized to the app spacing system.
- The main issue is not the paper itself. The main issue is that the stage is built from three nested spacing layers with two measurement systems:
  - page/workspace padding in `px` tokens
  - preview card padding in `px` tokens
  - resume shell / frame padding in `mm`
- Equal margins around a single rendered A4 page are not the right target for web UI. The page is tall, so a balanced stage should be tighter horizontally and slightly deeper vertically.
- Best-practice answer for a single resume view:
  - the paper should sit on a dedicated stage, not directly on the site background
  - that stage can have a subtle gradient
  - the paper itself should remain flatter and brighter than the stage
  - the stage padding should not be equal on all sides

## Stage Audit

### Current state
- The workspace page itself still uses a product-level page padding token:
  - `--space-page-pad: var(--s7)` in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css:33`
  - applied in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiStyleWorkspace.tsx:863`
- The preview card that contains the renderer adds another padding layer:
  - `padding: isNarrow ? "var(--s2)" : "var(--s3)"` in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiStyleWorkspace.tsx:839`
- The resume renderer then adds its own shell and frame padding:
  - `.resume-preview-shell--single` in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-preview.css:63`
  - `.resume-page-frame` in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-preview.css:157`
  - `.theme-resume-calm--single .resume-page-frame` in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-preview.css:177`

### Is the render card using a subtle gradient?
- Yes.
- The render card in StyleForge uses a subtle app-stage gradient in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiStyleWorkspace.tsx:835-840`.
- The inner comparison shell and page frame also use subtle gradients in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-preview.css:74-78` and `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-preview.css:165-168`.

### Should the stage margins be equal?
- No.
- For a single A4 page in a desktop UI, equal stage margins make the composition feel too wide because the page ratio is tall.
- The better proportion is:
  - horizontal stage inset smaller
  - top inset moderate
  - bottom inset slightly deeper
- That is also more consistent with the Dasti reference shell, which keeps the resume in a framed preview surface instead of dropping it directly onto the canvas.

### Recommended single-page stage proportions
- Desktop workspace gutter:
  - `32px` page gutter on desktop, matching Dasti container gutters from `/Volumes/video/kay/app/pouraurelien/save/UI/TSET/dasti-production-hybrid-refactor/src/styles/tokens.css:128` and utilities at `/Volumes/video/kay/app/pouraurelien/save/UI/TSET/dasti-production-hybrid-refactor/src/styles/utilities.css:182-189`
- Render card padding:
  - `24px`
- Inner stage around one paper:
  - `16px` left/right
  - `24px` top
  - `32px` bottom
- Gradient:
  - yes, but only on the stage, not on the paper
  - keep it subtle: roughly 2% to 5% tonal spread, with optional soft radial tint from accent at very low opacity

### Recommendation
- Keep the paper sitting on a stage.
- Do not make the stage the same white as the paper.
- Do not make the stage inherit the site background directly.
- Normalize the stage to one explicit rule for single-page mode instead of stacking several unrelated padding systems.

## Design-System Audit

### F01. `my-app` still mixes too many token layers in one file
- Severity: high
- Evidence:
  - foundation spacing and type in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css:25-58`
  - semantic colors in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css:60-110`
  - compatibility aliases in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css:113-166`
  - extra Neyssan aliases in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css:170-194`
- Why this matters:
  - this is exactly the drift problem identified in `/Volumes/video/kay/app/pouraurelien/save/UI/UI-SPEC/css-audit/cssaudit.md`
  - one concept still has multiple names in active code

### F02. Product spacing semantics are still encoded as root tokens instead of layout rules
- Severity: high
- Evidence:
  - `--space-page-pad` and `--space-panel-stack` in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css:33-35`
- Why this matters:
  - the restructuring note explicitly recommends removing page/product spacing semantics from the token foundation and treating them as layout rules instead
  - see `/Volumes/video/kay/app/pouraurelien/save/UI/UI-SPEC/css-audit/dasti_design_system_restructure.md`

### F03. `index.css` still duplicates base document defaults already defined in `globals.css`
- Severity: medium
- Evidence:
  - `body` defaults in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/index.css:30-36`
  - overlapping `html, body, #root` and `body` defaults in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css:211-224`
- Why this matters:
  - Dasti reference separates tokens, base, and utilities cleanly
  - `my-app` still has base concerns split across multiple files

### F04. The Dasti reference has already formalized the split that `my-app` still approximates
- Severity: high
- Evidence:
  - reference token foundations in `/Volumes/video/kay/app/pouraurelien/save/UI/TSET/dasti-production-hybrid-refactor/src/styles/tokens.css`
  - reference base reset in `/Volumes/video/kay/app/pouraurelien/save/UI/TSET/dasti-production-hybrid-refactor/src/styles/base.css`
  - reference layout utilities in `/Volumes/video/kay/app/pouraurelien/save/UI/TSET/dasti-production-hybrid-refactor/src/styles/utilities.css`
- Why this matters:
  - the target structure already exists in the reference repo
  - `my-app` should converge toward that layering instead of expanding ad hoc globals

### F05. StyleForge still relies heavily on inline layout instead of reusable Dasti primitives
- Severity: medium
- Evidence:
  - active workspace layout is largely inline-styled in `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiStyleWorkspace.tsx`
- Why this matters:
  - every new polish pass becomes one-off
  - spacing consistency becomes harder to audit than if `stack`, `cluster`, `container`, and panel primitives were reused

### F06. The current shell feels polished, but the spacing logic is still partly local rather than systemic
- Severity: medium
- Evidence:
  - app page gutter: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiStyleWorkspace.tsx:863`
  - preview card padding: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/VerbatiStyleWorkspace.tsx:839`
  - resume shell/frame padding: `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/features/verbati/resume/resume-preview.css:63-68`, `:157-177`
- Why this matters:
  - it looks acceptable in one screen, but it is hard to propagate consistently across CV, proposal, and future letter viewers

## Comparison With Reference Dasti

### What `my-app` already gets right
- The light palette family is close to Dasti paper/canvas values.
- The 4/8/12/16/24/32/40 scale still exists.
- The resume preview correctly treats the page as an artifact inside a stage, not as plain page content.

### What still diverges
- The reference repo already exports clearer foundation and utility primitives.
- `my-app` still keeps compatibility aliases and product-level spacing semantics in the same root layer.
- Feature screens still use inline spacing and card anatomy instead of converging on Dasti utilities and primitives.

## Final Recommendation

### Stage
- Keep a 3-layer model:
  - site background
  - preview stage
  - paper
- For single resume view, do not target equal UI padding around the sheet.
- Recommended ratio:
  - tighter left/right
  - moderate top
  - slightly deeper bottom
- Keep the stage gradient subtle and separate from the paper.

### System
- Use the reference Dasti split as the target:
  - `tokens`
  - `base`
  - `utilities`
  - component primitives
  - product styles
- Reduce `my-app/src/styles/globals.css` back toward foundation + semantics only.
- Move product spacing semantics like `--space-page-pad` and `--space-panel-stack` out of the token root and into page-shell/layout rules.
- Remove duplicate body/base defaults from `src/index.css` once the new base layer is authoritative.

## Recommended Next Audit/Implementation Slice
1. Normalize page shell gutters across Resume, StyleForge, and Proposal to the Dasti container/gutter system.
2. Replace inline StyleForge layout spacing with reusable Dasti `container / stack / cluster / grid` primitives.
3. Split `my-app` global styles into the same layers already present in the reference repo.
