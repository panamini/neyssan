# Writer Contract And Language Hardening

Date: 2026-03-13

## Decision

Keep the existing planner -> writer architecture and harden it locally instead of adding another generation system.

This pass makes two narrow changes:

1. strengthen the writer contract so the planner is treated as binding
2. fix the active output-language resolver so isolated foreign tokens do not flip the whole output language

## Why

The remaining failures were not architectural anymore. The planner step was already the right separation of concerns. The remaining issues came from:

- writer overreach beyond `allowed_concrete_facts` and `allowed_transfer_themes`
- weak no-context obedience
- literal transfer in adjacent/distant cases
- credential/qualification inflation
- brittle English/French resolution driven by a single French diacritic

## What changed

- Strengthened planner-owned disallowed-claim defaults and writer-plan contract text for:
  - no-context phrasing bans
  - same-domain claim-fidelity limits
  - adjacent/distant transfer boundaries
  - credential-status obedience
  - employer-name synthesis bans
- Kept presets structurally unchanged, with only small opening-contract refinements for `engaging` and `storyteller`
- Replaced the previous language resolver behavior that flipped to French on any French diacritic
  - English JDs with one isolated token like `résumé` now remain English
  - French output now requires stronger document-level French evidence

## Scope limits

- No UI changes
- No extension changes
- No Convex/public API changes
- No stored proposal schema changes
- No model/provider changes

