# CV Parser

This is a robust CV/resume parsing pipeline that handles both text-based and scanned/image-based PDFs. It uses a hybrid approach: PDF text extraction for native text, PaddleOCR for scanned documents, with fallbacks to ensure no empty results.

## Key Features
- **Auto-Detection**: Detects if PDF is text or image-based using heuristics (font presence, image ratio).
- **Text Extraction**: pdfplumber for native text PDFs.
- **OCR**: PaddleOCR v5 with PP-Structure for layout, supporting tables/charts.
- **Fallbacks**: If OCR crashes (e.g., segfault in Docker), forces pdfplumber text extraction; no empty rawText.
- **Diagnostics**: Logs pages, total_lines, avg_conf, ocr_passes, fallback_used, crashed.
- **Hybrid Parsing**: Post-processes with section mapping for experience, education, skills, etc.

## Installation
```bash
pip install -r requirements.txt
pip install paddlepaddle==3.2.0  # CPU
pip install paddleocr==3.2.0
```

For Docker:
```bash
docker build -f cv_parser_service/Dockerfile -t cv-parser-service .
```

## Usage
### CLI
```bash
python -m cv_parser.pipeline.runner input.pdf --output result.json --mode auto --dpi 300 --engine pdf2image
```

Modes: `auto` (detect), `text` (pdfplumber), `ocr` (PaddleOCR).

### Service
Run: `uvicorn cv_parser_service.main:app --reload --port 8000`

Test:
```bash
curl -X POST http://localhost:8000/parse-cv -F "file=@fixtures/cvpn g.pdf"
```

Response: JSON with normalized (rawText, sections), diagnostics (fallback_used, crashed).

## Docker Troubleshooting
- **Rendering**: Uses pdf2image (poppler-utils) for compatibility; no pypdfium2 segfaults.
- **Crashes**: If PaddleOCR segfaults (SIGSEGV, returncode=-11), service forces text fallback (pdfplumber), logs "[fallback] forcing text after crash". Diagnostics: ocr_crashed=True, fallback_used=True.
- **Test Script**: Run in container:
  1. `docker exec -it cv-parser-service-dev mkdir -p /app/cv_parser/fixtures`
  2. `docker cp fixtures/cvpn g.pdf cv-parser-service-dev:/app/cv_parser/fixtures/cvpng.pdf`
  3. `docker exec -it cv-parser-service-dev python /app/cv_parser/tests/test_ocr_docker.py`
  Expected: Raw length >500, "PASS" or fallback success.
- **Warnings**: spacy/srsly suppressed; ignore if no spacy needed.
- **Build Issues**: Ensure PADDLEOCR_HOME=/home/app/.paddlex in Dockerfile; models cache there.
- **Performance**: OMP_NUM_THREADS=1 in Docker to avoid threading crashes.

## Migration Notes (v0.2+ Robust OCR)
- In-memory rendering with pdf2image (RGB np.arrays, DPI 300/400 retry).
- Fallback on empty/crash: pdfplumber text, confidence=0.5.
- Diagnostics: avg_conf (mean score), total_lines, ocr_passes (1-2), fallback_used, crashed.
- Service logs: "[response] pages=X total_lines=Y avg_conf=Z ocr_passes=W fallback=V engine=U".

For issues, check logs for "crashed" or run test script.

## OCR Instrumentation (CV_OCR_DEBUG)

Set `CV_OCR_DEBUG=1` to enable detailed OCR diagnostics:

- Logs include: engine, dpi, permissive, pass, pages, blocks, chars
- Per-run snapshots under system temp directory, e.g. `/tmp/cv_ocr_dbg_<hash>/pass<id>/`:
  - `pageNNN.png` — rasterized page images for that pass
  - `summary.json` — compact JSON with counts and sample texts

Behavior on empty OCR output:

- The OCR extractor retries with permissive settings and an alternate engine.
- If all OCR retries still produce no text, it raises a descriptive `RuntimeError` including engine/dpi/permissive/pass/pages/blocks so callers (and Convex actions) can surface precise failure reasons.

Example invocation:

```
export CV_OCR_DEBUG=1
python -m cv_parser.pipeline.runner fixtures/sample_scanned_resume.pdf
```
