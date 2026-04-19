# Mainrestore Preview Restoration Scratchpad

## Context

Goal: bring the better `mainrestore` resume preview behavior back into the active backup-based PR1-PR6 architecture without broad restores, without reviving legacy paths, and without losing newer workspace token wiring.

Working branch: `codex/backup-minus-snapshot-mainrestore-adapt`

## Process Summary

1. Compared `backup`, `mainrestore`, and the post-PR6 history to separate safe restores from noisy backup-only regressions.
2. Reintroduced selected `mainrestore` preview commits into the current architecture instead of replacing large files.
3. Kept workspace/runtime token names from the backup-derived branch where they were still current authority.
4. Treated shell/container/toolbar/zoom and workshop pagination as separate buckets.
5. Verified the workshop zoom bug at the rendered boundary instead of continuing speculative patches.

## What Went Wrong During Adaptation

- Several preview fixes transferred cleanly from `mainrestore`, but workshop preview still behaved like the bad backup path.
- Static code review alone was misleading because the stage layout and the workshop renderer each looked plausible in isolation.
- A previous gap-scaling patch was a false move and was reverted.

## Winning Boundary

The real regression was in the workshop renderer contract, not in the page-gap math itself.

`ResumeTemplateRenderer.tsx` was scaling the inner A4 page with `transform`, but the transformed page still owned unscaled layout height in fit mode. That made:

- rendered stack height larger than the canvas
- visible page geometry drift from page-count geometry
- first-page visibility and overflow behavior unstable
- zoom appear to dilute/narrow content because visual scale and layout scale diverged

## Fix Applied

- Made the workshop page shell own the scaled width/height.
- Positioned the transformed A4 page absolutely inside that shell.
- Added a focused test locking that shell-vs-inner-page contract.
- Moved preview wheel interception off the passive React wheel path and onto a native non-passive listener on the viewport node.

## Verified Result

Rendered browser probe on seeded `/cv?id=...` workshop preview:

- before fix: fit-mode canvas height `3084px`, rendered workshop stack `4562px`
- after fix: fit-mode canvas height `3084px`, rendered workshop stack `3084px`
- page shells align to the visible scaled page height
- page gap stays stable at `24px`

## Current State

- Workshop preview geometry is back on a coherent rendered boundary.
- The unrelated dirty `AGENTS.md` change was left untouched.
- Next priority should be styled PDF export authority: confirm the styled resume export path is using the current workspace model/token pipeline and not falling back to ATS/basic export behavior.
