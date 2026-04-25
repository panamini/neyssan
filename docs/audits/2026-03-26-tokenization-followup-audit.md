# Tokenization Follow-up Audit

Date: 2026-03-26

## Scope

- Active code only: `my-app/src/styles/`, `my-app/src/components/`, `my-app/src/features/`, `my-app/src/pages/`
- Legacy or obsolete code was not treated as authoritative for this audit.

## Verdict

- The token rebuild is directionally correct.
- Borders, shadows, radius, spacing, layout utilities, buttons, inputs, pills, dropdowns, sidebar, and major surface recipes are tokenized well enough to be considered part of the active system.
- Typography tokenization exists at the foundation layer, but consumption is incomplete. The system has canonical tokens for font families, sizes, line-heights, and tracking, yet several rich surfaces still bypass them with inline values.

## Typography Token Status

- `foundation.css` defines typography primitives:
  - `--font-*`: 13 tokens
  - `--line-*`: 5 tokens
  - `--tracking-*`: 4 tokens
  - semantic text tokens (`--text-*-size`, `--text-*-line`): 14 tokens
- `primitives.css` consumes these tokens in shared recipes for labels, captions, body text, headings, buttons, cards, fields, and dialog copy.

## What Is Still Not Fully Tokenized

- Inline typography is still concentrated in a few active surfaces:
  - `src/features/verbati/resume/ResumePage.tsx`: 310 inline typography declarations
  - `src/features/verbati/VerbatiStyleWorkspace.tsx`: 47 inline typography declarations
  - `src/components/ProposalDisplay.tsx`: 23 inline typography declarations
  - `src/lib/proposal-document-typography.ts`: 15 inline typography declarations
- Global inline totals across active code:
  - `fontSize`: 183
  - `lineHeight`: 132
  - `letterSpacing`: 59
  - `fontFamily`: 61

## Interpretation

- Font styles: tokenized in foundation, partially consumed.
- Line spacing: tokenized in foundation, partially consumed.
- Kerning / letter spacing: tokenized in foundation, partially consumed.
- The main remaining leak is not absence of tokens. It is incomplete migration of rich document-like surfaces to those tokens.

## Highest Priority Remaining Work

- Normalize `src/features/verbati/resume/ResumePage.tsx` so repeated inline typography values become semantic resume tokens or renderer-specific recipe tokens.
- Reduce direct typography declarations in `src/features/verbati/VerbatiStyleWorkspace.tsx` and `src/components/ProposalDisplay.tsx`.
- Convert repeated direct values in `product.css` and `ProposalInputForm.module.css` to semantic text roles where they map cleanly.

## Boundary Call

- The Verbati resume renderer is still a specialized document-rendering subsystem. It should keep its mm-based fit logic and variant-specific density controls.
- Even so, its repeated font, line-height, and tracking decisions should be wrapped in renderer-scoped tokens instead of remaining as raw inline values.
