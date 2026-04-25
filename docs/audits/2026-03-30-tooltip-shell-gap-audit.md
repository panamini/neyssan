# Tooltip Shell-Gap Audit

Date: 2026-03-30

## Active Code

- `my-app/src/styles/product.css` already defined the 2px attached-surface token, but touched tooltips and drawers still mixed shell-edge and trigger-edge spacing.
- `my-app/src/features/verbati/VerbatiProposalWorkspace.tsx`, `my-app/src/components/ProposalArtifactInspector.tsx`, and `my-app/src/components/EmbeddedStyleInspector.tsx` still exposed browser-native `title` tooltips on touched toolbar controls.
- `my-app/src/pages/CvForge.tsx`, `my-app/src/components/ProposalDisplay.tsx`, and `my-app/src/components/ProposalComposeToolbar.tsx` used app tooltips, but some touched labels were still verbose instead of compact toolbar labels.

## Legacy But Informative Code

- Untouched tooltip patterns outside the requested surfaces still rely on older control-edge placement. They are informative, but not authoritative for the active CV Forge and proposal workbench chrome.

## Obsolete Or Dead Code

- No dead tooltip subsystem was revived in this pass. The deprecated behavior is the trigger-edge attachment rule itself for the touched chrome.

## Chosen Rule

- The only supported attached-surface offset rule for the touched toolbar chrome is `2px` from the outer shell edge.
- For padded toolbar and drawer shells, the rendered offset is therefore `shell padding + 2px` when a trigger sits inside the shell.

## Corrected In This Pass

- CV Forge now keeps the small preview and workspace preview on one shared CV style draft, with the same persisted `verbatiStyle` source backing both.
- The resume workspace rail now reserves a stable toolbar lane instead of overlaying the stage, so the preview chrome stops hopping between viewport behaviors.
- Touched proposal workspace, saved proposal, CV Forge, and resume style controls no longer rely on browser-native `title` tooltips.
- Compact app tooltip labels were restored for the touched zoom, style, color, copy, delete, cancel, and tone controls.
