# Audit: Section Header Action Unity

Date: 2026-03-20

## Scope

Active section headers in the resume editor:
- `Summary`
- `Profile`
- `Experience`
- `Education`
- `Achievements`
- `Skills`
- `Languages`

## Current Active Patterns

### 1) `Summary` and `Profile`

Source:
- `my-app/src/components/SectionEditor.tsx:692`
- `my-app/src/components/SectionEditor.tsx:1607`

Pattern:
- header shows `Pen`
- header also shows `Trash`
- `Trash` becomes `Clear / Cancel` confirm inline

Issue:
- this creates a dual primary action in the same header
- visually heavier than other sections
- reads less like a calm editorial shell and more like app chrome

### 2) `Experience` and `Education`

Source:
- `my-app/src/components/SectionEditor.tsx:1936`

Pattern:
- header shows `Pen` only
- destructive actions live inside the modal per entry

Assessment:
- this is the cleanest current header model
- one clear entry point
- destructive actions are moved closer to the thing being deleted

### 3) `Achievements`

Source:
- `my-app/src/components/structured-blocks/AchievementsBlock.tsx:123`

Pattern:
- header shows `Plus`
- header also shows `Trash`
- `Trash` becomes `Clear all / Cancel`

Issue:
- same unity problem as `Summary` / `Profile`
- two competing content actions in one small header
- better than `Pen + Trash` semantically, but still visually noisy

### 4) `Skills` and `Languages`

Source:
- `my-app/src/components/SectionEditor.tsx:1086`
- `my-app/src/components/SectionEditor.tsx:1476`

Pattern:
- no competing header actions
- add/remove actions happen in body/chips/inline rows

Assessment:
- this is coherent
- the header is not overloaded

## Diagnosis

The lack of unity does not come from icon styling anymore. It comes from action placement.

Right now there are three different header philosophies:
- `edit-only` header (`Experience` / `Education`)
- `edit + clear` header (`Summary` / `Profile`)
- `add + clear` header (`Achievements`)

That inconsistency is what makes the interface feel unstable.

## Recommendation

Use one rule:

### Rule: one content action max in the section header

The header should expose only the main entry action for that section.
Destructive or bulk-clear actions should move inside the editor/modal for that section.

Recommended mapping:

### `Summary`
- header: `Pen` only
- `Clear` moves inside the modal

### `Profile`
- header: `Pen` only
- `Clear` moves inside the modal

### `Experience`
- header: `Pen` only
- keep row deletion inside modal

### `Education`
- header: `Pen` only
- keep row deletion inside modal

### `Achievements`
- header: `Plus` only
- keep `Add achievement` as the header entry action
- move `Clear all` inside the modal

### `Skills`
- no header action required
- keep add/remove inline in body

### `Languages`
- no header action required
- keep add/remove inline in body

## Why This Is The Strongest Option

- one dominant action per header
- destructive actions live closer to the edited content
- `Experience / Education` remain the reference for calm section chrome
- `Achievements` keeps its additive nature without needing a second destructive icon in the shell
- `Summary / Profile` stop looking heavier than the rest of the document

## Classification

- Active code: all findings above.
- Legacy but informative: none used for this diagnosis.
- Obsolete/dead code: not required for this diagnosis.

