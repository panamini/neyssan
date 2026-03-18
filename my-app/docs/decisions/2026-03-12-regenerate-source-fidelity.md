# Regenerate Source Fidelity

Date: 2026-03-12

## Decision
Saved proposals must preserve the original job-post source needed for future regeneration.

Each proposal row now stores, in `metadata` when available:
- `sourceJobDescription`: the original job-post description used for generation
- `proposalType`: the normalized output format (`cover_letter`, `application_message`, or `freelance_proposal`)

Saved-proposals `Regenerate` must use `metadata.sourceJobDescription` as the next generation source.
It must not fall back to the previous proposal body as `jobDescription`.

## Reason
Using the previous proposal body as the next `jobDescription` creates a self-conditioning loop and collapses variation across repeated regenerations.

## Scope
This decision does not change:
- the generation action
- tone defaults
- visible UI controls
- auth, scraping, CV flow, or model selection
