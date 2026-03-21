# Structural Spacing Semantics

Date: 2026-03-20

## Decision

We add a small semantic spacing layer on top of the existing DASTI tokens instead of introducing new raw pixel values page by page.

## Why

The local spec `dasti-spec-v2.md` already defines the harmonic basis:

- 8-based canonical spacing series
- varied hierarchy across 16 / 24 / 32 / 40 / 64 / 80
- √2 and φ used for typography and layout proportions

The app already uses those tokens in many places, but page-level spacing was still named ad hoc per file.

## `--s9`

The spec prose includes `80` in the canonical spacing series, but the token block only listed `--s1` to `--s8`.

Decision:

- formalize `--s9: 80px`

Reason:

- it is already implied by the spec prose
- active code was already using `var(--s9)` in a few places
- defining it is cleaner than silently replacing those usages with a smaller existing rung

## Semantic variables added

- `--space-page-pad`
- `--space-page-stack`
- `--space-panel-stack`
- `--space-card-grid`
- `--space-split-gap`
- `--space-split-gap-wide`
- `--space-empty-state`

## Initial mapping

- `--space-page-pad: var(--s7)`
- `--space-page-stack: var(--s6)`
- `--space-panel-stack: var(--s5)`
- `--space-card-grid: var(--s4)`
- `--space-split-gap: var(--s5)`
- `--space-split-gap-wide: var(--s7)`
- `--space-empty-state: var(--s9)`

## First adoption scope

Applied only to structural page layout in:

- `CvsLibrary.tsx`
- `ProposalsLibrary.tsx`
- `CvForge.tsx`
- `ProposalForge.tsx`
- `StyleForge.tsx`

Not applied to preview internals or optical micro-spacing yet.
