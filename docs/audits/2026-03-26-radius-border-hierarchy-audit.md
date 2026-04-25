# Radius and Border Hierarchy Audit

Date: 2026-03-26

## Scope

This audit covers the active routed `my-app` UI only.

### Active code

- `src/styles/foundation.css`
- `src/styles/base.css`
- `src/styles/primitives.css`
- `src/styles/product.css`
- `src/styles/utilities.css`
- `src/components/Sidebar.tsx`
- `src/components/ProposalInputForm.tsx`
- `src/components/ProposalInputForm.module.css`
- `src/components/ProfileReviewCard.tsx`
- `src/components/StructuredUploadButton.tsx`
- `src/components/SectionEditor.tsx`
- `src/components/SelectedBlockInspector.tsx`
- `src/components/CVDocumentReviewer.tsx`
- `src/components/ProposalDisplay.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/SegmentedRadio.tsx`
- `src/components/header/CvToolbar.tsx`
- `src/components/remirror-editor/components/EditorToolbar.tsx`
- `src/components/structured-blocks/AchievementsModal.tsx`
- `src/components/structured-blocks/SkillsModal.tsx`
- `src/components/structured-blocks/LanguagesModal.tsx`
- `src/features/verbati/VerbatiStyleWorkspace.tsx`
- `src/features/verbati/VerbatiCvPreviewPanel.tsx`
- active routed pages under `src/pages/`

### Legacy but informative code

- `src/styles/tailwind.css`
- `src/components/ProfileEditorUnified.tsx`
- `src/components/ProfileEditors.tsx`
- `src/components/ProfileForm.tsx`
- `src/components/structured-blocks/SkillsDrawer.tsx`

These files still matter as compatibility or editor-adjacent references, but they were not treated as the primary routed baseline for this pass.

### Obsolete or non-authoritative code

- archive folders
- backup trees
- `*.bak`
- legacy parser and `pdf-ingest` code per project instructions

## Implemented canon

### Radius

- Canonical scale:
  - `--radius-1: 8px`
  - `--radius-2: 12px`
  - `--radius-3: 16px`
  - `--radius-4: 20px`
  - `--radius-pill: 999px`
- Semantic roles:
  - `--radius-inline`
  - `--radius-control`
  - `--radius-card`
  - `--radius-surface`

### Border

- Light mode:
  - `--border-soft: hsla(30, 10%, 12%, 0.07)`
  - `--border-field: hsla(30, 10%, 12%, 0.11)`
  - `--border-strong: hsla(30, 10%, 12%, 0.16)`
- Dark mode:
  - `--border-soft: hsla(46, 12%, 86%, 0.10)`
  - `--border-field: hsla(46, 12%, 86%, 0.16)`
  - `--border-strong: hsla(46, 12%, 86%, 0.22)`
- Semantic API:
  - `--color-border`
  - `--color-border-strong`
  - `--color-border-contrast`

## Result

- Shared authoring now uses semantic radius and border roles across the active routed shell.
- The active routed code no longer authors against `--rs`, `--rm`, `--rl`, `--rp`, `--bo`, or `--bm`.
- Buttons, fields, selects, segmented controls, toolbars, cards, panels, modals, chooser cards, and stage surfaces now follow the same radius hierarchy.
- Borders now read as quiet contour lines:
  - cards and panels use the soft tier
  - inputs and control shells use the field tier
  - selected and active states use the contrast tier or accent
- Verbati app-shell wrappers now follow the shared shell canon while the resume renderer keeps its document-specific layout system.

## Verification notes

- Static residue search on active routed code returned no remaining usage of legacy radius or border aliases.
- Compatibility aliases remain in the token layer by design so old utilities do not break during migration.
- Spacing canon was intentionally not replaced in this pass; only semantic spacing and flow aliases were added on top of the existing ladder.

## Remaining gaps

- `src/styles/tailwind.css` still exposes compatibility classes based on legacy token names. This is intentional for transition safety.
- Legacy but informative editor-adjacent files listed above were not used as the authority for this routed pass and may still rely on compatibility aliases until they are either removed or normalized in a separate cleanup.
