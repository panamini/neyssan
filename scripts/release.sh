#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-cv-parser:test-local}"

docker build -t "${IMAGE}" .

docker rm -f cv-parser >/dev/null 2>&1 || true
docker run -d --rm --name cv-parser -p 8000:8000 --shm-size=1g \
  -e CV_OCR_ENGINE=doctr \
  "${IMAGE}"

for i in $(seq 1 60); do
  curl -sf http://127.0.0.1:8000/ready && break
  sleep 1
done

curl -sf http://127.0.0.1:8000/metrics | egrep 'cv_parser_ocr_engine_total|cv_parser_route_total' || true

./scripts/bench_fixtures.sh
python scripts/review_bench.py

echo "[ok] local release smoke passed"
