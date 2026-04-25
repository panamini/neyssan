# CV Forge Card Width And Sidebar Collapse Audit

## Scope

- Active code:
  - `my-app/src/pages/CvForge.tsx`
  - `my-app/src/components/ProfileReviewCard.tsx`
  - `my-app/src/components/SectionEditor.tsx`
  - `my-app/src/styles/foundation.css`
  - `my-app/src/styles/product.css`
  - `my-app/src/App.tsx`

## Findings

- CV Forge did not have a dedicated card-width hierarchy in tokens.
- The page shell was hardcoded to `960px`, which produced an editor rail that was too wide for section previews and summary text.
- Several section cards bypassed shared padding styles and used local `p-3 / p-4`, which made header/body margins feel inconsistent.
- The forced-collapsed sidebar still behaved like a desktop collapsed rail on narrow windows.
- The narrow-screen feeling was amplified by the topbar keeping a large fixed horizontal padding.

## Readability Audit

- For editor cards, the useful target is roughly `40–70` characters per line.
- The previous `960px` shell was above that target once card padding was applied, especially for summary and profile previews.
- A readable shell should favor composition comfort, not raw maximum text display.

## Chosen Direction

- Do not apply phi gratuitously.
- Use phi only where it lands on a better readable width.
- Expanded sidebar is `256px`.
- `256 * phi^2 ≈ 670px`, which rounds cleanly to `672px` on the 8px grid.
- That becomes the chosen large editor rail.
- With shell padding, the resulting CvForge shell is `736px`, which keeps section text within a calmer reading measure.

## Changes Applied

- Added card rail hierarchy tokens:
  - `--card-rail-sm: 544px`
  - `--card-rail-md: 608px`
  - `--card-rail-lg: 672px`
- Added `--cv-editor-shell-max-width: 736px`
- Switched `CvForge` to `--cv-editor-shell-max-width`
- Reduced mobile shell side padding for CvForge to `var(--space-3)`
- Normalized section header/body padding through shared classes instead of local ad hoc paddings
- Tightened the forced-collapsed sidebar rail for narrow windows
- Reduced topbar horizontal padding responsively so the content area is not unnecessarily crushed on narrow screens

## Result

- CV Forge now uses a readable editor width instead of a generic wide shell
- Section cards are more balanced internally
- The narrow-window collapsed sidebar is more contained and less desktop-like

## Follow-up

- If the CV library grows visually denser, reuse `--card-rail-md` there before introducing new one-off widths
- If the preview rail in CvForge later needs a wider mode, use the hierarchy tokens rather than hardcoded values
