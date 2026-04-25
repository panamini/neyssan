# Proposal Compose / Preview Follow-Up Fix Plan

Date: 2026-04-01

## Goal

Apply the smallest active-path fix set for:

- Auto-tone generation being overridden in workspace mode
- Proposal and resume zoom control regression
- CV fit-page left crop
- Resume preview toolbar inconsistency

## Plan

1. Fix the live auto-tone authority path.
   - Keep `externalVoicePreset={null}` authoritative in `ProposalInputForm`.
   - Normalize restored toolbar preset values in `ProposalForge`.

2. Restore compact zoom controls on the active proposal and resume preview surfaces.
   - Use a compact `Fit` control with the zoom drawer.
   - Remove the larger proposal-only zoom mode popover.

3. Fix the CV fit-page crop at the layout layer.
   - Override the workspace resume stage alignment so the scaled A4 page is laid out from the top-left.

4. Reuse the shared style/color toolbar surface in CV workspace preview.
   - Keep only the shared style and palette drawers.

5. Re-run the focused unit and CSS tests for the touched live path.
