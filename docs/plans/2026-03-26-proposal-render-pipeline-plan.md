# Proposal Render Pipeline Plan
Date: 2026-03-26

## Goal
- Add a real proposal template/render pipeline that connects Style Forge to generated proposal output at runtime.

## Plan
1. Add a shared proposal template contract.
   Extend the Convex settings and proposal metadata contracts with a proposal template id.
2. Refactor proposal rendering onto a renderer map.
   Keep the existing sheet shell, but replace the plain letter preview with template-driven document rendering.
3. Wire the live proposal surfaces.
   Feed the active template into `ProposalForge`, stamp it onto saved proposal metadata, and render saved proposals through the same template path.
4. Add Style Forge proposal mode.
   Keep the resume workspace intact, add a persisted render-mode toggle, and mount a proposal template picker plus live proposal preview that reads the real draft/library data.
5. Verify.
   Run TypeScript and focused component tests against the proposal display path.
