# Proposal Render Pipeline Audit
Date: 2026-03-26

## Scope
- Build a real proposal render pipeline for Style Forge and generated proposal output.
- Exclude CV template work.

## Active Code
- `src/pages/ProposalForge.tsx`
  Owns the live generated proposal output state, local output draft persistence, and compose-view output rendering.
- `src/components/ProposalInputForm.tsx`
  Owns proposal generation requests and already persists proposal voice preset via `proposalSettings`.
- `src/components/ProposalDisplay.tsx`
  Owns the actual proposal output shell used in compose and saved views. Before this change it only had one text-shell renderer.
- `src/components/ProposalsList.tsx`
  Owns saved proposal rendering and editing.
- `convex/proposalSettings.ts`
  Owns user-level proposal defaults. Before this change it only stored `voicePreset`.
- `convex/updateProposalPublic.ts`, `convex/proposalsPublic.ts`, `convex/proposals.ts`, `convex/schema.ts`
  Own the saved proposal persistence contract and public query shape.
- `src/features/verbati/VerbatiStyleWorkspace.tsx`
  Owns Style Forge. Before this change it was resume-only.

## Legacy But Informative Code
- `convex/lib/proposals/proposalRenderer.ts`
  Active for generation-time boundary insertion, but not authoritative for client-side document templates. Informative because it guarantees salutation, closing, and name lines for cover letters.

## Obsolete / Dead Code
- `src/ProposalGenerator.tsx`
  No active route or import path points to it.
- `src/services/proposal-handler.ts`
  Referenced only by documentation, not by the active app runtime.

## Blunt Findings
1. There was no proposal template contract anywhere in the app state.
   `userProfiles`, `proposalSettings`, `proposals.metadata`, and the local proposal output draft had no field for a proposal template id.
2. Style Forge had no proposal mode.
   `VerbatiStyleWorkspace` only exposed resume styling controls and resume preview state.
3. Proposal output had a shell, not a template system.
   `ProposalDisplay` rendered a single sheet with plain text and a small letter spacer. There was no renderer mapping or template picker.
4. The real runtime bridge already existed in two pieces.
   Compose output lived in `ProposalForge` local draft storage, while saved proposals lived in Convex. That made a split persistence model possible without a rewrite.
5. The clean persistence split was missing.
   A proposal template must exist both as a user default for live cross-page reactivity and as stamped proposal metadata for historical fidelity in the library.

## Recommended State Placement
- User default: `userProfiles.proposalTemplateId`, exposed through `proposalSettings`.
- Per-proposal stamp: `proposals.metadata.templateId`.
- Live unsaved draft bridge: local proposal output draft storage in the browser.
- Style Forge page mode switch: local browser storage only.

## Why This Path Fits The Current Architecture
- It reuses the existing proposal settings channel instead of inventing a new store.
- It keeps Proposal Forge and Proposal Library on the same `ProposalDisplay` renderer.
- It avoids touching CV persistence or CV renderer contracts.
- It stays additive and reversible.
