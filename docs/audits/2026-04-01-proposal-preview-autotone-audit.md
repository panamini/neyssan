# Proposal Preview / Auto-Tone Audit

Date: 2026-04-01

## Scope

Active code reviewed:

- `src/pages/ProposalForge.tsx`
- `src/components/ProposalInputForm.tsx`
- `src/components/ProposalDisplay.tsx`
- `src/components/ProposalsList.tsx`
- `src/components/Sidebar.tsx`
- `src/features/verbati/VerbatiResumePreview.tsx`
- `src/components/EmbeddedStyleInspector.tsx`
- `convex/generateProposalMutation.ts`

Legacy but informative:

- `src/pages/ProposalForgeNext.tsx`

Obsolete/dead for this task:

- Archive and backup trees not imported by the active routes

## Findings

### 1. Auto-tone pipeline

Status: active code verified

- The server already treats `voicePreset: null` as the explicit auto-tone path.
- In `convex/generateProposalMutation.ts`, `args.voicePreset === null` triggers `selectAutoTone(...)` before prompt construction.
- The current frontend request builder still sends `voicePreset: null` for Auto and omits explicit `formalityLevel` / `creativity`, which matches the intended contract.
- I did not find an authorization gate tied to auto-tone. The generation path and auth checks are separate.

Conclusion:

- The intended behavior is: Auto sends `null`, the server resolves the preset, generation proceeds normally.
- The client-side fix here is verification coverage rather than a pipeline rewrite.

### 2. Proposal preview initial scaling

Status: active bug

- `ProposalDisplay.tsx` still initialized desktop preview zoom to `actual`.
- That caused refresh / first paint to reopen the proposal oversized inside a correctly sized shell.

Root cause:

- The initial zoom mode favored document actual size instead of container fit.

### 3. CV workspace fit-page centering

Status: active bug

- `VerbatiResumePreview.tsx` top-left anchored the workspace viewport for every workspace zoom mode.
- That was correct for editor-style `fit-width` and manual zoom, but wrong for `fit-page`.

Root cause:

- `defaultCenterX/defaultCenterY` never switched back to centered positioning for fit-page.

### 4. Toolbar consistency

Status: active inconsistency

- Proposal output surfaces still used `ProposalArtifactInspector`.
- CV preview uses `EmbeddedStyleInspector`.

Root cause:

- Two separate toolbar implementations were shipping on active routes for similar style/color controls.

### 5. Collapsed sidebar footer alignment

Status: active bug

- In collapsed mode, the footer tools remained in normal flow after the profile button.

Root cause:

- The collapsed footer CSS centered the stack, but did not reorder the tool cluster above the avatar.

### 6. Proposal List cleanup

Status: active cleanup item

- Proposal List still rendered the mobile `Focus selected proposal` and `Open proposal library overview` buttons.

Root cause:

- The saved-view mobile control block was still mounted even though the gesture/view-mode system already existed underneath.

### 7. Green frame on load

Status: probable active bug

- I could not reproduce this visually in a live browser in this session, but the most plausible active cause in the live path was focus outline on the selected proposal card / viewer shell during selection and load transitions.

Root cause treated:

- Explicitly removed focus outlines from the viewer shell / selected proposal card container in the active CSS path.

## Git / regression notes

- The preview zoom and workspace anchoring behavior remained the live root cause after the earlier March 31 workbench fixes.
- No newer git evidence contradicted the current server-side auto-tone contract; the backend still expects `null` for Auto.
