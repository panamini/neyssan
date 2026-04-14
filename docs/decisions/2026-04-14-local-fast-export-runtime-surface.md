# Local-Fast Export Runtime Surface

## Decision

- Keep `./run.sh local-fast` on workspace-mounted parser runtime with `uvicorn --reload`.
- Preserve image-installed export/runtime dependencies in workspace mode by shielding:
  - `/app/node_modules`
  - `/app/my-app/node_modules`
- Keep `./run.sh local-convex` as a legacy alias, but remove it from the short helper banner.

## Why

- The export worker launches through `tsx` inside the parser container and resolves `playwright` from container node modules.
- Binding the whole repo over `/app` exposed host macOS `node_modules` to the Linux container.
- The proved failure was an `esbuild` platform mismatch: the worker saw `@esbuild/darwin-arm64` instead of the Linux package required by the container runtime.

## Consequences

- `local-fast` keeps fast Python reload and regains export support without a rebuild for ordinary parser edits.
- Runtime/package surface changes still require `./run.sh rebuild-docker`.
- `tunnel` remains the stable end-to-end validation command.
