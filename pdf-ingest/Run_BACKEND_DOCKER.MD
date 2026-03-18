How to run the backend with Docker

Go to your pdf-ingest folder:

cd pdf-ingest


Start the backend using Docker Compose:

docker-compose up


This will build and run the FastAPI backend on port 8000.

Make sure your frontend knows the backend URL:

VITE_PDF_INGEST_URL=http://127.0.0.1:8000


Restart the frontend dev server (npm run dev or similar), so it picks up the new env variable.

Now your POST to /api/v1/confirm-save should reach the backend without 404s.


Option A — Docker Compose (recommended if Docker works)

1. From the repo: cd pdf-ingest

2. Try pulling individual images first (helps surface network errors): docker pull redis:7 docker pull postgres:15

3. Bring up the stack: docker compose up --build

   - This builds the web image (uses Dockerfile.python311) and starts web, db, redis.
   - If the command complains about `version` being obsolete, ignore the warning — it’s non-blocking.
   - If pulling postgres or redis fails with a TLS/handshake error, see Troubleshooting below.

4. Verify the FastAPI service: curl [](http://127.0.0.1:8000/api/v1/health)<http://127.0.0.1:8000/api/v1/health> -> {"status":"ok",...}


Option 2 — persistent per-project .env file (recommended):
Create or edit my-app/.env (or my-app/.env.local) and add:
VITE_PDF_INGEST_URL=http://127.0.0.1:8000
Then restart the dev server:
cd my-app
npm run dev

Notes:

- Frontend will POST to {VITE_PDF_INGEST_URL}/api/v1/confirm-save (the modal uses that env var).
- If you set no VITE_PDF_INGEST_URL the modal will POST to relative /api/v1/confirm-save (which fails when front-end server is at :5173 and backend at :8000).
- CORS: the FastAPI app already allows all origins in dev, so browser requests to 127.0.0.1:8000 should succeed.
