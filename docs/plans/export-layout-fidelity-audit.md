# Export Layout Fidelity Audit

## Before
- Export PDF geometry already used the Robial frame, but internal cadence was under-specified.
- Styled PDF changed layout-adjacent behavior through `layout-${stylePreset.layout}` classes.
- Résumé export relied on generic section/list spacing and wrap-sensitive entry heads.
- Proposal export had weak print hierarchy for title/date/sender/recipient/subject blocks.
- Proposal DOCX existed, but its spacing and heading cadence were ad hoc.
- No focused export tests covered selector contracts, ATS/Styled structural parity, or locale typography normalization.

## After
- Robial export geometry stays centralized in `robialGrid.ts`, now with explicit step tokens and CSS var serialization.
- PDF export markup is frozen across ATS and Styled and annotated with required `data-export-doc` / `data-block` hooks.
- Styled export now changes appearance only; geometry/flow no longer depend on `stylePreset.layout`.
- Résumé PDF export uses steadier summary measure, calmer sidebar rules, wrap-safe entry heads, and invariant tag metrics.
- Proposal PDF export now has clearer header hierarchy, structured sidebar blocks, safer closing grouping, and locale-aware structured text normalization.
- Proposal DOCX keeps one-column editability while using more deliberate section spacing, subject hierarchy, and body cadence.
- New tests cover:
  - Robial CSS var serialization
  - ATS/Styled structural parity
  - French typography normalization in export HTML
  - proposal DOCX one-column/hierarchy invariants

## Known Limits
- Résumé DOCX is still not wired through the worker/parser export pipeline.
- Manual local/tunnel export verification has not been run in this pass.
- Repo-wide TypeScript build failures pre-existed outside this branch and still block a clean full build.
