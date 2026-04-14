# Local-Fast Export Compatibility

## Summary

- Keep `./run.sh local-fast` as the fast parser-development workflow with workspace-mounted Python autoreload.
- Restore export support by preserving the image-installed Linux runtime dependencies that the export worker needs.
- Keep `./run.sh tunnel` as the stable validation path and `./run.sh rebuild-docker` as the explicit runtime rebuild path.

## Implementation

- Update `run.sh` workspace parser startup to bind-mount the repo at `/app` while protecting:
  - `/app/node_modules`
  - `/app/my-app/node_modules`
- Add a workspace-runtime preflight after parser readiness to verify:
  - `tsx` loader under `/app/my-app/node_modules`
  - `playwright` package under `/app/node_modules`
  - Playwright browser install under `/ms-playwright`
  - platform-matching `@esbuild/<platform-arch>` under `/app/my-app/node_modules`
- Keep export endpoints and worker code unchanged.
- Clean the short helper banner so it highlights `tunnel`, `local-fast`, `parser-dev`, `rebuild-docker`, `down`, `reset`, `status`, and `logs`.
- Keep `local` and `local-convex` only in long help and README compatibility notes.

## Validation

- `OPEN_BROWSER=0 ./run.sh local-fast`
  - app serves on `http://127.0.0.1:5173`
  - parser ready on `http://127.0.0.1:8001/ready`
  - CV import still succeeds from the real UI
  - resume ATS PDF returns 200
  - resume styled PDF returns 200
  - proposal ATS PDF returns 200
  - proposal styled PDF returns 200
  - proposal DOCX returns 200
  - parser Python edits reload without `./run.sh rebuild-docker`

## Assumptions

- The failure is a workspace-runtime masking problem, not an export-pipeline design problem.
- JS dependency changes, Dockerfile changes, and runtime dependency changes still require `./run.sh rebuild-docker`.
