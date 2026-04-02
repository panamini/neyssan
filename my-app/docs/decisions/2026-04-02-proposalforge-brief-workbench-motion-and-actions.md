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

The collapsed control order is also intentional:

- restore / show compose stays on the left as the workbench affordance
- tone and generate sit together on the right as the brief action cluster

This keeps the source action and its tone modifier visually coupled instead of
leaving the tone chip stranded in the middle of the toolbar.

### 5. Saved proposals use `Refine`; draft output no longer has a secondary regenerate icon

The saved-proposal library keeps the `Refine` action, but the draft output
toolbar no longer exposes a separate regenerate / refine icon.

Why:

- `Generate` belongs to the brief-driven compose flow
- the saved library still benefits from a refine action because it operates on a
  detached saved artifact
- the draft workspace should not show both the primary generation flow and a
  second output-side generation trigger in the same chrome

For the saved-proposal surface, the action model is split into two controls:

- a tone icon opens a downward drawer with the saved-proposal tone choices
- `Refine` stays a direct action button

That tone drawer now reuses the same drawer recipe as the collapsed compose
toolbar so the saved surface matches the Proposal Forge draft chrome more
closely.

### 6. Motion timings and submit timings are stylesheet-owned tokens

The Proposal Forge workspace no longer hardcodes the brief swap and generate
button timings in component constants. Those values now live in foundation
tokens and are read at runtime from computed styles.

This keeps the animation system adjustable from CSS:

- motion durations and easing can be tuned without editing component logic
- the small collapsed generate button can use its own size / radius / stroke
  token set
- JS timers stay aligned with the visible CSS timing budget

### 7. Output edit mode uses full-width inner paper with masked top and bottom edges

The editable output page now differs from preview mode on purpose:

- preview mode keeps the reading-measure cap because the page is being viewed
- edit mode uses the available paper width with preserved inline padding
- the first lines start with a calm top inset
- once scrolled, text fades behind the sheet border at the top and bottom

The character counter capsule is also overlap-aware and hides itself once it
would collide with the editable page area.

### 8. Saved proposals use a left sidebar for actions and editable title

The saved-proposal view no longer keeps its title / meta block inside the top of
the document card when `actions-only` chrome is used.

Instead:

- the saved view owns a real left sidebar in `ProposalsList`
- the `Back to draft` / `Duplicate to draft` actions sit at the top of that
  sidebar
- the editable saved proposal title and meta sit directly underneath those
  actions
- the output chrome sits in a detached rail above the document page
- the page itself keeps its full A4 block budget because the title is no longer
  consuming vertical space above it or inside the document shell

This removes the awkward stacked top area in the saved-proposal page, keeps the
left actions and saved title aligned in one column, and preserves inline title
editing without breaking the document ratio.

The selected saved proposal also now reuses the draft output-shell sizing
contract:

- the saved main card is wrapped in the same workspace output shell token layer
- the selected-shell wrapper spans the available page width so the left action
  column can actually pin to the page edge instead of hugging the document card
- the saved detached rail is explicitly kept static instead of inheriting the
  draft absolute rail lift
- the saved shell drops the toolbar-height portion of the shell-height tokens,
  because its toolbar now lives outside the shell in normal flow
- the saved sidebar and the saved output shell share the same `layout-card-grid`
  spacing token as the draft workspace
- both the saved output rail and the collapsed compose rail now use the shared
  surface-attached tooltip / drawer offset tokens, so popovers open below the
  frosted panel instead of colliding with the icon itself

The old transient spotlight border around the selected saved card is also
removed; selection reveal still scrolls the card into view, but it no longer
adds a second shell highlight that fought the document chrome.

### 9. Proposal preview now paginates instead of clipping long content inside one A4 page

The remaining saved-view A4 regression was not the shell anymore. It was the
renderer: long proposal content still flowed through a single-page preview path,
so the document body overflowed the page and got clipped inside the A4 frame.

The shared proposal renderer now:

- builds ordered salutation / paragraph / closing blocks from the parsed content
- measures those blocks against the current A4 body height
- fragments oversized paragraphs before pagination so one merged paragraph cannot
  force the page to overflow
- paginates them at paragraph boundaries into continuation pages
- reports the page count back to `ProposalDisplay`, so the stacked preview shell
  expands to fit page 2 and beyond
- preserves the actual paper bottom padding when measuring and fitting, so text
  stops above the page edge instead of running to the border

Single-page proposals still keep the existing fit behavior. Longer proposals now
stack into additional preview pages instead of overflowing one page.

The saved-proposal library also reuses the same edge-fade vocabulary as the main
Proposal Forge surfaces, and the transient focus jump highlight on selection is
removed by not programmatically focusing the selected card during reveal.

### 10. Saved-view chrome now reuses the same attached-surface toolbar contract as draft

The saved proposal page had drifted onto a mixed toolbar system:

- the left saved actions used the shared frosted surface
- the saved tone trigger used a partially copied compose-tone drawer
- the style and color controls still used the artifact-inspector's custom
  tooltip stack

That mismatch caused several regressions:

- tooltips rendered from the icon box instead of the surface edge
- style and color drawers overlapped the toolbar instead of opening below it
- the saved tone drawer dropped options and lost the same button treatment as
  the rest of the toolbar
- the selected saved card no longer matched the draft A4 shell sizing because
  the reduced library-card inline-size token was still being applied to the
  primary saved card

The saved view now uses one consistent rule set:

- saved page width is stable through a dedicated
  `--proposal-saved-view-page-max-width` token
- the selected saved card now uses the same reduced output-shell inline-size
  token as draft Proposal Forge instead of falling back to the generic document
  viewer shell width
- the reduced inline-size token remains only on secondary library cards
- the saved tone drawer restores the `Auto` option and stores
  `requestedVoicePreset` separately from `resolvedVoicePreset`
- saved tone, style, and color tooltips all use the same shared
  `data-toolbar-tooltip` contract as the draft toolbars
- drawer option tooltips use inline-end placement so they appear to the right
  of the vertical menu stack

### 11. Saved-view A4 sizing must inherit the draft output shell width budget

The remaining dark-mode saved-preview crop was caused by the selected saved card
drifting back onto the generic `--document-viewer-shell-inline-size` contract.
That widened the paper shell beyond the Proposal Forge draft output budget, so
the saved preview no longer matched the same A4 staging behavior as draft.

The saved selected shell now defines a dedicated
`--proposal-library-selected-shell-inline-size` token equal to the same reduced
draft output width budget:

- `calc(var(--document-sheet-inline-size) - (var(--s4) * 2))`

That token is used for both:

- the selected saved-view grid column
- the selected saved proposal card's `--document-viewer-shell-inline-size`

Secondary saved cards keep their overview sizing, but the primary saved preview
now inherits the same inline width contract as the draft proposal output shell.

## What was not changed

- Mobile and compact layouts
- CV Forge
- Mini brief visual design beyond removing workspace regressions
- Proposal generation backend prompts or voice preset definitions
