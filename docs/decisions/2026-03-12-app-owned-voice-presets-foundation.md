# App-Owned Voice Presets Foundation

Date: 2026-03-12

## Decision

- Proposal voice presets are now backend-owned and limited to exactly five ids:
  - `signature`
  - `expert`
  - `direct`
  - `engaging`
  - `storyteller`
- Presets remain lightweight modifiers over one shared proposal-generation baseline.
- Explicit `formalityLevel` and `creativity` values still override preset baseline values, but they do not disable preset-specific guidance.
- Proposal Forge exposes the preset selector as the main tone control.
- Existing formality and creativity controls remain temporarily available as secondary advanced controls.
- The app owns the saved default preset in `userProfiles.proposalVoicePreset`.
- Each saved proposal stores the resolved `voicePreset`, `formalityLevel`, and `creativity` used for generation so regenerate remains faithful.

## Active Code

- `convex/lib/proposals/voicePresets.ts`
- `convex/lib/proposals/effectiveTone.ts`
- `convex/generateProposalMutation.ts`
- `convex/proposalSettings.ts`
- `src/components/ProposalInputForm.tsx`
- `src/components/ProposalsList.tsx`

## Legacy But Informative

- `src/services/tone-service.ts`
- `src/services/proposal-handler.ts`

## Explicitly Out Of Scope

- Voice Profile upload
- Smart Match or preset auto-selection
- Intensity sliders
- Separate prompt systems per preset
- Extension preset UI
- Handoff payload changes
- Migration of legacy `tonePreference` or `writingStyle`
- Large tone architecture rewrites

## Reasoning

- Tone and style needed one app-owned source of truth without reopening the stable auth, scraping, CV sync, or handoff work.
- A backend preset catalog keeps semantics consistent across app surfaces and leaves the extension simple in phase 1.
- Storing the resolved preset and effective tone values on each proposal preserves regenerate fidelity for both new and existing rows.
