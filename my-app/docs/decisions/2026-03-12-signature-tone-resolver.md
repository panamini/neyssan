# Signature Tone Resolver

Date: 2026-03-12

## Decision

- The active proposal-generation boundary owns default tone resolution.
- The backend resolves effective tone before prompt construction and now applies the explicit `signature` preset at that boundary.
- Missing tone values use a single Signature baseline:
  - `formalityLevel: "neutral"`
  - `creativity: "medium"`
- Valid explicit values from Proposal Forge remain authoritative.
- Narrow legacy normalization is limited to known invalid values observed in active callers, currently `creativity: "standard"` -> `"medium"`.
- The saved-proposal regenerate flow no longer hardcodes the legacy `technical` branch or explicit tone defaults.

## Scope Kept Intentionally Unchanged

- No Proposal Forge UI changes
- No profile preference migration or re-interpretation
- No auth, scraping, CV context, handoff, or model-selection redesign

## Reasoning

- The backend needed to name the live default explicitly without turning tone into a larger preset system.
- Proposal Forge already exposes explicit tone choices and those should continue to be respected.
- A resolver at the backend boundary fixes missing/legacy inputs without broadening into a tone-system rewrite.
- The regenerate path was still nudging generation back toward legacy output behavior, so it needed a small alignment pass.
