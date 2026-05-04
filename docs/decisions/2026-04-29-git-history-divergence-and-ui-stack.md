# Decision: Keep the UI Refactor Stack Off `main` Until History Is Reconciled

Date: 2026-04-29
Status: Accepted

## Context
- During PR1, local `main` and `origin/main` no longer shared a common ancestor.
- The local branch history used to build the UI refactor stack is `codex-ui-refactor`.
- PR1 was opened from `codex-ui-refactor-pr1`, branched from `codex-ui-refactor`.
- The remote `origin/main` was force-updated to a different root snapshot.

## Verified Facts
- The two root histories differ only in:
  - `my-app/env.md`
  - `my-app/mistral_integration_backend.md`
- The content delta is limited to cleanup of example API-key text.
- The divergence is a branch-history issue, not a broad code fork.

## Decision
- Keep all remaining UI refactor work stacked on `codex-ui-refactor` and its child branches.
- Do not use local `main` as the base for new refactor work until the branch history is intentionally reconciled.
- Do not force-push or rewrite `origin/main` unless that is an explicit, reviewed decision.
- If a clean `main`-based PR is required later, create a fresh branch from `origin/main` and bridge the refactor stack once, at the end.

## Consequences
- PRs stay reviewable without cherry-picking every branch.
- The refactor stack remains isolated from the divergent `main` history.
- Future collaborators and automation should treat `codex-ui-refactor` as the integration line for this UI refactor until the branch histories are merged or reset on purpose.
