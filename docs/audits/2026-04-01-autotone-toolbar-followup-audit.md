# Proposal Toolbar And Auto-Tone Follow-Up Audit

Date: 2026-04-01

## Scope

Active code only:

- `src/pages/ProposalForge.tsx`
- `src/components/ProposalsList.tsx`
- `src/features/verbati/VerbatiCvPreviewPanel.tsx`
- `src/components/ProposalDisplay.tsx`
- `src/features/verbati/VerbatiResumePreview.tsx`
- `convex/generateProposalMutation.ts`
- `convex/lib/proposals/autoToneSelector.ts`

## Findings

### 1. Auto-tone is still a real backend path

`generateProposalMutation.ts` still treats `voicePreset === null` as the explicit Auto path and resolves it through `selectAutoTone(...)`.

This means Auto was not removed from the generation pipeline.

### 2. Auto-tone is narrower than the UI suggests

`selectAutoTone(...)` currently chooses among the existing presets from:

- job title keywords
- job description keywords
- whether personalization context exists
- whether personalization richness is marked as `rich`

It does **not** do deep tone selection from the full CV, profile, or a rich candidate narrative model.

Current behavior:

- technical-role keywords -> `expert`
- relationship / marketing keywords -> `engaging`
- rich personalization context -> `expert`
- otherwise -> `signature`

### 3. The main live regression was in the proposal toolbar surface, not in auto-tone itself

The active compose output and Proposal List surfaces had been switched from the older `ProposalArtifactInspector` to `EmbeddedStyleInspector`.

That introduced the wrong style/color interaction model for the proposal output toolbar.

### 4. Resume workspace needed the compact style/color surface

The resume workspace toolbar was exposing the extra refine/customize path instead of the compact style/color-only controls the user was referencing.

### 5. Auto looked broken in the UI because the meta line was showing the resolved preset

The live compose output meta line was rendering the resolved preset label (`Formal`, `Warm`, `Natural`) even when the user had explicitly chosen `Auto`.

That made Auto appear as if it had not been selected.

## Fix Summary

- Restored proposal compose output toolbar to `ProposalArtifactInspector`
- Restored Proposal List output toolbar to `ProposalArtifactInspector`
- Kept resume workspace on the compact `Style` / `Color` surface and hid extra refine/prompt controls
- Preserved Auto as an explicit selectable mode
- Changed proposal output meta labeling so requested `Auto` stays visible as `Auto`
- Kept the restored compact zoom drawer model with magnifier trigger and `Fit` inside the drawer

## Verification

Focused tests covering the live path passed after the changes:

- `src/pages/__tests__/ProposalForge.artifact-inspector.test.tsx`
- `src/components/__tests__/ProposalsList.toolbar-grouping.test.tsx`
- `src/components/__tests__/ProposalDisplay.test.tsx`
- `src/features/verbati/__tests__/VerbatiResumePreview.test.tsx`
- `src/features/verbati/__tests__/VerbatiCvPreviewPanel.test.tsx`
- `src/components/__tests__/ProposalInputForm.provider-busy.test.tsx`
- `src/pages/__tests__/ProposalForge.workspace-toolbar.test.tsx`

Manual browser verification is still pending.
