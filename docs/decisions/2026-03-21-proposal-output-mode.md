# Proposal Output Mode

Date: 2026-03-21

## Status

Accepted

## Decision

Adopt **Option B** for the active `Proposal` compose flow.

- Left panel stays a compose shell.
- Right panel stays a single A4/root-2 proposal sheet.
- The right sheet exposes a single `Pencil` icon toggle inside the same document header:
  - inactive in preview
  - highlighted in edit
- Clicking the preview body can surface a lightweight hint toast that points the user to the pen icon.
- Edits made in `Edit` mode update the local compose state immediately and persist back to the generated draft on blur.
- `Imported from LinkedIn · View source` lives below the compose shell, right-aligned and ghosted.
- The attached resume chip lives below the compose shell on the left.

## Rationale

- Keeps one canonical document surface instead of duplicating preview and edit as two separate pages.
- Preserves compare-and-adjust workflow because the compose shell remains visible.
- Reduces extra medium-neutral wrappers around the proposal output.
- Keeps the output header lighter than a segmented text control while preserving discoverability.
- Keeps the `Saved` view compatible with the same document-first logic, even if its left title card remains.

## Active Code

- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/pages/ProposalForge.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalDisplay.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalInputForm.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css`
