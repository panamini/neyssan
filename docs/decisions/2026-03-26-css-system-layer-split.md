# CSS System Layer Split

Date: 2026-03-26

## Decision

- Split the previous monolithic `src/styles/globals.css` into explicit layers:
  - `foundation.css`
  - `themes.css`
  - `base.css`
  - `primitives.css`
  - `utilities.css`
  - `product.css`
- Keep `globals.css` as the stable composition entrypoint.

## Rationale

- The previous structure mixed tokens, base rules, app-shell layout, product-specific components, and modal/document styling in a single file.
- That structure made it difficult to distinguish:
  - source-of-truth tokens
  - shared primitives
  - page-shell utilities
  - product-specific rules
- The new split supports progressive migration without breaking existing screens because compatibility aliases remain available.

## Consequences

- Shared interface work should land in `primitives.css` or `utilities.css`, not `product.css`.
- Product-specific visuals should stay in `product.css`.
- Resume renderer-specific document styling remains separate from the app shell.
- Existing short token names are still allowed temporarily, but readable aliases are the preferred interface for new work.
