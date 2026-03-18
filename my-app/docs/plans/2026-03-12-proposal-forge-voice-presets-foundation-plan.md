# Proposal Forge Voice Presets Foundation Plan

Date: 2026-03-12

## Goal

Add the smallest safe foundation for app-owned voice presets while keeping Proposal Forge, regenerate, and extension handoff behavior stable.

## Plan

1. Add a backend-owned preset catalog with conservative baseline mappings and short overlay guidance.
2. Extend proposal generation to accept optional `voicePreset` while keeping `formalityLevel` and `creativity` backward-compatible.
3. Save the user default preset in `userProfiles.proposalVoicePreset` through a small `proposalSettings` query/mutation surface.
4. Make the preset selector the main Proposal Forge tone control and move current formality/creativity controls into a temporary advanced section.
5. Persist `voicePreset`, `formalityLevel`, and `creativity` on new proposals so regenerate can replay the original tone inputs safely.
6. Keep extension handoff unchanged in phase 1. Proposal Forge should inherit the saved app preset after handoff load.

## Guardrails

- Never invent candidate experience, tools, industries, metrics, seniority, or authority.
- Preserve requested format, structure, and length.
- Keep all presets in the same human, credible, grounded product family.
- Keep `storyteller` controlled and grounded on `neutral` + `medium`.

## Scope Kept Intentionally Small

- No extension code changes in phase 1
- No preset-specific prompt systems
- No automatic preset switching
- No second layer of tuning controls
