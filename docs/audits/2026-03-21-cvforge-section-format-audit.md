# CvForge Section Format Audit

Date: 2026-03-21

## Scope

Audit of active `CvForge` section cards to decide whether section sizing should be fixed, bounded, or content-driven, and to validate header title scale against the body content.

## Classification

- Active code:
  - `src/components/SectionEditor.tsx`
  - `src/components/structured-blocks/AchievementsBlock.tsx`
  - `src/styles/globals.css`
- Legacy but informative:
  - `src/components/cv-editor/SectionPanel.tsx`
- Obsolete/dead:
  - `src/components/cv-editor/Section.legacy.tsx`

## Current State

- `section-container` is content-driven.
- No canonical min/max height exists for collapsed section cards.
- Headers use `cv-section-heading`, which is visually stable, but section body heights vary sharply depending on whether the section is empty, collapsed, or imported.

## Assessment

### Good

- Content-driven height is correct for expanded `Experience`, `Education`, and `Achievements`.
- A fixed document-card ratio would be wrong for these sections because they are editors/previews, not archive cards.

### Weak

- Empty or near-empty collapsed sections can feel visually underweighted.
- The system lacks a bounded collapsed rhythm, so “blank” and “populated” cards can look unrelated.

## Recommendation

Use a bounded collapsed format, but keep expanded sections free-flowing.

### Recommended Rule

- Collapsed section cards:
  - minimum body height only
  - no fixed aspect ratio
  - suggested minimum body block around `var(--s8)` for dense sections
- Expanded section cards:
  - fully content-driven
  - no max-height unless editing performance requires it

### Header Title

- Keep `cv-section-heading` as the canonical heading size for section cards.
- Do not increase it further; the current scale is already close to the upper limit for the amount of body copy underneath.
- Future changes should target body rhythm and spacing before title size.

## Minimal Next Step

If we want to continue this direction, the next low-risk improvement is:

1. add a small `collapsed` body minimum height primitive for empty/short section cards
2. apply it only to `Summary`, `Profile`, `Achievements`, `Experience`, `Education` collapsed previews
3. leave expanded cards untouched
