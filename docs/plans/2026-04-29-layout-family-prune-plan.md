# Layout Family Prune Plan

## Decision

Use `two-column` as the one kept legacy layout family.

Keep `robial` only as the internal resume renderer variant id behind `two-column`. Do not expose `robial` as a product-facing layout name, persisted style family, or selector option.

Keep `workshop` as the active target family.

## Why

- `two-column` is the user-facing style family in `STYLE_FAMILY_DEFINITIONS`.
- `robial` is used as `ResumeLayoutVariantId` in the legacy resume renderer.
- Saved resume/export tests already encode the compatibility boundary: `layout: "two-column"` with `rendererVariantId: "robial"`.
- Treating both as top-level layout identities would preserve duplicate vocabulary instead of removing drift.

## Timing

Do this after PR1 is merged to `main`.

Do not stack the layout prune on the PR1 CSS split branch. The layout prune touches style persistence, template resolution, preview rendering, and export compatibility; keeping it separate makes regressions easier to review and revert.

## Target State

- User-facing layout choices show `workshop` as the active path.
- `two-column` remains available only for legacy/reference compatibility.
- `robial` remains an implementation detail of the legacy resume renderer.
- Old aliases (`playful-photo`, `soft-ribbon`, `slate-column`) continue to normalize to `two-column`.
- Saved documents with legacy families still open, render, and export through a deterministic fallback.

## Implementation Slices

1. Freeze the boundary.
   - Add tests around `sanitizePersistedVerbatiStyle`, `resolveVerbatiStyle`, `getResumeTemplateId`, and `resolveLegacyResumeRendererVariantId`.
   - Assert `two-column` maps to `two_column_resume_legacy` and renderer `robial`.
   - Assert `robial` is rejected as a persisted family/layout input.

2. Hide legacy families from active selectors.
   - Remove `swiss`, `volk-register`, `editorial`, `modernist`, and `quire` from user-facing layout options.
   - Keep `workshop` visible when its feature flag allows it.
   - Keep `two-column` out of normal selection unless a dedicated reference/legacy mode needs it.

3. Normalize old saved styles.
   - Map removed canonical families to `two-column` or `workshop` explicitly.
   - Prefer `two-column` when preserving old visual shape matters.
   - Prefer `workshop` only for new/default document creation.

4. Prune template definitions.
   - Remove unused resume template ids only after saved-render/export tests prove fallback behavior.
   - Keep `two_column_resume_legacy` while `robial` remains the reference renderer.
   - Keep `workshop_resume_onecol_ats` as the active target.

5. Remove dead renderer branches.
   - Only delete renderer variants after import/export parity and saved document tests prove they no longer route.
   - Do not delete `ResumePage.tsx` while `robial` is still the two-column reference renderer.

## Verification

- `pnpm test --run src/features/verbati/__tests__/style.test.ts`
- `pnpm test --run src/lib/__tests__/document-export-models.test.ts`
- `pnpm test --run src/lib/layout/__tests__/resumeTemplates.test.ts`
- `pnpm test --run src/features/verbati/resume/__tests__/ResumePage.test.tsx`
- `pnpm tsc --noEmit`
- `pnpm lint:css`
- `pnpm exec vite build`

## Non-Goals

- Do not remove `workshop`.
- Do not rename `robial` inside the low-level renderer in the same slice.
- Do not delete saved document compatibility.
- Do not change proposal template behavior until resume fallback behavior is proven.
