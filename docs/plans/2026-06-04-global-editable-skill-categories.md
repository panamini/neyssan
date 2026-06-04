# Global Editable Skill Categories

## Scope

Add user-editable skill categories across every CV template. This is separate from the Sanat template. Sanat can display explicit categories today, but the current app only has fixed skill `bucket` values: `core`, `secondary`, and `familiar`.

## Current Active Path

- Active data shape: `my-app/src/types/cvDocument.ts` and `my-app/src/schemas/cvDocument.schema.ts`.
- Active skills editors: `my-app/src/components/structured-blocks/SkillsModal.tsx` and `my-app/src/components/structured-blocks/SkillsDrawer.tsx`.
- Active resume mapping: `my-app/src/features/verbati/cvDocumentToResumeData.ts`.
- Active template renderers consume normalized `ResumeData` and committed workshop fragments.

## Proposed Model

Introduce stable category records on skill sections:

```ts
type SkillCategory = {
  id: string;
  label: string;
  source?: "ai" | "user" | "import";
  locked?: boolean;
};

type SkillItem = {
  id?: string;
  name: string;
  level: Level;
  bucket?: SkillBucket;
  categoryId?: string;
};
```

Keep `bucket` as an internal ranking/strength signal. Do not use it as the visible category label unless the user explicitly asks for a bucket-style view.

## Implementation Plan

1. Extend schema and normalization.
   - Add optional `skillCategories` metadata to skill sections or add a typed skills structured payload.
   - Preserve legacy `ISkillItem[]` by treating missing categories as uncategorized.
   - Keep `bucket` backward compatible.

2. Add AI/import category generation.
   - Let AI propose categories such as `Security Operations`, `Compliance`, or `Physical Response`.
   - Store generated labels with `source: "ai"`.
   - Never generate labels inside renderers.

3. Update skills editors.
   - In `SkillsDrawer`, replace fixed bucket groups with editable category groups.
   - Add controls to create, rename, reorder, and delete categories.
   - Add move controls for selected skills between categories.
   - Keep a compact bucket/strength control as secondary metadata.

4. Update `SkillsModal`.
   - Add per-row category select.
   - Add quick-create category from the select.
   - Keep save behavior atomic with the full skills payload.

5. Update resume mapping and pagination.
   - Resolve `categoryId` to category `label` in `cvDocumentToResumeData`.
   - Carry category labels through `resumePagination`.
   - Ensure all templates receive the same category-ready `ResumeSkillItem`.

6. Update template rendering.
   - Existing templates can keep flat skills by default.
   - Add a shared grouped-skill renderer for templates that opt into categories.
   - Sanat should use that shared renderer instead of owning category logic.

7. Add tests.
   - Schema round-trip with categories.
   - Import/AI-generated categories are preserved.
   - User can rename a category and the preview updates.
   - Uncategorized skills remain visible.
   - Print/PDF export receives the same grouped skill output.

## Non-Goals

- Do not infer category labels during rendering.
- Do not replace buckets until existing ranking logic has an alternative.
- Do not make Sanat-only skill category behavior.
