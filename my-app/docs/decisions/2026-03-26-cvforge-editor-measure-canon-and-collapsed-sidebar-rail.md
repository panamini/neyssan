# CV Forge Editor Measure Canon And Collapsed Sidebar Rail

## Status

Accepted on 2026-03-26.

## Decision

- CV Forge uses a dedicated editor shell width, not the generic `960px` page shell.
- The canonical editor rail is `672px`.
- The shell max width is `736px`.
- Narrow-screen forced collapse uses a smaller dedicated sidebar rail than the desktop collapsed state.

## Tokens

- `--card-rail-sm: 544px`
- `--card-rail-md: 608px`
- `--card-rail-lg: 672px`
- `--cv-editor-shell-max-width: 736px`
- `--app-sidebar-width-collapsed-mobile: 40px`

## Rationale

- CV Forge is a composition workspace, not a general marketing page or library grid.
- Readability and editability matter more than filling the viewport.
- `672px` is the nearest 8px-grid width to `256 * phi^2`, so it keeps the harmonic relationship without forcing phi where it hurts usability.
- The previous width produced lines that were too long.
- The mobile collapsed rail needed its own token because the desktop collapsed rail was too generous on narrow windows.

## Implementation Notes

- `CvForge` now uses `--cv-editor-shell-max-width`
- Section card header/body padding now goes through shared card shell classes
- The topbar uses responsive horizontal padding to avoid wasting space on narrow windows
