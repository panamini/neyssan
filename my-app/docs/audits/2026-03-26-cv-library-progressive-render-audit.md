# CV Library Progressive Render Audit

## Scope classification

- Active code: `my-app/src/pages/CvsLibrary.tsx`
- Legacy but informative: none used
- Obsolete/dead code: backup files and archive trees were not used

## Finding

The CV library cards are materially lighter than saved proposal sheets, so the main risk is not parsing or renderer cost. The likely pressure point at larger library sizes is DOM growth from mounting every card at once.

## Change

The library now mounts CV cards progressively in batches using `IntersectionObserver`.

- Initial render: 12 cards
- Additional cards: 12 at a time as the user scrolls

## Rationale

This keeps the change small and reversible:

- no change to CV storage
- no change to `loadCv()`
- no backend pagination assumption
- improved resilience if the library grows

## Follow-up

If the CV cards later become heavier, the next clean step is route-level virtualization or server-backed pagination. That is not required yet.
