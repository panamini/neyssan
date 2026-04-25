# Proposal Verifier Enforcement Stage

Date: 2026-03-13

## Decision

Keep the existing planner -> writer architecture and add one small backend enforcement layer after draft generation.

The new stage does three things:

1. verifies the generated draft against the active planner contract
2. performs one narrow repair pass if verification fails
3. applies a tiny deterministic cover-letter boundary normalizer before save

## Why

Prompting and planning alone had plateaued.

The remaining failures were concentrated in:

- no-context pseudo-background
- exact fact-fidelity drift
- adjacent/distant over-translation
- credential inflation
- final EN/FR obedience
- missing cover-letter boundary lines

Those are enforcement problems, not architecture problems.

## Scope

- backend only
- active planner -> writer path only
- no UI changes
- no extension changes
- no schema changes
- no model/provider change

## Notes

- English/French hardening remains the active language scope.
- Spanish or broader multilingual support is a separate capability expansion and is not part of this trust-hardening pass.
- The verifier is generic. It is based on:
  - no-context honesty
  - exact fact fidelity
  - transfer-distance control
  - credential/qualification control
  - output-language control
  - final-format control

