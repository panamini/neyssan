# UI Audit — Compose Proposal Actions & Render Surface

Date: 2026-03-27

## Scope

- Screen audited: Proposal Compose and Saved Proposal surfaces
- Focus:
  - action placement for output controls
  - rendered proposal visibility strategy during compose
  - compose vs saved output behavior divergence

## Code Classification

- Active code
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx`
  - `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx`
- Legacy but informative
  - none used for this audit
- Obsolete/dead code
  - not assessed in this audit

## Current State

### Compose

- The compose output uses `ProposalDisplay` in the main right panel.
- The action cluster is injected from `ProposalForge` and rendered in the document header in `actions-only` mode.
- Current actions include:
  - edit / preview
  - focus
  - save
  - delete
  - copy

Relevant code:

- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx:887`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx:913`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx:922`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx:573`

### Saved proposals

- The selected saved proposal still mounts `ProposalDisplay` in `mode="edit"`.
- Secondary saved proposals mount `ProposalDisplay` in `mode="preview"`.

Relevant code:

- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx:983`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx:1000`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx:1134`

## Findings

### 1. The current action placement is document-adjacent, but it reads like site chrome

The controls are technically inside the output component, not the global navbar. However, they are positioned at the very top-right edge of the viewer, detached from the paper itself. Visually, they read as global controls instead of document controls.

This is the wrong emphasis for:

- edit / preview
- copy
- save
- delete
- focus

These are document-specific actions, not page-level navigation.

### 2. Compose currently mixes two product questions into one surface

There are actually two distinct intents:

- "show me the generated result"
- "let me manipulate the output"

Right now the rendered proposal appears immediately in the main output pane, and the edit shell is hidden behind a mode toggle. That is coherent, but only if the mode switch is explicit and obviously local to the document.

At the moment, the UI communicates the render state weakly, and the action cluster competes with the zoom controls.

### 3. Compose and saved proposals still follow different mental models

Compose:

- generated proposal is primarily presented as a rendered document
- editing is secondary and toggle-driven

Saved proposals:

- selected saved proposal is primarily presented as editable text shell
- rendered preview is secondary and mostly lives in the other cards

This asymmetry is why the user perceives the "edit shell" as missing in compose but still present in saved proposals.

## Recommendation

## A. Best-practice placement for the action controls

Preferred pattern:

- keep global page actions in the site/top app bar
- move document actions into a discrete floating capsule attached to the document viewer

For Neyssan, the strongest version is:

- place a small capsule in the top-right of the proposal viewer chrome, just above the paper or slightly overlapping the paper margin
- keep only document-local actions there
- order:
  - edit / preview toggle
  - copy
  - save
  - delete
  - focus

Why this is the better pattern:

- Android/Material guidance says app bars should surface only the most important actions for the current context, and overflow the rest when space is limited. That supports keeping page-level actions sparse and context-specific actions local to the active surface.
- Apple’s guidance for menus/contextual menus emphasizes a small number of frequently used actions relevant to the current view or task.
- Adobe tool UIs use contextual toolbars for object/document-local operations rather than mixing them with app navigation.

Conclusion:

- not in the global top site bar
- not scattered across the whole card
- yes to a compact contextual capsule on the document viewer

## B. Best choice for showing the rendered proposal during compose

Preferred choice:

- keep the rendered proposal in the main compose output pane
- keep editing available through an explicit local toggle inside that same pane
- do not move the rendered output into a second card below by default

Why:

- the right pane is already understood as "the output"
- a second card below adds vertical travel and weakens the left-input / right-output relationship
- a toggle keeps the model simple:
  - Rendered
  - Editable

Best UX version:

- segmented toggle or dual-state button inside the document capsule
- labels should be explicit:
  - `Rendered`
  - `Editable`
- default after generation: `Rendered`
- preserve last chosen mode per session if needed

Alternative:

- a secondary preview card below is only justified if the product wants simultaneous comparison of rendered output and editable output
- today that would likely add clutter more than value

## C. Compose vs saved should converge

Best target state:

- Compose selected output: default `Rendered`, editable via toggle
- Saved selected output: same default and same toggle
- Secondary saved cards: preview only

That would remove the current conceptual mismatch between compose and saved.

## Preferred UX Model

### Compose

- Left: source / prompt / job shell
- Right: one output card
- In the output card:
  - zoom controls
  - small document action capsule
  - rendered/editable toggle

### Saved proposals

- Selected card: same output card behavior as compose
- Secondary cards: lightweight rendered previews only

## Decision Summary

- Document actions should live in a discrete contextual capsule on the viewer, not in the global site chrome.
- The rendered proposal should stay visible in compose as the primary output.
- The editable shell should return as an explicit toggle state inside the same output card.
- Saved selected proposals should align with compose and stop defaulting to a different interaction model.

## External Guidance Used

- Android Developers, top app bar actions:
  - https://developer.android.com/develop/ui/views/components/appbar/actions
- Apple Human Interface Guidelines, menus / contextual actions:
  - https://developer.apple.com/design/human-interface-guidelines/menus
- Adobe contextual toolbar pattern reference:
  - https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/interface/toolbars
- Vercel Web Interface Guidelines:
  - https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

