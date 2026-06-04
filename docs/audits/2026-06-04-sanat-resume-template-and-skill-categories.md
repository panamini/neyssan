# Sanat Resume Template And Skill Categories Audit

Date: 2026-06-04

## Confirmed Active Code

- Template registry: `my-app/src/lib/layout/resumeTemplates.ts`.
- Live preview entry: `my-app/src/features/verbati/VerbatiResumePreview.tsx`.
- Planner-backed resume rendering: `my-app/src/features/verbati/resume/ResumeTemplateRenderer.tsx`.
- Print route: `my-app/src/pages/ResumePrintPage.tsx`.
- Styled PDF payload path: `my-app/src/lib/document-export-models.ts` builds preview-print payloads with `resumeTemplateId`, `stylePreset`, `resumeData`, and `committedPages`.
- Design drawer/template selection: `my-app/src/features/verbati/style.ts`, `my-app/src/components/EmbeddedStyleInspector.tsx`, and CV Forge's registered template panel.

## Template Findings

- Workshop resume templates are first-class when they are present in `RESUME_TEMPLATE_IDS`, persist through `VerbatiStylePreset.resumeTemplateId`, and render through `ResumeTemplateRenderer`.
- Preview, saved preview, print, and styled PDF share committed workshop pages; adding a template-specific export renderer would violate the current parity contract.
- The Sanat-inspired template can safely reuse the workshop planner with a distinct lane resolver: profile/summary in header, experience/projects/text sections in the main column, and education/skills/languages/compact credentials in the right rail.

## Skill Category Findings

- `ISkillItem` already supports `bucket?: "core" | "secondary" | "familiar"` in `my-app/src/types/cvDocument.ts` and the Zod schema.
- The active resume mapping previously dropped skill bucket/category-like fields before preview/export.
- The active editor does not yet expose a first-class editable category label control, and the renderer must not invent AI labels. AI category generation plus user-editable labels should be implemented as a separate product slice against the canonical skills editor.

## Implemented Scope

- Added passive preservation of `bucket` and category-like labels from structured skill items into `ResumeData` and committed pages.
- Added the Sanat template as a planner-backed renderer variant using existing style tokens and print/export parity.

