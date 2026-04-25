# Proposal Toolbar And Auto-Tone Follow-Up Plan

Date: 2026-04-01

## Goal

Apply the smallest live-path fix set for:

- proposal output toolbar regression
- resume workspace toolbar consistency
- Auto-tone visibility confusion
- restored compact zoom drawer expectations

## Plan

1. Re-check active proposal and resume render paths only.
2. Revert proposal output surfaces to the git-backed `ProposalArtifactInspector`.
3. Keep resume workspace on compact style/color controls only.
4. Preserve `Auto` as a selectable tone and stop relabeling it in the output meta.
5. Update focused tests around the restored magnifier-trigger zoom drawer and inspector surfaces.
6. Run the targeted test set.

## Result

Completed on 2026-04-01.
