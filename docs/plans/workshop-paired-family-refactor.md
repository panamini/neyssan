# Workshop Paired Family Refactor

## Core Rules
- `VerbatiStylePreset` remains the persisted user-facing paired style object.
- `familyId` is the canonical structural selector.
- `layout` is migration-only compatibility state and may still carry legacy aliases.
- `documentAppearance.ts` remains appearance-only.
- `resumeTemplates.ts` is the structural authority for workshop résumé layout.
- `resume-layout.spec.ts` is legacy-only adapter territory and must not be in the workshop normalization path.
- Preview, print preview, HTML export, and PDF export share a repo-owned fragment/page plan keyed by exact `ResumeTemplateId`.
- Workshop must preserve both existing preview surfaces:
  - workspace preview
  - mini/panel preview
- Both preview surfaces must continue to support preview-to-editor linking and active-target highlighting.
- `VerbatiResumePreview.tsx` remains responsible for host-mode shell behavior (`panel` vs `workspace`), link-intent emission, and active-target routing.
- The workshop renderer path must preserve the section/item data attributes and highlight hooks required by the existing preview interaction model.
- Export must consume committed planner fragments and must not independently re-paginate.

## Milestone 1
- Add style-family resolution through `styleFamilies.ts`.
- Add `workshop` family with:
  - `workshop_resume_onecol_ats`
  - `workshop_proposal_margin`
- Add canonical résumé render-model building for preview/export parity.
- Add `resumeTemplates.ts` and `resumePagination.ts`.
- Add dedicated workshop résumé preview/render path without changing `VerbatiResumePreview.tsx` ownership of host-mode shell behavior and preview interaction routing.
- Make styled résumé export honor exact `ResumeTemplateId`.

## Compatibility
- Keep legacy `layout` strings readable through migration aliases.
- Keep legacy résumé preview variants on the old renderer path until they are migrated.
- Keep DOCX export on canonical content/template tokens, but exclude it from exact page-plan parity in this milestone.

## Test Plan Additions
- Mini preview interaction tests proving workshop panel preview still:
  - renders in `hostMode="panel"`
  - emits section/item link intents with `source="preview-panel"`
  - highlights the active section/item through `activeTarget`
- Workspace preview interaction tests proving workshop workspace preview still:
  - renders in `hostMode="workspace"`
  - emits section/item link intents with `source="preview-workspace"`
  - highlights the active section/item through `activeTarget`
  - preserves planner-driven page count UI
