# Radius and Border Canon

Date: 2026-03-26

## Decision

The routed `my-app` shell will author against one explicit radius and border hierarchy:

- Radius scale:
  - `8 / 12 / 16 / 20 / pill`
- Radius roles:
  - `inline`
  - `control`
  - `card`
  - `surface`
- Border roles:
  - `soft`
  - `field`
  - `strong`

Compatibility aliases such as `--rs`, `--rm`, `--rl`, `--bo`, and `--bm` remain available only to avoid breakage during migration. They are not the preferred authoring interface.

## Rationale

- The previous system already had premium direction, but its geometry was fragmented.
- A readable canon is easier to apply consistently than short mnemonic aliases.
- `12 / 16 / 20` creates clearer separation between controls, cards, and large surfaces than the previous `6 / 12 / 18`.
- Soft border tiers fit the product better than stronger frame-like lines, especially in the lighter paper-and-sage palette.
- Explicit semantic roles are easier to maintain than component-specific formulas.

## Component mapping

- `inline`: compact icon actions and small square affordances
- `control`: buttons, fields, selects, menu options, segmented buttons, toolbars
- `card`: document cards, chooser cards, selection cards, warning notices
- `surface`: panels, modals, hero surfaces, stage shells
- `pill`: chips and explicit capsule controls only

## Consequences

- New shared-shell code should use semantic radius and border roles directly.
- Shared-shell borders should default to `soft`, use `field` for control shells, and reserve `strong` for selected or active structure.
- The Verbati resume renderer remains a separate document-rendering surface and should not inherit app-shell geometry rules internally.
- Spacing migration is deferred. This decision only stabilizes geometry and border hierarchy.
