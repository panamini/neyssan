# UI Tokenization Status Audit

Date: 2026-03-26

## Scope

- Active code only:
  - `src/styles/foundation.css`
  - `src/styles/primitives.css`
  - `src/styles/product.css`
  - `src/components/ui/toast.tsx`
  - `src/components/ProposalDisplay.tsx`
  - `src/features/verbati/VerbatiStyleWorkspace.tsx`
  - `src/features/verbati/resume/ResumePage.tsx`

## Confirmed Tokenized

- borders
- shadows
- cards
- spacing
- clusters
- buttons
- text fields
- status
- pills
- dropdowns
- sidebar
- font families
- font weights
- font sizes
- line heights
- tracking / letter spacing
- toast typography and spacing

## What Was Fixed In This Pass

- Toast typography now uses toast-specific presentation tokens for:
  - font family
  - title size
  - title line-height
  - title weight
  - title tracking
  - description size
  - description line-height
  - description weight
  - description tracking
  - close glyph size
  - region insets and gaps

## Remaining Leakage

- `src/features/verbati/resume/ResumePage.tsx`
  - still contains the heaviest concentration of inline typography and layout values.
- `src/features/verbati/VerbatiStyleWorkspace.tsx`
  - still contains local presentational values for preview cards and chooser surfaces.
- `src/components/ProposalDisplay.tsx`
  - document typography is token-backed, but several layout values are still expressed inline.

## Verdict

- The token rebuild is directionally correct and now solid at the system layer.
- The remaining weakness is not the token source of truth anymore.
- The remaining weakness is migration completeness in a few UI-heavy files, especially the resume renderer/editor surface.
