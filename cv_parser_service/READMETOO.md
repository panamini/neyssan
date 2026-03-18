This service extracts and normalizes CV/resume data from PDF/PNG/TXT files using PaddleOCR + pdfplumber heuristics with optional LLM refinement.
It runs as a FastAPI service inside a multi-stage Docker container with a prebuilt Python venv to minimize rebuild time.

🚀 Quick Start (Dev)
# 1. Build + start dev container (auto health-check)
./scripts/start-dev.sh

# 2. Check service health
curl -s http://127.0.0.1:8000/healthz | jq .

# 3. Smoke test with text payload
curl -s -X POST http://127.0.0.1:8000/parse-cv \
  -F 'raw_text=This is a smoke test' \
  -F 'mode=text' | jq .


✅ Expected:

HTTP 200

normalized contains name, summary, experience, education, skills, languages, achievements, contact

diagnostics.fallback_used=false

🐳 Docker Build Stages
Stage	Purpose	Notes
base	Installs OS libraries, creates /opt/venv	No compilers in runtime
deps	Installs Python deps (using python -m pip)	Includes FastAPI + Uvicorn
runtime	Copies venv + app code, creates non-root user	Fast rebuild: copies venv from deps
Prewarming OCR Models

You can pre-cache PaddleOCR models during build:

docker buildx build --build-arg PREWARM=1 -t cv-parser-service .

🧭 Architecture Diagram
sequenceDiagram
    participant User as Frontend (React/Convex)
    participant Convex as Convex Action
    participant FastAPI as Parser Service (FastAPI)
    participant Python as Python Pipeline (OCR/Heuristics)

    User->>Convex: structuredUpload (PDF/PNG/TXT bytes)
    Convex->>FastAPI: POST /parse-cv (multipart)
    FastAPI->>Python: Run pipeline (pypdfium2 + PaddleOCR)
    Python-->>FastAPI: JSON {layout, sections, diagnostics}
    FastAPI-->>Convex: Normalized payload (always 200, fallback safe)
    Convex-->>User: Canonicalized sections (experience, education, etc.)
    User->>User: Renders in ProfileReviewCard, sortable UI


✅ This diagram shows:

Upload → API → Pipeline → Convex → UI flow

Fallbacks return minimal JSON (no 4xx/5xx) even on timeouts

🔧 Development Tips
Fast Rebuilds

No full rebuild unless you touch:

cv_parser_service/Dockerfile

requirements.txt / requirements.lock

Otherwise ./scripts/start-dev.sh reuses cached deps layer and just copies code.

Force a Clean Build
./scripts/start-dev.sh --rebuild

Verify Deps
docker run --rm cv-parser-service pip list | grep uvicorn
# → uvicorn 0.37.0 (installed inside /opt/venv)

🧪 Testing
Python Tests
pytest -q cv_parser/tests/

Fallback Behavior
pytest -q cv_parser/tests/test_service_fallback.py


Ensures:

Never 4xx/5xx on timeout

Schema always contains name, summary, empty arrays for experience/education/skills/languages/achievements

🏗️ CI/CD (Recommended)

Cache cv-parser-deps stage by digest

Push tagged images after main branch passes tests:

- name: Build & Push Parser Images
  run: |
    docker buildx build \
      --target deps \
      --cache-to=type=registry,ref=ghcr.io/<org>/cv-parser-deps:cache,mode=max \
      --cache-from=type=registry,ref=ghcr.io/<org>/cv-parser-deps:cache \
      -t ghcr.io/<org>/cv-parser-deps:3.2.0 .
    docker buildx build \
      --cache-from=type=registry,ref=ghcr.io/<org>/cv-parser-deps:cache \
      -t ghcr.io/<org>/cv-parser-service:3.2.0 .
    docker push ghcr.io/<org>/cv-parser-service:3.2.0

    🛠️ Troubleshooting
Symptom	Likely Cause	Fix
ModuleNotFoundError: fastapi	venv not copied into runtime	./scripts/start-dev.sh --rebuild
Timeout on big PDFs	55s default timeout	Increase PIPELINE_TIMEOUT_SECONDS (env var)
502 runner_invalid_json	Crash in pipeline	Now returns 200 with diagnostics + empty arrays