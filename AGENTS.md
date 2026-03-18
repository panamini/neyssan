# Codex Project Instructions

## Baseline
- Treat `v1` as the active development baseline.
- Prioritize the product goal:
  - CV ingestion/parsing -> canonical saved profile/CV data -> personalized proposal generation.

## Scope Control
- Do not perform large architectural rewrites unless explicitly requested.
- Prefer small, testable, reversible changes.

## Architecture Authority Rules
When making architecture decisions, treat the following as non-authoritative or obsolete by default:
- `pdf-ingest/`
- spaCy/training-oriented legacy parser code
- `*.bak` files
- backup component trees
- archive folders

## Documentation Requirements
- For audits: save a Markdown report under `docs/audits/`.
- For technical decisions: document them under `docs/decisions/`.
- For implementation plans: save them under `docs/plans/`.

## Ambiguity Handling
When uncertainty exists, explicitly classify findings as:
- active code
- legacy but informative code
- obsolete/dead code

Do not present assumptions as settled facts. Mark uncertainty clearly.
