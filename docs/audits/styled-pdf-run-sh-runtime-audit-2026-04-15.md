# Styled PDF `run.sh` Runtime Audit

Date: 2026-04-15

## Scope

Audit two regressions without changing `run.sh` first:

1. `metadata.verbatiStyle` rejected during CV import/persistence
2. Styled resume PDF export returning `500` on the shared-renderer path

## Runtime Topology

Active code:

- `run.sh`
  - starts Vite on the host with `--host 127.0.0.1 --port 5173`
  - starts the parser in Docker as `cv-parser-service-dev`
- `cv_parser_service/document_export.py`
  - runs the Node/TS worker inside the parser runtime
- `my-app/scripts/document-export-worker.ts`
  - for styled resume PDF, injects payload and loads `/print/resume`

Observed runtime mapping:

| Surface | Location |
| --- | --- |
| Preview app / Vite | host |
| Parser API | Docker container |
| Styled PDF worker | Docker container |
| Print route URL used by worker | `http://host.docker.internal:5173/print/resume` |

## Findings

### 1. `verbatiStyle` import failure

Classification: active code bug

Root cause:

- `my-app/src/schemas/cvDocument.schema.ts` used a strict metadata schema that did not recognize `metadata.verbatiStyle`

Effect:

- `normalizeAndValidateCvDocument(...)` failed during `importCv(...)`
- style preset persistence failed in:
  - `my-app/src/features/verbati/VerbatiCvPreviewPanel.tsx`
  - `my-app/src/features/verbati/useBoundVerbatiCvStyle.ts`

Fix:

- add `verbatiStyle` to the strict metadata schema

### 2. Styled PDF 500 was not a `run.sh` root-cause issue

Classification: active code/runtime bugs

`run.sh` was audited and reverted to its pre-audit state first.

The actual failure chain was:

1. Worker import bug
   - `my-app/scripts/document-export-worker.ts` imported `buildResumePrintRoutePayload` from the wrong module
   - actual error:
     - `SyntaxError: ... export-renderers does not provide an export named 'buildResumePrintRoutePayload'`

2. Playwright API mismatch
   - worker used `page.emulateMediaType("print")`
   - runtime Playwright exposed `page.emulateMedia(...)`
   - actual error:
     - `TypeError: page.emulateMediaType is not a function`

3. Vite host allowlist blocked the parser container
   - from inside the parser container:
     - `http://host.docker.internal:5173/print/resume` returned `403`
   - actual response body:
     - `Blocked request. This host ("host.docker.internal") is not allowed.`
   - this prevented the real app from booting in the worker browser, so readiness never advanced and the worker timed out

4. Resulting worker symptom
   - `page.waitForFunction` timed out waiting for `__DASTI_RESUME_PRINT_STATUS__ === "ready"`

## Fixes Applied

### Reverted before audit

- `run.sh`
  - removed provisional `DOCUMENT_EXPORT_FRONTEND_URL`
  - removed provisional `host.docker.internal` Docker host mapping
- `scripts/start-dev.sh`
  - removed the same provisional startup-script wiring

### Kept fixes

- `my-app/src/schemas/cvDocument.schema.ts`
  - accept `metadata.verbatiStyle`

- `my-app/scripts/document-export-worker.ts`
  - import `buildResumePrintRoutePayload` from `document-export-models`
  - use `page.emulateMedia({ media: "print" })`

- `my-app/vite.config.ts`
  - allow `host.docker.internal` in `server.allowedHosts`
  - allow `host.docker.internal` in `preview.allowedHosts`

## Verification

Automated:

- `npx vitest run src/lib/__tests__/normalize-cv.metadata.test.ts src/lib/__tests__/document-export-models.test.ts src/pages/__tests__/ResumePrintPage.test.tsx src/lib/__tests__/exportDocumentFile.test.ts`
- `npx tsc --noEmit -p tsconfig.json --pretty false`

Runtime:

- parser container can resolve `host.docker.internal`
- parser container now receives `200` from `http://host.docker.internal:5173/print/resume`
- live styled export repro against `http://127.0.0.1:8001/api/v1/document-export/resume/pdf` returns:
  - `200 OK`
  - `Content-Type: application/pdf`

## Decision

The correct fix location was not `run.sh`.

The final fix stayed at the actual failure boundaries:

- schema acceptance for `verbatiStyle`
- worker module/API compatibility
- frontend dev-server host allowlist for the shared print route
