# Proposal Style Twin Linkage Plan
Date: 2026-03-26

## Goal
- Make proposal rendering inherit the real Style Forge style preset and persist that styling per proposal.

## Plan
1. Normalize the proposal template set around resume twins.
   Keep the proposal layout system proposal-specific, but map it to named twins of the active resume layouts.
2. Feed the resume style preset into the proposal renderer.
   Use the existing Verbati theme var pipeline so proposal paper, ink, accent, and font families stop floating on generic app tokens.
3. Persist a proposal style snapshot end-to-end.
   Add `verbatiStyle` to the local draft and saved proposal metadata contract.
4. Rehydrate saved proposals from their own metadata.
   Saved library cards and focused proposal views must render from the stored style snapshot, not the current workspace theme.
5. Verify with focused checks.
   Run TypeScript, targeted proposal display tests, and refresh the Convex schema/codegen artifacts.
