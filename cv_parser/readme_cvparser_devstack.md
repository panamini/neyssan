Using CV Parser Dev Stack

Prereqs – macOS or Linux with Docker Desktop ≥ 4, Make ≥ 3.81, Python 3.11+, npm ≥ 10, and curl/jq for quick checks. Log into any private registries your org requires before starting.
Install – run make bootstrap once to create .venv, install Python deps (pip-sync), and fetch Node modules. If you only need the parser container, skip to the next step.
Build Images – make docker-build creates both cv-parser-deps:3.2.0 and cv-parser-service:latest. This step is cached; rebuild with FORCE_REBUILD=true make docker-build after changing Python deps.
Start Parser (Docker) – preferred: USE_LOCAL_PARSER=false RELOAD=0 HTTP_IMPL=h11 PREWARM=0 ./scripts/start-dev.sh --service-only --no-tail-logs. It mounts the repo, launches uvicorn, waits for /ready, then exits leaving the container running (cv-parser-service-dev).
Check Health – curl -s http://127.0.0.1:8000/ready | jq (expect {"ok":true,…}). Text sanity: curl -sS -H 'content-type: application/json' -d '{"mode":"text","text":"Senior Security Guard …"}' http://127.0.0.1:8000/parse-cv | jq '.ok,.summaryFirstSentence'.
OCR Smoke (pdfplumber/docTR) – pdf fallback: curl -sS -H 'content-type: application/pdf' --data-binary @fixtures/fixturetest/cv\ (13).pdf 'http://127.0.0.1:8000/parse-cv?mode=ocr' | jq '.diagnostics'. Neural OCR on arm64: restart with CV_ALLOW_DOCTR_ON_ARM=1 CV_OCR_ENGINE=doctr PREWARM=1 USE_LOCAL_PARSER=false ./scripts/start-dev.sh --service-only --no-tail-logs and re-run the curl; ensure .diagnostics.engine_final=="doctr".
Run Bench Suite – ./scripts/bench_fixtures.sh executes the canonical battery (text + PDF) and writes results to artifacts/bench/<timestamp>/. Review auto-checks via python scripts/review_bench.py; expect [summary] PASS.
Tail Logs – docker logs -f cv-parser-service-dev for the parser; add --tail-logs to start-dev.sh if you want auto-follow in the same terminal.
Stop / Clean – docker rm -f cv-parser-service-dev stops the service container. To remove caches, make clean-docker drops buildx cache + images (rebuild will be slower).
Local uvicorn (optional) – for on-host dev: USE_LOCAL_PARSER=true RELOAD=1 HTTP_IMPL=h11 ./scripts/start-dev.sh --service-only, or directly PYTHONPATH=$(pwd) ./scripts/parser.sh start. Health/smoke commands stay the same.

Common Troubles

curl: (52) Empty reply → ensure RELOAD=0 with Docker; re-run start script.
docTR timeout on arm64 → either opt in (CV_ALLOW_DOCTR_ON_ARM=1) or stick to pdfplumber fallback (default).
Bench failures flagged as summary_weak_or_addressish → re-run python scripts/review_bench.py to see specifics; confirm summary sentence meets ≥30 chars or verb heuristic.
Reference Commands (cheat-sheet)

# Bootstrap
make bootstrap

# Build runtime
make docker-build

# Start Docker service
USE_LOCAL_PARSER=false RELOAD=0 \
  HTTP_IMPL=h11 PREWARM=0 \
  ./scripts/start-dev.sh --service-only --no-tail-logs

# Health + text sanity
curl -s http://127.0.0.1:8000/ready | jq
curl -sS -H 'content-type: application/json' \
  -d '{"mode":"text","text":"Senior Security Guard ..."}' \
  http://127.0.0.1:8000/parse-cv | jq '.ok,.summaryFirstSentence'

# OCR smoke (fallback)
curl -sS -H 'content-type: application/pdf' \
  --data-binary @fixtures/fixturetest/cv\ \(13\).pdf \
  'http://127.0.0.1:8000/parse-cv?mode=ocr' | jq '.diagnostics'

# Bench + reviewer
./scripts/bench_fixtures.sh
python scripts/review_bench.py

# Tail logs, then stop
docker logs -f cv-parser-service-dev
docker rm -f cv-parser-service-dev
Use the make targets where possible (make run, make bench, etc.) if your team adds them; commands above map directly to the scripts currently in the repo.