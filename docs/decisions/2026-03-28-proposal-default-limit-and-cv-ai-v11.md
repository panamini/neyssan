# Proposal Default Limit and CV AI v1.1

## Status
- Active code

## Summary
- Proposal generation keeps a single visible voice control: `Auto`, `Balanced`, `Formal`, `Warm`.
- `Auto` is a UI/default state only. It means the client sends no explicit preset override. The backend then falls back to the existing safe default tone resolution path.
- Proposal compose no longer exposes a character-limit dropdown. Generation now defaults to a hidden `1500` character target.
- Proposal output remains dual-mode: `Document` and `Plain text`.
- Document preview now allows a second page when content does not fit on one A4 page. The viewer remains scroll-based and caps the rendered stack at two pages.
- CV AI v1.1 uses inline suggestion rows for `Skills` and `Languages`, plus icon-only per-item AI actions for `Responsibilities` and `Achievements`.
- Editor/CV helper actions stay on lightweight helper models, not frontier generation models.

## Proposal Controls
- Visible compose controls:
  - resume picker
  - proposal type
  - voice preset
  - generate
- Hidden default length rule:
  - `characterLimitMode: "custom"`
  - `characterLimitValue: 1500`
- Users can still expand or compress the generated draft after generation through the editing/selection AI tools instead of pre-configuring multiple length presets in compose.

## Character Count Behavior
- The output surface shows live character count against the active target.
- Toast thresholds are platform-oriented:
  - `2000`: LinkedIn InMail range
  - `3000`: Upwork advisory range
  - `4000`: Indeed typed cover-letter limit
- These toasts are informational. They do not block editing.

## Proposal Tone Semantics
- Protected generation presets remain unchanged:
  - `Balanced` -> `signature`
  - `Formal` -> `expert`
  - `Warm` -> `engaging`
- Legacy preset families are not part of the visible UI surface.
- Additive tone-tuning controls are not part of the active compose UX.

## CV AI v1.1
- `Skills`
  - AI suggestions are requested explicitly by the user.
  - Suggestions render inline as accept/dismiss chips.
  - Source inputs: experience + education.
  - Server narrows suggestions through the compact skills taxonomy shortlist before prompting.
- `Languages`
  - Same inline suggestion-row pattern as skills.
  - Source inputs: summary + experience + education.
  - Accepted suggestions create language rows with a default `Intermediate` level.
- `Responsibilities`
  - Each experience entry exposes an icon-only AI action in the modal.
  - AI returns a diff that must be accepted or discarded before apply.
- `Achievements`
  - Each achievement line exposes an icon-only AI action.
  - AI returns a line-level diff with explicit accept/discard.

## Runtime Contract
- `runCvSectionAiAction` is the canonical backend boundary for CV helper actions.
- New action literals include:
  - `generate_skills_suggestions`
  - `generate_language_suggestions`
  - `improve_experience_responsibilities`
  - `improve_achievement_line`
- If the browser reports an `ArgumentValidationError` for those literals, the active Convex runtime is stale relative to the checked-in source. Refresh the backend contract with `npx convex codegen` or restart `npx convex dev`.

## Model Routing
- Proposal generation still uses the main generation path and its existing model policy.
- Helper/editor/CV AI actions use the helper-model router:
  - OpenAI helper primary: `gpt-5-mini`
  - OpenAI light/default helper fallback in config: `gpt-5-nano`
  - Mistral helper primary: `mistral-small-latest`
- Frontier `gpt-5.4` is not the intended default for these short CV/editor refinement actions.
