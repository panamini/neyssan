# Local-Fast Dev Mode

## Decision

- Make `./run.sh local-fast` the recommended parser-development command.
- Keep `./run.sh local-convex` as a compatibility alias to the same implementation.
- Treat `./run.sh tunnel` as the stable validation path and `./run.sh rebuild-docker` as the explicit stable image rebuild path.

## Why

- The full local import problem is caused by server-side Convex actions resolving parser origin independently from the frontend.
- Frontend-only local parser config is insufficient because `structuredUpload` chooses its parser target server-side from Convex env/runtime.
- Daily parser iteration needs workspace-mounted Python reload, not image rebuilds.

## Consequences

- `local-fast` uses local parser + local Convex + local Vite as one aligned workflow.
- `local` remains available for partial local work, but is not the recommended full structured-upload workflow.
- Stable runtime parity still belongs to `tunnel` and `rebuild-docker`.
