# Proposal Compose Surface Direction

Date: 2026-03-21

## Decision

The generated proposal and saved proposal content keep the document-style A4-like viewport.

The compose input does not.

Instead, the compose input uses:

- a shorter document shell
- auto-height growth up to a bounded max height
- internal scroll after that point
- a compact attach-style resume selector with a paperclip trigger, passive truncated label, and explicit clear action

## Why

- The output is a document artifact and benefits from a document ratio.
- The input is an assistant-like drafting surface and should be immediately usable without forcing a full-page scroll before interaction.
- This keeps the app closer to a chat/assistant interaction model while preserving the proposal document canon on output surfaces.

## Active code

- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalInputForm.tsx`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/components/ProposalInputForm.module.css`
- `/Volumes/video/kay/app/pouraurelien/save/implementation_UI/neyssan/my-app/src/styles/globals.css`

## Deferred

The broader family of canonical card/sheet aspect ratios across dialogs, libraries, and editors remains a separate design-system decision.
