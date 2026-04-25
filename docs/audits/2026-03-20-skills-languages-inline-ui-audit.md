# Skills / Languages Inline UI Audit

Date: 2026-03-20

## Scope

Active code only:

- `src/components/SectionEditor.tsx`

Legacy but informative:

- `src/components/structured-blocks/SkillsModal.tsx`
- `src/components/structured-blocks/LanguagesModal.tsx`
- `src/components/structured-blocks/SkillsBlock.tsx`

## Findings

### 1. Active path is inline, not modal

`skills` and `languages` are edited inline in `SectionEditor.tsx`. The modal components remain in the codebase, but the header edit actions are intentionally hidden and the current UX is autosave-on-blur / autosave-on-change for level updates.

Implication:

- visual consistency work should focus on the inline rows first
- modal footer/button work is not currently user-visible

### 2. The shared `LevelDots` helper is already the right foundation

The active inline UI already uses the shared `LevelDots` helper for:

- collapsed chips
- expanded skill rows
- expanded language rows

This is good because it means the dot system is centralized in one place inside `SectionEditor.tsx`, rather than duplicated across separate components.

### 3. Main inconsistency is row chrome, not persistence

Persistence behavior is already coherent:

- skill name persists on blur / Enter
- language name persists on blur / Enter
- level changes persist immediately when a row has a name
- empty draft rows are preserved locally until named

The remaining inconsistency is visual:

- `skills` exposes extra row actions (`pin`) that `languages` does not
- collapsed chips include inline delete buttons
- expanded rows use compact icon buttons that are correct in token family, but the overall row rhythm is still denser and more utilitarian than the newer section patterns

### 4. `Skills` and `Languages` intentionally diverge in feature set

`Skills` has:

- pin-to-top behavior
- level sorting helpers in logic

`Languages` does not.

So full visual parity should not erase that product distinction. The goal should be shared chrome, not identical capability.

## Recommendation

Next micro-pass should target only the active inline surface:

1. normalize row rhythm and action reveal for `skills` and `languages`
2. keep `pin` in `skills`, but make its visual hierarchy subordinate to name + dots
3. decide whether collapsed chip delete buttons should remain visible there, or move to hover/focus for less noise

## Do Not Do Yet

- do not spend time polishing `SkillsModal` / `LanguagesModal` further
- do not rewrite persistence behavior
- do not remove `pin` from `skills` without a product decision
