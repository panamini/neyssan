# Button Pressed-State Audit

Date: 2026-04-05

## Scope

Audit of active button systems and click/pressed-state patterns in the app, with focus on whether the new tactile pressed-card animation used in Settings should be applied across the whole app.

## Findings

### 1. Active code has multiple button families with different interaction semantics

These are not one interchangeable button system.

- Base icon buttons live in [primitives.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/primitives.css#L296).  
  `.dasti-icon-button` is a compact utility control with hover/focus styling but no explicit press transform.
- Inline AI toolbar actions live in [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L2909).  
  `.dasti-inline-ai-toolbar__action` and `.dasti-inline-ai-toolbar__apply` already use a tiny `translateY(1px)` press at [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L2947).
- Proposal chips live in [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L4849).  
  `.dasti-proposal-chip` is a chip-like selection surface with active state styling at [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L4965).
- Compose toolbar buttons live in [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L8371).  
  `.dasti-compose-toolbar__tone-option`, `.dasti-compose-toolbar__tone-chip`, `.dasti-compose-toolbar__icon-button`, and the CV shell/chip/remove controls are compact toolbar controls, not card surfaces.
- Settings selection cards live in [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L10036) and [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L11362).  
  These are the only places currently using the new tactile press compression treatment.

Why this matters:

- Small icon buttons are precision controls.
- Chips are segmented-selection controls.
- Settings cards are large, surface-like selectors.

They should not all receive the same pressed motion blindly.

### 2. A global tactile card press would be correct for card selectors, but risky for toolbar/icon controls

The new settings-card press behavior is active here:

- Layout cards: [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L10036)
- Font-pair cards: [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L11362)
- Preset slot cards: [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L11412)

That treatment works because those controls are:

- visually card-like
- large enough to absorb scale
- used for selection, not repeated micro-actions

Applying the same scale/inset-shadow press to these systems would be risky:

- `.dasti-icon-button` in [primitives.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/primitives.css#L296)
- `.dasti-compose-toolbar__icon-button` / `.dasti-compose-toolbar__tone-option` in [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L8371)
- `.dasti-inline-ai-toolbar__action` in [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L2909)

Why:

- toolbar controls sit in tight clusters; scale can make spacing feel unstable
- icon buttons are visually optimized for crisp hover/focus, not compression
- some controls are split shells (`cv-shell`, `cv-chip`, `cv-remove`) where scaling one child can look broken

### 3. The app already uses at least three press models

Active press/click interaction models today:

1. No explicit press transform, hover/focus only  
   Example: `.dasti-icon-button` in [primitives.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/primitives.css#L296)

2. Micro press nudge  
   Example: inline AI toolbar at [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L2947)

3. Card compression with inset pressure  
   Example: settings cards at [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L10036), [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L11367), and [product.css](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/product.css#L11412)

This means the system is already differentiated by control role. That is a feature, not necessarily a bug.

### 4. The best unification boundary is by surface type, not by “all buttons”

Recommended grouping:

- Card selectors: use tactile compression  
  Settings layout/font/preset cards, future large selection cards

- Toolbar icon controls: keep crisp hover/focus, at most add a very subtle press  
  Base `.dasti-icon-button`, compose toolbar icon buttons, saved-view toolbar buttons

- Chips/pills/toggles: keep segmented-control behavior  
  `.dasti-proposal-chip`, `.dasti-settings-pill`, compose tone chips

- Inline AI toolbar: keep the current micro `translateY(1px)` pattern  
  It is intentionally smaller and more command-like

### 5. Legacy but informative code mirrors the same split

These are not primary styling authorities, but they confirm the same interaction split:

- [SavedProposalForgeToolbarPreview.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/SavedProposalForgeToolbarPreview.tsx)
- [EmbeddedStyleInspector.tsx](/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/EmbeddedStyleInspector.tsx)

They reuse toolbar/action/active patterns rather than inventing a single universal pressed effect.

### 6. Obsolete/dead code should not guide this decision

Non-authoritative for this audit:

- `*.bak`
- backup component trees
- `ProposalForgeNext.tsx`
- archive folders

These should not be used to decide button motion direction.

## Root Cause

There is no single “button class object” in the app. The active UI is intentionally composed of separate control families:

- base icon utility buttons
- toolbar action buttons
- chips/pills/toggles
- card selectors

The settings tactile press works because those controls are cards. It is not automatically a good fit for the rest of the app.

## Recommendation

Do not apply the settings card press globally across the whole app.

Recommended policy:

1. Keep tactile compression for large card selectors only.
2. Keep toolbar icon buttons on the current hover/focus model, with at most a tiny press cue later if desired.
3. Keep inline AI toolbar on its existing micro-press model.
4. Keep chips/pills as chips/pills, not mini cards.

## Minimal Follow-Up Plan

If you want a cleaner system without overreaching:

1. Define three interaction tiers:
   - `press-card`
   - `press-micro`
   - `press-none`
2. Audit active selectors into those three tiers.
3. Only then normalize repeated rules inside each tier.

## Concrete Recommendation By Selector

Safe to use tactile card press:

- `.dasti-settings-style-card`
- `.dasti-settings-font-pair-card`
- `.dasti-settings-slot-card`
- future large style/template choice cards

Should probably keep current behavior:

- `.dasti-icon-button`
- `.dasti-compose-toolbar__icon-button`
- `.dasti-compose-toolbar__tone-option`
- `.dasti-inline-ai-toolbar__action`
- `.dasti-inline-ai-toolbar__apply`
- `.dasti-proposal-chip`
- `.dasti-settings-pill`

## Bottom Line

Use the new pressed-card animation as a surface-level pattern, not as a universal button rule.

That is the more coherent system for this app.
