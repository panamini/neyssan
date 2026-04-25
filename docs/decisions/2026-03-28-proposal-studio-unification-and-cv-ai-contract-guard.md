# Proposal Studio Unification + CV AI Contract Guard

Date: 2026-03-28

## Status

Implemented in active v1 code.

## Scope

- Proposal studio interaction model on `/proposal`
- CV AI runtime safety for section-level helper actions
- Style toolbar naming and surface simplification
- Compact-but-editable achievements input behavior

## Decisions

### 1. `/proposal` remains one studio

Saved proposals no longer require a separate in-page workspace mode. The proposal page now keeps:

- a persistent live draft on the left compose shell
- an optional opened saved proposal on the right preview/workbench side

Opening a saved proposal must not overwrite the live draft automatically.

### 2. Saved proposal inspection is explicit

When a saved proposal is opened:

- the right rail shows a `Saved proposal` context card
- the user can return to the live draft without clearing it
- the user can `Copy to draft` to continue from the saved proposal intentionally

This keeps inspection non-destructive by default.

### 3. CV AI helper actions are capability-gated

A new Convex query, `getCvAiCapabilities`, exposes:

- a version string
- the supported `runCvSectionAiAction` ids

Client helpers now load capabilities through a catchable Convex client query rather than assuming the runtime is current. If the backend is stale:

- unsupported AI affordances are disabled
- the user sees a clear refresh/restart hint
- the UI avoids firing known-unsupported actions that would otherwise hit `ArgumentValidationError`

### 4. Style surface is preset-first

The embedded style workbench keeps the existing bundle system but simplifies the presentation:

- `Minimal` becomes `Clean`
- `Rounded` becomes `Soft`
- `Editorial` and `Bold` stay unchanged
- `Style` / `Hide details` becomes `Customize` / `Hide customize`
- control labels become `Layout`, `Type`, `Color`, and `Describe a look`

This is a nomenclature and surface simplification only. Underlying bundle ids and style primitives remain intact.

### 5. Linked CV control stays actionable

The proposal style accessory no longer acts like a passive linked-state badge.

- the main pill opens the CV picker
- the secondary linked/local pill toggles inheritance

Being linked to a CV must not block access to the picker.

### 6. Achievement rows stay compact but become editable for bad imports

Achievement inputs remain visually compact at rest, but they now expand when:

- focused
- the content is long
- the content contains line breaks

This preserves quick editing for short lines while making parser mistakes recoverable.

## Notes

- `Balanced`, `Formal`, and `Warm` generation prompts remain protected and unchanged.
- Proposal voice in the right-side workbench is currently active for opened saved proposals; the live draft still uses the compose form as the source of truth.
- Capability fallback treats legacy runtimes as supporting only the historical CV AI action set.
