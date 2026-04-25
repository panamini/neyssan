# Structural Spacing Audit

Date: 2026-03-20

## Scope

Active code:

- `src/pages/CvsLibrary.tsx`
- `src/pages/ProposalsLibrary.tsx`
- `src/pages/CvForge.tsx`
- `src/pages/ProposalForge.tsx`
- `src/pages/StyleForge.tsx`

Related active references:

- `src/styles/globals.css`

## Findings

### 1. Core spacing tokens already exist

The base spacing system is present in `globals.css`:

- `--s1` 4
- `--s2` 8
- `--s3` 12
- `--s4` 16
- `--s5` 24
- `--s6` 32
- `--s7` 40
- `--s8` 64

This is enough to define structural spacing without inventing raw px values.

### 2. Structural gaps are partly consistent, but still page-local

Examples of good tokenized use:

- `ProposalsLibrary.tsx` uses `gap: var(--s6)` at page level and `gap: var(--s4)` in card grids
- `CvsLibrary.tsx` uses `gap: var(--s5)` / `var(--s4)`
- `CvForge.tsx` and `ProposalForge.tsx` already use `var(--s5)` between major panels
- `StyleForge.tsx` uses `var(--s5)` / `var(--s6)` for major sections

Conclusion:

- the system is not missing base tokens
- it is missing semantic names for recurring structural roles

### 3. There are still hardcoded optical values in active pages

Examples:

- `gap: 3` in `CvsLibrary.tsx`
- `gap: 3` in `ProposalsLibrary.tsx`
- `gap: 12` and several `marginTop: 4 / 2 / 14` in `StyleForge.tsx`

Some of those are acceptable as local optical adjustments inside previews, but others leak into actual page structure and should be reviewed.

### 4. There is at least one real spacing bug

`var(--s9)` is used in active pages even though `--s9` is not defined in `globals.css`.

Affected files:

- `src/pages/CvsLibrary.tsx`
- `src/pages/ProposalsLibrary.tsx`
- `src/components/ProfileReviewCard.tsx`

This means those paddings currently resolve incorrectly and should be fixed.

## Recommendation

Add a small semantic spacing layer on top of the existing tokens.

Suggested semantic variables:

- `--stack-page`
- `--stack-section`
- `--grid-cards`
- `--stack-panel`
- `--stack-inline-meta`

Map them initially to existing tokens only, for example:

- `--stack-page: var(--s6)`
- `--stack-section: var(--s5)`
- `--grid-cards: var(--s4)`
- `--stack-panel: var(--s5)`
- `--stack-inline-meta: var(--s3)`

## Recommended Next Pass

1. fix invalid `--s9` usage
2. define the semantic spacing variables in `globals.css`
3. adopt them first in:
   - `CvsLibrary.tsx`
   - `ProposalsLibrary.tsx`
   - `CvForge.tsx`
   - `ProposalForge.tsx`

Do not start with `StyleForge` preview internals; too many of its small offsets are optical preview tuning rather than true page structure.
