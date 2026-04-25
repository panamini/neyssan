# 2026-03-20 Title/Subtitle Stack Semantics

## Context
- Page headers and intro stacks were still styled inline in several active surfaces.
- Modal title/subtitle treatment was already centralized, but page headers were not.
- The goal is to standardize vertical rhythm without forcing a broad visual retune.

## Decision
Introduce a small semantic text-stack family in `globals.css`:
- `.dasti-stack`
- `.dasti-stack__eyebrow`
- `.dasti-stack__title`
- `.dasti-stack__subtitle`

These classes encode the current canonical page-header rhythm using existing tokens:
- eyebrow gap: `--s2`
- title size: `--tx2`
- title line-height: `--lx2`
- subtitle gap: `--s1`
- subtitle size: `--ts`
- subtitle line-height: `--ls`

## Initial Adoption
- `CvsLibrary.tsx`
- `ProposalsLibrary.tsx`

## Follow-up
Later passes can build on this family for:
- compact title/subtitle stacks
- selection-card title/description pairs
- inline meta rows
