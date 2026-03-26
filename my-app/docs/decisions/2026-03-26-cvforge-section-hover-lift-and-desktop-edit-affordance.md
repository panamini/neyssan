# CvForge Section Hover Lift And Desktop Edit Affordance

## Decision

- Section cards keep a subtle hover/focus affordance.
- On desktop fine-pointer devices, the card itself is the primary edit affordance.
- Explicit pencil edit buttons are demoted to hover/focus reveal on desktop.
- On touch/coarse-pointer devices, the edit buttons remain visible.

## Rationale

- Always-visible pencils on desktop are redundant once the card hover clearly signals click-to-edit.
- Touch devices do not have hover, so the explicit edit affordance should stay visible.
- Dark mode hover should feel slightly detached, not bright or glowy.

## Interaction Rule

- Rich sections remain `preview-first + editor-on-open`.
- This pass does not introduce true inline editing.
- Hover lift is subtle and should not overpower the content preview.
