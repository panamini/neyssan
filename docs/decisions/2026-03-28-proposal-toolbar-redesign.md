# Proposal toolbar redesign — 2026-03-28

## Problem

The `dasti-document-rail` inside `ProposalDisplay` was carrying up to 11 visible
controls at peak:

- Left: `Document` pill · `Plain text` pill · `👁` toggle · `✏️` toggle
- Center: `Fit` · `−` · `+`
- Right: Save icon · Regenerate icon · Copy icon · Delete icon (+ confirm `X`)

All buttons had identical visual weight. The most powerful action (Regenerate) was
a bare `RotateCcw` icon with only a tooltip. Voice selection was completely
disconnected from the regenerate path — you had to scroll back to the compose
form, pick a voice, then click Generate again.

## Decisions

### 1. Output format toggle removed

The `Document / Plain text` toggle was removed entirely from the proposal
surface. The rendered preview and editable text states already cover the two
meaningful working modes, so keeping a second format system added duplicate
state without giving users a distinct capability.

**Why:** In edit mode the document/plain-text distinction collapses into the
same raw text. In preview mode the proposal should behave like a document sheet,
not a formatter switcher. For copy-to-platform workflows, the existing copy
action remains enough without a persistent format toggle.

### 2. Regenerate is now a compound trigger — `RegenerateMenu`

The bare `RotateCcw` icon button is replaced by a labeled `RegenerateMenu`
component. Clicking it opens a compact popover that contains:

- Voice selector chips: Auto · Balanced · Formal · Warm
- A primary "Regenerate" action button

Voice selection in the popover is local state that defaults to the current
`proposalVoicePreset`. After a successful regeneration with an override the
voice is persisted via `handleProposalSubmit → setLastProposalRequest`, so the
next popover open reflects the most recently used voice.

**Why:** Regenerate is the highest-value action on the output surface. Giving it
a label ("Regenerate") and pairing it with a one-tap voice override makes the
intent explicit without adding permanent UI. The four voice options (Auto /
Balanced / Formal / Warm) map to the protected backend presets (null /
signature / expert / engaging) — no new prompt-stacking modifiers were added.

**Why not a split button:** A chevron-triggered dropdown on a labeled button was
chosen over a split button (left = immediate action, right = options). A split
button requires explaining the two zones, adds two click targets, and
communicates a default action that may not be obvious. A single compound trigger
is simpler.

### 3. `handleRegenerateOutput` extended with `voiceOverride` parameter

Signature: `async (voiceOverride?: FormValues["voicePreset"] | null) => void`

The override is merged into `requestWithVoice` before the action call.
`handleProposalSubmit` receives `requestWithVoice` so `lastProposalRequest` and
`proposalVoicePreset` are both updated consistently. No backend prompts were
changed.

### 4. Primary toolbar left section simplified

The left rail now uses a single toggle button that flips between preview and
edit states. The button shows `Eye` in preview and `Pencil` in edit, matching
the one-control pattern already used for theme toggles elsewhere in the app.

**Why:** Two adjacent buttons for two mutually exclusive states carried twice
the visual weight for one decision. A single toggle keeps the rail smaller and
makes it obvious that preview/edit is one binary mode, not two separate tools.

### 5. Zoom moved into a secondary vertical dock

Zoom controls now sit directly under the preview/edit toggle as a vertical dock.
On pointer-hover devices the dock appears on hover or focus; on touch/mobile it
stays visible by default.

**Why:** Fit / minus / plus are useful but secondary. Moving them under the
mode toggle keeps them nearby without competing with regenerate, copy, or save.

### 6. Regenerate popover may escape the document shell

The proposal sheet and overlay control containers now allow visible overflow,
and the regenerate popover sits above the document frame stack.

**Why:** The compound regenerate trigger only works if the menu can expand past
the card edge. Clipping it behind the proposal output made the new control feel
broken even though the logic was correct.

## What was not changed

- Voice workbench in the saved-proposal sidebar — left intact.
- Style inspector (`EmbeddedStyleInspector`) — the "Hide customize" toggle flip
  was noted as awkward but deferred; it is a label concern only and the
  behaviour is correct.
- All backend voice presets and proposal generation prompts — protected.
- Zoom controls (Fit / − / +) — kept functionally unchanged, but relocated into
  the left-side dock under the mode toggle.
- Delete confirm flow — unchanged.
- Copy button positioning — unchanged (right section of rail).
