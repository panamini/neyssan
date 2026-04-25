# Document Card Canon

Date: 2026-03-21

## Decision

Use one cross-site `title-first` document card canon for:

- Resume Library
- Proposal Library
- resume chooser cards inside Proposal Forge

The chosen card format is `root-2 landscape`.

- ratio: `1.41421356 : 1`
- this is the horizontal counterpart of the existing A4/root-2 proposal sheet

## Rules

1. The title is the visual anchor.
2. Date is quiet, never primary, and lives in a bottom-left stamp rail.
3. Meta sits below the title.
4. Snippet sits below meta when the surface needs content preview.
5. Actions belong in the bottom rail only when the user needs explicit confirm/select/edit controls.
6. Library/chooser cards reserve a two-line title area even when the title fits on one line.

## Internal Rails

- Rail 1: title, reserved for 2 lines
- the title text sits on the bottom of that reserved frame, so the gap to rail 2 stays optically stable with one-line and two-line titles
- Rail 2: meta, reserved for 1 compact line
- Rail 3: snippet/preview when relevant, reserved for 2 lines in library cards
- Rail 4: bottom rail
  - date as quiet stamp on the left
  - actions on the opposite side when needed

For proposal library cards, `type · tone · date` can live together in rail 4 so the card reads:
title → snippet → archive stamp.

Within the same format family:

- CV cards use a tighter top cluster (`title → subtitle`) because they read as identity cards
- proposal cards keep a stronger title reserve and give the snippet an extra line, because they read more like saved documents than profile records
- library cards use a stable `24` padding shell
- internal rhythm stays on `8 / 12` only

CV subtitle priority:

1. email
2. LinkedIn
3. website
4. phone
5. location

This keeps CV cards closer to a contact / identity card than a narrative preview.

## Typographic Hierarchy

- title: Fraunces, calmer than panel/page headings, still the anchor
- meta: Source Sans, quiet and compact
- snippet: Source Sans, slightly larger than meta but softer than title
- stamp/date: smallest and ghosted

The goal is not to maximize contrast between all lines, but to keep a clear editorial descent:
title → context → detail → stamp.

## Notes

- `Choose resume` intentionally keeps no snippet for now.
- The chooser remains a document card, not a list row.
- Variants should be made with rail/layout modifiers, not by inventing new card grammars.
