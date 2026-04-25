# Proposal Compose Follow-up Audit

Date: 2026-03-21

## Scope
- `src/components/ProposalInputForm.tsx`
- `src/styles/globals.css`
- `src/lib/normalize-cv.ts`

## Findings

### Active code

1. `Choose resume` still had card-width pressure at narrow widths.
   - Cause: the action/date rail still relied on a fixed reserved area pattern that worked poorly once titles became longer.
   - Fix: switch chooser cards to a real text/action split layout, with a responsive fallback that moves the rail below the text on very narrow widths.

2. Proposal composer bottom controls still overlapped at small widths.
   - Cause: the generate button was absolutely positioned over a wrapping bottom toolbar.
   - Fix: replace the absolute layout with a two-column control rail:
     - left: CV picker + meta controls
     - right: generate button anchored bottom-right

3. `Choose resume` still carried too much density.
   - Cause: cards exposed title, meta, summary, and top-right actions simultaneously.
   - Fix: keep only title, subtitle/meta, and date; use larger confirmation/edit icons in a dedicated trailing rail.

4. Experience rich text formatting could still disappear after save/reopen.
   - Cause: `normalize-cv.ts` flattened structured `responsibilities` docs back into plain text during normalization.
   - Fix: preserve rich Remirror docs in normalization for `experience.responsibilities` and `education.description`.

### Legacy but informative code

- Older `SkillsModal` / `LanguagesModal` surfaces remain in the repo, but they are not the primary interaction path for the active proposal composer work.

### Obsolete / dead code

- None identified in this pass.

## Result

The proposal composer now uses a stable bottom control rail, the chooser cards have a clearer selection/confirmation hierarchy, and structured experience rich text no longer gets flattened by normalization.
