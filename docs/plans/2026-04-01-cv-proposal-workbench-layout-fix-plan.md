# CV / Proposal Workbench Fix Plan

Date: 2026-04-01

## Goal

Repair the active CV Forge / Proposal Forge workbench layout with the smallest correct change set, using only live render-path evidence.

## Plan

1. Trace the live route tree from `App.tsx` into `/cv` and `/proposal`.
2. Identify the final winning layout and preview rules in active CSS and component state logic.
3. Check recent git history for workspace/layout regressions before editing.
4. Patch only the active workbench path:
   - proposal toolbar sizing
   - proposal preview rail and zoom modes
   - CV workspace preview zoom/anchor behavior
   - very narrow mobile sidebar removal
5. Add focused regression tests for the touched behaviors.
6. Save audit and plan docs.

## Completed

- live route tracing completed
- git regression review completed
- minimal fix set implemented in active code
- focused regression tests added and passing
- audit saved under `docs/audits/`

## Deferred

- full live browser re-check after patch

Reason:

- local frontend launch for manual runtime verification was not permitted in this session
