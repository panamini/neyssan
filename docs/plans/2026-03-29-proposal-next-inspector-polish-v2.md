# Proposal-Next Inspector Polish v2

## Scope

- `proposal-next` inspector polish only
- left-panel dismiss / restore on `proposal-next`
- custom accent color with draft, metadata, and settings persistence
- proposal-facing tone label unification (`signature` shown as `Natural`)

## Implemented

### Sprint A

- Token-based inspector offset on the `proposal-next` output shell
- Shared `getVoicePresetDisplayLabel()` helper used across proposal-facing UI
- Tone UI standardized to `Auto · Natural · Formal · Warm`
- Inactive tone icons + active `Check`
- Manual style buttons switched to `Aa` previews
- Dynamic auto style preview on `proposal-next`
- Settings page updated to match the inspector visual language

### Sprint B

- `leftPanelVisible` added to `proposal-next`
- Left column collapses via `max-width + opacity`
- Restore affordance kept inside the output shell bounds
- Compact layouts ignore the dismiss flow

### Sprint C

- Added `customAccentHex` alongside `paletteOverride`
- Enforced mutual exclusion between named palette and custom accent
- Extended local proposal output draft persistence with:
  - `paletteOverride`
  - `customAccentHex`
- Saved proposal render metadata now serializes the merged style preset with palette/custom accent
- Added `ProposalColorPickerPopover`
- Added `proposalAccentHex` to settings persistence

### Sprint D

- Normalized inspector and collapsed-tone drawer tooltip placement so trigger tooltips and drawer-item tooltips no longer share conflicting positioning rules
- Replaced the custom-accent popover internals with a card-style saturation field, compact hue ribbon, and minimal pipette fallback instead of the wheel / palette-button path

## Deferred

- Template gallery drawer
- Separate typography/layout override system
- Any precedence rules beyond the current bundled style model
