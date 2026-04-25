# Proposal Runtime Restore And UI Backport

Date: 2026-03-31

## Active vs Legacy

- Active runtime target: `src/pages/ProposalForge.tsx`
- Donor/reference only during migration: `src/pages/ProposalForgeNext.tsx`
- Saved proposal browser source of truth: `src/components/ProposalsList.tsx`

## Runtime Decision

- `/proposal` is restored to `ProposalForge`
- `/proposal-next` stays a redirect to `/proposal`
- `ProposalForgeNext` remains in-tree temporarily as a donor/reference, not a routed page
- No duplicate backup page file is created; git history is the backup

## Parity Checklist

- [x] generate -> resume -> proposal persistence
- [x] saved proposal -> back to draft
- [x] saved proposal -> copy to draft
- [x] save button behavior stays on the draft runtime instead of a donor page
- [x] sidebar active proposal continuity
- [x] sidebar active resume continuity via `currentCvId` fallback
- [x] handoff/import continuity
- [x] CV selection continuity from proposal workspace
- [x] Playwright end-to-end path for Proposal -> Resume -> Proposal
- [x] saved-proposal browser roundtrip with a deterministic live saved fixture

## UI Backport Inventory

### Adopted from `ProposalForgeNext`

- current `ProposalInputForm`
- current `ProposalDisplay`
- current document-stage / chrome behavior already used by `ProposalDisplay`
- `ProposalComposeToolbar` as a live workspace-level CV/tone toolbar for `ProposalForge`
- `ProposalArtifactInspector` as a live document-header style/palette control for `ProposalForge`
- `ProposalBriefCard` as a live compose-column brief summary for `ProposalForge`

### Rejected from `ProposalForgeNext`

- page-level saved-view hydration model
- page-level left/right panel orchestration
- page-level compose collapse state model

Each item above must be reduced to a presentational/stateless plug-in before adoption into `ProposalForge`.

## Migration Notes

- The old `ProposalForge` already carries the stronger saved vs compose route model and explicit copy-to-draft logic.
- Restoring the old runtime is the shortest path back to predictable proposal/resume workspace continuity.
- Missing explicit saved-view controls were reintroduced on the old page:
  - `Back to draft`
  - `Copy to draft`
- Browser coverage now exists for the seeded Proposal -> Resume -> Proposal workspace roundtrip in `e2e/proposal-workspace-roundtrip.spec.ts`.
- The live runtime now uses the donor `ProposalComposeToolbar` as the workspace-level CV/tone host while `ProposalInputForm` keeps document type and generate inside the compose sheet.
- The live runtime now uses `ProposalArtifactInspector` as a header-level style and color control, backed by the existing draft output state instead of the donor page's panel orchestration.
- The live runtime now uses `ProposalBriefCard` as a compose-side brief summary and focus handoff, without reviving the donor page's saved-view hydration or panel state model.
- The roundtrip spec was updated to use the toolbar-based attached-CV trigger and configured serially to avoid known parallel-worker flake on sidebar return clicks.
- Saved proposal browser coverage now uses a deterministic local fixture seam via `dasti:proposal-saved-fixtures:v1`, which lets the live saved route and the sidebar roundtrip be verified in guest/dev browser runs without depending on Convex-sourced saved records.
- `ProposalForgeNext` is now treated as archived donor code only; live navigation, sidebar state, and route contract coverage are all anchored to `ProposalForge`.

## Final Removal Checklist For `ProposalForgeNext`

- [x] all parity checklist rows are green
- [x] donor-only components needed by `ProposalForge` have been extracted or adopted
- [x] no live route imports `ProposalForgeNext`
- [x] route-level tests no longer depend on `ProposalForgeNext` for live behavior
- [x] cleanup pass removes `ProposalForgeNext` or archives it with a documented decision
