# Proposal Workspace Screenshot UX Audit

Date: 2026-04-01

Scope:
- Active Proposal Forge and CV Forge workspace routes only
- Screenshot review plus active code inspection
- No archive or dead-code analysis

Reference guideline:
- Vercel Web Interface Guidelines: <https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md>

## Active Code Evidence

1. Proposal workspace chrome is intentionally left-anchored.
   - `src/pages/ProposalForge.tsx` renders the compose toolbar inside `dasti-workbench-top-left-slot--proposal`.
   - `src/pages/CvForge.tsx` renders the preview/edit toggle inside `dasti-workbench-top-left-slot--cv`.
   - This creates a consistent workspace anchor on the left edge of the shell.

2. The main proposal artifact is rendered inside a fixed document stage.
   - `src/components/ProposalDisplay.tsx` uses `useDocumentStageLayout(...)` for preview sizing.
   - The document rail and preview shell are separate from the left workbench toolbar.

3. The current split proposal layout can visually separate the brief card from the toolbar anchor.
   - `src/pages/ProposalForge.tsx` uses a two-column `dasti-grid-split` with a max-width compose column and a flexible output column.
   - When the output is visually dominant, the brief card can feel stranded between the toolbar anchor and the centered document shell.

4. CV mini preview overflow on mobile came from the embedded stage being clamped while the embedded frame was not.
   - `src/styles/product.css` already clamped `.resume-page-stage`.
   - `src/features/verbati/resume/resume-preview.css` still gave `.resume-page-frame` a `width: max(100%, var(--preview-stage-width, 100%))`.

## UX Findings

### 1. The proposal toolbar must stay in one stable left workspace position.

Status:
- Correct pattern.

Reason:
- The toolbar is workspace chrome, not document chrome.
- If it shifts toward the centered document card, the user loses the spatial anchor between compose, preview/edit controls, and the left-side workbench logic.

Recommendation:
- Keep Proposal and CV top-left controls aligned to the same left workspace slot.
- Do not make the toolbar chase the centered preview card.

### 2. The main output artifact should be the dominant focal point, and it currently loses that role.

Observed from screenshots:
- The preview card is too tall for the visible block.
- The user must scroll before the artifact is comfortably legible as a whole.
- The surrounding negative space is large, but it is not serving the document because the first visible crop hides too much of the artifact.

Impact:
- The system asks the user to judge output quality before showing enough of the output.
- That weakens confidence and slows evaluation.

Recommendation:
- In read-only proposal preview, fit the document stage by containment rather than width-only sizing.
- If the rendered document exceeds the available block height, preserve inner scrolling on the document stage instead of clipping it.

### 3. The brief card/header is visually disconnected from the left toolbar anchor.

Observed from screenshots:
- The toolbar sits at the far upper-left.
- The brief card begins noticeably lower and farther inward.
- On wide canvases, the brief feels like a floating island rather than the first step in the proposal workflow.

Impact:
- The user’s scan path becomes fragmented:
  1. toolbar far left
  2. brief lower and inward
  3. preview further right

Recommendation:
- Treat the left toolbar as the system anchor.
- Keep the brief card optically aligned with that left compose column.
- Any spacing reduction should tighten the compose/output stack without relocating the toolbar itself.

### 4. Compose and output should feel like coordinated peers, not equal-weight twins.

Assessment:
- They do not need to be exactly the same size.
- The proposal output should usually carry more visual weight than the brief once content exists.

Better rule:
- Align them at the top.
- Keep the compose column disciplined and narrower.
- Let the output column be visually dominant, but not so tall that the document is cropped on first read.

### 5. The mini CV render should never exceed its frame on mobile.

Status:
- This was a real layout defect, not a taste issue.

Recommendation:
- Clamp both the stage and the frame widths in non-workspace embedded mode.
- Keep workspace mode free to use the larger canvas rules.

## Product Direction

Recommended hierarchy for Proposal Forge:
1. Left workspace toolbar = stable anchor.
2. Brief card = first content block aligned to the compose column.
3. Proposal preview = dominant artifact with full first-glance readability.

Recommended hierarchy for CV Forge:
1. Left preview/edit toggle = stable anchor.
2. Editor content = primary task in edit mode.
3. Mini preview = persistent support artifact, never overflowing its shell.

## Changes Applied In This Pass

1. Preserved the stable left-anchored proposal toolbar behavior by reverting the uncommitted frame-centering change.
2. Updated proposal preview sizing to use the read-only contain-fit path and expose overflow scrolling when stacked page height exceeds the available stage.
3. Clamped embedded CV preview frames on non-workspace paths so the mobile sheet cannot exceed its container width.

## Remaining Recommendation

I did not further reposition the brief card or compress the proposal shell spacing in this pass because the priority was to restore behavior and fix regressions first.

If you want the next visual polish pass, the right next move is:
- tighten the compose/output vertical rhythm while keeping the toolbar anchored left
- align the brief card more explicitly to the compose column start
- reduce first-view cropping pressure before touching any larger information architecture
