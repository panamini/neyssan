# Proposal Planner Step Before Final Writing

Date: 2026-03-13

## Decision

Add a compact backend-owned planning step before final proposal prose generation on the active Mistral small/large path.

The planner returns structured JSON only and is not user-facing. The final writer then uses that plan plus the existing candidate context to produce the proposal.

## Why

The single-pass prose prompt had plateaued on the remaining hard cases:

- true no-context pseudo-history
- JD-to-candidate rewriting
- credential-fit inflation
- identity/status/background overreach
- weak-fit over-translation
- preset convergence in `engaging` and `storyteller`

These failures were increasingly caused by the model making too many decisions at once inside one prose prompt.

## Scope

This decision intentionally keeps scope narrow:

- no UI change
- no extension change
- no preset catalog redesign
- no auth / scraping / CV flow change
- no schema change for stored proposals
- no model/provider change

## Planner responsibilities

The planner classifies:

- context richness
- domain gap
- credential status
- transfer mode
- proof strategy
- opening strategy
- allowed concrete facts
- allowed transfer themes
- disallowed claims
- identity hard stops

## Implementation notes

- Prefer Mistral structured output via schema-backed JSON.
- If structured parsing fails, fall back to Mistral JSON mode plus server-side validation.
- Keep source-backed specificity intact by building a source fact bank from the current candidate context and constraining planner-selected concrete facts to that bank.
- Normalize the planner output server-side so no-context mode, preset-owned opening strategy, and hard-stop rules remain deterministic.

## Consequence

The final writer still uses the existing prompt family, but now receives a compact planning block that sharply reduces ambiguity before prose generation.
