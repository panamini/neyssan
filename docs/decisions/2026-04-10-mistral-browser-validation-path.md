# Mistral Browser Validation Path

## Source of truth workflow

- Frontend runs locally.
- Convex stays on cloud/default unless `--local-convex` is explicitly used.
- Parser base is `https://parser.dasti.ai`.
- Standard validation launch path is `./run.sh up --ui`.

## Mistral button path

`my-app/src/components/StructuredUploadButton.tsx`  
→ `api.actions.structuredUpload.structuredUpload`  
→ `my-app/convex/actions/structuredUpload.ts`  
→ `canonicalizeParserResult(...)`  
→ `my-app/convex/lib/parsing/canonicalize.ts` / `canonicalizeExperience(...)`  
→ parser target `/mistral-ocr/parse`

## Local parser vs edge parser

- `scripts/start-dev.sh` refreshes the local parser container on `http://127.0.0.1:8001`.
- That does not change the browser validation path by itself, because the standard UI flow still points Convex to `https://parser.dasti.ai`.
- For browser validation, edge traffic must resolve through `cloudflared` to `cv-parser-service-dev`.

## `run.sh` startup gotcha

- The browser failure for Janice was not caused by the parser fix itself.
- `run.sh up --ui` had been starting `cv-parser-service-dev` from `cv-parser-service:latest` without mounting the workspace at `/app`.
- That left the real browser flow on stale parser code even when the workspace file `cv_parser/canonicalize.py` was already fixed.
- `run.sh` now replaces a stale parser container that lacks the `${ROOT_DIR} -> /app` bind mount and restarts it with the workspace mounted.

## Janice conclusion

- The Janice parser fix was correct.
- The real browser failure persisted only because the standard runtime path was stale until `run.sh` startup was fixed.

## Temporary diagnostics

- Temporary Janice diagnostics were added during debugging in:
  - `my-app/convex/actions/structuredUpload.ts`
  - `my-app/convex/lib/parsing/canonicalize.ts`
  - `cv_parser/canonicalize.py`
- Those temporary diagnostics should not stay as durable behavior after the runtime-path issue is confirmed.
- They have been removed after validation.
