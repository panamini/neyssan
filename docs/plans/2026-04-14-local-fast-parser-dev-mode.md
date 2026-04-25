# Local-Fast Parser Dev Mode

## Summary

- Add `./run.sh local-fast` as the recommended fast full-app parser-development mode.
- Build it on the local Convex path so both the browser and server-side `structuredUpload` resolve the local parser.
- Keep `./run.sh tunnel` as stable validation and `./run.sh rebuild-docker` as the explicit stable image rebuild path.

## Implementation

- `run.sh`
  - add `local-fast_stack()`
  - keep `local-convex` as a compatibility alias
  - start parser with workspace mount + autoreload
  - start local Convex before Vite
  - use discovered local Convex state when available, with `3210/3211` as fallback sanity checks
  - fail fast on disabled local deployments or occupied local Convex ports
- `my-app/convex/actions/structuredUpload.ts`
  - normalize local loopback candidates and fallbacks to `http://127.0.0.1:8001`
  - preserve parser target logging for verification
- `my-app/src/lib/exportDocumentFile.ts`
  - normalize local export fallback to `http://127.0.0.1:8001`

## Validation

- unit tests cover parser-resolution and export fallback on `8001`
- runtime acceptance for `./run.sh local-fast`
  - parser healthy on `127.0.0.1:8001`
  - local Convex healthy
  - Vite serves the app
  - `structuredUpload` logs show local parser selection
  - Python parser edits reload without Docker rebuild
