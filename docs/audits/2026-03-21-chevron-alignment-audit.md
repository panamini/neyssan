# Chevron Alignment Audit

Date: 2026-03-21

## Scope
- `Summary`
- `Achievements`
- `Experience`
- `Education`

## Active Code
- `src/components/structured-blocks/SummaryBlock.tsx`
- `src/components/structured-blocks/AchievementsBlock.tsx`
- `src/components/SectionEditor.tsx`
- `src/styles/globals.css`

## Findings
- Two competing placements existed:
  - local right-aligned disclosure rows inside `Summary` / `Achievements`
  - mixed right-aligned rows with extra horizontal padding inside `Experience` / `Education`
- `Experience` / `Education` also had a logic bug:
  - the section-level chevron only rendered while collapsed
  - once expanded, the `up` chevron disappeared because the condition depended on hidden items rather than toggle eligibility

## Canonical Rule
- One disclosure pattern only:
  - icon-only chevron
  - right aligned
  - same compact icon button
  - same top offset from preceding content
- Eligibility rule:
  - section-level chevron appears whenever a section has more than 3 preview entries
  - item-level chevron appears whenever a compact preview is actually truncating content

## Implementation
- shared classes:
  - `.cv-disclosure-row`
  - `.cv-disclosure-row--section`
- `Summary`, `Achievements`, `Experience`, `Education` now use the same disclosure rail

## Notes
- This audit covers disclosure placement only.
- It does not redefine the main section collapse chevron in the header bar.
