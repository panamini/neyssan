# Proposal Forge Auto Tone And Resume Toolbar Audit

Date: 2026-04-01

Scope classification:
- Active code: `src/pages/ProposalForge.tsx`, `src/components/ProposalInputForm.tsx`, `convex/generateProposalMutation.ts`, `convex/lib/proposals/autoToneSelector.ts`, `src/features/verbati/VerbatiCvPreviewPanel.tsx`, `src/features/verbati/VerbatiResumePreview.tsx`, `src/components/ProposalArtifactInspector.tsx`, `src/components/EmbeddedStyleInspector.tsx`, `src/components/ProposalDisplay.tsx`, `src/components/ProposalsList.tsx`
- Legacy but informative: recent git history for the same active files
- Obsolete/dead code: not inspected beyond import boundaries

## Audit Summary

The live Proposal Forge generation pipeline already supports Auto as a `voicePreset: null` sentinel:
- `src/components/ProposalInputForm.tsx` builds `voicePreset: null` when no explicit preset is selected.
- `convex/generateProposalMutation.ts` treats `args.voicePreset === null` as an Auto request and resolves it through `selectAutoTone(...)`.
- `src/components/ProposalInputForm.tsx` describes Auto as “Adapt the tone to the client and context.”

The live blockers were on the client:
- The active Zod schema still required `voicePreset`, `formalityLevel`, and `creativity`, so Auto could be rejected before generation started.
- The live client also lost explicit Auto state during draft/output persistence and saved-proposal restore, which could silently rehydrate the toolbar as the resolved preset instead of the requested Auto selection.

For the resume preview toolbar, the live route is using the shared rail placement and shared drawer chrome classes. The current active implementation now constrains the resume workspace controls to the same interaction model as proposal output: `Style` and `Color` only, no extra drawer families.

## Root Causes

1. Auto state was serialized inconsistently.
- `StoredProposalComposeDraft` only typed `voicePreset` as `string`, while live compose snapshots wrote `null` for Auto.
- `normalizeStoredProposalComposeDraft(...)` only preserved string presets and dropped `null`.

2. Live form validation still treated Auto as invalid.
- `ProposalInputForm.schemas.ts` required `voicePreset`, `formalityLevel`, and `creativity` even though the active UI uses an unset preset to mean Auto.

3. Proposal Forge restore logic collapsed explicit Auto into fallback presets.
- Toolbar initialization used `??` fallback chaining, so `sourceComposeDraft.voicePreset: null` fell through to stored or resolved presets.
- Saved-proposal duplication used `requestedVoicePreset ?? savedProposalVoicePreset`, which turned a saved Auto request back into the resolved preset.
- The compose-draft restore path only rewrote `voicePreset` when the normalized preset was truthy, so explicit Auto (`null`) could not overwrite a stale explicit preset already in storage.

4. Resume preview controls had already been partially aligned in active code, but needed to stay constrained to the proposal drawer model.
- Recent active edits on `EmbeddedStyleInspector.tsx` and `VerbatiCvPreviewPanel.tsx` already move the live workspace toolbar to `Style` + `Color` only using the shared proposal drawer chrome.

## Git Evidence

- `96ff9a49` introduced the shared proposal/CV workspace toolbar and stage structure.
- `d702a37d` refined the shared color drawer anchoring behavior.
- `8c891236` adjusted active proposal workbench chrome without changing the Auto-tone server contract.

These commits support the conclusion that the live regression was in client state restore, not in the Convex generation resolver.

## Fix Set

1. Preserve explicit Auto through local draft and output-draft storage.
- Updated compose-draft typing to allow `voicePreset: null`.
- Updated output-draft compose normalization to preserve `voicePreset: null`.

2. Allow Auto through the real Proposal Forge submit path.
- Updated `ProposalInputForm.schemas.ts` so Auto no longer fails schema validation.
- Added a non-mocked submit-path test that exercises real `react-hook-form` + Zod validation and confirms `voicePreset: null` reaches generation.

3. Preserve explicit Auto through live Proposal Forge restore paths.
- Added a property-presence-aware toolbar preset resolver instead of nullish-fallback chaining.
- Preserved `requestedVoicePreset: null` when duplicating a saved proposal back into the live draft.
- Allowed the restored draft write to actively store `voicePreset: null`, replacing stale explicit presets.

4. Kept resume preview toolbar aligned with proposal output drawers.
- Active workspace preview uses `EmbeddedStyleInspector` with only `Style` and `Color` exposed.
- Shared drawer chrome and shared left-rail placement remain intact.

## Verification

Automated verification:
- `npx vitest run src/lib/__tests__/proposal-workspace-state.test.ts src/lib/__tests__/proposal-output-draft.test.ts src/pages/__tests__/ProposalForge.saved-view.test.tsx src/pages/__tests__/ProposalForge.workspace-toolbar.test.tsx src/components/__tests__/ProposalInputForm.provider-busy.test.tsx src/features/verbati/__tests__/VerbatiCvPreviewPanel.test.tsx src/features/verbati/__tests__/VerbatiResumePreview.test.tsx`
- Result: 7 files passed, 52 tests passed.

Coverage added/confirmed:
- Real ProposalInputForm submit accepts Auto and sends `voicePreset: null`.
- Auto survives compose-draft storage.
- Auto survives output-draft source compose storage.
- Saved proposal duplication back to live draft preserves `voicePreset: null`.
- Proposal Forge workspace toolbar still passes external Auto through to the compose form.
- Resume workspace preview exposes proposal-like `Style` and `Color` drawers without extra controls.

Manual verification:
- Attempted by starting a local Vite server for live inspection.
- Blocked because port binding required unsandboxed execution and approval was not granted.
