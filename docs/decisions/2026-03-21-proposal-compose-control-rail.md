# Proposal Compose Control Rail

Date: 2026-03-21

## Decision

Adopt a two-part control model for Proposal compose:

1. `Choose resume` dialog
   - Clicking the card selects a candidate locally.
   - The trailing confirmation icon confirms the selected resume.
   - The edit icon remains a direct action.
   - Date stays in the top-right corner of the card rail.
   - Actions stay in the bottom-right corner of the card rail.

2. Proposal compose bottom toolbar
   - The toolbar is a real layout rail, not an absolute overlay.
   - Left side contains:
     - paperclip picker
     - selected resume label
     - document type
     - tone
   - Right side contains the generate button, aligned bottom-right.

## Why

- This preserves the date as a useful secondary signal in chooser cards.
- It avoids overlay collisions at small widths.
- It matches assistant-style composer hierarchy more closely:
  content field first, compact controls second, primary send/generate control trailing bottom-right.

## Notes

- The selected resume label should stay passive and truncated; it is not a full-width button.
- The bottom toolbar should share the same neutral field surface as the job-title field for visual unity.
- Rich structured experience content must stay stored as a Remirror doc through normalization, otherwise modal reopen loses formatting.
