**OCR Gap Review**

— Source of truth: docs/ocr-architecture-v1.md; TS addendum: docs/parsing-pipeline_addendum.md; Pipeline plan: docs/parsing-pipeline.md. Where an item is “Covered,” the supporting doc already specifies behavior; here we cite code/observable evidence only where useful. Note: docs/parsing-runtime-diagnosis.md not found in repo; the runtime checklist below reconstructs the intended checks from your request.

**1) Compliance Checklist — OCR Architecture vs Implementation**

- Selection Matrix (arm64 dev → docTR only; no auto flip to Paddle)
  - Status: ✅
  - Evidence: `cv_parser_service/main.py:284` forces `selected="doctr"` when requested, even if probe fails; never flips to Paddle. `cv_parser_service/main.py:292` only converts to `paddle_subproc` when selection is Paddle and arch is arm64.
  - Impact if missing: Confusing/incorrect engine use on arm64; hard-to-diagnose runtime behavior.
  - Recommendation: None.
  - Reference: docs/ocr-architecture-v1.md (Selection Matrix, Readiness rules) — Covered.

- linux/amd64 server defaults to Paddle; text PDFs short‑circuit to pdfplumber; Tesseract optional (off by default)
  - Status: ✅
  - Evidence: Default engine resolver returns Paddle on non‑arm (`cv_parser/extract/ocr_pdf.py:104`). Text‑dense PDFs route to text: `_analyze_pdf_bytes` + routing (`cv_parser_service/main.py:335`, `cv_parser_service/main.py:1225–1238`). Optional Tesseract fallback gates on `CV_TESSERACT_FALLBACK` env (`cv_parser/extract/ocr_pdf.py:1460–1510`).
  - Impact if missing: Unnecessary OCR usage on text PDFs; slower/less reliable results.
  - Recommendation: None.
  - Reference: docs/ocr-architecture-v1.md (Routing) — Covered.

- /ready contract exposes {engine, selected, available, reason}
  - Status: ✅
  - Evidence: `cv_parser_service/main.py:557–585` returns `{ ok, prewarm, ocr: { engine, selected, available, reason } }` with reasons sourced from probes (`cv_parser_service/main.py:271–281`).
  - Impact if missing: “No effect” confusion; hard to validate engine selection.
  - Recommendation: None.
  - Reference: docs/ocr-architecture-v1.md (Readiness & UX rules) — Covered.

- run.sh contract: flags and status mirror /ready; assert-ocr behavior
  - Status: ✅
  - Evidence: `run.sh:34–68` parses `--doctr/--paddle`; `run.sh:55–67` sets `CV_OCR_ENGINE`, arm64 `DOCTR_BACKEND=tensorflow`, `CV_ALLOW_DOCTR_ON_ARM=1`, `PREWARM=1`; no Paddle env is set for doctr. `run.sh:88–100` status prints `/ready`; `run.sh:117–176` `assert_ocr` accepts `doctr` or `pdfplumber` when docTR requested.
  - Impact if missing: Wrong engine path in dev; no easy verification.
  - Recommendation: None.
  - Reference: docs/ocr-architecture-v1.md (File responsibilities) — Covered.

- docTR backend pinning via `DOCTR_BACKEND=tf|pt`
  - Status: 🟡 (partial)
  - Evidence: Env is exported (`run.sh:55–67`, `scripts/start-dev.sh:589–612`); Doctr subprocess probe runs (`cv_parser_service/main.py:216–247`). The docTR subprocess itself does not pass a `framework`/backend param to `ocr_predictor` (`cv_parser/extract/ocr_pdf.py:250–277`).
  - Impact if missing: On arm64 with PyTorch-only site‑packages or SIGILL risk, docTR may select the wrong backend.
  - Recommendation: In Doctr subprocess script, honor `DOCTR_BACKEND` by setting predictor framework accordingly (tiny change; see plan §5).
  - Reference: docs/ocr-architecture-v1.md (Env & flags) — Covered.

- Paddle timeouts, subprocess guard, diagnostics
  - Status: ✅
  - Evidence: Subprocess worker + timeout (`cv_parser/extract/ocr_pdf.py:1178–1224`, `cv_parser/extract/ocr_pdf.py:1210–1233`), `CV_OCR_PADDLE_TIMEOUT` (`cv_parser/extract/ocr_pdf.py:1145–1151`), metrics & diagnostics (timeouts/crashes) in service (`cv_parser_service/main.py:407–443`, `cv_parser_service/main.py:460–490`).
  - Impact if missing: Hung OCR; unclear failure signals.
  - Recommendation: None.
  - Reference: docs/ocr-architecture-v1.md (Env & flags) — Covered.

- Native‑text short‑circuit and diagnostics fields (engine_attempted, engine_final, ocr_retry_count, pdf_pages_rendered)
  - Status: ✅
  - Evidence: Short‑circuit routing (`cv_parser_service/main.py:1225–1238`); top‑level diagnostics normalized (`cv_parser_service/main.py:1414–1473`), counters & pages rendered set (`cv_parser_service/main.py:709–733`, `cv_parser_service/main.py:1389–1473`).
  - Impact if missing: OCR overuse; non‑deterministic outcomes.
  - Recommendation: None.
  - Reference: docs/parsing-pipeline_addendum.md (Diagnostics Catalog) — Covered.


**2) Pipeline Plan vs Implementation (TS + Python)**

- Python stage hygiene (columns, heading locks, early noise) + diagnostics
  - Covered
  - Evidence: Two‑column reorder via median x0 and rail ordering (`cv_parser/canonicalize.py:1602–1643`); heading grouping/locks in `extract_sections` (`cv_parser/canonicalize.py:1478–1519`); early noise filters (`cv_parser/canonicalize.py:520–560`); emitted `section_order`, `noise_lines_removed`, `column_mode`, `engine_selection` (`cv_parser/canonicalize.py:1755–1787`, `cv_parser/canonicalize.py:1689–1738`).
  - Reference: docs/parsing-pipeline.md (Layout & Columns), docs/parsing-pipeline_addendum.md — Covered.

- TS hand‑offs and sequencing (cvMapper → normalize_cv → canonical)
  - Covered
  - Evidence:
    - Experience segmentation & diagnostics: `cvMapper.ts:1010–1100`, per‑entry `diagnostics.header_signals/date_range/counts/summarySource` set in `finalizeEntry` (`cvMapper.ts:1030–1062`).
    - Normalization & synthesis: caps/dedupe, summary synthesis + syncing `summarySource` on entry & diagnostics (`normalize_cv.ts:1–120`, `normalize_cv.ts:260–320`).
    - Final de‑bleed & validation: `canonical.ts:1–120`, `canonical.ts:120–240`, with `debleed_removed_count`, `validation.warnings/counts/needsReview`.
    - Orchestrator attaches defaults and preserves/fills diagnostics: `canonicalize.ts:3208–3264` (engine_selection fallback, defaults for `column_mode`, `noise_lines_removed`, `section_order`).
  - Reference: docs/parsing-pipeline_addendum.md (sequence) — Covered.

- Diagnostics catalog presence in final JSON
  - Covered
  - Evidence: `canonicalize.ts:3208–3264` merges `result.diagnostics` with defaults and returns under `diagnostics`; tests assert presence (`my-app/convex/lib/parsing/__tests__/canonicalize.test.ts:154–210`).
  - Reference: docs/parsing-pipeline.md (Diagnostics Catalog) — Covered.

- Deviations
  - docTR backend pin missing in Doctr subprocess (see §1, “docTR backend pinning”).
  - No other material deviation found; notably, no evidence of “re‑pushing” raw experience after segmentation (mapping only populates arrays; see `cvMapper.ts:300–360`, `cvMapper.ts:540–620`).


**3) “No Effect” Runtime Diagnosis (Why changes weren’t visible)**

Checklist (go/no‑go):
- Build vs runtime mismatch (old bundle/dist served)
  - Go: Vite dev uses live code; TS tests green; no static dist in dev path.
  - Caveat: If running a built app or a different env, verify which parser URL the UI uses (tunnel vs local) in `scripts/start-dev.sh` logs.

- Docker image/volume cache masking updated code
  - Risk: Medium. The parser runs in a container with bind‑mounted source (`scripts/start-dev.sh:648–676`), but uvicorn reload is off by default unless `--reload` is set. Code edits to Python won’t reflect until container restart or reload; TS changes are in the app, not the service.
  - Action: Restart container (`./run.sh down && ./run.sh up --doctr`) or run with `--reload` for Python hot‑reload.

- Env flags gating features at runtime
  - Not observed: The listed flags (`USE_NATIVE_TEXT_WHEN_AVAILABLE`, `ENABLE_SECTION_LOCKS`, etc.) are documentation toggles; current code does not gate behavior on them (searched under `my-app/convex/lib/parsing`).

- Case‑sensitive import issues (cvmapper.ts vs cvMapper.ts)
  - Not observed: Implementation uses `cvMapper.ts` consistently (`my-app/convex/lib/parsing/cvMapper.ts:1`).

- Duplicate module copies in monorepo
  - Not observed for parsing modules; only one canonical location under `my-app/convex/lib/parsing`.

- Late overwrite of structured `cv.experience`
  - Not observed: Mapping builds arrays once and downstream normalizes; no re‑push of raw sections into `experience` arrays found (`cvMapper.ts:300–360`, `normalize_cv.ts:1–120`).

- Python service alignment (correct instance; docTR/Paddle models available)
  - Confirm via `/ready` (`./run.sh status`) to ensure `{engine, selected, available, reason}` match expectations. If `selected=pdfplumber` with `engine=doctr`, docTR probe failed.

Do we need a Docker rebuild?
- Usually no for code‑only changes (bind mount). Yes if dependencies, Paddle/docTR site‑packages, or Dockerfile changed. For code changes to take effect, restart or run with `--reload`.

Minimum steps to force correctness
- `./run.sh down && ./run.sh up --doctr --reload` (dev, arm64)
- If dependencies changed: `./run.sh up --doctr --rebuild`
- Validate: `./run.sh status` → fields present; then `./run.sh smoke-ocr fixtures/fixturetest/cv_png.pdf`

Post‑fix verification keys to see in responses
- Top‑level: `diagnostics.engine_selection`, `diagnostics.column_mode`, `diagnostics.section_order`, `diagnostics.noise_lines_removed`, `diagnostics.debleed_removed_count`, `diagnostics.validation`.
- Per‑entry: `experience[i].diagnostics.header_signals/date_range/counts/summarySource`.


**4) Multi‑Fixture Test Coverage (Plan, not code)**

- Fixture classes (per docs/parsing-pipeline_addendum.md) — Covered
  - 2‑column native, single‑column native, noise‑heavy, OCR docTR, OCR Paddle, multilingual, year‑only dates, org‑only+ops verbs.
- Acceptance gates (high level)
  - Arrays present (responsibilities/achievements); synthesized summaries where needed.
  - Diagnostics keys present: `engine_selection`, `column_mode`, `section_order`, `debleed_removed_count`, `validation.warnings` reasonable.
  - OCR fixtures include `engine_attempted/final`, `ocr_retry_count`, `pdf_pages_rendered`.
- Commands
  - TS compile: `pnpm -w tsc --noEmit`
  - Focused tests: `pnpm vitest run my-app/convex/lib/parsing/__tests__/cvMapper.test.ts my-app/convex/lib/parsing/__tests__/canonicalize.test.ts --reporter=verbose`
  - Parser service: `./run.sh down && ./run.sh up --doctr --reload && ./run.sh status`
  - OCR smoke: `./run.sh smoke-ocr fixtures/fixturetest/cv_png.pdf`


**5) Minimal‑Risk Implementation Plan (if gaps exist)**

- ocr_pdf (docTR backend pin)
  - What: Pass framework based on `DOCTR_BACKEND` in the Doctr subprocess (e.g., `framework=("tf" if DOCTR_BACKEND in {"tf","tensorflow"} else "pt")`).
  - Why: Ensure stable docTR on arm64 (avoid PT SIGILL) and honor CLI contract.
  - Where: `cv_parser/extract/ocr_pdf.py:250–277` docTR script payload/kwargs.
  - Risk: Low; localized to subprocess; no API changes.
  - Validate: `./run.sh up --doctr && ./run.sh status` → `selected=doctr`; parse OCR PDF and inspect `diagnostics.engine_final`.

- Python hot‑reload/dev ergonomics
  - What: Prefer `--reload` for local dev or document restart requirement.
  - Why: Avoid “no effect” confusion when editing Python.
  - Where: Usage via `./run.sh up --doctr --reload`.
  - Risk: Low.
  - Validate: Edit a log line; confirm change without container restart.

- Diagnostics visibility check in UI path
  - What: Ensure consumers read the `diagnostics` returned by `canonicalize.ts` (already merged in `canonicalizeParserResult`).
  - Why: To surface engine/validation signals to users.
  - Where: UI consumers of canonicalized payload.
  - Risk: Low.
  - Validate: Snapshot of UI/API response contains the keys in §3 “Post‑fix verification”.

- TypeScript compile hygiene (only if current CI flags these)
  - TS7006 implicit any in canonicalize.ts: annotate inline callback params as `string` (e.g., `.map((s: string) => ...)`) on the lines from your error list.
  - TS2367 “org_first” mismatch in cvMapper.ts: not present in codebase; ensure no downstream checks reference a non‑existent union member.
  - TS2352 in skillsCanonical.ts: Already addressed; stoplist terms are flattened (see `skillsCanonical.ts:1–80`).

Acceptance criteria after changes
- docTR runs with TF backend on arm64 when requested; `/ready.ocr.selected=doctr` and OCR PDF yields `engine_final=doctr` or `pdfplumber`.
- For native PDFs, diagnostic `engine_selection.engine=\"native\"` and OCR not invoked.
- Per‑entry arrays present with counts; `summarySource` set and mirrored to diagnostics when synthesized.
- Top‑level diagnostics include `column_mode`, `section_order`, `noise_lines_removed`, `debleed_removed_count`, `validation.warnings`.
- TS tests pass; focused vitest suite green.


**6) (Optional) Doc adjustments to docs/ocr-architecture-v1.md (Proposed)**

- Note current state: docTR subprocess does not explicitly set the `framework` based on `DOCTR_BACKEND`; it relies on the installed backend. Proposed addition: “When `DOCTR_BACKEND` is set, the Doctr subprocess will pass `framework` to `ocr_predictor` (tf|pt).”
- Rationale: Aligns docs with intended behavior; very low risk; brings code and doc in complete sync.

**Key Sanity Answers**
- Are text‑based PDFs short‑circuited to pdfplumber? Yes — `cv_parser_service/main.py:1225–1238`.
- On arm64 dev, can the system ever route to Paddle without explicit request? No — selection honors `doctr` and does not auto‑flip (`cv_parser_service/main.py:284–301`).
- Is `/ready` exposing `{engine, selected, available, reason}`? Yes — `cv_parser_service/main.py:557–585`.
- Are responsibilities/achievements arrays reaching consumers (not overwritten)? Yes — arrays built in mapper (`cvMapper.ts:980–1100`), normalized (`normalize_cv.ts:1–120`), preserved in final validation (`canonical.ts:120–240`).
- Do tests cover multiple fixtures? Yes — under `my-app/convex/lib/parsing/__tests__/` (e.g., `canonicalize.test.ts`, `cvMapper.test.ts`, language tests); align with the matrix in docs/parsing-pipeline_addendum.md.

# ready
curl -sS $ORIGIN/ready | jq '{ok,ocr}'

# mistral probe
curl -sS -F file=@fixtures/fixturetest/cv_png.pdf $ORIGIN/mistral-ocr/probe | jq '{ok,diag}'

# mistral parse → expected diag fields
curl -sS -F file=@fixtures/fixturetest/cv_png.pdf $ORIGIN/mistral-ocr/parse \
  | jq '.diagnostics | {engine,engine_final,ocr_engine,ocr_chars,pages}'
