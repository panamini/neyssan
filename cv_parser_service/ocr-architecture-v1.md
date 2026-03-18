# Resume Parser OCR Architecture — v1.0 (Source of Truth)

## Goals

- arm64 (local dev): run docTR only for image/PDF OCR. Never auto‑flip to Paddle.
- linux/amd64 (server): run Paddle (+subprocess guard) for OCR.
- text‑based PDFs: always route to pdfplumber, no neural OCR.
- Tesseract: optional last‑ditch fallback (off by default).
- Readiness: `/ready` surfaces requested vs selected engine and probe reason without silently changing selection.

## Routing (high level)

```mermaid
flowchart TD
  A[Request /parse-cv] --> B{Payload kind}
  B -->|JSON/text OR PDF with text| T[TEXT MODE -> canonicalize.py via pdfplumber text]
  B -->|PDF image-only| C{Platform & requested engine}

  C -->|arm64 & request=doctr| D[Select docTR (backend: PT or TF)]
  C -->|linux/amd64 OR request=paddle| E[Select Paddle (subprocess on arm64; in-proc on amd64)]

  D --> F{docTR success?}
  F -->|yes| G[Normalize + map (canonicalize.py, ts mappers)]
  F -->|no| H{Fallbacks (arm64)}
  H -->|pdfplumber text present| G
  H -->|else if enabled| I[Tesseract minimal] --> G
  H -->|else| J[Return empty with diagnostics]

  E --> K{Paddle success?}
  K -->|yes| G
  K -->|no| L{Fallbacks (amd64)}
  L -->|pdfplumber text present| G
  L -->|else if enabled| I --> G
  L -->|else| J
```

## Selection Matrix (authoritative)

| Platform    | Requested  | Selected (must be)                     | Fallbacks allowed                 |
| ----------- | ---------- | -------------------------------------- | --------------------------------- |
| arm64       | doctr      | doctr                                   | pdfplumber → (optional) tesseract |
| arm64       | auto/blank | doctr                                   | same as above                     |
| arm64       | paddle     | paddle_subproc (dev only, discouraged)  | pdfplumber → tesseract            |
| linux/amd64 | auto/blank | paddle                                   | pdfplumber → tesseract            |
| linux/amd64 | doctr      | doctr if available else pdfplumber       | pdfplumber → tesseract            |

> No automatic flip from docTR→Paddle on arm64. If docTR probe fails, `selected=doctr`, `available=false`, `reason=<probe error>`; execution still uses docTR and surfaces errors cleanly.

## Env & flags (canonical)

- `CV_OCR_ENGINE=auto|doctr|paddle|tesseract`
- `CV_ALLOW_DOCTR_ON_ARM=1` (arm64 dev to bypass guard)
- `DOCTR_BACKEND=tensorflow|pt` (arm64: recommend `tensorflow` to avoid PyTorch SIGILL; this is passed through to the docTR subprocess via `DOCTR_BACKEND`)
- `PREWARM=1` (on `--doctr` or `--paddle`)
- `CV_TESSERACT_FALLBACK=1` to opt-in to Tesseract last-resort fallback (authoritative). Legacy `CV_OCR_DISABLE_TESSERACT_FALLBACK` is deprecated.
- Paddle worker safety (server): `CV_OCR_PADDLE_TIMEOUT=20` (or 60), `OPENBLAS_CORETYPE=ARMV8` (arm), `LD_PRELOAD` OpenBLAS if needed.

## File responsibilities

- `run.sh`
  - Parse options only for `up`.
  - `--doctr` ⇒ export `CV_OCR_ENGINE=doctr`, `CV_ALLOW_DOCTR_ON_ARM=1`, `PREWARM=1`, (arm64) `DOCTR_BACKEND=tensorflow`. Do not set Paddle worker env.
  - `--paddle` ⇒ export `CV_OCR_ENGINE=paddle`, set Paddle worker env (server).
  - `status` prints `{engine, selected, available, reason}` from `/ready`.
  - `assert-ocr FILE.pdf` (when doctr requested) validates `engine_final == doctr` (or `pdfplumber` if docTR failed) and `pdf_pages_rendered >= 1` and `pdf_text_len >= 5`.

- `cv_parser_service/main.py`
  - `_probe_doctr()` / `_probe_paddle()` lightweight subprocess checks with timeouts.
  - `_refresh_ocr_selection()`:
    - If arm64 & requested=doctr ⇒ `selected="doctr"` regardless of probe outcome; set `available=false` + `reason` when probe fails (no auto‑flip).
    - Else follow matrix above.
  - `/ready` returns:
    ```json
    { "ok": true, "ocr": { "engine": "<requested>", "selected": "<selected>", "available": true|false, "reason": "..." } }
    ```
  - `/parse-cv` OCR branch uses `selected` as decided above (don’t coerce docTR→Paddle on arm64). pdfplumber short‑circuit remains for text‑dense PDFs.

- `cv_parser/extract/ocr_pdf.py`
  - `resolve_effective_ocr_engine()` respects env.
  - `DoctrOCREngine` forwards `DOCTR_BACKEND=tf|pt` into the subprocess environment and passes the `framework` hint to `ocr_predictor`; cached weights live under the shared `HF_HOME` path.
  - When `selected_engine == "doctr"`: never attempt Paddle fallback. Allow `pdfplumber`, then optional Tesseract when `CV_TESSERACT_FALLBACK=1`.
  - Keep adaptive retries (DPI bump, tilt/orientation). Always set diagnostics fields: `engine`, `engine_final`, `pdf_pages_rendered`, `ocr_blocks`, `ocr_chars`, `failure_reason?`.

- Canonicalization & mapping (`canonicalize.py`, TS mappers)
  - Keep the shared label blocklist and positional bias improvements.
  - Name extraction: prefer short, capitalized header candidates; never accept blocklisted labels (“Email/Details”).
  - Return `null` for name rather than polluted headings.

## Readiness & UX rules

- Never lie: Do not mark Paddle as selected on arm64 when `--doctr` was requested. Show docTR unavailability in `/ready.ocr.reason`.
- `status` mirrors `/ready`.
- `assert-ocr` enforces docTR path when requested.

---

## Implementation To‑Do (diff‑sized, minimal)

1) Engine selection fix (no flip on arm64) — `cv_parser_service/main.py`

- In `_refresh_ocr_selection()` when `requested=="doctr"` and arm64 ⇒ `selected="doctr"`; record probe outcome, but don’t change selection.
- `/parse-cv` OCR branch uses `selected` and forces `env_engine="doctr"` when selected is doctr.

2) docTR backend pin — `ocr_pdf.py`

- Add `DOCTR_BACKEND` handling (PT vs TF).
- When `selected_engine=="doctr"`, remove Paddle fallback. Keep `pdfplumber` → (optional) `tesseract`.

3) CLI integrity — `run.sh`

- On `--doctr`: export `CV_OCR_ENGINE=doctr`, `CV_ALLOW_DOCTR_ON_ARM=1`, `PREWARM=1`, and (arm64) `DOCTR_BACKEND=tensorflow`. Do not set Paddle worker vars.
- `status` prints `{engine,selected,available,reason}` from `/ready`.
- `assert-ocr` expects `engine_final==doctr` when doctr requested; otherwise allow `pdfplumber` if docTR failed.

4) Name extraction guardrails — already in place

- Keep the new fallback picker + blocklist (py + ts) as described.

---

## Definition of Done (all green)

- Boot & readiness
  - `./run.sh down && ./run.sh up --doctr && ./run.sh status`
  - Shows `{engine:"doctr", selected:"doctr", available:true|false, reason}`.

- docTR assertion (arm64)
  - `./run.sh assert-ocr fixtures/fixturetest/cv_png.pdf`
  - PASS: `engine_final=doctr` (or `pdfplumber` if docTR failed), `pdf_pages_rendered>=1`, `pdf_text_len>=5`.

- Endpoint smoke
  - `curl -sS -H 'content-type: application/pdf' --data-binary @fixtures/fixturetest/cv_png.pdf 'http://127.0.0.1:8000/parse-cv?mode=ocr' | jq '{name:.result.normalized.contact.name, eng:.result.diagnostics.engine_final}'`
  - `engine_final = doctr`; name is either a good candidate or `null`.

- Bench
  - `./scripts/bench_fixtures.sh && python scripts/review_bench.py`
  - Summary PASS.

- Compile sanity
  - `python -m compileall cv_parser_service/main.py cv_parser/canonicalize.py`
  - No errors.

---

## Notes / choices

- docTR on arm64 backend: If PyTorch SIGILLs, set `DOCTR_BACKEND=tensorflow` in `run.sh` for arm64 dev; docTR works well on TF CPU.
- Paddle on arm64: allowed only when explicitly requested; otherwise never used on arm64.
- Tesseract: keep disabled unless you opt-in (`CV_TESSERACT_FALLBACK=1`).

---

## Commit template

```
cv: lock architecture — arm64=docTR, amd64=Paddle; no silent engine flips

- main.py: selection matrix; arm64 doctr never flips to paddle; /ready surfaces {engine, selected, available, reason}
- ocr_pdf.py: DOCTR_BACKEND support (tf/pt); disable Paddle fallback when doctr selected; keep pdfplumber guard
- run.sh: --doctr exports CV_OCR_ENGINE=doctr, CV_ALLOW_DOCTR_ON_ARM=1, PREWARM=1, (arm64) DOCTR_BACKEND=tensorflow; status/assert-ocr reflect selected engine
- canonicalize.ts/py: retain blocklist + positional name scorer

Tests:
- compileall main.py canonicalize.py OK
- run.sh status shows selected=doctr on arm64
- assert-ocr(cv_png.pdf) passes (pages>=1, text_len>=5)
- bench fixtures all green
```
