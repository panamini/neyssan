# Proposal Style Twin Linkage Audit
Date: 2026-03-26

## Scope
- Audit why proposal rendering drifted away from the resume style system.
- Fix the live proposal preview going flat/white.
- Add a real per-proposal linkage for template, typography, and color.

## Active Code
- `src/features/verbati/style.ts`
  Authoritative source for the resume style preset, typography families, palette accent, and theme variables.
- `src/features/verbati/VerbatiStyleWorkspace.tsx`
  Active Style Forge owner. It already persisted the authoritative `verbatiStyle` into the CV metadata.
- `src/pages/ProposalForge.tsx`
  Active compose/runtime proposal output owner. Before this pass it stamped only `metadata.templateId`.
- `src/components/ProposalDisplay.tsx`
  Active proposal sheet shell. Before this pass it did not consume the resume style preset at all.
- `src/components/proposal-render/ProposalDocumentRenderer.tsx`
  Active proposal document renderer. Before this pass it handled layout geometry only.
- `src/components/ProposalsList.tsx`
  Active saved proposal viewer/editor. Before this pass it rendered saved proposals without any saved style snapshot.
- `convex/schema.ts`, `convex/proposals.ts`, `convex/proposalsPublic.ts`, `convex/updateProposalPublic.ts`
  Active persistence contract for proposal metadata.

## Legacy But Informative Code
- `convex/lib/proposals/proposalRenderer.ts`
  Still informative for generated letter structure, but not authoritative for client-side document styling.

## Obsolete / Dead Code
- `src/ProposalGenerator.tsx`
  No live route or active usage in the proposal runtime.
- `src/services/proposal-handler.ts`
  Documentation residue, not part of the active proposal render path.

## Blunt Findings
1. The white/flat render was structural, not incidental.
   Proposal sheets were still driven by generic app tokens and a static paper token, while resume rendering already had a dedicated theme var pipeline.
2. Proposal layout state and proposal style state were split.
   `templateId` existed, but the actual resume style preset was never stamped onto proposals or passed into the renderer.
3. Saved proposals had no historical style fidelity.
   The library could remember `templateId`, but not the typography/palette snapshot that the user actually used when the proposal was generated.
4. Style Forge proposal mode was only half-linked.
   It controlled proposal template selection, but proposal preview still ignored the authoritative resume style preset that Style Forge itself owned.
5. The cleanest architecture was additive.
   The resume style preset already existed and was already persisted on the CV. Proposal runtime only needed a saved style snapshot plus a twin-template mapping, not a rewrite.

## Recommended State Placement
- Authoritative live style: CV `metadata.verbatiStyle` in Style Forge.
- Live compose bridge: browser `proposal-output-draft` with `proposalVerbatiStyle`.
- Saved proposal historical snapshot: `proposals.metadata.verbatiStyle`.
- Saved proposal layout snapshot: `proposals.metadata.templateId`.
- Proposal template default: keep `proposalSettings` for current user selection, but normalize legacy template ids into the new twin template set.

## Implemented Outcome
- Proposal paper, ink, accent, and font families now read from the same Verbati style preset family as the resume system.
- Proposal templates now exist as resume twins rather than generic letter skins.
- Proposal metadata now stores both `templateId` and `verbatiStyle`.
- Saved proposal rendering now rehydrates its own style snapshot instead of borrowing the current global app theme.
