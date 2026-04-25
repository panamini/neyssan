# Dev Startup Parser Fallback

## Status
Accepted on 2026-03-28.

## Context
- `npm run dev` and `npm run dev:frontend` were failing before React finished booting.
- The failure path was the parser bootstrap chain:
  - `my-app/scripts/ensure-parser-and-run-frontend.mjs`
  - `scripts/start-parser-service.sh`
  - `scripts/start-dev.sh`
- `scripts/start-dev.sh` no longer supported the legacy `--service-only` contract still used by app bootstrap scripts.
- On this machine, Docker was also unavailable, so parser startup could not succeed locally.
- When the app did load through raw Vite, there was no evidence of an infinite render loop. The main browser-side boot noise was an unauthenticated `activeCvSnapshots:setCurrent` mutation from `CvLibraryContext`.

## Decision
- Restore legacy-compatible `--service-only` support in `scripts/start-dev.sh`.
- Make parser bootstrap opt-in in development:
  - `my-app/scripts/ensure-parser-and-run-frontend.mjs` no longer auto-starts local parser services unless `STRUCTURED_UPLOAD_AUTO_BOOTSTRAP_PARSER=1`
  - if no parser URL is already available, the frontend still launches and parser-backed upload flows degrade gracefully
- Keep parser startup best-effort when explicitly requested:
  - if Docker is unavailable and no healthy fallback parser is reachable, continue launching the frontend without parser-backed upload features
  - do not crash the whole app because the parser is unavailable
- Gate active CV snapshot sync in `CvLibraryContext` behind Clerk auth readiness and signed-in state.

## Consequences
- `npm run dev:frontend` can start the UI without immediately kicking off a Docker parser build.
- Developers can still opt into parser bootstrap explicitly with `STRUCTURED_UPLOAD_AUTO_BOOTSTRAP_PARSER=1`.
- Upload/parser flows remain degraded until a parser URL is actually available.
- Anonymous boot no longer emits `Not authenticated` snapshot mutation errors.
- This fix addresses startup stability; it does not claim there are no future UI performance issues on deeper user flows.
