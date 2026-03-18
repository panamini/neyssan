# PDF Ingest (FastAPI) - Development README

This service parses PDF CVs into a normalized JSON profile. This folder contains a FastAPI scaffold and development tooling for local development.

Quickstart (local with Docker Compose)
1. From this folder:
   cd pdf-ingest
   docker compose up --build

   Note: Compose references a local `.env` file in this folder. Run the compose command from `pdf-ingest/` so the relative `env_file: - .env` resolves correctly.

2. The FastAPI server will be available at http://localhost:8000

Available endpoints
- POST /api/v1/parse-now : Upload a small PDF and get normalized JSON immediately.
- POST /api/v1/upload : Upload a PDF and get a jobId for background parsing.
- GET /api/v1/jobs/{jobId} : Poll job status/result.
- POST /api/v1/confirm-save : Accepts normalized JSON and persists to Postgres (upsert by email if provided).
- POST /api/v1/llm-refine : Enqueue an LLM refine job for an existing profile: { "profileId": "<uuid>" }.
- GET /api/v1/rq-job/{jobId} : Poll RQ job status/result (used by the frontend).
- GET /api/v1/profiles/{id} : Retrieve a stored profile.

Running tests (locally, outside Docker)
1. Create a Python 3.11 venv and install deps:
   python3.11 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt

2. Run pytest:
   pytest -q

Note: Integration tests that use real Postgres/Redis should be run via Docker Compose. Unit tests that rely on the LLM use mock mode by default and are CI-friendly.

Worker (RQ) notes
- Worker entry & task:
  - `worker.py` contains the `llm_refine_profile(profile_id)` task.
  - `worker_entry.py` launches the RQ worker programmatically (used in the Compose worker service to avoid rq-cli click issues).

- Run a worker locally (requires Redis):
  pip install -r requirements.txt
  rq worker --url redis://redis:6379

Docker & Compose
- `docker-compose.yml` / `docker compose` brings up:
  - web: FastAPI app (port 8000)
  - db: Postgres 15
  - redis: Redis 7
  - worker: RQ worker (runs `worker_entry.py`)

Environment
- The app reads `DATABASE_URL` and `REDIS_URL` environment variables. The compose file sets:
  - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/pdf_ingest
  - REDIS_URL=redis://redis:6379

- LLM-related environment (defaults & keys):
  - LLM_MOCK=true|false       (default true — mock)
  - PDF_INGEST_LLM_PROVIDER   (e.g., "openai", "mistral") — default used by code when not set
  - LLM_THRESHOLD=0.6         (enqueue threshold for auto-refine)
  - OPENAI_API_KEY
  - OPENAI_MODEL (optional)
  - MISTRAL_API_KEY
  - MISTRAL_MODEL (default: mistral-small-latest)
  - MISTRAL_CHAT_URL (default: https://api.mistral.ai/v1/chat/completions)
  - LLM_RETRY_COUNT, LLM_RETRY_BACKOFF, LLM_TIMEOUT_CONNECT, LLM_TIMEOUT_READ (fallback tuning)

Developer workflow
- Start services:
  cd pdf-ingest
  docker compose up --build

- Upload a PDF for quick parse (sync):
  curl -F "file=@cv.pdf" http://localhost:8000/api/v1/parse-now

- Confirm/save a parsed profile (example):
  curl -X POST http://localhost:8000/api/v1/confirm-save -H "Content-Type: application/json" -d @sample_normalized_profile.json

- Retrieve a saved profile:
  curl http://localhost:8000/api/v1/profiles/<id>

LLM refinement (mock vs real) — updated guidance
-----------------------------------------------
This project includes a mock-first LLM refinement pipeline. The code lives in `pdf-ingest/llm.py` and is designed to be robust to multiple provider response shapes.

How it works
1. Parser produces a NormalizedProfile and a confidence score.
2. If confidence < LLM_THRESHOLD (env var, default 0.6), the backend auto-enqueues an LLM refine job when saving the profile.
3. You can explicitly enqueue refine jobs via POST /api/v1/llm-refine with `{ "profileId": "<uuid>" }`.
4. Worker calls `refine_with_llm(raw_text, mock=...)`, validates the returned JSON against the NormalizedProfile Pydantic model, and updates the profiles table with refined fields and `meta.llmRefined` / `meta.llmConfidence`.

Switch to Mistral (real provider)
- Add your Mistral key to `pdf-ingest/.env`:
  PDF_INGEST_LLM_PROVIDER=mistral
  MISTRAL_API_KEY=<your_key>
  MISTRAL_MODEL=mistral-small-latest
  LLM_MOCK=false

- The code currently calls the Mistral chat/completions endpoint (https://api.mistral.ai/v1/chat/completions) and includes fallbacks for other shapes. The LLM client code:
