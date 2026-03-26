# Saved Proposal Semantic Zoom

## Status

Accepted on 2026-03-26.

## Scope

Active code only: `my-app/src/components/ProposalsList.tsx` and shared product styles.

## Decision

Saved Proposal on mobile uses three semantic zoom states:

- `focused`: single full-width proposal sheet
- `stack`: selected proposal sheet plus additional A4 cards below
- `library`: compact proposal library cards with title, snippet, and meta

The interaction uses:

- two-finger pinch inside the saved proposal surface to step one level at a time
- explicit mobile fallback buttons for `focus` and `library`

## Rationale

- Gesture-only navigation is too fragile for mobile web and competes with browser zoom.
- The fallback buttons keep the feature discoverable and accessible.
- The `library` mode reuses the lighter proposal-card pattern instead of rendering many full proposal sheets.

## Notes

- Pinch-in moves toward more overview: `focused -> stack -> library`
- Pinch-out moves toward more detail: `library -> stack -> focused`
- Desktop keeps the existing `focused / stack` behavior and does not expose the `library` mode by default
