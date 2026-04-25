# Proposal Preview / Auto-Tone Fix Plan

Date: 2026-04-01

## Goal

Apply the smallest live-path fix set for proposal preview scaling, CV fit-page centering, toolbar consistency, collapsed sidebar alignment, Proposal List cleanup, and auto-tone verification without changing the backend generation contract.

## Plan

1. Keep the auto-tone request contract intact.
   - Treat `voicePreset: null` as authoritative Auto mode.
   - Verify with focused tests instead of rewriting the generation pipeline.

2. Fix proposal preview initial load scaling.
   - Change `ProposalDisplay` initial zoom mode to `fit-width`.

3. Fix CV fit-page centering.
   - Keep top-left anchoring for workspace editing modes.
   - Re-center only when the workspace switches to `fit-page`.

4. Reuse the shared style/color toolbar component.
   - Extend `EmbeddedStyleInspector` so proposal output can reuse it with proposal bundle options.
   - Replace proposal-output/list `ProposalArtifactInspector` usage on active surfaces.

5. Clean the saved proposals mobile chrome.
   - Remove the rendered `Focus selected proposal` and `Open proposal library overview` buttons.

6. Stabilize collapsed sidebar footer alignment.
   - Reorder the tool cluster above the avatar in collapsed mode.

7. Remove likely focus-frame noise on load.
   - Neutralize focus outlines on the proposal viewer shell / selected card container.

8. Verify with focused tests.
   - Proposal preview default zoom
   - CV fit-page centering
   - Shared inspector rendering
   - Proposal List cleanup
   - Auto-tone request contract
