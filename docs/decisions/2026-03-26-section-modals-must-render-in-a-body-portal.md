# Section Modals Must Render In A Body Portal

## Context
- CV Forge section cards now use hover/focus lift for clearer affordance.
- A transformed section card becomes a containing block for positioned descendants.
- Several section editors rendered `position: fixed` overlays inline inside the section card subtree.

## Decision
- Section modals and sheets must render through a portal attached to `document.body`.
- Shared dialogs should follow the same rule.

## Why
- Inline `fixed` overlays can be visually trapped inside a transformed card.
- Portaling preserves the lifted card affordance without breaking modal layering.
- This keeps modal behavior consistent across desktop and mobile section editors.

## Applied To
- Shared dialog shell
- Summary modal
- Profile modal
- Experience / Education modal shell
- Languages modal
- Skills modal
- Achievements modal
- Skills drawer
- Add Section bottom sheet
