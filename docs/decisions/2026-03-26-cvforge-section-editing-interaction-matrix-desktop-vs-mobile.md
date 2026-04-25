# CV Forge Section Editing Interaction Matrix: Desktop Vs Mobile

## Status

Accepted on 2026-03-26.

## Decision

CV Forge uses a `preview-first, editor-on-open` interaction model for rich sections instead of pretending they are directly editable inline.

This applies now on both desktop and mobile, with different presentation:

- Desktop: click the section preview to open the dedicated editor surface
- Mobile: open the same editor in a modal/sheet-friendly flow

## Rationale

- The current rich sections are not true inline editors yet.
- Showing a text cursor on previews suggests direct text editing, which is false.
- Direct inline editing is desirable long-term, but only when the renderer and editor are truly unified.
- Until then, consistency matters more than partially simulated inline editing.

## Interaction Rules

- Rich content sections use `pointer`, not `text`, until inline editing is real.
- Section hover/focus should communicate clickability with subtle lift, border emphasis, and surface change.
- Dismiss actions such as the small `X` for removable sections appear on hover-capable devices only when the user hovers or focuses the section.

## Section Matrix

- `Profile`: dedicated editor, not inline
- `Summary`: dedicated editor, not inline
- `Experience`: dedicated editor, not inline
- `Education`: dedicated editor, not inline
- `Achievements`: dedicated editor, not inline
- `Languages`: dedicated editor, not inline
- `Skills`: light inline operations are acceptable because rows are short and structured

## Future Upgrade Path

When the document preview and editor share a real inline editing architecture, the project can promote:

- `Summary`
- `Experience`
- `Achievements`

to true inline editing on desktop first.

Until that point, avoid mixed metaphors such as:

- text cursor on non-inline previews
- partial direct editing in one section and modal-only editing in similar sections
- mobile and desktop entering different editing models for the same content type
