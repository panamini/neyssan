# Proposal Planner Contract Hardening

Date: 2026-03-13

## Decision

Harden the planner-to-writer contract on the active backend proposal path so the writer treats the planner as binding rather than advisory.

## Why

The planner step improved generation quality, but the remaining failures were still writer-obedience issues:

- no-context pseudo-history
- literal adjacent/distant transfer
- credential-fit inflation
- in-progress vs completed qualification drift
- multilingual output drift

## What changed

- Added `output_language` to the planner output.
- Tightened planner enums for credential status:
  - `exact_required`
  - `related_not_equivalent`
  - `in_progress_only`
  - `unsupported`
- Strengthened no-context normalization and writer rules.
- Strengthened adjacent/distant transfer rules in the writer contract.
- Added explicit credential-language bans unless exact claims appear in allowed concrete facts.
- Bound final prose language to the planner contract.

## Scope

- backend only
- active planner/writer path only
- no UI changes
- no extension changes
- no preset catalog redesign
- no provider/model changes

## Consequence

The planner now carries more of the decision load, and the writer is more constrained in the remaining hard cases without changing the product surface.
