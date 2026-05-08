# Plan — Workshop Two-Column CV Layout

## Context

We are on branch `new-layout`. The goal is to add a new two-column CV layout that is fully compatible with the active Workshop pipeline:

- parsed/canonical CV data stays the source of truth;
- live render works in edit and preview modes;
- Workshop tokens govern geometry, flow, appearance, and runtime behavior;
- pagination uses committed Workshop pages;
- styled PDF/print export preserves layout, style, and data;
- DOCX export remains safe and predictable;
- legacy Robial/Grid 17/18 may be used as visual inspiration only, never as the token/runtime source.

Confirmed current active Workshop CV template is `workshop_resume_onecol_ats`. Legacy two-column/Robial templates exist but are not planner-backed and should not be reused for the new implementation.

## Approach

Add a new **Workshop-family** CV template beside the existing one-column template, tentatively named:

```ts
workshop_resume_twocol_ats
```

The new layout should reuse the existing Workshop architecture rather than reviving legacy Robial. The implementation must first close the routing/default-template loop so all surfaces agree on the active template ID, then make Workshop renderer selection generic enough to support multiple Workshop template IDs.

Routing/default rule for v1:

- keep `workshop_resume_onecol_ats` as the default Workshop template for existing saved CVs and existing style-family resolution;
- expose `workshop_resume_twocol_ats` as an explicit visible layout choice immediately;
- persist/pass the explicit `resumeTemplateId` everywhere once selected;
- never infer two-column from the generic `workshop` family alone;
- update every hardcoded one-column Workshop check into an `isWorkshopResumeTemplateId(...)` / `isWorkshopPlannerTemplate(...)` style helper, with renderer dispatch by exact template ID.

The first production version should prioritize preview/print/PDF parity. DOCX is deliberately **one-column only**: selecting the two-column visual layout must not produce a fake two-column DOCX. DOCX export should use the existing safe one-column/ATS document contract and be labeled/tested as a linear DOCX fallback if the two-column template is visible.

## Files to modify

Critical files expected to change:

- `my-app/src/lib/layout/resumeTemplates.ts`
  - Add `workshop_resume_twocol_ats` to `RESUME_TEMPLATE_IDS` and `RESUME_TEMPLATE_DEFINITIONS`.
  - Add helpers such as `WORKSHOP_RESUME_TEMPLATE_IDS`, `isWorkshopResumeTemplateId(...)`, and `isWorkshopTwoColumnResumeTemplateId(...)`.
  - Add/derive canonical preview/export tokens for two-column geometry.
- `my-app/src/features/verbati/resume/ResumeTemplateRenderer.tsx`
  - Replace `WORKSHOP_TEMPLATE_RENDERER_ID = "workshop_resume_onecol_ats"` as the only Workshop gate with shared Workshop template helpers.
  - Dispatch to one-column or two-column page renderer based on exact template ID.
- `my-app/src/lib/resume/resumePagination.ts`
  - Extend planner inputs/logic so the two-column layout can produce valid `committedPages` without preview/print/export re-planning differently.
- `my-app/src/features/verbati/resume/ResumeOneColAtsPage.tsx`
  - Reuse shared rendering helpers where practical.
- `my-app/src/features/verbati/resume/ResumeTwoColAtsPage.tsx` *(new likely file)*
  - Render the two-column Workshop page from committed fragments and canonical vars.
- `my-app/src/pages/ResumePrintPage.tsx`
  - Allow print route rendering for both Workshop CV template IDs.
- `my-app/src/lib/export-renderers.ts`
  - Replace `getCommittedWorkshopPagesOrThrow` hardcoding with the shared Workshop template helper.
  - Ensure styled PDF export consumes committed pages for the new template.
  - Add export rendering support for two-column geometry.
  - Keep DOCX one-column/linear and test that two-column CV selection does not imply two-column DOCX.
- `my-app/src/lib/document-export-models.ts`
  - Replace the hardcoded `buildCommittedWorkshopPages` one-column check with the shared Workshop template helper.
  - Ensure `ResumePreviewPrintSource` / `ResumePrintSource` carries the new template ID and committed pages unchanged for PDF/print.
  - Ensure DOCX builder/export path deliberately falls back to the one-column/linear contract, not a silent accidental renderer mismatch.
- Tests near the modified paths, especially existing Workshop pagination/render/export tests.

Additional routing/default files to audit and likely modify:

- `my-app/src/lib/layout/styleFamilies.ts`
  - Current `workshop` family maps to `workshop_resume_onecol_ats`; keep this default, but add an explicit route for choosing/persisting the two-column template rather than deriving it from family.
- `my-app/src/lib/layout/documentTokenNormalizer.ts`
  - Current Workshop heading-fit branch is hardcoded to `workshop_resume_onecol_ats`; generalize to Workshop templates.
- `my-app/src/features/verbati/VerbatiResumePreview.tsx`
  - Ensure selected `resumeTemplateId` is the explicit source of truth and is passed to planning/rendering/export.
- `my-app/src/features/verbati/style.ts`
  - Do not create a new legacy family; keep `familyId: "workshop"` and route the template explicitly.
- `my-app/src/lib/layout/documentTokenSerializers.ts`
- `my-app/src/lib/layout/__tests__/resumeTemplates.test.ts`
- `my-app/src/features/verbati/resume/__tests__/ResumeTemplateRenderer.test.tsx`
- `my-app/src/lib/resume/__tests__/resumePagination.test.ts`
- `my-app/src/pages/__tests__/ResumePrintPage.test.tsx`
- `my-app/src/lib/__tests__/export-renderers.test.ts`
- `my-app/src/lib/__tests__/document-export-models.test.ts`

## Reuse

Existing implementation to reuse:

- `my-app/src/lib/layout/resumeTemplates.ts`
  - Current template registry, `ResumeTemplateDefinition`, preview/export token shape, Workshop preview contracts.
- `my-app/src/lib/layout/documentTokenNormalizer.ts`
  - Existing normalization entrypoint for `normalizeResumePreviewTokens`.
- `my-app/src/lib/layout/documentTokenSerializers.ts`
  - Existing CSS variable serialization via `serializeResumePreviewVars`.
- `my-app/src/lib/resume/resumePagination.ts`
  - Existing planner, section rules, rich content splitting, and `WorkshopResumeCommittedPage` model.
- `my-app/src/features/verbati/resume/ResumeTemplateRenderer.tsx`
  - Existing page shell, A4 scaling, stable page count callback, committed page rendering loop.
- `my-app/src/features/verbati/resume/ResumeOneColAtsPage.tsx`
  - Existing inline editing, AI actions, preview region attrs, rich responsibility rendering helpers, compact section rendering patterns.
- `my-app/src/pages/ResumePrintPage.tsx`
  - Existing print route payload path.
- `my-app/src/lib/export-renderers.ts`
  - Existing PDF/export renderer and current committed-pages guard.
- `my-app/src/lib/document-export-models.ts`
  - Existing export source builders and committed page payload transport.

Legacy Robial/Grid references to avoid as implementation source:

- `two_column_resume_legacy` in `resumeTemplates.ts`
- `robial` variant in old resume layout specs/CSS
- legacy `familyId` mappings in `features/verbati/style.ts`

These can inform proportions only after translating into Workshop-owned tokens.

## Steps

- [ ] Add shared helpers/constants for Workshop planner-backed template IDs, starting with `workshop_resume_onecol_ats` and the new `workshop_resume_twocol_ats`; use them to replace hardcoded one-column checks in `styleFamilies.ts`, `ResumeTemplateRenderer.tsx`, `documentTokenNormalizer.ts`, `document-export-models.ts`, `export-renderers.ts`, and `ResumePrintPage.tsx`.
- [ ] Add `workshop_resume_twocol_ats` to the template registry with `familyId: "workshop"`, `supportsPlanner: true`, and canonical two-column preview/export geometry.
- [ ] Define the initial two-column geometry using Workshop tokens and the requested 17/18-inspired grid: A4 page, `topMm: 17`, `leftMm: 18`, `rightMm: 35`, `bottomMm: 18`, `gutterMm: 12`, sidebar/main widths derived from the remaining live width, plus Workshop-owned header summary width and section rhythm. Do not import Robial CSS vars/classes.
- [ ] Audit `documentTokenNormalizer` and `documentTokenSerializers` to ensure current sidebar/gutter/main/header vars are enough; add only canonical Workshop vars if the two-column layout needs more.
- [ ] Extend `ResumeTemplateRenderer` so it plans and renders any planner-backed Workshop template, not only `WORKSHOP_TEMPLATE_RENDERER_ID`.
- [ ] Create `ResumeTwoColAtsPage.tsx` or a parameterized Workshop page renderer that consumes `WorkshopResumeCommittedPage` fragments and renders header/contact/sidebar/main content without using Robial classes.
- [ ] Decide and encode section placement rules for the first two-column version:
  - profile/header spans the top;
  - compact metadata/contact/skills/languages/certifications can live in the sidebar;
  - experience, education, selected projects, custom/additional text default to main column;
  - no section should disappear if sidebar overflows; overflow must be planned into committed pages or fall back to main flow.
- [ ] Extend `resumePagination.ts` only as needed for page-break planning. Guardrail: keep `committedPages` as page-break/fragment truth only; keep column placement renderer-local unless measured browser validation proves the payload must change.
- [ ] Update print route support in `ResumePrintPage.tsx` for the new template ID.
- [ ] Update styled PDF export rendering in `export-renderers.ts` so the new layout uses committed pages and preserves style tokens.
- [ ] Define DOCX as one-column/linear for this template from day one. If the layout is visible immediately, the UI/export contract must make clear that PDF preserves the two-column visual layout while DOCX remains the existing one-column document layout.
- [ ] Add tests for template registry, token serialization, planner committed pages, renderer output, print route, and export parity.
- [ ] Run focused verification, then TypeScript, then browser/e2e validation if wrapping or page fit changed.

## Verification

Focused unit/component tests:

```bash
rtk npx vitest run src/lib/layout/__tests__/resumeTemplates.test.ts
rtk npx vitest run src/lib/layout/__tests__/documentTokenSystem.test.ts
rtk npx vitest run src/lib/resume/__tests__/resumePagination.test.ts
rtk npx vitest run src/features/verbati/resume/__tests__/ResumeTemplateRenderer.test.tsx
rtk npx vitest run src/features/verbati/resume/__tests__/ResumeOneColAtsPage.test.tsx
rtk npx vitest run src/pages/__tests__/ResumePrintPage.test.tsx
rtk npx vitest run src/lib/__tests__/document-export-models.test.ts
rtk npx vitest run src/lib/__tests__/export-renderers.test.ts
```

Export/status safety:

```bash
rtk npx vitest run src/lib/__tests__/exportDocumentFile.test.ts
rtk npx vitest run src/pages/__tests__/CvForge.export-status.test.tsx
```

Broad safety:

```bash
rtk npx tsc --noEmit
```

Manual/browser checks:

- Open CV Forge with a parsed CV.
- Select/use the new two-column Workshop layout.
- Confirm edit mode and preview mode render the same pages/data.
- Confirm inline edit/linking regions still work.
- Export styled PDF and compare against preview/print route for content, style, and page breaks.
- Export DOCX and confirm no data loss; verify DOCX remains the existing one-column/linear document layout even when the visible CV template is two-column.

## Decisions locked for this plan

1. Geometry should echo the existing 17/18 grid language but be expressed only as Workshop tokens: use `topMm: 17`, `leftMm: 18`, `rightMm: 35`, `bottomMm: 18`, and `gutterMm: 12` as the starting geometry.
2. The new layout should be visible immediately as an explicit layout/template choice.
3. DOCX remains one-column/linear and does not attempt to match the two-column PDF layout.

## Wiki/update follow-up

Because the project wiki currently describes Workshop pagination as specific to `workshop_resume_onecol_ats`, the implementation PR must include a knowledge update after code behavior is real, not leave this as an optional note.

Files to update:

- `/Volumes/video/git/twoweeks-wiki/wiki/tech/workshop-pagination.md`
- `/Volumes/video/git/twoweeks-wiki/wiki/hot.md`
- `/Volumes/video/git/twoweeks-wiki/wiki/index.md` only if the retrieval map wording needs to change
- `/Volumes/video/git/twoweeks-wiki/wiki/log.md` for the mandatory mutation log entry

Required replacement meaning for `wiki/tech/workshop-pagination.md`:

- Change the opening sentence from “Workshop pagination is the planner-driven page-boundary system for `workshop_resume_onecol_ats`” to “Workshop pagination is the planner-driven page-boundary system for planner-backed Workshop resume templates, currently `workshop_resume_onecol_ats` and `workshop_resume_twocol_ats`.”
- Change the active path list so it includes both page renderers:
  - `ResumeOneColAtsPage.tsx`
  - `ResumeTwoColAtsPage.tsx`
- Keep the invariant that `committedPages` is the authoritative source of **page breaks** for preview, print, and export.
- Add a guardrail sentence: “Column placement for two-column Workshop remains renderer-local unless measured browser validation proves that the committed page payload must carry column metadata.”
- Update the geometry section so the shared Workshop base remains `top: 17mm`, `right: 35mm`, `bottom: 18mm`, `left: 18mm`, and the two-column variant adds `gutter: 12mm` with sidebar/main widths owned by Workshop template tokens.

Required replacement meaning for `wiki/hot.md`:

- Replace the fact that “workshop resume path” is only `workshop_resume_onecol_ats` with a fact that planner-backed Workshop resume templates include one-column and two-column variants.
- Preserve the rule that preview, print route, and export consume committed pages instead of re-planning independently.
