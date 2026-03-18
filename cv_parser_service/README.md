# CV Parser Service

FastAPI microservice that wraps `cv_parser.pipeline.runner` so environments
without a bundled Python interpreter (for example Convex actions) can call the
parser over HTTP.

## Local development

### Manual (virtualenv)
```bash
cd cv_parser_service
python -m venv .venv
source .venv/bin/activate
pip install -r ../requirements.txt
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Docker via Makefile
From the repository root:
```bash
make docker-build
make docker-run
```
This exposes the API on http://localhost:8000 and streams the Uvicorn logs to confirm readiness.
Alternatively run the helper scripts:
```bash
./scripts/start-parser-service.sh    # build + run the parser container with logs
./scripts/start-dev-stack.sh          # build container + start pnpm dev (frontend + Convex)
```

Call the endpoint:

```bash
curl -X POST http://localhost:8000/parse-cv \
  -F "file=@../fixtures/sample_scanned_resume.pdf" \
  -F "mode=ocr"
```

Or send raw text:

```bash
curl -X POST http://localhost:8000/parse-cv \
  -F "raw_text=$(cat ../fixtures/sample_text_resume.txt)" \
  -F "mode=text"
```

## Docker

If you prefer raw Docker commands instead of the Makefile helpers:
```bash
docker build --no-cache -t cv-parser-service -f cv_parser_service/Dockerfile .
docker run --rm -p 8000:8000 cv-parser-service
```

## Response shape

The service responds with:

- `result`: the JSON emitted by `cv_parser.pipeline.runner`.
- `runner`: metadata (stdout, stderr, return code, `fallback_triggered`).
- `source_kind`: `file` or `raw_text` depending on how the input was supplied.

HTTP errors (4xx/5xx) include a JSON body describing the failure so callers can
surface the message in their own logs or UI.

## Readiness & metrics

- `/ready` now returns:

  ```json
  {
    "ok": true,
    "prewarm": false,
    "ocr": { "engine": "paddle", "available": true }
  }
  ```

  `ocr.available` flips to `false` the moment Paddle times out or crashes and
  returns to `true` after the next successful Paddle pass. The endpoint never
  blocks on warmup or OCR execution.

- `/metrics` exposes Prometheus counters: engine mix, Paddle timeouts/crashes,
  fallback reasons, worker respawns, and `cv_parser_ocr_latency_seconds`.

## Node / Convex example

```ts
const form = new FormData();
form.append("mode", "auto");
form.append("file", new File([fileBuffer], uploadedFileName, { type: "application/pdf" }));

const response = await fetch("https://your-service.example.com/parse-cv", {
  method: "POST",
  body: form,
});

if (!response.ok) {
  const err = await response.json();
  throw new Error(`Parser failed: ${err.message ?? response.statusText}`);
}

const payload = await response.json();
console.log(payload.result.diagnostics);
```

## Environment configuration

- `CV_OCR_ENGINE=doctr|paddle|tesseract` — overrides the OCR backend. The
  service defaults to `doctr` on macOS/ARM64 and `paddle` on other platforms;
  set `CV_OCR_ENGINE=paddle` to roll back to Paddle on demand.

Convex actions call the service via `fetch`. Set `CONVEX_PARSER_URL` in your Convex environment (and `.env.local` for local dev) when the service is deployed remotely. During local development the action defaults to `http://localhost:8000/parse-cv`.

Notable environment variables:

- `CV_OCR_ENGINE` — defaults to `doctr` on macOS/ARM64 and `paddle` on other platforms (falls back to Tesseract/pdfplumber only on failure).
- `CV_OCR_PADDLE_TIMEOUT` — timeout (seconds) for the guarded Paddle worker, default `20`.
- `PREWARM=1` — triggers background OCR warmup at startup (`/ready.prewarm=true` while warming). Paddle loads its worker, docTR preloads its predictor weights.



# 1. Build + start dev container (auto health-check)
./scripts/start-dev.sh

# 2. Check service health
curl -s http://127.0.0.1:8000/healthz | jq .
# → { "status": "ok" }

# 3. Smoke test with text payload
curl -s -X POST http://127.0.0.1:8000/parse-cv \
  -F 'raw_text=This is a smoke test' \
  -F 'mode=text' | jq .


# ready
curl -sS $ORIGIN/ready | jq '{ok,ocr}'

# mistral probe
curl -sS -F file=@fixtures/fixturetest/cv_png.pdf $ORIGIN/mistral-ocr/probe | jq '{ok,diag}'

# mistral parse → expected diag fields
curl -sS -F file=@fixtures/fixturetest/cv_png.pdf $ORIGIN/mistral-ocr/parse \
  | jq '.diagnostics | {engine,engine_final,ocr_engine,ocr_chars,pages}'
