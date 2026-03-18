# CV Parser Service

OCR-first microservice that extracts structured CV data via a PaddleOCR pipeline with automatic ARM64 safeguards and a Tesseract fallback. Designed to run inside Docker, expose an HTTP API, and tolerate CPU-only environments where Paddle’s OpenBLAS kernels may crash.

---

## 1. Overview

| Capability | Details |
|------------|---------|
| OCR engines | PaddleOCR (PP-OCRv5 mobile detector/recognizer) with automatic Tesseract fallback on crash |
| Input types | PDFs, raster images (PNG/JPEG); fallback to text-only parsing |
| Platform focus | ARM64 (Apple Silicon, Graviton) with thread caps & shared-memory tuning |
| API surface | FastAPI server (`/parse-cv`) + health check (`/healthz`) |
| Diagnostics | Debug snapshots saved under `/tmp/cv_ocr_dbg_<hash>/passN/summary.json` |

---

## 2. Requirements & Version Pins

| Package | Version | Notes |
|---------|---------|-------|
| `paddlepaddle` | `3.2.0` | Core framework (CPU wheel) |
| `paddleocr` | `3.2.0` | OCR pipeline |
| `paddlex[ocr-core]` | `3.2.0` | Pulls `opencv-contrib-python==4.10.0.84` |
| `pytesseract` | `0.3.13` | Fallback OCR via Tesseract |

Additional runtime packages (auto-installed through requirements):
`opencv-python==4.10.0.84`, FastAPI, pdfplumber, pdfminer.six, transformers, etc.

### System-Level Requirements

- Docker (20.10+ recommended)
- ARM64 Linux base (project targets ARM64 but works on x86_64 too)
- Tesseract binaries (installed inside the image)
- Shared Paddle model cache mount (`~/.paddlex`)

---

## 3. Quick Start (Clean Machine)

### 3.1 Clone the Repository

```bash
git clone https://github.com/your-org/cv_parser_service.git
cd cv_parser_service
3.2 Build the Docker Image
bash

docker build -t cv-parser-service .
This step installs all pinned Python deps (Paddle 3.2.0 stack + Tesseract).

3.3 Run the Container
bash

docker run --rm \
  --name cv-parser-service-dev \
  -p 8000:8000 \
  --shm-size=1g \
  -v ~/.paddlex:/home/app/.paddlex \
  -e OMP_NUM_THREADS=1 \
  -e OPENBLAS_NUM_THREADS=1 \
  -e MKL_NUM_THREADS=1 \
  -e NUMEXPR_NUM_THREADS=1 \
  -e PADDLE_CPU_MATH_LIBRARY_NUM_THREADS=1 \
  -e OPENBLAS_CORETYPE=ARMV8 \
  cv-parser-service \
  uvicorn cv_parser_service.main:app --host 0.0.0.0 --port 8000
Why these flags?

Flag	Reason
--shm-size=1g	PaddleOCR needs large shared memory for PDF rendering & OpenBLAS scratch space.
-v ~/.paddlex:/home/app/.paddlex	Persist model downloads across container restarts.
Thread env vars	Prevent OpenBLAS thread storms and stabilize performance on ARM64.
OPENBLAS_CORETYPE=ARMV8	Ensures optimal kernels for ARM CPUs.
3.4 Confirm Service Up
bash

curl http://127.0.0.1:8000/healthz
Optional smoke test:

bash

curl http://127.0.0.1:8000/healthz?smoke=1
Returns JSON with the OCR engine used and block count (runs a 1-page smoke OCR).

4. Engine Configuration
Variable	Values	Default	Description
CV_OCR_ENGINE	auto, paddle, doctr, tesseract	auto	Engine selector. Auto picks docTR on arm64, Paddle otherwise.
CV_TESSERACT_FALLBACK	0 or 1	0	Opt-in flag for using Tesseract as a last-resort fallback when neural OCR fails.
Paddle-Specific Tunables
Variable	Purpose
CV_OCR_DET_NAME	Override detector (default: PP-OCRv5_mobile_det on CPU).
CV_OCR_REC_NAME	Override recognizer (default: en_PP-OCRv5_mobile_rec on CPU).
CV_OCR_DET_LIMIT_SIDE_LEN	Cap detection input size (e.g., 640) to reduce GEMM pressure.
CV_PARSER_LOW_MEMORY_DPI	Low-DPI retry (default: 96, min 72).
CLI args	--dpi, --rec-batch (recognition batch size).
Tesseract Tunables (Used when engine=tesseract or fallback triggered)
Variable	Default	Description
CV_TESSERACT_OEM	1	OCR Engine Mode (1 = LSTM only).
CV_TESSERACT_PSM	6	Page segmentation mode (3, 4, 6, 11 common).
CV_TESSERACT_LANG	eng	Language codes (e.g., eng+fra).
5. Usage
5.1 Run Isolated OCR (CLI)
bash

CV_OCR_ENGINE=auto \
python scripts/run_ocr_single.py cv_parser/ocr/data/raw_pdfs/cvpng.pdf \
  --dpi 150 \
  --rec-batch 1
Output example:

bash

[ocr-single] OK pages=2 blocks=480 chars=3401 debug_dir=/tmp/cv_ocr_dbg_0bab4f09/pass3
5.2 Run Full Pipeline (CLI)
bash

python -m cv_parser.pipeline.runner cv_parser/ocr/data/raw_pdfs/cvpng.pdf \
  --mode ocr \
  --dpi 150 \
  --engine pypdfium2 \
  --output /tmp/out_ocr.json
Check results:

bash

wc -c /tmp/out_ocr.json
head -40 /tmp/out_ocr.json
5.3 Restart Service & Use Frontend
If using the monorepo scripts:

bash

scripts/start-parser-service.sh    # stops existing container, rebuilds if needed
Upload CVs via the “Structured Upload” UI (frontend points to backend at http://127.0.0.1:8000).

6. How Crash Sentinel Works
Paddle OCR (default) handles detection/recognition.
If the Paddle subprocess exits unexpectedly (segfault, -9, timeout) the service automatically retries with CV_OCR_ENGINE=tesseract.
Fallback results carry diagnostics (fallback_used=true, engine="tesseract").
Debug artifacts saved at /tmp/cv_ocr_dbg_<hash>/passN/summary.json include engine, DPI, block counts.
7. Health & Diagnostics
Endpoint	Description
GET /healthz	Returns { "status": "ok" } (no OCR run).
GET /healthz?smoke=1	Executes a 1-page OCR smoke test, responds with engine + block count.
Debug snapshots	/tmp/cv_ocr_dbg_<hash>/pass1, /pass2, etc., each with summary.json (engine, DPI, blocks, diagnostics).
8. Testing & CI Recommendations
Golden PDF Set

Include samples: text-native, scanned, low-res, multi-language.
Assert JSON output contains non-empty normalized.raw, reasonable ocr_blocks.
Engine Selection Tests

CV_OCR_ENGINE=auto should default to Paddle.
Simulate failure (e.g., mock subprocess exit code) to ensure fallback uses Tesseract.
ARM-only Regression Test

On ARM runners, ensure OCR completes without segfault (skip on x86_64).
Verify adjusted env caps (OMP_NUM_THREADS=1, etc.).
Automated CLI Invocations

scripts/run_ocr_single.py on fixtures (check exit code, log output).
python -m cv_parser.pipeline.runner verifying JSON >10 KB.
Frontend Integration

E2E tests via Structured Upload to ensure backend acceptance of engine=tesseract fallback responses.
9. Troubleshooting
Issue	Fix
Paddle crashes / segfaults	Ensure --shm-size=1g; verify thread caps; clear /home/app/.paddlex/official_models; reduce CV_OCR_DET_LIMIT_SIDE_LEN; lower --dpi.
Model downloads fail	Pre-seed models locally (~/.paddlex/official_models) and mount into container (-v ~/.paddlex:/home/app/.paddlex).
Tesseract output is noisy	Adjust CV_TESSERACT_PSM (try 4, 6, 11); tweak CV_TESSERACT_LANG; unset `CV_TESSERACT_FALLBACK` if you need to disable the fallback temporarily.
Empty results	Check debug summaries under /tmp/cv_ocr_dbg_*; rerun at lower DPI or with CV_OCR_ENGINE=tesseract; verify /healthz?smoke=1.
Docker build fails on OpenCV pins	Ensure requirements list paddlex[ocr-core]==3.2.0 (auto pulls opencv-contrib-python==4.10.0.84). Remove older OpenCV pins.
10. Commit Message Convention
Use descriptive, conventional commits capturing the ARM/Tesseract safeguards. Example:

cpp

feat(ocr): ARM-safe auto engine switch + Tesseract fallback; pin Paddle 3.2.0; stabilize SHM and thread caps
Include bullet points summarizing engine selector, fallback behavior, env tuning, and health checks.

Appendix: Handy Commands
Action	Command
Build image	docker build -t cv-parser-service .
Run dev container	scripts/start-parser-service.sh
Tail logs	docker logs -f cv-parser-service-dev
Exec into container	docker exec -it cv-parser-service-dev bash
Clean debug artifacts	rm -rf /tmp/cv_ocr_dbg_*
View Tesseract summary	cat /tmp/cv_ocr_dbg_<hash>/passN/summary.json
Happy parsing! Copy-paste these steps on a pristine machine to reproduce the full setup without surprises.
