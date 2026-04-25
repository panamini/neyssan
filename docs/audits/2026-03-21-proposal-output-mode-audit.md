# Proposal Output Mode Audit

Date: 2026-03-21

## Scope

Active code:
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalInputForm.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalsList.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css`

## Problem

The proposal tool currently mixes two different ideas:

1. a tool shell for composing inputs
2. a document surface for reading and editing the generated proposal

This creates too many nested surfaces and weakens the hierarchy:
- compose and output do not feel like the same family
- the generated proposal can look trapped inside an unnecessary outer frame
- `Saved` currently duplicates title metadata on a separate card and in the document context

## Design Constraints

- Keep the app on a maximum of 3 large neutral surfaces on screen
- Keep proposal documents on the existing root-2 / A4 portrait sheet
- Keep composer controls discoverable
- Avoid introducing a second full page if a mode switch can solve the same problem

## Options

### Option A: Two full pages side by side

- Left: compose page
- Right: preview/edit page

Pros:
- very explicit
- good for constant compare-and-edit behavior

Cons:
- visually heavy
- duplicates document gravity
- expensive on medium screens

Assessment:
- not ideal for this app unless document editing becomes the dominant activity

### Option B: One output sheet with `Preview / Edit` mode

- Left: compose shell remains visible
- Right: one A4 document sheet
- The right sheet switches between read mode and edit mode
- In edit mode, the left composer can stay reduced but present

Pros:
- one canonical document surface
- no duplication of preview vs edit
- closer to assistant workflows without copying them literally
- easiest to keep visually clean

Cons:
- needs a clear mode affordance
- requires careful toolbar/header design inside the sheet

Assessment:
- best option for this app

### Option C: Single document only, composer hidden behind drawer

- Right: one document sheet only
- Compose controls open in a drawer or overlay

Pros:
- cleanest visual state

Cons:
- worse discoverability
- slower iteration for prompt tuning

Assessment:
- too hidden for the current product stage

## Recommendation

Adopt **Option B**.

### Canonical behavior

- `Compose` page:
  - left = composer shell
  - right = one A4 proposal sheet
  - right sheet header contains title, tone/type meta, and document actions
  - right sheet supports `Preview / Edit` toggle

- `Saved` page:
  - keep the left library/title card
  - right = one A4 proposal sheet
  - document actions live inside the same visual frame as the sheet

## Surface rule

- Composer shell may keep its surrounding tool frame because it contains controls
- Generated output should trend toward **sheet-first**
- Any extra medium-gray wrapper around the output should be reduced to either:
  - no wrapper, or
  - a very light structural frame only if needed for spacing/alignment

## Chevron note

For `Experience / Education`, the section-level disclosure icon should not compete with the single header edit action.

Recommendation:
- keep the header for the primary edit action only
- place section-length disclosure at bottom-right of the section preview
- keep item-level disclosure aligned to the same right rail

This is cleaner than adding a second control to the header for this specific card family.
