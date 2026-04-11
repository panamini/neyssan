# Mistral Browser Validation Path

## Source of truth workflow

- Standard validation path is `./run.sh up --ui`.
- Frontend runs locally.
- Convex stays on cloud/default unless `--local-convex` is explicitly used.
- Parser base is `https://parser.dasti.ai`.
- Validation entrypoint is the Mistral OCR button hitting `/mistral-ocr/parse`.

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

- `run.sh up --ui` can leave the browser path on stale parser code if the edge parser container is not bind-mounted to the workspace at `/app`.
- The live check is the edge parser behind `https://parser.dasti.ai`, not the local parser process.
- If browser behavior disagrees with local parser tests, verify the bind-mounted runtime first.

## Experience trust ladder

- Trust order is:
  - parser typed experience
  - raw-sections fallback
  - text/narrative fallback
- Active app-side boundary is:
  - `canonicalizeParserResult(...)`
  - `canonicalizeExperience(...)`

## Janice conclusion

- The Janice parser fix was correct.
- The real browser failure persisted only because the standard runtime path was stale until `run.sh` startup was fixed.

## Farman conclusion

- Farman required both parser-side and app-side fixes.
- Parser side had to trim non-experience contamination and prefer the stronger current-job narrative line.
- App side had to preserve the live source text that reached canonicalization and recover narrative experience from weak raw-section fallbacks.

## First-upload / restart-gap / button-freeze conclusion

- First-upload failures were a runtime readiness problem, not a parsing-quality problem.
- The real issues were:
  - restart-gap requests against the edge parser
  - Mistral probe results being treated as a hard UI disable
- Durable behavior is:
  - probe on click
  - allow server-side retries/recovery
  - do not freeze the OCR route on transient probe failures

## Temporary diagnostics

- Temporary diagnostics were used during the Janice/Farman sequence to prove runtime path, source-family presence, and fallback decisions.
- They should not remain in the durable path unless intentionally reintroduced for a specific incident.
