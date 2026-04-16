# Export Layout Fidelity Brief

## Goal
- Improve export-specific layout fidelity on the Robial frame without redesigning preview layouts or changing the direct-download pipeline.

## Guardrails
- `my-app/src/lib/layout/robialGrid.ts` remains the only geometry authority.
- Export improvements land in export-specific layers first.
- Preview layouts remain the visual reference and must render as before.
- Do not introduce styled DOCX variants.
- Preserve user text. Locale cleanup applies only when it is safe, lossless, and predictable.

## Product Model
- `DOCX (editable)`
- `PDF (ATS)`
- `PDF (Styled)`

## Current Pipeline Reality
- In the worker/parser pipeline, proposal DOCX exists today and résumé DOCX does not.
- Legacy client-side résumé DOCX builders still exist outside the export-renderer/export-worker path.
- This pass improves proposal DOCX only inside the direct-download worker pipeline and leaves résumé DOCX worker wiring out of scope.

## Implementation Shape
- Add export-safe Robial CSS var serialization and explicit `17mm / 18mm / 8.5mm` step tokens.
- Refactor export HTML/CSS into:
  - semantic document markup
  - shared Robial geometry
  - invariant PDF flow tokens
  - ATS appearance
  - Styled appearance
- Add stable export hooks:
  - `data-export-doc`
  - `data-block`
- Remove layout-driven export styling keyed off `stylePreset.layout`.
- Add locale-aware export helpers for safe French/English typography normalization on structured export fields.
- Tighten proposal DOCX spacing and hierarchy while keeping one-column editability.
