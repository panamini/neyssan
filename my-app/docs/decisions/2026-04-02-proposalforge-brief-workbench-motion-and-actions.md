# Proposal Forge brief workbench motion and actions — 2026-04-02

## Problem

Proposal Forge desktop had three separate regressions in the brief-collapsed
workspace:

- The left compose column collapsed into the wrong grid behavior, which pushed
  the output shell under the mini brief instead of keeping the normal two-column
  workbench geometry.
- The expand / collapse motion briefly stacked the compact brief and compose
  shell in the same column during restore, which made the header jump downward
  before the compose shell settled.
- The compose scroll affordance was implemented as a shadow-oriented overlay on
  the sheet body, which read like a dark stripe on top of the text instead of a
  real surface fade, especially in light mode.

The primary action model was also carrying duplicate semantics:

- The compose surface owned `Generate`.
- The output surface and saved-proposal library both exposed `Regenerate`.
- The collapsed brief state had no direct way to generate from the saved brief.

## Decisions

### 1. Desktop brief-collapsed mode keeps the normal two-column workbench

Brief-collapsed mode no longer changes the desktop workbench into a single
column. The detached compose toolbar stays in the top-left slot, the compact
brief stays in the left compose column, and the output shell remains in the
right column with the same geometry as the expanded layout.

Only the left compose content swaps:

- expanded: compose shell
- brief-collapsed: compact brief

Nothing else in the desktop workbench moves.

### 2. Brief restore is sequenced as rail-clear first, compose-enter second

The compose shell is now kept hidden until the compact brief has finished its
exit state. This removes the transient stacked height that caused the visible
header jump on expand.

The motion direction is horizontal-first:

- compact brief exits laterally
- compose shell then enters from the right-side workbench position
- expansion happens after the rail clears, not during the same stack frame

### 3. Compose scroll affordance uses a surface fade, not a dark shadow

For the compose textarea, the old pseudo-element edge shadow is disabled.
Instead, the editable layer itself uses a strength-driven mask tied to the
scroll depth. This produces a true fade into the sheet surface:

- text fades into the background instead of keeping full-contrast glyphs under a
  dark stripe
- light mode remains visible without over-darkening the edge
- dark mode stays softer and stops snapping on/off

The fade height is intentionally small so the affordance reads as half a line of
surface attenuation, not a full extra band.

### 4. Collapsed brief keeps a primary generate action

The collapsed compose toolbar now exposes the same generate action as the main
compose form, using the shared scribble glyph in a smaller button. The action
is still owned by the compose source of truth:

- it triggers generation from the saved brief
- it mirrors the main button state and disabled rules
- it does not create a second generation system

### 5. Output and saved-proposal actions are `Refine`, not `Regenerate`

The output-side and library-side action label is now `Refine`.

Why:

- `Generate` belongs to the brief-driven compose flow
- acting from an existing output is conceptually a refinement of the current
  result, not a fresh generation event
- the label better matches what the user is doing from the output and saved
  proposal surfaces

The page action and the saved-proposal list keep the same capability, but the
copy, tooltips, and toasts now use the refinement vocabulary.

## What was not changed

- Mobile and compact layouts
- CV Forge
- Saved proposal view geometry
- Mini brief visual design beyond removing workspace regressions
- Proposal generation backend prompts or voice preset definitions
