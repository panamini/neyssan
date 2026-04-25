# Robial 17/18 Modular Grid

## Rule
Robial governs export page geometry only: margins, columns, gutters, and modular page rhythm.

`stylePreset` governs typography, palette, emphasis, and ornament only.

Preview components may remain legacy during migration, but no final export renderer may inherit page geometry from preview-stage code.

`ProposalDocumentRenderer` may be reused for semantic document structure, but export-facing geometry must be re-authored against the shared Robial contract.

## Canonical A4 Contract
- Page size: `210mm × 297mm`
- Margins:
  - top: `17mm`
  - right: `35mm`
  - bottom: `35mm`
  - left: `17mm`
- Body layout:
  - sidebar: `35mm`
  - gutter: `18mm`
  - main: `105mm`

## Modular Reference Positions

### Inline
- `17mm`
- `35mm`
- `52mm`
- `70mm`
- `87mm`
- `105mm`
- `122mm`
- `140mm`
- `157mm`
- `175mm`
- `192mm`

### Block
- `17mm`
- `35mm`
- `52mm`
- `70mm`
- `87mm`
- `105mm`
- `122mm`
- `140mm`
- `157mm`
- `175mm`
- `192mm`
- `210mm`
- `227mm`
- `245mm`
- `262mm`
- `280mm`

## Export Usage Notes
- Use mm for page size, margins, columns, gutters, and physical spacing.
- Use pt for type scale.
- ATS exports may reduce decoration and density, but must not replace Robial with another grid.
- Styled exports may vary visual expression, but must stay on the Robial frame.

## DOCX Mapping Notes
- DOCX margins should map from the same Robial contract.
- DOCX column widths and paragraph spacing should be derived from explicit mm-to-twip helpers.
- Exact visual parity with CSS layouts is not required.
- Structural conservatism and editability take priority.
