# Preset Catalog Wiring Audit For Application Message And Freelance Proposal

Date: 2026-03-17

## Scope

- preset/tone wiring only
- `application_message`
- `freelance_proposal`
- comparison against already-stabilized premium `cover_letter`

## Active code findings

- Shared preset catalog still defines five presets in `convex/lib/proposals/voicePresets.ts`:
  - `signature`
  - `expert`
  - `direct`
  - `engaging`
  - `storyteller`
- UI filtering in `src/components/ProposalInputForm.tsx` previously existed only for premium ChatGPT cover letters.
- Backend normalization in `convex/generateProposalMutation.ts` previously resolved any valid preset token without format/model-specific support checks.

## Format audit

### Premium `cover_letter`

- Already intentionally restricted to:
  - `signature`
  - `expert`
  - `engaging`
- Existing UI fallback behavior already enforced that set.

### `application_message`

- Active ChatGPT path now uses the inline format-specific writer prompt.
- That prompt carries preset guidance directly, so all five presets remain explicitly represented.
- I did not find a preset-catalog mismatch that required reducing the set for this format.

### `freelance_proposal`

- Mistral paths still use the inline prompt and can carry all five presets.
- ChatGPT path still goes through the legacy technical-proposal service and only receives formality/creativity, not the preset identity itself.
- As a result, `signature`, `engaging`, and `storyteller` collapse to the same ChatGPT freelance baseline (`neutral` + `medium`), so showing all five in that mode is not truthful.

## Classification

- Primary issue: mixed `UI preset-catalog issue` + `backend preset-normalization issue`
- `application_message`: no meaningful preset-availability issue found
- `freelance_proposal` on ChatGPT: real format-to-preset-set coherence issue

## Narrow fix

- Keep premium `cover_letter` unchanged.
- Keep `application_message` on the full preset set.
- Restrict ChatGPT `freelance_proposal` to the explicit supported set:
  - `signature`
  - `expert`
  - `direct`
- Use one shared source-of-truth helper for supported preset ids and format/model-aware normalization.
