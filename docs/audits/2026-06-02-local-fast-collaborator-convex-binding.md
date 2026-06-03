# local-fast collaborator Convex binding audit

Date: 2026-06-02

## Finding

`./run.sh local-fast` is active local workflow code. It starts the parser, then starts local Convex through `start_convex`.

The collaborator failure happens because `start_convex` calls `resolve_convex_project_binding`, and the resolver previously depended on one of two machine-local states:

- a generated `CONVEX_DEPLOYMENT=... # team: <team>, project: <project>` comment in `my-app/.env.local` or `my-app/.env`
- exactly one existing local Convex backend under `~/.convex/convex-backend-state`

Both are untracked private state. A fresh collaborator can have neither, so the script exits before local Convex starts.

## Why it differs by machine

Your machine has enough private local Convex state for the fallback path to resolve. A fresh collaborator's machine does not. That makes `local-fast` non-reproducible from the repository alone.

## Repo readiness gap

Env example files were ignored by both root `.gitignore` and `my-app/.gitignore`, so the repository had no tracked first-time setup template for the required Convex binding.

## Change made

- `run.sh` now accepts explicit non-secret `CONVEX_TEAM` and `CONVEX_PROJECT` values from `.env.local`, `.env`, `my-app/.env.local`, or `my-app/.env`.
- The legacy generated Convex comment remains supported.
- The error now tells collaborators exactly which values to add.
- `.env.example` and `my-app/.env.local.example` are unignored and documented as shareable setup templates.

## Remaining owner action

Fill the real shared Convex `CONVEX_TEAM` and `CONVEX_PROJECT` slugs in each collaborator's private `.env.local`, or publish those non-secret slugs in the tracked `.env.example` if this repository is private and that exposure is acceptable.
