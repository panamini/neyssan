Docker run instructions — build, run, test, and debug

Quick commands (copy/paste)

1) Build the image
- From repo root:
  cd pdf-ingest
  docker build -t pdf-ingest:py311 -f Dockerfile.python311 .


2) Run the container (detached)
  docker run --rm -d -p 8000:8000 --name pdf_ingest_server pdf-ingest:py311

3) Check container logs (if you want to see startup)
  docker logs -f pdf_ingest_server

4) Verify health endpoint
  curl -i http://127.0.0.1:8000/api/v1/health

5) Parse a PDF (synchronous test)
  curl -i -X POST "http://127.0.0.1:8000/api/v1/parse-now" \
    -H "Content-Type: multipart/form-data" \
    -F "file=@/path/to/resume.pdf"

    ///
    curl -i -X POST "http://127.0.0.1:8000/api/v1/parse-now" \
    -H "Content-Type: multipart/form-data" \
    -F "file=@cv.pdf"

6) Async upload + poll
  curl -i -X POST "http://127.0.0.1:8000/api/v1/upload" -F "file=@cv.pdf"
  # -> {"jobId":"<id>","status":"accepted"}
  curl -i http://127.0.0.1:8000/api/v1/jobs/<id>

  curl -i http://127.0.0.1:8000/api/v1/jobs/cccf9d4c-89db-477e-be58-4ff3323dc637


7) Stop container
  docker stop pdf_ingest_server

How to use the browser test page
- Serve the static page (optional)
  cd pdf-ingest/static
  python3 -m http.server 8001
  Then open http://localhost:8001/test_upload.html in your browser.
- Or open the file directly (file://...) and set "Backend base URL" to http://localhost:8000.

Common errors & fixes

A. "Cannot connect to the Docker daemon" / docker not running
- Ensure Docker Desktop is running on your machine.
- On macOS, open Docker Desktop, wait for it to be "Running".
- Verify: docker info
- If still failing, ensure your user has permission to access Docker (restart Docker Desktop).

B. Build hangs / apt-get errors while building
- If Dockerfile uses apt-get and fails to fetch packages, it is usually a network or mirror issue.
- Solution: use the provided Dockerfile.python311 (which avoids apt-get), or run build with a different network or on your local computer where Docker has proper network access.

C. "Failed to fetch" in browser when calling /api/v1/parse-now
- Browser-side "TypeError: Failed to fetch" usually means:
  - Backend not reachable (container not running), or
  - CORS issue, or
  - The frontend is using HTTPS while backend is HTTP.
- Fix checklist:
  1. Confirm container is running: docker ps | grep pdf_ingest_server
  2. Confirm health: curl -i http://127.0.0.1:8000/api/v1/health
  3. Confirm browser can reach the endpoint: open a new tab to http://localhost:8000/api/v1/health
  4. If it loads from curl but browser still fails, ensure you used http://localhost:8000 in the test page and that CORS is enabled (app has dev CORS enabled by default).
  5. Inspect browser console for network errors (CORS, mixed content, blocked, or DNS).

D. If parsing returns empty JSON / low confidence
- PDF may be scanned (image). The scaffold does not enable OCR by default.
- For scanned PDFs enable OCR by installing pdf2image, pytesseract, Pillow and system tools (poppler, tesseract) or use cloud OCR.
- See README.md for notes.

If you run the commands locally and paste back:
- Full docker build output (the whole stdout/stderr)
- docker run output or docker logs -f pdf_ingest_server
- curl -i health output
If anything fails, paste the outputs here and I will analyze and provide targeted fixes.

Optional: I can also:
- Patch your frontend to point to http://localhost:8000 in dev (set env or add Vite proxy)
- Run a demo parse here if you upload a sample PDF to the repo (I can then call the container's endpoint from within this environment when the container is running here)


LAUCNH THE APP

./run-all.sh --skip-backfill --force

CREATE A LOG to check the app running
 docker compose -f pdf-ingest/docker-compose.yml logs -f web worker > worker.log
