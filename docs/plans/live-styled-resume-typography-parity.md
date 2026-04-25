# Live Same-Export Typography Parity Audit and Fix

## Summary
- Audit only active code. The live `documentAppearance` source is `my-app/src/lib/layout/documentAppearance.ts`; there is no active `my-app/src/features/verbati/documentAppearance.ts`.
- If `http://127.0.0.1:5173/cv` or `http://127.0.0.1:8001/ready` are down, start the stack with `./run.sh local-fast` before any live audit.
- Replace the current preset-differentiation harness flow with a same-export audit for one active CV and one actual `Export Styled PDF` click.
- Prove the first divergence boundary in order: UI preset/state -> preview vars/computed fonts -> export request body -> worker bootstrap payload -> `/print/resume` computed fonts -> print-route screenshot immediately before `page.pdf()` -> exact PDF bytes returned by the click -> PDF page 1 raster.
- The audit must save and rasterize the exact PDF bytes returned by the real `Export Styled PDF` click, not only a replayed request.
- The print-route screenshot immediately before `page.pdf()` is mandatory for every audit run, not conditional.
- If the user provides the exported PDF file they are viewing, the audit must verify that file matches the captured export artifact by hash/path before drawing conclusions.

## Implementation Changes
- `CvForge.tsx`, `VerbatiResumePreview.tsx`, `resume-font-debug.ts`
  - Add a debug-only capture path that records the active CV id, selected style preset, resolved typography id, resolved `rendererVariantId`, preview CSS vars, and computed heading/body font families for the exact export being clicked.
  - Expose the last styled-export capture on `window` behind a debug flag so the harness can read the real click payload and the exact returned PDF bytes from the actual export request.
  - Extend the debug snapshot beyond heading/body probes to include one inherited body-text node and one explicit heading node so wrapper inheritance bugs are visible.
- `document-export-models.ts`, `ResumePrintPage.tsx`, `document-export-worker.ts`
  - Preserve the exact styled export payload through `buildStyledResumePrintSource` -> `buildResumePrintRoutePayload` -> worker init script with no alternate style path.
  - Capture and expose the worker bootstrap payload and the `/print/resume` snapshot immediately before `page.pdf()`.
  - Capture a mandatory print-route screenshot immediately before `page.pdf()` on every audit run.
  - If print and raster still differ after font parity is proven, compare the mandatory pre-`page.pdf()` screenshot against the rasterized PDF to isolate the worker/PDF boundary.
- `run-resume-font-parity-harness.ts`, `ResumeFontParityHarnessPage.tsx`, `PdfRasterHarnessPage.tsx`
  - Convert the harness from “preset A vs preset B” to “same export across preview vs print vs raster”.
  - Add an explicit active-document input for audit mode: `--cv-id` or full `/cv?id=...` URL. If absent, fail loudly instead of silently falling back to the fixture.
  - Persist one artifact set per audit run: `ui-export-request.json`, `preview.json`, `worker-bootstrap.json`, `print-route.json`, `returned-export.pdf`, `preview.png`, `print-route-pre-pdf.png`, `pdf-raster-page-1.png`, `diff-preview-vs-print.json/png`, `diff-print-vs-raster.json/png`, and `summary.json`.
  - If the user provides the exported PDF file they are viewing, verify that file matches the captured export artifact by hash and path before drawing conclusions.
  - Write the human audit report to `docs/audits/`.
- `ResumePage.tsx`, `resume-preview.css`
  - Fix only the first proven non-twin boundary.
  - Start with the strongest live candidate already visible in the code: some resume text still relies on inherited `font-family` while the selected font pair is only carried as CSS vars on wrappers. Normalize the resume surface so unspecified copy inherits the selected body font consistently, while explicit heading/editorial/mono rules remain intact.
  - Only patch more local variant blocks if the same-export audit proves a narrower divergence than page-level inheritance.

## Test Plan
- Add unit coverage for `resume-font-debug.ts` so snapshots include typography id, CSS vars, computed heading/body families, inherited-node families, and any provided exported-PDF verification metadata.
- Add unit coverage for `document-export-models.ts` so styled resume export payloads and print-route payloads preserve the same `stylePreset` and `rendererVariantId`.
- Add `ResumePrintPage` coverage so the ready snapshot is emitted after `document.fonts.ready` and the pre-`page.pdf()` screenshot hook is always available.
- Add a DOM/CSS test around `ResumePage` or `resume-preview.css` proving the resume surface establishes the selected base body font family without overriding explicit heading/editorial/mono rules.
- Run the live same-export audit and prove:
  1. Preview computes the expected heading/body fonts.
  2. `/print/resume` computes the same heading/body fonts for that same export.
  3. Preview screenshot vs mandatory pre-`page.pdf()` print-route screenshot either matches or identifies the exact wrapper/inheritance divergence.
  4. Mandatory pre-`page.pdf()` print-route screenshot vs rasterized PDF page 1 either matches or identifies the exact worker/PDF divergence.
  5. The saved `returned-export.pdf` is the exact PDF bytes from the real click, not a replay artifact.
  6. If the user supplied a viewed PDF file, its hash/path verification result is recorded before any verdict.

## Assumptions
- Active code only: `my-app/*` resume preview/print/export files are authoritative; `pdf-ingest/`, backups, and legacy parser trees are not.
- Existing `tmp/resume-font-parity/*` artifacts are informative but not proof for this task because they compare different presets on each surface, not preview vs print vs raster for the same export.
- The active-CV audit will require a reproducible CV identifier (`cvId` or full `/cv?id=...` URL) for a fresh session; if that cannot be supplied or restored, the implementation should stop with a clear error rather than substitute a fixture.
- If the user supplies the exported PDF they are viewing, that file becomes part of the audit chain and must be verified against the captured export artifact before any conclusion about divergence.
- No second style system, export-only font override, or fallback renderer will be introduced.
